/**
 * Compression SYSTÉMATIQUE des images côté navigateur avant envoi.
 *
 * Pourquoi : Vercel coupe toute requête au-delà de ~4,5 Mo, et une photo de
 * téléphone pèse 3 à 12 Mo. On réduit donc tout sur le téléphone, sans
 * perte utile (le serveur retravaille de toute façon à ~1 600 px) :
 *  - photos / captures → JPEG ≈ 1 600 px, qualité 0,82 ;
 *  - logo → PNG ≤ 1 024 px (transparence conservée), JPEG si la source
 *    n'a pas de transparence possible ;
 *  - le total d'un envoi reste sous {@link UPLOAD_BUDGET_BYTES} (on
 *    recompresse plus fort si besoin).
 *
 * L'interface n'affiche JAMAIS de taille ni de limite : en cas d'image
 * illisible, on renvoie une erreur `ImageUnreadableError` dont le message
 * est déjà rédigé pour le commerçant.
 */

export type ImageRole = "logo" | "photo" | "screenshot";

/** Marge sous la limite Vercel (enveloppe multipart + champs texte). */
export const UPLOAD_BUDGET_BYTES = Math.round(3.8 * 1024 * 1024);

const PHOTO_STEPS = [
  { side: 1600, quality: 0.82 },
  { side: 1400, quality: 0.74 },
  { side: 1200, quality: 0.68 },
  { side: 960, quality: 0.62 },
];
const LOGO_STEPS = [1024, 768, 512];
/** Un logo PNG au-delà de ce poids est réduit d'un cran. */
const LOGO_SOFT_MAX_BYTES = 900 * 1024;

const ALPHA_TYPES = new Set(["image/png", "image/webp", "image/gif", "image/svg+xml", "image/avif"]);
const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp|svg|tiff?)$/i;

export class ImageUnreadableError extends Error {
  constructor() {
    super("Cette image n'a pas pu être lue. Essayez avec une autre photo (JPG ou PNG).");
  }
}

/** Le fichier choisi est-il une image ? (Android renvoie parfois un type vide.) */
export function looksLikeImage(file: File): boolean {
  if (file.type) return file.type.startsWith("image/");
  return IMAGE_EXT_RE.test(file.name);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.decoding = "async";
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode_failed"));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function draw(
  img: HTMLImageElement,
  maxSide: number,
  opaque: boolean
): HTMLCanvasElement | null {
  // Un SVG sans dimensions intrinsèques rapporte 0 : on le rend en carré.
  const w = img.naturalWidth || maxSide;
  const h = img.naturalHeight || maxSide;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  if (opaque) {
    // JPEG sans transparence : fond blanc plutôt que noir.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * HEIC / HEIF (photos iPhone) : le serveur (sharp) ne sait PAS les lire. Si le
 * navigateur ne les décode pas lui-même (Chrome ordinateur…), on demande une
 * autre image plutôt que d'envoyer un fichier voué à l'échec.
 */
function isHeic(file: File): boolean {
  return /^image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

/** Repli « envoyer le fichier tel quel » : seulement s'il est léger ET lisible côté serveur. */
function canSendAsIs(file: File): boolean {
  return !isHeic(file) && file.size <= UPLOAD_BUDGET_BYTES / 2;
}

function baseName(file: File, role: ImageRole): string {
  const cleaned = file.name.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "-").slice(0, 40);
  return cleaned || role;
}

/**
 * Compresse une image pour son rôle. `level` (0…3) durcit la compression
 * (utilisé par {@link fitUploadBudget}).
 */
export async function compressImage(file: File, role: ImageRole, level = 0): Promise<File> {
  let img: HTMLImageElement;
  try {
    // Un <img> respecte l'orientation EXIF (photo prise en portrait).
    img = await loadImage(file);
  } catch {
    // Format que ce navigateur ne sait pas décoder : envoyé tel quel s'il
    // est léger et lisible par le serveur (jamais un HEIC, cf. isHeic).
    if (canSendAsIs(file)) return file;
    throw new ImageUnreadableError();
  }

  if (role === "logo") {
    const keepsAlpha = ALPHA_TYPES.has(file.type) || !file.type;
    const sides = LOGO_STEPS.slice(Math.min(level, LOGO_STEPS.length - 1));
    let last: File | null = null;
    for (const side of sides) {
      const canvas = draw(img, side, !keepsAlpha);
      if (!canvas) break;
      const type = keepsAlpha ? "image/png" : "image/jpeg";
      const blob = await canvasToBlob(canvas, type, keepsAlpha ? undefined : 0.9);
      if (!blob) break;
      last = new File([blob], `${baseName(file, role)}.${keepsAlpha ? "png" : "jpg"}`, { type });
      if (blob.size <= LOGO_SOFT_MAX_BYTES) break;
    }
    if (last) return last;
    if (canSendAsIs(file)) return file;
    throw new ImageUnreadableError();
  }

  const step = PHOTO_STEPS[Math.min(level, PHOTO_STEPS.length - 1)];
  const canvas = draw(img, step.side, true);
  const blob = canvas ? await canvasToBlob(canvas, "image/jpeg", step.quality) : null;
  if (!blob) {
    if (canSendAsIs(file)) return file;
    throw new ImageUnreadableError();
  }
  return new File([blob], `${baseName(file, role)}.jpg`, { type: "image/jpeg" });
}

export type PreparedImages = Partial<Record<ImageRole, File>>;

/**
 * Garantit que l'ensemble des images d'un envoi tient dans le budget :
 * recompresse de plus en plus fort, en commençant par la plus lourde.
 */
export async function fitUploadBudget(
  originals: Partial<Record<ImageRole, File>>,
  prepared: PreparedImages
): Promise<PreparedImages> {
  const out: PreparedImages = { ...prepared };
  const levels: Record<ImageRole, number> = { logo: 0, photo: 0, screenshot: 0 };
  const total = () => Object.values(out).reduce((sum, f) => sum + (f?.size ?? 0), 0);

  for (let guard = 0; guard < 8 && total() > UPLOAD_BUDGET_BYTES; guard++) {
    const heaviest = (Object.keys(out) as ImageRole[])
      .filter((role) => out[role] && originals[role] && levels[role] < 3)
      .sort((a, b) => (out[b]?.size ?? 0) - (out[a]?.size ?? 0))[0];
    if (!heaviest) break;
    levels[heaviest] += 1;
    out[heaviest] = await compressImage(originals[heaviest] as File, heaviest, levels[heaviest]);
  }
  if (total() > UPLOAD_BUDGET_BYTES) throw new ImageUnreadableError();
  return out;
}
