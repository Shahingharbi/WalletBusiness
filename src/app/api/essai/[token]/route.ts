import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { loadEssai } from "@/lib/essai/load";
import {
  ESSAI_NOT_FOUND_ERROR,
  essaiErrorResponse,
  essaiJsonError,
} from "@/lib/essai/errors";
import type { EssaiSummaryResponse } from "@/lib/essai/types";

/**
 * GET /api/essai/[token] — résumé public d'une carte d'essai.
 *
 * Utilisé par /register?essai=<token> pour afficher « Votre carte « X » vous
 * attend » (nom, logo, couleurs). Aucune donnée personnelle : uniquement la
 * marque du commerce, déjà publique.
 */

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const limited = await rateLimit(request, {
    key: "essai:summary",
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const { token } = await params;
    const loaded = await loadEssai(token);
    if (!loaded) return essaiJsonError(ESSAI_NOT_FOUND_ERROR, 404);

    const { card, instance, meta } = loaded;
    const body: EssaiSummaryResponse = {
      token: instance.token,
      cardId: card.id,
      name: card.name,
      logoUrl: card.design.logo_url ?? null,
      colors: {
        background: card.design.background_color,
        text: card.design.text_color,
        accent: card.design.accent_color,
      },
      rewardText: card.reward_text,
      claimed: meta.claimed !== null,
    };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return essaiErrorResponse(err, "api/essai/summary");
  }
}
