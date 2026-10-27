import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { BrandAnalysisError, analyzeBrand } from "@/lib/essai/brand";
import { SafeFetchError } from "@/lib/essai/brand/safe-fetch";
import { createEssaiCard } from "@/lib/essai/create";
import { essaiJsonError, isEssaiError } from "@/lib/essai/errors";
import type { BrandProfile, EssaiCreateResponse } from "@/lib/essai/types";

/**
 * POST /api/essai — « Votre carte de fidélité en 30 secondes ».
 *
 * multipart/form-data : `url?` (site, Google Maps, Instagram), `name?`
 * (facultatif, prioritaire sur le nom détecté), `image?` (photo d'enseigne,
 * logo ou capture du profil Instagram, ≤ 8 Mo). Au moins `url` ou `image`.
 *
 * Analyse la marque (logo, couleurs, métier…) puis crée une VRAIE carte
 * installable dans Apple / Google Wallet → `EssaiCreateResponse`.
 *
 * Route publique sans compte : rate-limit serré (5 / min / IP), car chaque
 * appel télécharge des pages externes et crée des lignes en base.
 */

export const runtime = "nodejs"; // sharp, dns, @react-pdf : pas d'Edge
export const maxDuration = 60; // analyse ~20 s max + création de la carte

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/** Corps multipart : image + champs texte + enveloppe. */
const MAX_BODY_BYTES = MAX_IMAGE_BYTES + 256 * 1024;
const URL_MAX = 2048;
const NAME_MAX = 80;

/**
 * Type réel de l'image d'après ses premiers octets. Le type déclaré par le
 * navigateur n'est pas fiable (vide sur certains Android, mensonger si
 * l'appel est forgé) : on ne transmet à l'analyse que de vraies images.
 */
function sniffImageType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  const ascii = (start: number, end: number) => buf.toString("latin1", start, end);
  if (ascii(0, 4) === "GIF8") return "image/gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    if (brand === "avif" || brand === "avis") return "image/avif";
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1", "heim", "heis"].includes(brand)) {
      return "image/heic";
    }
  }
  if (ascii(0, 2) === "BM") return "image/bmp";
  if (ascii(0, 4) === "II*\u0000" || ascii(0, 4) === "MM\u0000*") return "image/tiff";
  const head = buf.toString("utf8", 0, Math.min(buf.length, 1024)).trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) {
    return "image/svg+xml";
  }
  return null;
}

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

export async function POST(request: Request) {
  const limited = await rateLimit(request, {
    key: "essai:create",
    limit: 5,
    windowMs: 60_000,
  });
  if (limited) return limited;

  // Refus immédiat d'un corps trop gros, avant de le lire en mémoire.
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    return essaiJsonError("Votre photo est trop lourde (8 Mo maximum).", 413);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (
    !contentType.includes("multipart/form-data") &&
    !contentType.includes("application/x-www-form-urlencoded")
  ) {
    return essaiJsonError("Format de requête non pris en charge.", 415);
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

  let image: { buffer: Buffer; mimeType: string } | null = null;
  const file = form.get("image");
  // Un champ fichier laissé vide arrive comme un File de taille 0 : ignoré.
  if (file && typeof file !== "string" && file.size > 0) {
    if (file.size > MAX_IMAGE_BYTES) {
      return essaiJsonError("Votre photo est trop lourde (8 Mo maximum).", 413);
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const sniffed = sniffImageType(buffer);
    const declared = (file.type || "").toLowerCase();
    if (!sniffed && !declared.startsWith("image/")) {
      return essaiJsonError(
        "Ce fichier n'est pas une image. Envoyez une photo (JPG, PNG, HEIC…).",
        415
      );
    }
    image = { buffer, mimeType: sniffed ?? declared };
  }

  if (!url && !image) {
    return essaiJsonError(
      "Collez le lien de votre commerce ou ajoutez une photo de votre enseigne.",
      400
    );
  }

  let profile: BrandProfile;
  try {
    profile = await analyzeBrand({ url: url || null, image, name: name || null });
  } catch (err) {
    // Erreurs prévues de l'analyse (lien invalide sans photo, photo
    // illisible…) : message déjà rédigé pour le commerçant.
    if (err instanceof BrandAnalysisError) {
      return essaiJsonError(err.message, err.status);
    }
    if (err instanceof SafeFetchError) {
      return essaiJsonError(err.message, safeFetchStatus(err));
    }
    if (isEssaiError(err)) return essaiJsonError(err.message, err.status);
    console.error("[api/essai] analyse de la marque échouée :", err);
    return essaiJsonError(
      "Nous n'avons pas réussi à analyser votre commerce. Réessayez, ou ajoutez une photo de votre enseigne.",
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
      warnings: profile.warnings,
    };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (isEssaiError(err)) return essaiJsonError(err.message, err.status);
    console.error("[api/essai] création de la carte échouée :", err);
    return essaiJsonError(
      "Impossible de créer votre carte pour le moment. Réessayez dans un instant.",
      500
    );
  }
}
