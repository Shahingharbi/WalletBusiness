import Link from "next/link";
import {
  Megaphone,
  AlertCircle,
  Gift,
  Zap,
  Send,
  Cake,
  Users as UsersIcon,
  ChevronRight,
  Clock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { computeRfmSegmentFromVisits, SEGMENT_LABELS, type RfmSegment } from "@/lib/rfm";
import { formatRelative } from "@/lib/utils";
import { MarketingBroadcast } from "./marketing-broadcast";

interface CardLite {
  id: string;
  name: string;
  status: string;
  stamp_count: number;
  reward_text: string;
  card_type: string | null;
  auto_push_settings: {
    inactive_30d?: { enabled?: boolean };
    near_reward_80?: { enabled?: boolean };
    birthday?: { enabled?: boolean };
  } | null;
}

interface InstanceLite {
  id: string;
  client_id: string;
  card_id: string;
  stamps_collected: number;
  rewards_available: number;
  last_scanned_at: string | null;
  status: string;
  created_at: string;
  total_stamps_ever?: number;
}

interface ClientLite {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  birthday: string | null;
}

export default async function MarketingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("business_id")
    .eq("id", user!.id)
    .single();
  if (!profile?.business_id) {
    // Pas de business associé → render skeleton vide plutôt que de crasher.
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>Aucun commerce associé à votre compte.</p>
      </div>
    );
  }
  const businessId = profile.business_id;

  // Fetch en parallèle. Toutes les queries sont défensives — un fail
  // n'empêche pas le reste de charger. Limits explicites partout pour
  // éviter les timeouts sur les comptes volumineux.
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const ninetyDaysAgo = new Date(
    Date.now() - 90 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [cardsRes, instancesRes, clientsRes, txRes, campaignsRes] =
    await Promise.allSettled([
      supabase
        .from("cards")
        .select(
          "id, name, status, stamp_count, reward_text, card_type, auto_push_settings",
        )
        .eq("business_id", businessId)
        .order("created_at", { ascending: false }),
      supabase
        .from("card_instances")
        .select(
          "id, client_id, card_id, stamps_collected, rewards_available, last_scanned_at, status, created_at, total_stamps_ever",
        )
        .eq("business_id", businessId)
        .eq("status", "active")
        .limit(2000),
      supabase
        .from("clients")
        .select("id, first_name, last_name, phone, birthday")
        .eq("business_id", businessId)
        .limit(2000),
      // Transactions : limit aux 90 derniers jours (suffisant pour
      // segmentation RFM qui ne regarde que la fenêtre 90j). Avant: pas
      // de limit, plantage possible sur businesses très volumineux.
      supabase
        .from("transactions")
        .select("created_at, type, card_instance_id")
        .eq("business_id", businessId)
        .eq("type", "stamp_add")
        .gte("created_at", ninetyDaysAgo)
        .limit(20000),
      // Campaigns : fetch sans join, on remonte cardName via la map des
      // cartes déjà chargée. Évite les soucis de FK relationships côté
      // PostgREST qui peuvent renvoyer 500 si l'inférence rate.
      supabase
        .from("campaigns")
        .select("id, card_id, message, segment, recipients_count, sent_at")
        .eq("business_id", businessId)
        .gte("sent_at", thirtyDaysAgo)
        .order("sent_at", { ascending: false })
        .limit(10),
    ]);

  const unwrap = <T,>(r: PromiseSettledResult<{ data?: T[] | null }>): T[] =>
    r.status === "fulfilled" ? (r.value.data ?? []) : [];

  const cards = unwrap<CardLite>(cardsRes);
  const instances = unwrap<InstanceLite>(instancesRes);
  const clients = unwrap<ClientLite>(clientsRes);
  const transactions = unwrap<{
    created_at: string;
    type: string;
    card_instance_id: string;
  }>(txRes);
  const recentCampaigns = unwrap<{
    id: string;
    card_id: string;
    message: string;
    segment: string;
    recipients_count: number;
    sent_at: string;
  }>(campaignsRes);

  const activeCards = cards.filter((c) => c.status === "active");

  // ─── Calcul segments RFM par client ───────────────────────────────
  const visitsByClient = new Map<string, { created_at: string; type: string }[]>();
  // Lien tx → client via card_instance_id (le client_id n'est pas dans
  // transactions). On fait d'abord une map instance → client.
  const clientByInstance = new Map(instances.map((i) => [i.id, i.client_id]));
  for (const tx of transactions) {
    const ci = tx.card_instance_id as string | null;
    if (!ci) continue;
    const cid = clientByInstance.get(ci);
    if (!cid) continue;
    if (!visitsByClient.has(cid)) visitsByClient.set(cid, []);
    visitsByClient.get(cid)!.push({
      created_at: tx.created_at as string,
      type: tx.type as string,
    });
  }

  const segmentCounts: Record<RfmSegment, number> = {
    champion: 0,
    loyal: 0,
    at_risk: 0,
    lost: 0,
    new: 0,
  };
  for (const c of clients) {
    const seg = computeRfmSegmentFromVisits(visitsByClient.get(c.id) ?? []);
    segmentCounts[seg.segment]++;
  }

  // ─── Compteurs d'action ────────────────────────────────────────────
  const toReengage = segmentCounts.at_risk + segmentCounts.lost;

  // Anniversaires : ce mois-ci ET aujourd'hui
  const today = new Date();
  const todayMonthDay = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate(),
  ).padStart(2, "0")}`;
  const thisMonth = String(today.getMonth() + 1).padStart(2, "0");
  let birthdaysToday = 0;
  let birthdaysThisMonth = 0;
  for (const c of clients) {
    if (!c.birthday) continue;
    const md = c.birthday.slice(5); // "MM-DD"
    if (md === todayMonthDay) birthdaysToday++;
    if (md.slice(0, 2) === thisMonth) birthdaysThisMonth++;
  }

  // Près de la récompense : stamps >= 80% mais pas encore débloqué
  let nearReward = 0;
  const cardById = new Map(cards.map((c) => [c.id, c]));
  for (const inst of instances) {
    const card = cardById.get(inst.card_id);
    if (!card || card.stamp_count < 1) continue;
    const ratio = inst.stamps_collected / card.stamp_count;
    if (ratio >= 0.8 && inst.stamps_collected < card.stamp_count) nearReward++;
  }

  const campaignsLast30d = recentCampaigns.length;

  // ─── KPIs engagement CLIENT ────────────────────────────────────────
  // Pour mesurer la valeur du programme fidélité — ce que le merchant
  // doit voir pour évaluer l'efficacité de sa carte (vs son intuition).
  const totalClients = clients.length;
  const totalVisits = transactions.length; // = sum stamp_add transactions

  // Clients récurrents (au moins 2 visites)
  const recurrent = Array.from(visitsByClient.values()).filter(
    (v) => v.length >= 2,
  ).length;
  const recurrenceRate = totalClients > 0 ? recurrent / totalClients : 0;

  // Visites moyennes par client (parmi ceux qui ont au moins 1 visite)
  const clientsWithVisits = visitsByClient.size;
  const avgVisits =
    clientsWithVisits > 0 ? totalVisits / clientsWithVisits : 0;

  // Clients actifs 30j (dernière visite <= 30j)
  const thirtyDaysAgoTs = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let active30dCount = 0;
  for (const visits of visitsByClient.values()) {
    const lastTs = Math.max(
      ...visits.map((v) => new Date(v.created_at).getTime()).filter(Number.isFinite),
    );
    if (lastTs >= thirtyDaysAgoTs) active30dCount++;
  }
  const active30dRate = totalClients > 0 ? active30dCount / totalClients : 0;

  // Taux de complétion carte : instances qui ont déjà rempli au moins
  // une carte complète (total_stamps_ever >= stamp_count). Utilise
  // total_stamps_ever pour capturer même les cycles déjà rachetés.
  let completedAtLeastOnce = 0;
  for (const inst of instances) {
    const card = cardById.get(inst.card_id);
    if (!card || card.stamp_count < 1) continue;
    const total = (inst as InstanceLite & { total_stamps_ever?: number })
      .total_stamps_ever ?? 0;
    if (total >= card.stamp_count) completedAtLeastOnce++;
  }
  const completionRate =
    instances.length > 0 ? completedAtLeastOnce / instances.length : 0;

  const ACTION_CARDS = [
    {
      key: "inactive_30d" as const,
      title: "Clients à relancer",
      count: toReengage,
      countLabel: "clients",
      description:
        toReengage === 0
          ? "Aucun client inactif. Vos commerces tournent bien !"
          : "Inactifs depuis 41 jours ou plus. Une promo flash peut les ramener.",
      icon: AlertCircle,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-700",
      cta: "Envoyer une relance",
      messageTemplate:
        "On vous a manqué ! 🎁 Cette semaine, profitez d'une offre spéciale rien que pour vous.",
    },
    {
      key: "has_reward" as const,
      title: "Récompenses à débloquer",
      count: nearReward,
      countLabel: "clients proches",
      description:
        nearReward === 0
          ? "Aucun client à 80 % d'une récompense pour le moment."
          : "Ces clients sont à 1-2 tampons d'une récompense. Un petit rappel les fera venir.",
      icon: Gift,
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-700",
      cta: "Envoyer un rappel",
      messageTemplate:
        "Plus que quelques tampons et votre récompense est à vous ! On vous attend.",
    },
    {
      key: "birthdays" as const,
      title: "Anniversaires ce mois",
      count: birthdaysThisMonth,
      countLabel: "anniversaires",
      description:
        birthdaysThisMonth === 0
          ? "Aucun anniversaire ce mois — pensez à demander la date de naissance à vos clients."
          : `${birthdaysToday} aujourd'hui. Un message personnalisé fait toujours plaisir.`,
      icon: Cake,
      iconBg: "bg-pink-100",
      iconColor: "text-pink-700",
      cta: "Voir le calendrier",
      messageTemplate: "Joyeux anniversaire ! 🎂 Profitez d'une attention pour fêter ça avec nous.",
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-yellow text-foreground">
              <Megaphone className="h-5 w-5" />
            </span>
            <h1
              className="text-2xl sm:text-3xl text-foreground"
              style={{ fontFamily: "var(--font-ginto-nord)", fontWeight: 500 }}
            >
              Marketing
            </h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-xl">
            Relancez vos clients au bon moment. Auto-pushes, campagnes ciblées
            et notifications wallet — tout au même endroit.
          </p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiBlock
          icon={UsersIcon}
          label="Clients actifs"
          value={clients.length}
          accent="bg-foreground text-white"
        />
        <KpiBlock
          icon={AlertCircle}
          label="À relancer"
          value={toReengage}
          accent="bg-amber-100 text-amber-900"
        />
        <KpiBlock
          icon={Cake}
          label="Anniversaires ce mois"
          value={birthdaysThisMonth}
          accent="bg-pink-100 text-pink-900"
        />
        <KpiBlock
          icon={Send}
          label="Campagnes (30 j)"
          value={campaignsLast30d}
          accent="bg-emerald-100 text-emerald-900"
        />
      </div>

      {/* Actions suggérées */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-5 w-5 text-amber-500" />
          <h2
            className="text-lg font-bold text-foreground"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            Actions suggérées
          </h2>
        </div>

        <MarketingBroadcast
          actions={ACTION_CARDS}
          cards={activeCards.map((c) => ({
            id: c.id,
            name: c.name,
            stamp_count: c.stamp_count,
            reward_text: c.reward_text,
          }))}
        />
      </section>

      {/* Segments overview */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-lg font-bold text-foreground"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            Vos segments clients
          </h2>
          <Link
            href="/clients"
            className="text-xs font-semibold text-foreground/70 hover:text-foreground inline-flex items-center gap-1"
          >
            Voir tous les clients
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {(Object.keys(segmentCounts) as RfmSegment[]).map((seg) => {
            const meta = SEGMENT_LABELS[seg];
            const count = segmentCounts[seg];
            const segColor: Record<RfmSegment, string> = {
              champion: "from-emerald-100 to-emerald-50 border-emerald-200",
              loyal: "from-blue-100 to-blue-50 border-blue-200",
              at_risk: "from-amber-100 to-amber-50 border-amber-200",
              lost: "from-gray-200 to-gray-100 border-gray-300",
              new: "from-purple-100 to-purple-50 border-purple-200",
            };
            return (
              <Link
                key={seg}
                href={`/clients?filter=${seg}`}
                className={`block rounded-2xl border bg-gradient-to-br p-4 hover:shadow-md transition-all ${segColor[seg]}`}
              >
                <div className="text-2xl mb-1">{meta.emoji}</div>
                <p
                  className="text-2xl text-foreground"
                  style={{
                    fontFamily: "var(--font-ginto-nord)",
                    fontWeight: 500,
                  }}
                >
                  {count}
                </p>
                <p className="text-[11px] font-semibold text-foreground/70 uppercase tracking-wide mt-1">
                  {meta.label}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Performance engagement client — KPIs qui mesurent VRAIMENT la
          valeur du programme fidélité. Calculés depuis les transactions
          stamp_add + instances. */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-lg font-bold text-foreground"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            Performance engagement
          </h2>
          <span className="text-xs text-muted-foreground">
            Sur les 90 derniers jours
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <PerformanceCard
            label="Taux de visite récurrente"
            value={`${Math.round(recurrenceRate * 100)}%`}
            sub={`${recurrent} client${recurrent > 1 ? "s" : ""} ≥ 2 visites`}
            target="Objectif : > 40%"
            achieved={recurrenceRate >= 0.4}
          />
          <PerformanceCard
            label="Visites moyennes / client"
            value={avgVisits.toFixed(1)}
            sub={`${totalVisits} visite${totalVisits > 1 ? "s" : ""} total`}
            target="Plus élevé = plus fidèle"
            achieved={avgVisits >= 2}
          />
          <PerformanceCard
            label="Clients actifs 30 j"
            value={`${Math.round(active30dRate * 100)}%`}
            sub={`${active30dCount} actif${active30dCount > 1 ? "s" : ""} ce mois`}
            target="Objectif : > 50%"
            achieved={active30dRate >= 0.5}
          />
          <PerformanceCard
            label="Taux de complétion"
            value={`${Math.round(completionRate * 100)}%`}
            sub={`${completedAtLeastOnce} carte${completedAtLeastOnce > 1 ? "s" : ""} remplie${completedAtLeastOnce > 1 ? "s" : ""}`}
            target="Objectif : > 25%"
            achieved={completionRate >= 0.25}
          />
        </div>
      </section>

      {/* Auto-pushes status par carte */}
      {activeCards.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-lg font-bold text-foreground"
              style={{ fontFamily: "var(--font-maison-neue-extended)" }}
            >
              Auto-pushes
            </h2>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
            {activeCards.map((card) => {
              const s = card.auto_push_settings ?? {};
              const inactiveOn = s.inactive_30d?.enabled !== false;
              const nearOn = s.near_reward_80?.enabled !== false;
              const birthdayOn = s.birthday?.enabled !== false;
              const activeCount =
                (inactiveOn ? 1 : 0) + (nearOn ? 1 : 0) + (birthdayOn ? 1 : 0);
              return (
                <Link
                  key={card.id}
                  href={`/cards/${card.id}/auto-push`}
                  className="flex items-center justify-between gap-4 px-4 sm:px-5 py-4 hover:bg-beige/40 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {card.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {activeCount} / 3 déclencheurs actifs
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={inactiveOn ? "success" : "secondary"}>
                      <Clock className="h-3 w-3 mr-1" />
                      Inactifs
                    </Badge>
                    <Badge variant={nearOn ? "success" : "secondary"}>
                      <Gift className="h-3 w-3 mr-1" />
                      Récompense
                    </Badge>
                    <Badge variant={birthdayOn ? "success" : "secondary"}>
                      <Cake className="h-3 w-3 mr-1" />
                      Anniv.
                    </Badge>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Historique campagnes 30 derniers jours */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-lg font-bold text-foreground"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            Historique des campagnes
          </h2>
          <span className="text-xs text-muted-foreground">
            30 derniers jours
          </span>
        </div>
        {recentCampaigns.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
            <Send className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Aucune campagne envoyée pour le moment.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Lancez votre première relance via une des actions ci-dessus.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
            {recentCampaigns.map((c) => {
              const cardName = cardById.get(c.card_id)?.name ?? "Carte";
              return (
                <div key={c.id} className="px-4 sm:px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground line-clamp-2">
                        {c.message}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                        <span className="font-medium">{cardName}</span>
                        <span>·</span>
                        <span>{c.recipients_count} destinataires</span>
                        <span>·</span>
                        <span>Segment {c.segment}</span>
                      </div>
                    </div>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {formatRelative(c.sent_at as string)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function PerformanceCard({
  label,
  value,
  sub,
  target,
  achieved,
}: {
  label: string;
  value: string;
  sub: string;
  target: string;
  achieved: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        achieved
          ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold leading-tight"
          style={{ fontFamily: "var(--font-maison-neue-extended)" }}
        >
          {label}
        </p>
        {achieved && (
          <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold shrink-0">
            ✓
          </span>
        )}
      </div>
      <p
        className="text-3xl text-foreground leading-none mt-3"
        style={{ fontFamily: "var(--font-ginto-nord)", fontWeight: 500 }}
      >
        {value}
      </p>
      <p className="text-[11px] text-foreground/60 mt-1.5">{sub}</p>
      <p className="text-[10px] text-muted-foreground mt-2 pt-2 border-t border-gray-100">
        {target}
      </p>
    </div>
  );
}

function KpiBlock({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Megaphone;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div>
          <p
            className="text-3xl text-foreground leading-none"
            style={{ fontFamily: "var(--font-ginto-nord)", fontWeight: 500 }}
          >
            {value.toLocaleString("fr-FR")}
          </p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mt-2">
            {label}
          </p>
        </div>
        <span
          className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${accent}`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}
