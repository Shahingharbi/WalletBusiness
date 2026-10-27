/**
 * Préparation de la photo côté navigateur avant envoi à POST /api/essai.
 *
 * Pourquoi : une photo de téléphone pèse 3 à 12 Mo. En 4G moyenne, l'envoyer
 * telle quelle ajoute 5 à 20 s d'attente (et dépasse parfois la limite de
 * 8 Mo de la route). Le serveur réduit de toute façon l'image à ~1 600 px
 * pour l'analyse : on la réduit donc dès le téléphone, sans perte utile.
 *
 * Les logos PNG / WebP / GIF raisonnables sont envoyés INTACTS : leur
 * transparence sert à poser le logo proprement sur la carte, un passage par
 * JPEG la détruirait.
 */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_SIDE = 2048;
/** En dessous de ce poids et de MAX_SIDE, inutile de ré-encoder. */
const LIGHT_ENOUGH_BYTES = 2.5 * 1024 * 1024;
const JPEG_QUALITY = 0.88;

const ALPHA_TYPES = new Set(["image/png", "image/webp", "image/gif"]);
const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp|svg)$/i;

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

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Renvoie un fichier prêt à l'envoi (réduit si utile). Ne lève jamais :
 * si le navigateur ne sait pas décoder l'image (HEIC sur Chrome…), on
 * renvoie l'original et le serveur s'en charge.
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  const keepsAlpha = ALPHA_TYPES.has(file.type);
  if (file.type === "image/svg+xml") return file;
  if (keepsAlpha && file.size <= MAX_UPLOAD_BYTES) return file;

  try {
    // Un <img> respecte l'orientation EXIF (photo prise en portrait) —
    // createImageBitmap ne le garantit pas sur tous les navigateurs.
    const img = await loadImage(file);
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (!width || !height) return file;

    const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
    if (scale === 1 && file.size <= LIGHT_ENOUGH_BYTES) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    const outType = keepsAlpha ? "image/png" : "image/jpeg";
    if (!keepsAlpha) {
      // JPEG n'a pas de transparence : fond blanc plutôt que noir.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await canvasToBlob(canvas, outType, JPEG_QUALITY);
    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
    const ext = outType === "image/png" ? "png" : "jpg";
    return new File([blob], `${baseName}.${ext}`, { type: outType });
  } catch {
    return file;
  }
}
