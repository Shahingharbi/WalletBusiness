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
  const businessId = profile!.business_id;

  // Fetch en parallèle : cartes, instances, clients, transactions (pour
  // calcul segments RFM), campagnes 30 derniers jours.
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [cardsRes, instancesRes, clientsRes, txRes, campaignsRes] =
    await Promise.all([
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
          "id, client_id, card_id, stamps_collected, rewards_available, last_scanned_at, status, created_at",
        )
        .eq("business_id", businessId)
        .eq("status", "active"),
      supabase
        .from("clients")
        .select("id, first_name, last_name, phone, birthday")
        .eq("business_id", businessId),
      supabase
        .from("transactions")
        .select("created_at, type, card_instance_id")
        .eq("business_id", businessId)
        .eq("type", "stamp_add"),
      supabase
        .from("campaigns")
        .select(
          "id, card_id, message, segment, recipients_count, sent_at, cards(name)",
        )
        .eq("business_id", businessId)
        .gte("sent_at", thirtyDaysAgo)
        .order("sent_at", { ascending: false })
        .limit(10),
    ]);

  const cards = (cardsRes.data ?? []) as CardLite[];
  const instances = (instancesRes.data ?? []) as InstanceLite[];
  const clients = (clientsRes.data ?? []) as ClientLite[];
  const transactions = txRes.data ?? [];
  const recentCampaigns = campaignsRes.data ?? [];

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
              const cardName =
                (c.cards as unknown as { name?: string } | null)?.name ?? "";
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
