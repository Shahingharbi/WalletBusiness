import { NextResponse } from "next/server";
import { isOwnerOrAdmin, isSuperAdmin } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_CARD_DESIGN } from "@/lib/constants";

async function getOwnedCard(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié", status: 401 } as const;

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.business_id) {
    return { error: "Commerce introuvable", status: 400 } as const;
  }
  if (!isOwnerOrAdmin(profile.role)) {
    return { error: "Accès refusé", status: 403 } as const;
  }

  const { data: card } = await supabase
    .from("cards")
    .select("id, business_id, status")
    .eq("id", id)
    .single();

  if (!card) return { error: "Carte introuvable", status: 404 } as const;
  // super_admin contourne la check d'appartenance — il peut supprimer
  // n'importe quelle carte test peu importe le business owner.
  if (
    card.business_id !== profile.business_id &&
    !isSuperAdmin(profile.role)
  ) {
    return { error: "Cette carte ne vous appartient pas", status: 403 } as const;
  }

  return { supabase, card, role: profile.role } as const;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await getOwnedCard(id);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const body = await request.json();
    const update: Record<string, unknown> = {};

    if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();
    if (typeof body.stamp_count === "number") update.stamp_count = body.stamp_count;
    if (typeof body.reward_text === "string") update.reward_text = body.reward_text;
    if (body.barcode_type === "qr" || body.barcode_type === "pdf417") {
      update.barcode_type = body.barcode_type;
    }
    if (
      body.expiration_type === "unlimited" ||
      body.expiration_type === "fixed_date" ||
      body.expiration_type === "days_after_install"
    ) {
      update.expiration_type = body.expiration_type;
    }
    if (body.expiration_date !== undefined) update.expiration_date = body.expiration_date || null;
    if (body.expiration_days !== undefined) update.expiration_days = body.expiration_days || null;
    if (body.wallet_business_name !== undefined) {
      // Empty/whitespace -> NULL = fallback to businesses.name in wallet pass.
      update.wallet_business_name =
        typeof body.wallet_business_name === "string" &&
        body.wallet_business_name.trim().length > 0
          ? body.wallet_business_name.trim()
          : null;
    }
    if (body.design && typeof body.design === "object") {
      update.design = { ...DEFAULT_CARD_DESIGN, ...body.design };
    }
    if (body.status === "active" || body.status === "paused" || body.status === "draft" || body.status === "archived") {
      update.status = body.status;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Aucun changement" }, { status: 400 });
    }

    const { error } = await result.supabase
      .from("cards")
      .update(update)
      .eq("id", id);

    if (error) {
      console.error("Card update error:", error);
      return NextResponse.json({ error: "Erreur lors de la mise à jour" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/cards/[id] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * DELETE /api/cards/[id]
 *
 * Comportement par défaut : SOFT-DELETE (status = 'archived'). La carte
 * disparaît du dashboard mais reste en DB pour conservation des données.
 *
 * `?hard=true` : HARD-DELETE physique de la row + cascade sur
 * card_instances → transactions → auto_push_log. Autorisé pour tout
 * business_owner sur SES propres cartes (la check d'appartenance est
 * déjà faite dans getOwnedCard()) ET pour super_admin sur n'importe
 * quelle carte. Utilise le service role pour bypass RLS DELETE qui
 * pourrait être restrictive.
 *
 * UX: Le bouton "Supprimer définitivement" remplace l'archivage quand
 * le merchant a juste fait un test et veut nettoyer sa liste.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const hardDelete = url.searchParams.get("hard") === "true";

    const result = await getOwnedCard(id);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    if (hardDelete) {
      // Tout business_owner peut hard-delete SA propre carte (la check
      // card.business_id === profile.business_id est déjà faite plus haut
      // dans getOwnedCard, sauf pour super_admin qui bypass).
      // Bypass RLS via service role : ON DELETE CASCADE est en place sur
      // card_instances → transactions → auto_push_log, tout part en une
      // seule requête atomique.
      const admin = createAdminClient();
      const { error } = await admin.from("cards").delete().eq("id", id);
      if (error) {
        console.error("[cards] hard-delete failed:", error);
        return NextResponse.json(
          { error: "Erreur lors de la suppression définitive" },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, hard: true });
    }

    // Soft-delete : archivage classique.
    const { error } = await result.supabase
      .from("cards")
      .update({ status: "archived" })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: "Erreur" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/cards/[id] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
