import { NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs"; // sharp est natif → pas Edge

const MAX_SIZE = 8 * 1024 * 1024; // 8 MB en entrée (HEIC iPhone facilement >3 Mo)
// On accepte large côté client (incluant HEIC iOS), puis on normalise en PNG
// avec sharp côté serveur. Le wallet (Apple + banner Satori) requiert du PNG.
const ACCEPTED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/gif",
  // Certains navigateurs iOS envoient un mime vide ou octet-stream pour
  // les photos prises avec l'appareil — on accepte mais on validera via
  // la signature du buffer (sharp lèvera si format inconnu).
  "application/octet-stream",
  "",
]);
// SVG est aussi accepté mais traité à part (pas de raster conversion).
const SVG_MIME = new Set(["image/svg+xml"]);
const ALLOWED_BUCKETS = ["card-assets", "business-assets"] as const;

type Bucket = (typeof ALLOWED_BUCKETS)[number];

export async function POST(request: Request) {
  // File upload — expensive in bandwidth/storage. Authenticated, but
  // still cap to stop a compromised account flooding storage.
  const limited = await rateLimit(request, {
    limit: 20,
    windowMs: 60_000,
    key: "upload",
  });
  if (limited) return limited;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("business_id")
      .eq("id", user.id)
      .single();

    if (!profile?.business_id) {
      return NextResponse.json({ error: "Commerce introuvable" }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const bucket = (formData.get("bucket") as string) || "card-assets";
    const folder = (formData.get("folder") as string) || "uploads";

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }
    if (!ALLOWED_BUCKETS.includes(bucket as Bucket)) {
      return NextResponse.json({ error: "Bucket invalide" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Fichier trop volumineux (max 8 Mo)" },
        { status: 413 }
      );
    }

    const mime = (file.type || "").toLowerCase();
    const isSvg = SVG_MIME.has(mime) || /\.svg$/i.test(file.name);
    if (!isSvg && !ACCEPTED_MIME.has(mime)) {
      return NextResponse.json(
        {
          error:
            "Format non supporté. Utilisez une image (PNG, JPG, WEBP, HEIC, AVIF, GIF, SVG).",
        },
        { status: 415 }
      );
    }

    const safeFolder = folder.replace(/[^a-z0-9_-]/gi, "_");
    const inputBuf = Buffer.from(await file.arrayBuffer());

    let outBuf: Buffer;
    let outMime: string;
    let outExt: string;

    if (isSvg) {
      // SVG est conservé tel quel (vectoriel, pas de raster).
      outBuf = inputBuf;
      outMime = "image/svg+xml";
      outExt = "svg";
    } else {
      // Conversion systématique en PNG côté serveur.
      // Raison: l'iPhone uploade en HEIC/HEIF (et parfois en JPEG selon réglages),
      // or le générateur Apple Wallet exige du PNG (vérif des magic bytes 0x89 0x50 4E 47).
      // Convertir ici garantit que tous les logos/bannières/tampons fonctionnent
      // dans le wallet, indépendamment de la source (mobile vs desktop, iPhone vs Android).
      try {
        const converted = await sharp(inputBuf, { failOn: "none" })
          .rotate() // applique l'EXIF orientation (sinon photo iPhone tournée 90°)
          .png({ compressionLevel: 9, adaptiveFiltering: true })
          .toBuffer();
        outBuf = Buffer.from(converted);
      } catch (err) {
        console.error("[upload] sharp PNG conversion failed:", err);
        return NextResponse.json(
          { error: "Image illisible. Réessayez avec un PNG ou JPG." },
          { status: 415 }
        );
      }
      outMime = "image/png";
      outExt = "png";
    }

    const path = `${profile.business_id}/${safeFolder}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${outExt}`;

    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage
      .from(bucket)
      .upload(path, outBuf, {
        contentType: outMime,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: "Échec de l'upload: " + uploadError.message },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = admin.storage.from(bucket).getPublicUrl(path);

    return NextResponse.json({ url: publicUrl, path }, { status: 201 });
  } catch (err) {
    console.error("POST /api/upload error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
