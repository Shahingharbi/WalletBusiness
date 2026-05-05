import { NextResponse, after } from "next/server";
import { isOwnerOrAdmin } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { geocodeAddress } from "@/lib/geocode";

/**
 * Convention pour la location auto-créée à partir de l'adresse commerce.
 * Quand on regéocode (l'adresse a changé), on UPDATE la row existante avec
 * ce nom de marqueur plutôt que d'en créer une nouvelle (sinon doublons à
 * chaque édition d'adresse). Le merchant peut renommer librement les
 * locations qu'il a créées manuellement — on ne les touche pas.
 */
const PRIMARY_LOCATION_NAME = "Adresse principale";

/**
 * Géocode l'adresse du commerce et upsert une location "Adresse principale".
 * Best-effort : silencieux sur erreur, ne casse pas la requête principale.
 *
 * Pourquoi : géo-push (Apple/Google notif lockscreen quand le porteur passe à
 * <100m) nécessite des coordonnées GPS sur le pass. Sans intervention auto,
 * 99% des merchants ne configurent jamais leur location → feature jamais
 * utilisée. Cette fonction fait que dès qu'un merchant remplit son adresse
 * dans /settings, sa première location est créée toute seule.
 */
async function autoUpsertPrimaryLocation(
  businessId: string,
  parts: {
    address?: string | null;
    city?: string | null;
    postal_code?: string | null;
  },
): Promise<void> {
  if (!parts.address && !parts.city) return;
  try {
    const geo = await geocodeAddress(parts);
    if (!geo) return;

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("locations")
      .select("id")
      .eq("business_id", businessId)
      .eq("name", PRIMARY_LOCATION_NAME)
      .maybeSingle();

    const row = {
      business_id: businessId,
      name: PRIMARY_LOCATION_NAME,
      address: (parts.address ?? null) as string | null,
      city: (parts.city ?? null) as string | null,
      postal_code: (parts.postal_code ?? null) as string | null,
      latitude: geo.latitude,
      longitude: geo.longitude,
      is_active: true,
    };

    if (existing) {
      await admin.from("locations").update(row).eq("id", existing.id);
    } else {
      // RLS : on bypass via service role pour éviter les checks owner-side.
      // La gating "Starter = 0 emplacements" du POST /api/locations ne
      // s'applique pas ici : la location auto-créée est offerte à tous, c'est
      // un acquis du produit (sans elle, le geo-push est inutilisable).
      await admin.from("locations").insert(row);
    }
  } catch (err) {
    console.warn("[business] auto-geocode failed:", err);
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("business_id")
      .eq("id", user.id)
      .single();
    if (!profile?.business_id) {
      return NextResponse.json({ error: "Commerce introuvable" }, { status: 404 });
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("id, name, slug, logo_url, category")
      .eq("id", profile.business_id)
      .single();

    return NextResponse.json({ business });
  } catch (err) {
    console.error("GET /api/business error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("business_id, role")
      .eq("id", user.id)
      .single();

    if (!profile?.business_id) {
      return NextResponse.json({ error: "Commerce introuvable" }, { status: 400 });
    }
    if (!isOwnerOrAdmin(profile.role)) {
      return NextResponse.json(
        { error: "Seul le propriétaire peut modifier le commerce" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const update: Record<string, string | null> = {};

    if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();
    if (typeof body.address === "string" || body.address === null) update.address = body.address || null;
    if (typeof body.city === "string" || body.city === null) update.city = body.city || null;
    if (typeof body.postal_code === "string" || body.postal_code === null) update.postal_code = body.postal_code || null;
    if (typeof body.phone === "string" || body.phone === null) update.phone = body.phone || null;
    if (typeof body.category === "string" || body.category === null) update.category = body.category || null;
    if (typeof body.logo_url === "string" || body.logo_url === null) update.logo_url = body.logo_url || null;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });
    }

    const { error } = await supabase
      .from("businesses")
      .update(update)
      .eq("id", profile.business_id);

    if (error) {
      console.error("Business update error:", error);
      return NextResponse.json({ error: "Erreur lors de la mise à jour" }, { status: 500 });
    }

    // Si l'adresse / ville / CP a bougé, on regéocode et on met à jour la
    // location "Adresse principale" en background. `after()` garantit que ça
    // tourne après la réponse sans être tué par Vercel.
    const addressChanged =
      "address" in update || "city" in update || "postal_code" in update;
    if (addressChanged) {
      const businessId = profile.business_id;
      after(async () => {
        // Refetch pour avoir l'état FINAL après l'update (les champs non
        // modifiés dans `update` doivent quand même partir au géocodeur).
        const admin = createAdminClient();
        const { data: fresh } = await admin
          .from("businesses")
          .select("address, city, postal_code")
          .eq("id", businessId)
          .single();
        if (fresh) {
          await autoUpsertPrimaryLocation(businessId, fresh);
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/business error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
