import { cache } from "react";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { ESSAI_TTL_DAYS, loadEssai, type LoadedEssai } from "@/lib/essai/load";
import { isAppleWalletConfigured } from "@/lib/apple-wallet";
import { isGoogleWalletConfigured } from "@/lib/google-wallet";
import { pickContrast } from "@/lib/utils";
import { EssaiResult, type EssaiResultData } from "./essai-result";

/**
 * Page résultat d'une carte d'essai : « ajoutez-la à votre téléphone »,
 * « testez-la en direct », « elle vous plaît ? ».
 *
 * Server component : la carte est chargée via `loadEssai` (qui n'accepte QUE
 * les cartes du commerce essai) puis réduite à un objet sérialisable minimal
 * pour le composant client — rien d'interne (ids, meta complète) ne part
 * dans le HTML.
 */

type Params = Promise<{ token: string }>;

const HEX_RE = /^#[0-9a-f]{6}$/i;
const FALLBACK_BG = "#141414";
const FALLBACK_ACCENT = "#fbbf24";
const PAGE_BG = "#f9f7f0";

// `cache` : generateMetadata, generateViewport et la page partagent UNE seule
// lecture en base par requête.
const getEssai = cache((token: string): Promise<LoadedEssai | null> => loadEssai(token));

function hex(value: unknown): string | null {
  return typeof value === "string" && HEX_RE.test(value.trim())
    ? value.trim().toLowerCase()
    : null;
}

/**
 * URL absolue de cette page, pour le QR code (scanné par le téléphone) et le
 * message WhatsApp. Déduite de l'hôte de la requête pour être juste partout
 * (aswallet.fr, domaine Vercel de secours, localhost en dev) ; repli sur
 * NEXT_PUBLIC_APP_URL si l'en-tête est absent ou douteux.
 */
async function absoluteUrl(path: string): Promise<string> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
  if (/^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) {
    const forwardedProto = h.get("x-forwarded-proto")?.split(",")[0].trim();
    const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
    const proto =
      forwardedProto === "http" || forwardedProto === "https"
        ? forwardedProto
        : isLocal
          ? "http"
          : "https";
    return `${proto}://${host}${path}`;
  }
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://aswallet.fr").replace(/\/$/, "");
  return `${base}${path}`;
}

/**
 * « 2 novembre » — formaté côté serveur, à l'heure de Paris, pour que le
 * texte soit identique au rendu serveur et à l'hydratation.
 */
function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));
}

/** QR code SVG (net à toute taille) en data URL ; `null` si la génération échoue. */
async function qrDataUrl(text: string): Promise<string | null> {
  try {
    const svg = await QRCode.toString(text, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#1a1e22", light: "#ffffff" },
    });
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  } catch (err) {
    console.error("[essai/page] QR code non généré :", err);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { token } = await params;
  const essai = await getEssai(token);
  return {
    title: essai ? `${essai.card.name} — votre carte de fidélité` : "Carte introuvable",
    // Page personnelle d'un prospect : jamais indexée ni suivie.
    robots: { index: false, follow: false },
  };
}

export async function generateViewport({ params }: { params: Params }): Promise<Viewport> {
  const { token } = await params;
  const essai = await getEssai(token);
  // Sur mobile, la barre du navigateur prend la couleur de la carte.
  return { themeColor: (essai && hex(essai.card.design.background_color)) || PAGE_BG };
}

export default async function EssaiResultPage({ params }: { params: Params }) {
  const { token } = await params;
  const essai = await getEssai(token);
  if (!essai) notFound();

  const { card, instance, meta } = essai;
  const design = card.design;

  const background = hex(design.background_color) ?? FALLBACK_BG;
  const accent = hex(design.accent_color) ?? FALLBACK_ACCENT;
  const text = hex(design.text_color) ?? pickContrast(background);
  const stampCount = Math.max(1, Math.floor(card.stamp_count) || 10);
  const logoUrl =
    typeof design.logo_url === "string" && /^https?:\/\//.test(design.logo_url)
      ? design.logo_url
      : null;

  // Pastilles « vos couleurs » : fond + accent + palette mesurée, sans doublon.
  const palette = Array.from(
    new Set(
      [background, accent, ...meta.palette.map(hex)].filter(
        (c): c is string => Boolean(c)
      )
    )
  ).slice(0, 5);

  const pageUrl = await absoluteUrl(`/essai/${encodeURIComponent(instance.token)}`);

  const data: EssaiResultData = {
    token: instance.token,
    name: card.name,
    logoUrl,
    colors: { background, text, accent },
    palette,
    rewardText: card.reward_text,
    labelStamps: design.label_stamps || "Tampons",
    stampCount,
    stamps: Math.min(Math.max(0, instance.stamps_collected), stampCount),
    rewards: Math.max(0, instance.rewards_available),
    warnings: meta.warnings.slice(0, 2),
    claimed: meta.claimed !== null,
    active: card.status === "active" && instance.status === "active",
    expired: essai.expired,
    ttlDays: ESSAI_TTL_DAYS,
    expiresLabel: formatDay(essai.expiresAt),
    pageUrl,
    qrDataUrl: await qrDataUrl(pageUrl),
    appleWalletAvailable: isAppleWalletConfigured(),
    googleWalletAvailable: isGoogleWalletConfigured(),
  };

  return <EssaiResult data={data} />;
}
