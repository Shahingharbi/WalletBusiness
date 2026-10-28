import { NextResponse, after } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { cookies } from "next/headers";
import { essaiEditCookieName, isPlausibleEssaiToken } from "@/lib/essai/load";
import {
  ESSAI_MAX_REQUEST_BYTES,
  ESSAI_UPLOAD_ERROR,
  isEssaiMediaKind,
  readImageFile,
  updateEssaiMedia,
} from "@/lib/essai/update";
import {
  ESSAI_NOT_FOUND_ERROR,
  essaiErrorResponse,
  essaiJsonError,
} from "@/lib/essai/errors";

/**
 * POST /api/essai/[token]/media — remplace le logo ou la photo de la bande.
 *
 * multipart/form-data : `kind` = "logo" | "photo", `file` = l'image (déjà
 * compressée par le navigateur). → `EssaiCardView` (bande versionnée : la
 * nouvelle `bannerUrl` affiche immédiatement la nouvelle photo).
 *
 * Aucune limite de poids annoncée : seule une garde technique silencieuse
 * (corps > 4,4 Mo) renvoie un message neutre.
 *
 * Réservé au créateur : cookie httpOnly `essai_k_<token>` exigé (403 sinon).
 */

export const runtime = "nodejs"; // sharp
export const maxDuration = 30;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const limited = await rateLimit(request, {
    key: "essai:media",
    limit: 12,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const { token } = await params;
  if (!isPlausibleEssaiToken(token)) return essaiJsonError(ESSAI_NOT_FOUND_ERROR, 404);

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > ESSAI_MAX_REQUEST_BYTES) {
    return essaiJsonError(ESSAI_UPLOAD_ERROR, 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return essaiJsonError(ESSAI_UPLOAD_ERROR, 400);
  }

  const kind = form.get("kind");
  if (!isEssaiMediaKind(kind)) {
    return essaiJsonError("Requête invalide. Rechargez la page et réessayez.", 400);
  }

  let image;
  try {
    image = await readImageFile(form.get("file"));
  } catch {
    image = null;
  }
  if (!image || image.buffer.length > ESSAI_MAX_REQUEST_BYTES) {
    return essaiJsonError(ESSAI_UPLOAD_ERROR, 422);
  }

  try {
    const editKey = (await cookies()).get(essaiEditCookieName(token))?.value ?? null;
    const view = await updateEssaiMedia(token, kind, image, {
      schedule: (task) => after(task),
      editKey,
    });
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return essaiErrorResponse(err, "api/essai/media");
  }
}
