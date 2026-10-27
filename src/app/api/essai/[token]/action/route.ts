import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isEssaiActionType, runEssaiAction } from "@/lib/essai/actions";
import { essaiErrorResponse, essaiJsonError } from "@/lib/essai/errors";
import { isPlausibleEssaiToken } from "@/lib/essai/load";

/**
 * POST /api/essai/[token]/action — « Testez-la en direct ».
 *
 * Corps JSON `{ type: "stamp" | "promo" | "review" }` → `EssaiActionResponse`.
 * Public (le token joue le rôle de secret), limité aux cartes du commerce
 * essai par `loadEssai` (404 sinon) et rate-limité : chaque appel déclenche
 * de vraies notifications wallet (Google : 3 notifs / pass / 24 h max).
 */

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const limited = await rateLimit(request, {
    key: "essai:action",
    limit: 15,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const { token } = await params;
  if (!isPlausibleEssaiToken(token)) {
    return essaiJsonError("Cette carte d'essai est introuvable.", 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return essaiJsonError("Requête invalide.", 400);
  }
  const type = (body as { type?: unknown } | null)?.type;
  if (!isEssaiActionType(type)) {
    return essaiJsonError("Action inconnue. Choisissez un tampon, une promo ou un avis.", 422);
  }

  try {
    const result = await runEssaiAction(token, type);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return essaiErrorResponse(err, "api/essai/action");
  }
}
