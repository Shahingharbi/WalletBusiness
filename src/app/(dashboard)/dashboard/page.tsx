import Link from "next/link";
import {
  Users,
  CreditCard,
  ScanLine,
  Gift,
  Stamp as StampIcon,
  ArrowRight,
  BarChart3,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ScansChart } from "@/components/dashboard/scans-chart";
import { RangeFilter } from "@/components/dashboard/range-filter";
import { rangeToDates, type RangeId } from "@/lib/range";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelative } from "@/lib/utils";

interface DashboardPageProps {
  searchParams: Promise<{ range?: string }>;
}

const TX_LABELS: Record<string, string> = {
  stamp_add: "Tampon ajouté",
  reward_earned: "Récompense gagnée",
  reward_redeemed: "Récompense utilisée",
  card_installed: "Carte installée",
  card_expired: "Carte expirée",
  card_revoked: "Carte révoquée",
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = await createClient();
  const { range: rangeParam } = await searchParams;
  const range = ((rangeParam as RangeId) || "30d") as RangeId;
  const { start, end, prevStart, prevEnd, bucketDays } = rangeToDates(range);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_id, first_name")
    .eq("id", user!.id)
    .single();

  const businessId = profile!.business_id;

  const [
    clientsRes,
    activeCardsRes,
    scansPeriod,
    rewardsPeriod,
    scansPrev,
    rewardsPrev,
    clientsPrev,
    activeCardsPrev,
    scansSeries,
    recentTx,
    topCards,
  ] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("business_id", businessId),
    supabase.from("cards").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "active"),
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("type", "stamp_add")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString()),
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("type", "reward_redeemed")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString()),
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("type", "stamp_add")
      .gte("created_at", prevStart.toISOString())
      .lte("created_at", prevEnd.toISOString()),
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("type", "reward_redeemed")
      .gte("created_at", prevStart.toISOString())
      .lte("created_at", prevEnd.toISOString()),
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .lte("created_at", prevEnd.toISOString()),
    supabase
      .from("cards")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "active")
      .lte("created_at", prevEnd.toISOString()),
    supabase
      .from("transactions")
      .select("created_at")
      .eq("business_id", businessId)
      .eq("type", "stamp_add")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString()),
    supabase
      .from("transactions")
      .select("id, type, created_at, card_instance_id, card_instances(card_id, cards(name), clients(first_name, last_name))")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("transactions")
      .select("card_instance_id, card_instances(card_id, cards(id, name))")
      .eq("business_id", businessId)
      .eq("type", "stamp_add")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString()),
  ]);

  const kpis = [
    {
      title: "Clients",
      value: clientsRes.count ?? 0,
      previous: clientsPrev.count ?? undefined,
      icon: Users,
    },
    {
      title: "Cartes actives",
      value: activeCardsRes.count ?? 0,
      previous: activeCardsPrev.count ?? undefined,
      icon: CreditCard,
    },
    {
      title: "Scans (période)",
      value: scansPeriod.count ?? 0,
      previous: scansPrev.count ?? undefined,
      icon: ScanLine,
    },
    {
      title: "Récompenses",
      value: rewardsPeriod.count ?? 0,
      previous: rewardsPrev.count ?? undefined,
      icon: Gift,
    },
  ];

  // Build scans-per-day buckets across the range
  const buckets: { date: string; count: number; label: string }[] = [];
  for (let i = 0; i < bucketDays; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    buckets.push({
      date: d.toISOString().slice(0, 10),
      count: 0,
      label: d.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
      }),
    });
  }
  for (const tx of scansSeries.data ?? []) {
    const day = new Date(tx.created_at).toISOString().slice(0, 10);
    const b = buckets.find((bk) => bk.date === day);
    if (b) b.count++;
  }

  // Aggregate top cards by scan count
  const cardMap = new Map<string, { id: string; name: string; count: number }>();
  for (const tx of topCards.data ?? []) {
    const ci = tx.card_instances as unknown as {
      card_id: string;
      cards: { id: string; name: string };
    } | null;
    if (!ci?.card_id) continue;
    const existing = cardMap.get(ci.card_id);
    if (existing) {
      existing.count++;
    } else {
      cardMap.set(ci.card_id, {
        id: ci.cards?.id ?? ci.card_id,
        name: ci.cards?.name ?? "Carte",
        count: 1,
      });
    }
  }
  const topCardsList = [...cardMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const transactions = recentTx.data ?? [];

  // Empty state : post-onboarding, aucun scan ni client encore.
  const isFreshDashboard =
    (scansPeriod.count ?? 0) === 0 &&
    (clientsRes.count ?? 0) === 0 &&
    transactions.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1
            className="text-2xl sm:text-3xl text-foreground"
            style={{ fontFamily: "var(--font-ginto-nord)", fontWeight: 500 }}
          >
            Tableau de bord
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Bienvenue {profile?.first_name ?? ""} &mdash; voici ce qui se passe sur votre commerce
          </p>
        </div>
        <RangeFilter />
      </div>

      {isFreshDashboard && (
        <Card className="border-beige-dark">
          <CardContent className="py-12 sm:py-16 px-6 text-center">
            <div className="mx-auto h-24 w-24 rounded-full bg-beige flex items-center justify-center mb-6">
              <BarChart3
                className="h-16 w-16 text-foreground/70"
                strokeWidth={1.4}
              />
            </div>
            <h2
              className="text-xl sm:text-2xl text-foreground"
              style={{
                fontFamily: "var(--font-ginto-nord)",
                fontWeight: 500,
              }}
            >
              Vos statistiques arriveront bientôt
            </h2>
            <p
              className="mt-3 text-sm sm:text-base text-foreground/70 max-w-md mx-auto"
              style={{ fontFamily: "var(--font-maison-neue)" }}
            >
              Dès le premier scan d&apos;un tampon, vos KPI s&apos;afficheront en
              temps réel ici.
            </p>
            <div className="mt-6">
              <Link href="/scanner">
                <Button>Aller au scanner</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.title}
            title={kpi.title}
            value={kpi.value}
            previousValue={kpi.previous}
            icon={kpi.icon}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-beige-dark">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="min-w-0">
                <h2
                  className="font-semibold text-foreground"
                  style={{ fontFamily: "var(--font-maison-neue-extended)" }}
                >
                  Scans
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {start.toLocaleDateString("fr-FR")} &mdash;{" "}
                  {end.toLocaleDateString("fr-FR")}
                </p>
              </div>
              <Badge variant="success" className="shrink-0">
                {(scansPeriod.count ?? 0).toLocaleString("fr-FR")} total
              </Badge>
            </div>
            <ScansChart data={buckets} accent="#fbbf24" />
          </CardContent>
        </Card>

        <Card className="border-beige-dark">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-5">
              <h2
                className="font-semibold text-foreground"
                style={{ fontFamily: "var(--font-maison-neue-extended)" }}
              >
                Top cartes
              </h2>
              <Link
                href="/cards"
                className="text-xs font-semibold text-foreground hover:opacity-70 transition-opacity"
              >
                Toutes
              </Link>
            </div>
            {topCardsList.length === 0 ? (
              <div className="text-center py-8">
                <StampIcon className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Pas encore de scans</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topCardsList.map((c, i) => (
                  <Link
                    key={c.id}
                    href={`/cards/${c.id}`}
                    className="flex items-center gap-3 hover:bg-beige rounded-lg p-2 -mx-2 transition-colors"
                  >
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-yellow text-foreground text-xs font-bold">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {c.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.count} scan{c.count > 1 ? "s" : ""}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/50" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-beige-dark">
        <CardContent className="p-4 sm:p-6">
          <h2
            className="font-semibold text-foreground mb-5"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            Activité récente
          </h2>
          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm">
                Aucune activité pour le moment.{" "}
                <Link
                  href="/cards/new"
                  className="text-foreground font-semibold hover:underline"
                >
                  Créez votre première carte !
                </Link>
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {transactions.map((tx) => {
                const ci = tx.card_instances as unknown as {
                  cards: { name: string } | null;
                  clients: { first_name: string | null; last_name: string | null } | null;
                } | null;
                const clientName = ci?.clients
                  ? `${ci.clients.first_name ?? ""} ${ci.clients.last_name ?? ""}`.trim() || "Anonyme"
                  : "Client";
                const cardName = ci?.cards?.name ?? "";
                return (
                  <div key={tx.id} className="flex items-center justify-between py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {clientName}
                        {cardName && (
                          <span className="text-gray-400 font-normal"> &middot; {cardName}</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {TX_LABELS[tx.type] ?? tx.type}
                      </p>
                    </div>
                    <p className="text-xs text-gray-400 shrink-0 ml-3">
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
  );
}
