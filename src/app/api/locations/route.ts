import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  PLANS,
  effectivePlan,
  isLockedOut,
  type BusinessBillingState,
  type PlanId,
} from "@/lib/billing";

export const runtime = "nodejs";

interface LocationInput {
  name?: string;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  latitude?: number;
  longitude?: number;
  relevant_text?: string | null;
  is_active?: boolean;
}

/**
 * Limites de localisations geo-push par plan. Source de vérité : `PLANS[plan].limits.maxGeoLocations`.
 *  - Starter    : 0 (pas de geo-push)
 *  - Pro        : 3
 *  - Business   : 10
 *  - Enterprise : illimité
 */
const LOCATIONS_LIMIT: Record<PlanId, number> = {
  starter: PLANS.starter.limits.maxGeoLocations,
  pro: PLANS.pro.limits.maxGeoLocations,
  business: PLANS.business.limits.maxGeoLocations,
  enterprise: Number.POSITIVE_INFINITY,
};

function validate(input: LocationInput): string | null {
  if (!input.name || typeof input.name !== "string" || !input.name.trim()) {
    return "Le nom du lieu est requis";
  }
  if (typeof input.latitude !== "number" || !Number.isFinite(input.latitude)) {
    return "Latitude invalide";
  }
  if (typeof input.longitude !== "number" || !Number.isFinite(input.longitude)) {
    return "Longitude invalide";
  }
  if (input.latitude < -90 || input.latitude > 90) {
    return "Latitude doit être entre -90 et 90";
  }
  if (input.longitude < -180 || input.longitude > 180) {
    return "Longitude doit être entre -180 et 180";
  }
  return null;
}

export async function GET() {
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
    return NextResponse.json({ error: "Profil introuvable" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("locations")
    .select(
      "id, name, address, city, postal_code, latitude, longitude, relevant_text, is_active, created_at"
    )
    .eq("business_id", profile.business_id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ locations: data ?? [] });
}

export async function POST(request: Request) {
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
    return NextResponse.json({ error: "Profil introuvable" }, { status: 400 });
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("subscription_status, subscription_plan, trial_ends_at")
    .eq("id", profile.business_id)
    .single();

  if (!business) {
    return NextResponse.json({ error: "Commerce introuvable" }, { status: 404 });
  }

  if (isLockedOut(business as BusinessBillingState)) {
    return NextResponse.json(
      { error: "Votre essai a expiré. Choisissez un plan pour continuer." },
      { status: 402 }
    );
  }

  const plan = effectivePlan(business as BusinessBillingState);
  const limit = LOCATIONS_LIMIT[plan];

  const { count } = await supabase
    .from("locations")
    .select("id", { count: "exact", head: true })
    .eq("business_id", profile.business_id);

  if ((count ?? 0) >= limit) {
    if (limit === 0) {
      return NextResponse.json(
        {
          error: `Le geo-push n'est pas inclus dans le plan ${PLANS[plan].name}. Passez au plan Pro pour activer 3 emplacements.`,
          requiredPlan: "pro" satisfies PlanId,
        },
        { status: 402 }
      );
    }
    const requiredPlan: PlanId = plan === "pro" ? "business" : "enterprise";
    return NextResponse.json(
      {
        error: `Vous avez atteint la limite de ${limit} localisation${
          limit > 1 ? "s" : ""
        } du plan ${PLANS[plan].name}.`,
        requiredPlan,
      },
      { status: 402 }
    );
  }

  let body: LocationInput;
  try {
    body = (await request.json()) as LocationInput;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const err = validate(body);
  if (err) return NextResponse.json({ error: err }, { status: 422 });

  const { data, error } = await supabase
    .from("locations")
    .insert({
      business_id: profile.business_id,
      name: body.name!.trim().slice(0, 120),
      address: body.address?.trim().slice(0, 200) || null,
      city: body.city?.trim().slice(0, 80) || null,
      postal_code: body.postal_code?.trim().slice(0, 20) || null,
      latitude: body.latitude!,
      longitude: body.longitude!,
      relevant_text: body.relevant_text?.trim().slice(0, 200) || null,
      is_active: body.is_active ?? true,
    })
    .select(
      "id, name, address, city, postal_code, latitude, longitude, relevant_text, is_active, created_at"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ location: data });
}
