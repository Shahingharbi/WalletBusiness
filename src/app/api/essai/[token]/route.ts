import { NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";
import {
  buildEssaiCardView,
  buildEssaiSummary,
  essaiEditCookieName,
  isPlausibleEssaiToken,
  loadEssai,
} from "@/lib/essai/load";
import { updateEssaiCard } from "@/lib/essai/update";
import {
  ESSAI_NOT_FOUND_ERROR,
  essaiErrorResponse,
  essaiJsonError,
} from "@/lib/essai/errors";

/**
 * GET /api/essai/[token]
 *   - sans paramètre : résumé public `EssaiSummaryResponse` (utilisé par
 *     /register?essai=<token> : « Votre carte « X » vous attend ») ;
 *   - `?view=full`   : `EssaiCardView`, tout ce qu'il faut pour l'aperçu
 *     « réplique Wallet » (bande versionnée, type, prénom, compteur…).
 * Aucune donnée personnelle hormis le prénom saisi par le prospect lui-même.
 *
 * PATCH /api/essai/[token] (JSON `EssaiUpdateRequest`) → `EssaiCardView`.
 *   Retouches en direct : type, offre, prénom, nom, couleurs. Les wallets
 *   déjà installés sont mis à jour après la réponse (sans notification).
 *   Réservé au créateur : cookie httpOnly `essai_k_<token>` exigé (403 sinon).
 */

export const runtime = "nodejs";
export const maxDuration = 30;

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

    const full = new URL(request.url).searchParams.get("view") === "full";
    const body = full ? buildEssaiCardView(loaded) : buildEssaiSummary(loaded);
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return essaiErrorResponse(err, "api/essai/summary");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  // Retouches en direct (couleurs, prénom…) : généreux mais borné, chaque
  // appel réécrit la carte et pousse les wallets installés.
  const limited = await rateLimit(request, {
    key: "essai:update",
    limit: 40,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const { token } = await params;
  if (!isPlausibleEssaiToken(token)) return essaiJsonError(ESSAI_NOT_FOUND_ERROR, 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return essaiJsonError("Requête invalide. Rechargez la page et réessayez.", 400);
  }

  try {
    const editKey = (await cookies()).get(essaiEditCookieName(token))?.value ?? null;
    const view = await updateEssaiCard(token, body, {
      schedule: (task) => after(task),
      editKey,
    });
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return essaiErrorResponse(err, "api/essai/update");
  }
}
