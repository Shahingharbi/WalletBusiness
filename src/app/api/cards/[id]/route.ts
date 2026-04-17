import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CARD_DESIGN } from "@/lib/constants";

async function getOwnedCard(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifie", status: 401 } as const;

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.business_id) {
    return { error: "Commerce introuvable", status: 400 } as const;
  }
  if (profile.role !== "business_owner") {
    return { error: "Acces refuse", status: 403 } as const;
  }

  const { data: card } = await supabase
    .from("cards")
    .select("id, business_id, status")
    .eq("id", id)
    .single();

  if (!card) return { error: "Carte introuvable", status: 404 } as const;
  if (card.business_id !== profile.business_id) {
    return { error: "Cette carte ne vous appartient pas", status: 403 } as const;
  }

  return { supabase, card } as const;
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
      return NextResponse.json({ error: "Erreur lors de la mise a jour" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/cards/[id] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await getOwnedCard(id);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

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
