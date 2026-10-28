import { cache } from "react";
import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import {
  ESSAI_TTL_DAYS,
  buildEssaiCardView,
  canEditEssai,
  essaiEditCookieName,
  loadEssai,
  type LoadedEssai,
} from "@/lib/essai/load";
import { isAppleWalletConfigured } from "@/lib/apple-wallet";
import { isGoogleWalletConfigured } from "@/lib/google-wallet";
import { EssaiResult, type EssaiResultBoot } from "./essai-result";

/**
 * Page résultat d'une carte d'essai : aperçu « réplique Wallet » en
 * vedette, retouches en direct, ajout au téléphone, tests, « je garde ».
 *
 * Server component : la vue initiale (`EssaiCardView`, la même que
 * GET /api/essai/<token>?view=full) est calculée ici pour que la carte
 * apparaisse dès le premier affichage ; le client la relit ensuite et la
 * tient à jour à chaque retouche.
 *
 * Retouches réservées au créateur (`canEdit`) : cookie httpOnly
 * `essai_k_<token>` valide, ou carte ancienne sans clé d'édition. Sans lui
 * (lien partagé, QR scanné depuis un téléphone…) la page reste complète
 * — aperçu, ajout au téléphone, tests, « je garde », WhatsApp, affiche —
 * mais sans panneau de retouches.
 */

type Params = Promise<{ token: string }>;

const HEX_RE = /^#[0-9a-f]{6}$/i;
const PAGE_BG = "#f9f7f0";

// `cache` : generateMetadata et la page partagent UNE lecture par requête.
const getEssai = cache((token: string): Promise<LoadedEssai | null> => loadEssai(token));

function hex(value: unknown): string | null {
  return typeof value === "string" && HEX_RE.test(value.trim()) ? value.trim().toLowerCase() : null;
}

/**
 * URL absolue de cette page, pour le QR code (scanné par le téléphone) et
 * le message WhatsApp. Déduite de l'hôte de la requête (aswallet.fr,
 * domaine Vercel, localhost) ; repli sur NEXT_PUBLIC_APP_URL.
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

/** QR code SVG en data URL ; `null` si la génération échoue. */
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

export const viewport: Viewport = { themeColor: PAGE_BG };

export default async function EssaiResultPage({ params }: { params: Params }) {
  const { token } = await params;
  const essai = await getEssai(token);
  if (!essai) notFound();

  const view = buildEssaiCardView(essai);
  const editKey = (await cookies()).get(essaiEditCookieName(essai.instance.token))?.value;
  const canEdit = canEditEssai(essai.meta, editKey);

  // Pastilles « vos couleurs » : couleurs de la carte + palette mesurée.
  const palette = Array.from(
    new Set(
      [view.colors.background, view.colors.accent, ...essai.meta.palette]
        .map(hex)
        .filter((c): c is string => Boolean(c))
    )
  ).slice(0, 4);

  const pageUrl = await absoluteUrl(`/essai/${encodeURIComponent(view.token)}`);

  const boot: EssaiResultBoot = {
    view,
    palette,
    sourceUrl: essai.meta.source_url,
    active: essai.card.status === "active" && essai.instance.status === "active",
    ttlDays: ESSAI_TTL_DAYS,
    canEdit,
    pageUrl,
    qrDataUrl: await qrDataUrl(pageUrl),
    appleWalletAvailable: isAppleWalletConfigured(),
    googleWalletAvailable: isGoogleWalletConfigured(),
  };

  return <EssaiResult boot={boot} />;
}
