import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { BrandAnalysisError, analyzeBrand } from "@/lib/essai/brand";
import { SafeFetchError } from "@/lib/essai/brand/safe-fetch";
import { ESSAI_FIRST_NAME_MAX, createEssaiCard } from "@/lib/essai/create";
import { essaiJsonError, isEssaiError } from "@/lib/essai/errors";
import { ESSAI_EDIT_COOKIE_MAX_AGE, essaiEditCookieName } from "@/lib/essai/load";
import { ESSAI_MAX_REQUEST_BYTES, ESSAI_UPLOAD_ERROR, readImageFile } from "@/lib/essai/update";
import {
  ESSAI_CARD_TYPES,
  type BrandProfile,
  type EssaiCardType,
  type EssaiCreateResponse,
  type UploadedImage,
} from "@/lib/essai/types";

/**
 * POST /api/essai — « Votre carte de fidélité en 30 secondes ».
 *
 * multipart/form-data (tout est facultatif, mais il faut au moins un lien,
 * un nom ou une image) :
 *   - `url`        site, fiche Google Maps, Instagram / Facebook
 *   - `name`       nom du commerce (prioritaire sur le nom détecté)
 *   - `firstName`  prénom affiché « Bonjour <prénom> » sur la carte de démo
 *   - `cardType`   stamp | cashback | discount | membership (défaut : stamp)
 *   - `logo`       logo déposé (prioritaire sur tout logo détecté)
 *   - `photo`      photo de devanture / de l'intérieur (bande de la carte)
 *   - `screenshot` capture d'écran d'un profil Instagram / Facebook
 *   - `image`      ancien champ unique (capture / photo « auto »)
 *
 * Les images arrivent déjà compressées par le navigateur : aucune limite de
 * poids n'est annoncée ; seule une garde technique silencieuse protège la
 * route (corps > 4,4 Mo → message neutre).
 *
 * Analyse la marque puis crée une VRAIE carte installable dans Apple /
 * Google Wallet → `EssaiCreateResponse`. Pose aussi le cookie httpOnly
 * `essai_k_<token>` (clé d'édition) : seul le créateur pourra la retoucher.
 *
 * Route publique sans compte : rate-limit serré (5 / min / IP), car chaque
 * appel télécharge des pages externes et crée des lignes en base.
 */

export const runtime = "nodejs"; // sharp, dns : pas d'Edge
export const maxDuration = 60; // analyse ~20-45 s max + création de la carte

const URL_MAX = 2048;
const NAME_MAX = 80;

/** Erreurs de récupération du lien → statut HTTP (message déjà en français). */
function safeFetchStatus(err: SafeFetchError): number {
  switch (err.code) {
    case "timeout":
      return 504;
    case "network":
      return 502;
    default:
      return 422;
  }
}

function readText(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
}

function readCardType(form: FormData): EssaiCardType | null {
  const v = readText(form, "cardType");
  return (ESSAI_CARD_TYPES as readonly string[]).includes(v) ? (v as EssaiCardType) : null;
}

export async function POST(request: Request) {
  const limited = await rateLimit(request, {
    key: "essai:create",
    limit: 5,
    windowMs: 60_000,
  });
  if (limited) return limited;

  // Garde technique silencieuse, avant de lire le corps en mémoire.
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > ESSAI_MAX_REQUEST_BYTES) {
    return essaiJsonError(ESSAI_UPLOAD_ERROR, 413);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (
    !contentType.includes("multipart/form-data") &&
    !contentType.includes("application/x-www-form-urlencoded")
  ) {
    return essaiJsonError("Requête invalide. Rechargez la page et réessayez.", 415);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return essaiJsonError("Requête invalide. Rechargez la page et réessayez.", 400);
  }

  const url = readText(form, "url");
  if (url.length > URL_MAX) {
    return essaiJsonError("Ce lien est trop long. Copiez l'adresse de la page d'accueil.", 422);
  }
  const name = readText(form, "name").slice(0, NAME_MAX);
  const firstName = readText(form, "firstName").slice(0, ESSAI_FIRST_NAME_MAX).trim();
  const cardType = readCardType(form);

  // Fichiers : un champ vide ou qui n'est pas une image est ignoré en silence
  // (l'interface proposera simplement d'en ajouter un).
  let images: (UploadedImage | null)[];
  try {
    images = await Promise.all(
      ["logo", "photo", "screenshot", "image"].map((key) => readImageFile(form.get(key)))
    );
  } catch {
    return essaiJsonError(ESSAI_UPLOAD_ERROR, 400);
  }
  const [logoImage, photoImage, screenshotImage, image] = images;
  const totalBytes = images.reduce((sum, img) => sum + (img?.buffer.length ?? 0), 0);
  if (totalBytes > ESSAI_MAX_REQUEST_BYTES) {
    return essaiJsonError(ESSAI_UPLOAD_ERROR, 413);
  }

  if (!url && !name && !logoImage && !photoImage && !screenshotImage && !image) {
    return essaiJsonError(
      "Collez le lien de votre commerce, ou indiquez simplement son nom.",
      400
    );
  }

  let profile: BrandProfile;
  try {
    profile = await analyzeBrand({
      url: url || null,
      name: name || null,
      firstName: firstName || null,
      cardType,
      logoImage,
      photoImage,
      screenshotImage,
      image,
    });
  } catch (err) {
    // Erreurs prévues de l'analyse : message déjà rédigé pour le commerçant.
    if (err instanceof BrandAnalysisError) {
      return essaiJsonError(err.message, err.status);
    }
    if (err instanceof SafeFetchError) {
      return essaiJsonError(err.message, safeFetchStatus(err));
    }
    if (isEssaiError(err)) return essaiJsonError(err.message, err.status);
    console.error("[api/essai] analyse de la marque échouée :", err);
    return essaiJsonError(
      "Nous n'avons pas réussi à préparer votre carte. Réessayez, ou indiquez simplement le nom de votre commerce.",
      500
    );
  }

  try {
    const created = await createEssaiCard(profile);
    const body: EssaiCreateResponse = {
      token: created.token,
      cardId: created.cardId,
      name: created.name,
      category: profile.category,
      colors: created.colors,
      logoUrl: created.logoUrl,
      logoKind: profile.logo.kind,
      source: profile.source,
      aiUsed: profile.aiUsed,
      cardType: created.cardType,
      photoUrl: created.photoUrl,
      suggestions: created.suggestions,
    };
    const res = NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
    // Clé d'édition : seul ce navigateur pourra retoucher la carte (le token,
    // lui, circule : pass installé, lien WhatsApp, QR scanné sur un téléphone).
    res.cookies.set(essaiEditCookieName(created.token), created.editKey, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: ESSAI_EDIT_COOKIE_MAX_AGE,
    });
    return res;
  } catch (err) {
    if (isEssaiError(err)) return essaiJsonError(err.message, err.status);
    console.error("[api/essai] création de la carte échouée :", err);
    return essaiJsonError(
      "Impossible de créer votre carte pour le moment. Réessayez dans un instant.",
      500
    );
  }
}
