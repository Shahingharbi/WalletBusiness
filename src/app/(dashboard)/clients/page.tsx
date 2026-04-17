import Link from "next/link";
import { Users, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClientsFilter } from "./clients-filter";
import { formatRelative } from "@/lib/utils";

interface ClientsPageProps {
  searchParams: Promise<{ filter?: string; q?: string }>;
}

type Filter = "all" | "active" | "inactive" | "rewards";

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const supabase = await createClient();
  const { filter: filterParam, q } = await searchParams;
  const filter = ((filterParam as Filter) || "all") as Filter;
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
      "id, first_name, last_name, phone, created_at, card_instances(stamps_collected, rewards_available, last_scanned_at, status)"
    )
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`
    );
  }

  const { data: clientsRaw } = await query;

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
  };

  const clients: ClientRow[] = (clientsRaw ?? []).map((c) => {
    const instances = (c.card_instances ?? []) as Array<{
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
    };
  });

  const filtered = clients.filter((c) => {
    if (filter === "active") return c.status === "active";
    if (filter === "inactive") return c.status === "inactive";
    if (filter === "rewards") return c.rewards > 0;
    return true;
  });

  const counts = {
    all: clients.length,
    active: clients.filter((c) => c.status === "active").length,
    inactive: clients.filter((c) => c.status === "inactive").length,
    rewards: clients.filter((c) => c.rewards > 0).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-1">
            {counts.all} client{counts.all > 1 ? "s" : ""} au total
          </p>
        </div>
      </div>

      <ClientsFilter currentFilter={filter} initialQuery={search} counts={counts} />

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            {clients.length === 0 ? (
              <p className="text-gray-500 text-sm">
                Aucun client pour le moment.
                <br />
                Vos clients apparaitront ici une fois qu&apos;ils auront installe une de vos cartes.
              </p>
            ) : (
              <p className="text-gray-500 text-sm">
                Aucun client ne correspond a vos filtres.
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
                  <th className="px-5 py-3 font-medium">Telephone</th>
                  <th className="px-5 py-3 font-medium">Cartes</th>
                  <th className="px-5 py-3 font-medium">Tampons</th>
                  <th className="px-5 py-3 font-medium">Recompenses</th>
                  <th className="px-5 py-3 font-medium">Dernier scan</th>
                  <th className="px-5 py-3 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((c) => (
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
                      <Badge variant={c.status === "active" ? "success" : "secondary"}>
                        {c.status === "active" ? "Actif" : "Inactif"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
