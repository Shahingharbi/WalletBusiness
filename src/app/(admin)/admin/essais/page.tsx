import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  Camera,
  ExternalLink,
  Globe,
  MapPin,
  Smartphone,
  Sparkles,
  Stamp,
  Star,
  Type,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findEssaiBusinessId } from "@/lib/essai/business";
import { essaiExpiry, parseEssaiMeta } from "@/lib/essai/load";
import { ESSAI_CARD_TYPE_LABELS } from "@/lib/essai/types";
import type { EssaiCategory, EssaiMeta, EssaiSource } from "@/lib/essai/types";

/**
 * /admin/essais — suivi des démos « Votre carte en 30 secondes ».
 *
 * Réservé aux super_admin (404 pour tout autre compte, sans révéler que la
 * page existe). Liste les 200 dernières cartes d'essai : marque détectée,
 * source, tests effectués, installation iPhone, conversion (carte gardée).
 */

export const metadata: Metadata = {
  title: "Essais — Administration",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const LIST_LIMIT = 200;
/** Taille des lots pour les filtres `in (...)` (longueur d'URL PostgREST). */
const IN_CHUNK = 60;

const SOURCE_LABELS: Record<EssaiSource, { label: string; Icon: LucideIcon }> = {
  website: { label: "Site web", Icon: Globe },
  maps: { label: "Google Maps", Icon: MapPin },
  instagram: { label: "Instagram", Icon: Camera },
  photo: { label: "Photo", Icon: Camera },
  name: { label: "Nom", Icon: Type },
};

const CATEGORY_LABELS: Record<EssaiCategory, string> = {
  kebab: "Kebab",
  burger: "Burger",
  tacos: "Tacos",
  chicken: "Poulet",
  pizza: "Pizzeria",
  sushi: "Sushi",
  restaurant: "Restaurant",
  boulangerie: "Boulangerie",
  patisserie: "Pâtisserie",
  cafe: "Café",
  bar: "Bar",
  glacier: "Glacier",
  coiffeur: "Coiffeur",
  barbier: "Barbier",
  beaute: "Beauté",
  onglerie: "Onglerie",
  fleuriste: "Fleuriste",
  epicerie: "Épicerie",
  boucherie: "Boucherie",
  pressing: "Pressing",
  autre: "Autre",
};

interface CardRow {
  id: string;
  name: string;
  reward_text: string;
  stamp_count: number;
  created_at: string;
  design: Record<string, unknown> | null;
  card_instances: { token: string; stamps_collected: number; rewards_available: number }[] | null;
}

interface EssaiRow {
  id: string;
  token: string | null;
  name: string;
  rewardText: string;
  createdAt: string;
  colors: { background: string; accent: string; text: string };
  logoUrl: string | null;
  meta: EssaiMeta;
  stamps: number;
  stampCount: number;
  rewards: number;
  iphoneDevices: number;
  claimedBusinessName: string | null;
  expired: boolean;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function hex(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Lignes + compteurs. Fait hors du rendu (les calculs dépendant de l'heure
 * courante n'ont pas leur place dans le corps d'un composant).
 */
async function loadRows(): Promise<{ rows: EssaiRow[]; total: number; lastWeek: number }> {
  const admin = createAdminClient();
  const essaiBusinessId = await findEssaiBusinessId(admin);
  if (!essaiBusinessId) return { rows: [], total: 0, lastWeek: 0 };

  const [{ data: cards, error }, { count }] = await Promise.all([
    admin
      .from("cards")
      .select(
        "id, name, reward_text, stamp_count, created_at, design, card_instances(token, stamps_collected, rewards_available)"
      )
      .eq("business_id", essaiBusinessId)
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT),
    admin
      .from("cards")
      .select("id", { count: "exact", head: true })
      .eq("business_id", essaiBusinessId),
  ]);
  if (error) throw new Error(`[admin/essais] lecture des cartes : ${error.message}`);

  const parsed = ((cards ?? []) as unknown as CardRow[])
    .map((card) => ({ card, meta: parseEssaiMeta(card.design?.essai) }))
    .filter((x): x is { card: CardRow; meta: EssaiMeta } => x.meta !== null);

  // Installations iPhone = devices enregistrés par iOS pour le serial (= token).
  const tokens = parsed
    .map(({ card }) => card.card_instances?.[0]?.token)
    .filter((t): t is string => Boolean(t));
  const devicesByToken = new Map<string, number>();
  for (const part of chunk(tokens, IN_CHUNK)) {
    const { data } = await admin
      .from("apple_pass_devices")
      .select("serial_number")
      .in("serial_number", part);
    for (const d of data ?? []) {
      const serial = d.serial_number as string;
      devicesByToken.set(serial, (devicesByToken.get(serial) ?? 0) + 1);
    }
  }

  // Nom du commerce qui a gardé la carte.
  const claimedIds = [
    ...new Set(parsed.map(({ meta }) => meta.claimed?.business_id).filter(Boolean)),
  ] as string[];
  const businessNames = new Map<string, string>();
  for (const part of chunk(claimedIds, IN_CHUNK)) {
    const { data } = await admin.from("businesses").select("id, name").in("id", part);
    for (const b of data ?? []) businessNames.set(b.id as string, b.name as string);
  }

  const rows = parsed.map(({ card, meta }): EssaiRow => {
    const instance = card.card_instances?.[0] ?? null;
    const design = card.design ?? {};
    return {
      id: card.id,
      token: instance?.token ?? null,
      name: card.name,
      rewardText: card.reward_text,
      createdAt: card.created_at,
      colors: {
        background: hex(design.background_color, "#141414"),
        accent: hex(design.accent_color, "#fbbf24"),
        text: hex(design.text_color, "#ffffff"),
      },
      logoUrl: typeof design.logo_url === "string" ? design.logo_url : null,
      meta,
      stamps: instance?.stamps_collected ?? 0,
      stampCount: card.stamp_count,
      rewards: instance?.rewards_available ?? 0,
      iphoneDevices: instance ? (devicesByToken.get(instance.token) ?? 0) : 0,
      claimedBusinessName: meta.claimed
        ? (businessNames.get(meta.claimed.business_id) ?? "Commerce supprimé")
        : null,
      expired: essaiExpiry(meta.created_at || card.created_at).expired,
    };
  });

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const lastWeek = rows.filter((r) => new Date(r.createdAt).getTime() >= weekAgo).length;

  return { rows, total: count ?? rows.length, lastWeek };
}

export default async function AdminEssaisPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "super_admin") notFound();

  const { rows, total, lastWeek } = await loadRows();

  const installed = rows.filter((r) => r.iphoneDevices > 0).length;
  const claimed = rows.filter((r) => r.claimedBusinessName !== null).length;
  const tested = rows.filter(
    (r) => r.meta.actions.stamp + r.meta.actions.promo + r.meta.actions.review > 0
  ).length;
  const percent = (n: number) => (rows.length ? `${Math.round((n / rows.length) * 100)} %` : "—");
  const scopeHint = total > rows.length ? `sur les ${rows.length} dernières` : undefined;

  return (
    <main className="min-h-screen bg-beige/40 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Administration
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow">
              <Sparkles className="h-5 w-5 text-foreground" aria-hidden />
            </div>
            <div>
              <h1
                className="text-2xl text-foreground sm:text-3xl"
                style={{ fontFamily: "var(--font-ginto-nord)", fontWeight: 500 }}
              >
                Essais «&nbsp;carte en 30&nbsp;s&nbsp;»
              </h1>
              <p className="text-sm text-muted-foreground">
                Cartes créées depuis /essai : ce qui a été détecté, testé et gardé.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          <Stat label="Essais créés" value={total.toLocaleString("fr-FR")} />
          <Stat label="7 derniers jours" value={lastWeek.toLocaleString("fr-FR")} hint={scopeHint} />
          <Stat label="Testées en direct" value={percent(tested)} hint={`${tested} carte${tested > 1 ? "s" : ""}`} />
          <Stat label="Installées sur iPhone" value={percent(installed)} hint={`${installed} carte${installed > 1 ? "s" : ""}`} />
          <Stat label="Gardées" value={percent(claimed)} hint={`${claimed} compte${claimed > 1 ? "s" : ""}`} />
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-border bg-white p-10 text-center text-sm text-muted-foreground">
            Aucun essai pour le moment. Les cartes créées sur /essai apparaîtront ici.
          </div>
        ) : (
          <>
            {/* Ordinateur : tableau */}
            <div className="hidden overflow-hidden rounded-2xl border border-border bg-white md:block">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Commerce</th>
                      <th className="px-3 py-3 font-medium">Source</th>
                      <th className="px-3 py-3 font-medium">Métier</th>
                      <th className="px-3 py-3 font-medium">Couleurs</th>
                      <th className="px-3 py-3 font-medium">IA</th>
                      <th className="px-3 py-3 font-medium">Tampons</th>
                      <th className="px-3 py-3 font-medium">Tests</th>
                      <th className="px-3 py-3 font-medium">iPhone</th>
                      <th className="px-3 py-3 font-medium">Gardée</th>
                      <th className="px-4 py-3 font-medium">
                        <span className="sr-only">Lien</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b border-border/60 align-middle last:border-b-0">
                        <td className="px-4 py-3">
                          <Brand row={r} />
                        </td>
                        <td className="px-3 py-3">
                          <SourceCell meta={r.meta} />
                        </td>
                        <td className="px-3 py-3 text-foreground">{CATEGORY_LABELS[r.meta.category]}</td>
                        <td className="px-3 py-3">
                          <Swatches colors={r.colors} />
                        </td>
                        <td className="px-3 py-3">
                          <YesNo value={r.meta.ai_used} />
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-foreground">
                          {r.stamps}/{r.stampCount}
                          {r.rewards > 0 && <span className="ml-1 text-emerald-700">+{r.rewards} 🎁</span>}
                        </td>
                        <td className="px-3 py-3">
                          <Actions meta={r.meta} />
                        </td>
                        <td className="px-3 py-3">
                          <Iphone count={r.iphoneDevices} />
                        </td>
                        <td className="px-3 py-3">
                          <Claimed row={r} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <OpenLink token={r.token} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile : cartes empilées */}
            <ul className="space-y-3 md:hidden">
              {rows.map((r) => (
                <li key={r.id} className="rounded-2xl border border-border bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Brand row={r} />
                    <OpenLink token={r.token} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <Field label="Source">
                      <SourceCell meta={r.meta} />
                    </Field>
                    <Field label="Métier">{CATEGORY_LABELS[r.meta.category]}</Field>
                    <Field label="Couleurs">
                      <Swatches colors={r.colors} />
                    </Field>
                    <Field label="IA">
                      <YesNo value={r.meta.ai_used} />
                    </Field>
                    <Field label="Tampons">
                      {r.stamps}/{r.stampCount}
                      {r.rewards > 0 && ` (+${r.rewards} 🎁)`}
                    </Field>
                    <Field label="Tests">
                      <Actions meta={r.meta} />
                    </Field>
                    <Field label="iPhone">
                      <Iphone count={r.iphoneDevices} />
                    </Field>
                    <Field label="Gardée">
                      <Claimed row={r} />
                    </Field>
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className="mt-1 text-2xl font-semibold text-foreground"
        style={{ fontFamily: "var(--font-maison-neue-extended)" }}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-foreground">{children}</dd>
    </div>
  );
}

function Brand({ row }: { row: EssaiRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl"
        style={{ backgroundColor: row.colors.background }}
      >
        {row.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo distant (Supabase), vignette admin
          <img src={row.logoUrl} alt="" className="h-full w-full object-contain p-1" loading="lazy" />
        ) : (
          <span className="text-sm font-bold" style={{ color: row.colors.accent }}>
            {row.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground" title={row.name}>
          {row.name}
        </p>
        <p className="truncate text-xs text-muted-foreground" title={row.rewardText}>
          {row.rewardText}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {formatDate(row.createdAt)}
          {row.meta.logo_kind === "typographic" && " · logo généré"}
          {row.meta.photo_source === "stock" && " · photo du métier"}
          {row.meta.card_type && row.meta.card_type !== "stamp" && (
            <> · {ESSAI_CARD_TYPE_LABELS[row.meta.card_type]}</>
          )}
        </p>
      </div>
    </div>
  );
}

function SourceCell({ meta }: { meta: EssaiMeta }) {
  const { label, Icon } = SOURCE_LABELS[meta.source];
  const host = hostOf(meta.source_url);
  return (
    <div className="min-w-0">
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-800">
        <Icon className="h-3 w-3" aria-hidden />
        {label}
      </span>
      {meta.source_url && host && (
        <a
          href={meta.source_url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="mt-1 flex max-w-[11rem] items-center gap-1 truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
          title={meta.source_url}
        >
          <span className="truncate">{host}</span>
          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
        </a>
      )}
    </div>
  );
}

function Swatches({ colors }: { colors: EssaiRow["colors"] }) {
  const items = [
    { key: "Fond", value: colors.background },
    { key: "Accent", value: colors.accent },
    { key: "Texte", value: colors.text },
  ];
  return (
    <div className="flex items-center gap-1">
      {items.map((c) => (
        <span
          key={c.key}
          className="h-5 w-5 rounded-full border border-black/10"
          style={{ backgroundColor: c.value }}
          title={`${c.key} ${c.value}`}
          aria-label={`${c.key} ${c.value}`}
          role="img"
        />
      ))}
    </div>
  );
}

function YesNo({ value }: { value: boolean }) {
  return value ? (
    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
      Oui
    </span>
  ) : (
    <span className="text-xs text-muted-foreground">Non</span>
  );
}

function Actions({ meta }: { meta: EssaiMeta }) {
  const items: { Icon: LucideIcon; n: number; label: string }[] = [
    { Icon: Stamp, n: meta.actions.stamp, label: "tampons" },
    { Icon: Bell, n: meta.actions.promo, label: "promos" },
    { Icon: Star, n: meta.actions.review, label: "demandes d'avis" },
  ];
  return (
    <div className="flex items-center gap-2.5 text-xs">
      {items.map(({ Icon, n, label }) => (
        <span
          key={label}
          className={`inline-flex items-center gap-0.5 ${n > 0 ? "text-foreground" : "text-gray-300"}`}
          title={`${n} ${label}`}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
          <span className="font-mono">{n}</span>
          <span className="sr-only">{label}</span>
        </span>
      ))}
    </div>
  );
}

function Iphone({ count }: { count: number }) {
  if (count === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-foreground" title={`${count} appareil(s)`}>
      <Smartphone className="h-3.5 w-3.5" aria-hidden />
      {count}
    </span>
  );
}

function Claimed({ row }: { row: EssaiRow }) {
  if (row.claimedBusinessName) {
    return (
      <span
        className="inline-flex max-w-[10rem] truncate rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"
        title={row.claimedBusinessName}
      >
        Oui · {row.claimedBusinessName}
      </span>
    );
  }
  if (row.expired) {
    return <span className="text-xs text-muted-foreground">Non · expirée</span>;
  }
  return <span className="text-xs text-muted-foreground">Non</span>;
}

function OpenLink({ token }: { token: string | null }) {
  if (!token) return null;
  return (
    <a
      href={`/essai/${token}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border px-3 text-xs font-medium text-foreground hover:bg-beige"
    >
      Voir
      <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  );
}
