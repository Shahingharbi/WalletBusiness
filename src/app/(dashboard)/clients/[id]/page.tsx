import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Phone,
  Mail,
  Calendar,
  Stamp as StampIcon,
  Gift,
  History,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatRelative } from "@/lib/utils";
import { BirthdayEditor } from "./birthday-editor";

const TX_LABELS: Record<string, { label: string; color: string }> = {
  stamp_add: { label: "Tampon ajouté", color: "text-emerald-600" },
  reward_earned: { label: "Récompense gagnée", color: "text-amber-600" },
  reward_redeemed: { label: "Récompense utilisée", color: "text-purple-600" },
  card_installed: { label: "Carte installée", color: "text-blue-600" },
  card_expired: { label: "Carte expirée", color: "text-gray-500" },
  card_revoked: { label: "Carte révoquée", color: "text-red-600" },
};

export default async function ClientDetailPage({
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

  const { data: client } = await supabase
    .from("clients")
    .select("id, first_name, last_name, phone, email, notes, birthday, created_at")
    .eq("id", id)
    .eq("business_id", profile.business_id)
    .single();

  if (!client) notFound();

  const { data: instances } = await supabase
    .from("card_instances")
    .select(
      "id, stamps_collected, rewards_available, rewards_redeemed, total_stamps_ever, status, last_scanned_at, installed_at, cards(id, name, stamp_count, card_type, design)"
    )
    .eq("client_id", client.id)
    .eq("business_id", profile.business_id)
    .order("created_at", { ascending: false });

  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, type, value, created_at, card_instance_id, card_instances(card_id, cards(name))")
    .in(
      "card_instance_id",
      (instances ?? []).map((i) => i.id).filter(Boolean)
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const totalStamps = (instances ?? []).reduce(
    (acc, i) => acc + (i.total_stamps_ever ?? 0),
    0
  );
  const totalRewards = (instances ?? []).reduce(
    (acc, i) => acc + (i.rewards_redeemed ?? 0),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/clients"
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {client.first_name || "Anonyme"} {client.last_name ?? ""}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-lg">
                {client.first_name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">
                  {client.first_name || "Anonyme"} {client.last_name ?? ""}
                </p>
                <p className="text-xs text-gray-500">
                  Client depuis {formatDate(client.created_at, "long")}
                </p>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-2.5 text-sm">
              {client.phone && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <a href={`tel:${client.phone}`} className="hover:underline">
                    {client.phone}
                  </a>
                </div>
              )}
              {client.email && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <a href={`mailto:${client.email}`} className="hover:underline truncate">
                    {client.email}
                  </a>
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-700">
                <Calendar className="h-4 w-4 text-gray-400" />
                {formatDate(client.created_at)}
              </div>
              <BirthdayEditor
                clientId={client.id}
                initialBirthday={client.birthday ?? null}
              />
            </div>

            {client.notes && (
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs uppercase tracking-wide text-gray-400 font-medium mb-1">
                  Notes
                </p>
                <p className="text-sm text-gray-700">{client.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-1.5 text-gray-500 text-[11px] sm:text-xs">
                  <StampIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Tampons</span>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
                  {totalStamps}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-1.5 text-gray-500 text-[11px] sm:text-xs">
                  <Gift className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Récompenses</span>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
                  {totalRewards}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-1.5 text-gray-500 text-[11px] sm:text-xs">
                  <History className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Cartes</span>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
                  {(instances ?? []).length}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-6">
              <h2 className="font-semibold text-gray-900 mb-4">
                Cartes installées
              </h2>
              {!instances || instances.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  Aucune carte installée
                </p>
              ) : (
                <div className="space-y-3">
                  {instances.map((inst) => {
                    const card = inst.cards as unknown as {
                      id: string;
                      name: string;
                      stamp_count: number;
                    } | null;
                    return (
                      <Link
                        key={inst.id}
                        href={`/cards/${card?.id}`}
                        className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {card?.name ?? "Carte"}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {inst.stamps_collected} / {card?.stamp_count ?? "?"} tampons
                            {inst.rewards_available > 0 && (
                              <span className="text-amber-600 font-medium">
                                {" \u00b7 "}
                                {inst.rewards_available} récompense{inst.rewards_available > 1 ? "s" : ""}
                              </span>
                            )}
                          </p>
                        </div>
                        <Badge
                          variant={
                            inst.status === "active" ? "success" : "secondary"
                          }
                        >
                          {inst.status}
                        </Badge>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="font-semibold text-gray-900 mb-4">
                Historique des transactions
              </h2>
              {!transactions || transactions.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  Aucune transaction
                </p>
              ) : (
                <div className="space-y-1">
                  {transactions.map((tx) => {
                    const meta = TX_LABELS[tx.type] ?? {
                      label: tx.type,
                      color: "text-gray-700",
                    };
                    const ci = tx.card_instances as unknown as {
                      cards: { name: string } | null;
                    } | null;
                    const cardName = ci?.cards?.name ?? "";
                    return (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0"
                      >
                        <div>
                          <p className={`text-sm font-medium ${meta.color}`}>
                            {meta.label}
                          </p>
                          {cardName && (
                            <p className="text-xs text-gray-500">{cardName}</p>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">
                          {formatRelative(tx.created_at)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
