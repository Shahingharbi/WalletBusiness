import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { luminance, darkenHex } from "@/lib/wallet-colors";
import { pdfSafeText, posterQrDataUrl, renderPosterPdf } from "@/lib/poster";
import { loadEssai, type LoadedEssai } from "@/lib/essai/load";
import {
  ESSAI_NOT_FOUND_ERROR,
  essaiErrorResponse,
  essaiJsonError,
} from "@/lib/essai/errors";

/**
 * GET /api/essai/[token]/poster — affiche comptoir A4 (PDF) de la carte
 * d'essai, aux couleurs du commerce. Même gabarit que l'affiche de
 * l'onboarding (lib/poster.tsx).
 *
 * Cible du QR code :
 *  - carte gardée → page d'installation de la VRAIE carte du commerçant
 *    (/c/<cardId>) : l'affiche est alors directement utilisable en boutique ;
 *  - sinon → la page de la démo (/essai/<token>), d'où l'on ajoute la carte
 *    au téléphone. On évite ainsi que des clients réels s'inscrivent sur la
 *    carte de démo (commerce interne) si l'affiche était imprimée trop tôt.
 */

export const runtime = "nodejs";
export const maxDuration = 30;

/** Fond de l'affiche (#f9f7f0) : la couleur d'accent doit rester lisible dessus. */
const MAX_ACCENT_LUMINANCE = 0.55;

function posterAccent(loaded: LoadedEssai): string {
  const { accent_color: accent, background_color: background } = loaded.card.design;
  for (const candidate of [accent, background]) {
    if (/^#[0-9a-f]{6}$/i.test(candidate ?? "") && luminance(candidate) <= MAX_ACCENT_LUMINANCE) {
      return candidate;
    }
  }
  const darkened = darkenHex(accent, 0.55);
  return luminance(darkened) <= MAX_ACCENT_LUMINANCE ? darkened : "#1a1a1a";
}

function fileSlug(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036F]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "carte"
  );
}

/** URL encodée dans le QR (cf. commentaire en tête de fichier). */
async function qrTarget(loaded: LoadedEssai, appUrl: string): Promise<string> {
  const claimed = loaded.meta.claimed;
  if (claimed) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("cards")
      .select("id")
      .eq("id", claimed.card_id)
      .eq("status", "active")
      .maybeSingle();
    if (data) return `${appUrl}/c/${claimed.card_id}`;
  }
  return `${appUrl}/essai/${loaded.instance.token}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const limited = await rateLimit(request, {
    key: "essai:poster",
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const { token } = await params;
    const loaded = await loadEssai(token);
    if (!loaded) return essaiJsonError(ESSAI_NOT_FOUND_ERROR, 404);

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://aswallet.fr").replace(/\/$/, "");
    const qrDataUrl = await posterQrDataUrl(await qrTarget(loaded, appUrl));

    const name = pdfSafeText(loaded.card.name) || "Votre commerce";
    const buffer = await renderPosterPdf({
      businessName: name,
      cardName: `votre carte ${name}`,
      rewardText: pdfSafeText(loaded.card.reward_text),
      qrDataUrl,
      accentColor: posterAccent(loaded),
      logoUrl: loaded.card.design.logo_url,
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="affiche-${fileSlug(loaded.card.name)}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return essaiErrorResponse(err, "api/essai/poster");
  }
}
