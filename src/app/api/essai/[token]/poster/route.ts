import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { pdfSafeText, renderPosterPdf } from "@/lib/poster";
import { essaiInstallUrl, loadEssai } from "@/lib/essai/load";
import {
  ESSAI_NOT_FOUND_ERROR,
  essaiErrorResponse,
  essaiJsonError,
} from "@/lib/essai/errors";

/**
 * GET /api/essai/[token]/poster — affiche comptoir A4 (PDF) de la carte
 * d'essai, aux couleurs du commerce (fond, texte, accent), avec sa photo et
 * son logo. Même gabarit que l'affiche de l'onboarding (lib/poster.tsx).
 *
 * Cible du QR code : TOUJOURS une page publique d'installation /c/<cardId> :
 *  - carte gardée (et active) → la VRAIE carte du commerçant : l'affiche est
 *    alors directement utilisable en boutique ;
 *  - sinon → la carte d'essai elle-même.
 * Jamais /essai/<token> : ce token désigne la carte client de démo du
 * créateur, il ne doit pas être imprimé ni distribué.
 */

export const runtime = "nodejs";
export const maxDuration = 30;

function fileSlug(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "carte"
  );
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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
    const design = loaded.card.design as Record<string, unknown>;

    const name = pdfSafeText(loaded.card.name) || "Votre commerce";
    const buffer = await renderPosterPdf({
      businessName: name,
      cardName: `votre carte ${name}`,
      rewardText: pdfSafeText(loaded.card.reward_text),
      qrValue: await essaiInstallUrl(loaded, appUrl),
      accentColor: str(design.accent_color) ?? "#1a1a1a",
      backgroundColor: str(design.background_color),
      textColor: str(design.text_color),
      // Logo « typographique » = initiales générées : l'affiche met alors le
      // nom en très grand plutôt que des initiales.
      logoUrl: loaded.meta.logo_kind === "real" ? str(design.logo_url) : null,
      photoUrl: str(design.banner_url),
      appUrl,
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
