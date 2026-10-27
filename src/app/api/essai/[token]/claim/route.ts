import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { claimEssaiCard } from "@/lib/essai/claim";
import { essaiErrorResponse, essaiJsonError } from "@/lib/essai/errors";
import { isPlausibleEssaiToken } from "@/lib/essai/load";

/**
 * POST /api/essai/[token]/claim — « Je garde ma carte ».
 *
 * Réservé à un utilisateur connecté : l'identité vient UNIQUEMENT de la
 * session Supabase (cookie, vérifiée par `auth.getUser()` auprès de
 * Supabase), jamais du corps de la requête. La copie dans son commerce est
 * ensuite faite par `claimEssaiCard` (service role, idempotent).
 */

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const limited = await rateLimit(request, {
    key: "essai:claim",
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const { token } = await params;
  if (!isPlausibleEssaiToken(token)) {
    return essaiJsonError("Cette carte d'essai est introuvable.", 404);
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return essaiJsonError("Connectez-vous pour garder votre carte.", 401);
    }

    const result = await claimEssaiCard({ token, userId: user.id });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return essaiErrorResponse(err, "api/essai/claim");
  }
}
