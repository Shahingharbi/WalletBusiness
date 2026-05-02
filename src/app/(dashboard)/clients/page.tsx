import Link from "next/link";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClientsFilter } from "./clients-filter";
import { formatRelative } from "@/lib/utils";
import {
  computeRfmSegmentFromVisits,
  SEGMENT_LABELS,
  SEGMENT_ORDER,
  type RfmSegment,
} from "@/lib/rfm";

interface ClientsPageProps {
  searchParams: Promise<{ filter?: string; q?: string }>;
}

const STATIC_FILTERS = ["all", "active", "inactive", "rewards"] as const;
type StaticFilter = (typeof STATIC_FILTERS)[number];
type Filter = StaticFilter | RfmSegment;

function isFilter(v: string): v is Filter {
  return (
    (STATIC_FILTERS as readonly string[]).includes(v) ||
    (SEGMENT_ORDER as string[]).includes(v)
  );
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const supabase = await createClient();
  const { filter: filterParam, q } = await searchParams;
  const filter: Filter = filterParam && isFilter(filterParam) ? filterParam : "all";
  const search = (q ?? "").trim();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_id")
    .eq("id", user!.id)
    .single();

  const businessId = profile!.business_id;

  // Pull clients with their last instance + last scan + rewards
  let query = supabase
    .from("clients")
    .select(
      "id, first_name, last_name, phone, created_at, card_instances(id, stamps_collected, rewards_available, last_scanned_at, status)"
    )
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`
    );
  }

  const { data: clientsRaw } = await query;

  // Charge les transactions de type `stamp_add` pour calculer le segment RFM.
  // Une seule query pour tous les clients du business — ensuite groupé en
  // mémoire par client_id (via card_instance.client_id).
  const { data: txnsRaw } = await supabase
    .from("transactions")
    .select("type, created_at, card_instance_id")
    .eq("business_id", businessId)
    .eq("type", "stamp_add")
    .order("created_at", { ascending: false })
    .limit(5000);

  // Map card_instance_id -> client_id pour rattacher les transactions.
  const instanceToClient = new Map<string, string>();
  for (const c of clientsRaw ?? []) {
    const instances = (c.card_instances ?? []) as Array<{ id: string }>;
    for (const i of instances) instanceToClient.set(i.id, c.id);
  }

  // Group visits by client_id.
  const visitsByClient = new Map<string, Array<{ created_at: string; type: string }>>();
  for (const t of txnsRaw ?? []) {
    const cid = instanceToClient.get(t.card_instance_id);
    if (!cid) continue;
    const arr = visitsByClient.get(cid) ?? [];
    arr.push({ created_at: t.created_at, type: t.type });
    visitsByClient.set(cid, arr);
  }

  const now = Date.now();
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

  type ClientRow = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    created_at: string;
    last_scan: string | null;
    total_stamps: number;
    rewards: number;
    cards_count: number;
    status: "active" | "inactive";
    segment: RfmSegment;
    visits_count: number;
  };

  const clients: ClientRow[] = (clientsRaw ?? []).map((c) => {
    const instances = (c.card_instances ?? []) as Array<{
      id: string;
      stamps_collected: number;
      rewards_available: number;
      last_scanned_at: string | null;
      status: string;
    }>;
    const lastScan = instances.reduce<string | null>((acc, i) => {
      if (!i.last_scanned_at) return acc;
      if (!acc) return i.last_scanned_at;
      return new Date(i.last_scanned_at) > new Date(acc) ? i.last_scanned_at : acc;
    }, null);
    const totalStamps = instances.reduce((acc, i) => acc + (i.stamps_collected ?? 0), 0);
    const rewards = instances.reduce((acc, i) => acc + (i.rewards_available ?? 0), 0);
    const isActive = lastScan
      ? now - new Date(lastScan).getTime() <= THIRTY_DAYS
      : false;

    const visits = visitsByClient.get(c.id) ?? [];
    const rfm = computeRfmSegmentFromVisits(visits, now);

    return {
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      phone: c.phone,
      created_at: c.created_at,
      last_scan: lastScan,
      total_stamps: totalStamps,
      rewards,
      cards_count: instances.length,
      status: isActive ? "active" : "inactive",
      segment: rfm.segment,
      visits_count: rfm.visits_count,
    };
  });

  const filtered = clients.filter((c) => {
    if (filter === "active") return c.status === "active";
    if (filter === "inactive") return c.status === "inactive";
    if (filter === "rewards") return c.rewards > 0;
    if ((SEGMENT_ORDER as string[]).includes(filter)) {
      return c.segment === filter;
    }
    return true;
  });

  const counts: Record<string, number> = {
    all: clients.length,
    active: clients.filter((c) => c.status === "active").length,
    inactive: clients.filter((c) => c.status === "inactive").length,
    rewards: clients.filter((c) => c.rewards > 0).length,
  };
  for (const seg of SEGMENT_ORDER) {
    counts[seg] = clients.filter((c) => c.segment === seg).length;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-1">
            {counts.all} client{counts.all > 1 ? "s" : ""} au total
          </p>
        </div>
      </div>

      <ClientsFilter currentFilter={filter} initialQuery={search} counts={counts} />

      {filtered.length === 0 ? (
        <Card className="border-beige-dark">
          <CardContent className="py-14 sm:py-20 px-6 text-center">
            {clients.length === 0 ? (
              <>
                <div className="mx-auto h-24 w-24 rounded-full bg-beige flex items-center justify-center mb-6">
                  <Users className="h-16 w-16 text-foreground/70" strokeWidth={1.4} />
                </div>
                <h2
                  className="text-xl sm:text-2xl text-foreground"
                  style={{ fontFamily: "var(--font-ginto-nord)", fontWeight: 500 }}
                >
                  Aucun client pour le moment
                </h2>
                <p
                  className="mt-3 text-sm sm:text-base text-foreground/70 max-w-md mx-auto"
                  style={{ fontFamily: "var(--font-maison-neue)" }}
                >
                  Vos clients apparaîtront ici dès leur première installation.
                  Partagez le QR code de votre carte pour démarrer.
                </p>
                <div className="mt-6">
                  <Link href="/cards">
                    <Button variant="secondary">Voir mes cartes</Button>
                  </Link>
                </div>
              </>
            ) : (
              <p className="text-gray-500 text-sm">
                Aucun client ne correspond à vos filtres.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/50">
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-5 py-3 font-medium">Client</th>
                  <th className="px-5 py-3 font-medium">Téléphone</th>
                  <th className="px-5 py-3 font-medium">Cartes</th>
                  <th className="px-5 py-3 font-medium">Tampons</th>
                  <th className="px-5 py-3 font-medium">Récompenses</th>
                  <th className="px-5 py-3 font-medium">Dernier scan</th>
                  <th className="px-5 py-3 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((c) => {
                  const segMeta = SEGMENT_LABELS[c.segment];
                  const segVariant: "success" | "secondary" | "warning" | "default" =
                    c.segment === "champion"
                      ? "success"
                      : c.segment === "loyal"
                        ? "default"
                        : c.segment === "at_risk"
                          ? "warning"
                          : "secondary";
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3">
                        <Link href={`/clients/${c.id}`} className="font-medium text-gray-900 hover:text-emerald-600 hover:underline">
                          {c.first_name || "Anonyme"} {c.last_name ?? ""}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-gray-600">{c.phone ?? "-"}</td>
                      <td className="px-5 py-3 text-gray-900">{c.cards_count}</td>
                      <td className="px-5 py-3 text-gray-900">{c.total_stamps}</td>
                      <td className="px-5 py-3">
                        {c.rewards > 0 ? (
                          <span className="text-amber-600 font-semibold">{c.rewards}</span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-500">
                        {c.last_scan ? formatRelative(c.last_scan) : "Jamais"}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={segVariant}>
                          <span className="mr-1">{segMeta.emoji}</span>
                          {segMeta.label.replace(/s$/, "")}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
