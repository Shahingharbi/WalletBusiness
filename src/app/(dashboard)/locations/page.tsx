import Link from "next/link";
import { MapPin, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  PLANS,
  effectivePlan,
  isLockedOut,
  type BusinessBillingState,
  type PlanId,
} from "@/lib/billing";
import { LocationsClient, type LocationRow } from "./locations-client";

const LOCATIONS_LIMIT: Record<PlanId, number> = {
  starter: 1,
  pro: 3,
  business: 10,
};

export default async function LocationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_id")
    .eq("id", user.id)
    .single();

  if (!profile?.business_id) {
    return null;
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("subscription_status, subscription_plan, trial_ends_at")
    .eq("id", profile.business_id)
    .single();

  const billing: BusinessBillingState = (business as BusinessBillingState) ?? {
    subscription_status: null,
    subscription_plan: null,
    trial_ends_at: null,
  };

  if (isLockedOut(billing)) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Card className="border-beige-dark">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-yellow flex items-center justify-center">
              <Lock className="h-6 w-6 text-foreground" />
            </div>
            <h1 className="text-2xl font-semibold">Essai expiré</h1>
            <p className="text-sm text-gray-600">
              Choisissez un plan pour gérer vos points de vente.
            </p>
            <Link href="/settings/billing">
              <Button>Voir les plans</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const plan = effectivePlan(billing);
  const limit = LOCATIONS_LIMIT[plan];

  const { data: locationsRaw } = await supabase
    .from("locations")
    .select(
      "id, name, address, city, postal_code, latitude, longitude, relevant_text, is_active, created_at"
    )
    .eq("business_id", profile.business_id)
    .order("created_at", { ascending: false });

  const locations: LocationRow[] = (locationsRaw ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    address: l.address ?? null,
    city: l.city ?? null,
    postal_code: l.postal_code ?? null,
    latitude: typeof l.latitude === "string" ? Number.parseFloat(l.latitude) : (l.latitude ?? 0),
    longitude:
      typeof l.longitude === "string" ? Number.parseFloat(l.longitude) : (l.longitude ?? 0),
    relevant_text: l.relevant_text ?? null,
    is_active: l.is_active,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Localisations</h1>
          <p className="text-sm text-gray-500 mt-1">
            Vos clients reçoivent une notification wallet quand ils passent à
            moins de 100 m d&apos;un point de vente.
          </p>
        </div>
      </div>

      <Card className="border-emerald-200 bg-emerald-50/40">
        <CardContent className="p-4 flex items-start gap-3">
          <MapPin className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm text-emerald-900">
            <p className="font-semibold">
              Plan {PLANS[plan].name} : {locations.length} / {limit} localisation
              {limit > 1 ? "s" : ""}
            </p>
            <p className="text-emerald-800/80 mt-0.5">
              Les nouveaux pass Apple/Google embarquent automatiquement vos
              localisations actives. Les pass déjà installés sont mis à jour à
              la prochaine synchronisation.
            </p>
          </div>
        </CardContent>
      </Card>

      <LocationsClient
        initialLocations={locations}
        limit={limit}
        plan={plan}
      />
    </div>
  );
}
