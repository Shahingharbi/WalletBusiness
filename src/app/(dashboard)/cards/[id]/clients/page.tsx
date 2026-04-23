import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelative } from "@/lib/utils";

export default async function CardClientsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_id")
    .eq("id", user.id)
    .single();
  if (!profile) notFound();

  const { data: card } = await supabase
    .from("cards")
    .select("id, name, business_id, stamp_count")
    .eq("id", id)
    .eq("business_id", profile.business_id)
    .single();
  if (!card) notFound();

  const { data: instances } = await supabase
    .from("card_instances")
    .select(
      "id, stamps_collected, rewards_available, rewards_redeemed, last_scanned_at, created_at, status, clients(id, first_name, last_name, phone)"
    )
    .eq("card_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/cards/${card.id}`}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500">{card.name}</p>
        </div>
      </div>

      {!instances || instances.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              Aucun client n&apos;a encore installé cette carte.
            </p>
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
                  <th className="px-5 py-3 font-medium">Tampons</th>
                  <th className="px-5 py-3 font-medium">Récompenses</th>
                  <th className="px-5 py-3 font-medium">Dernier scan</th>
                  <th className="px-5 py-3 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {instances.map((inst) => {
                  const client = inst.clients as unknown as {
                    first_name: string | null;
                    last_name: string | null;
                    phone: string | null;
                  } | null;
                  return (
                    <tr key={inst.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3 font-medium text-gray-900">
                        {client?.first_name || "Anonyme"}{" "}
                        {client?.last_name ?? ""}
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        {client?.phone ?? "-"}
                      </td>
                      <td className="px-5 py-3 text-gray-900">
                        {inst.stamps_collected} / {card.stamp_count}
                      </td>
                      <td className="px-5 py-3 text-gray-900">
                        {inst.rewards_available > 0 ? (
                          <span className="text-amber-600 font-semibold">
                            {inst.rewards_available} dispo
                          </span>
                        ) : (
                          <span className="text-gray-400">
                            {inst.rewards_redeemed} utilisée
                            {inst.rewards_redeemed > 1 ? "s" : ""}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-500">
                        {inst.last_scanned_at
                          ? formatRelative(inst.last_scanned_at)
                          : "-"}
                      </td>
                      <td className="px-5 py-3">
                        <Badge
                          variant={
                            inst.status === "active"
                              ? "success"
                              : inst.status === "expired"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {inst.status}
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
