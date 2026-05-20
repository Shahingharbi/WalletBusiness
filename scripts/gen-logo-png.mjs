// Génère les PNG du logo aswallet à partir de public/icon.svg
// Utilisation : node scripts/gen-logo-png.mjs
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SVG = path.join(ROOT, "public", "icon.svg");
const OUT_DIR = path.join(ROOT, "public", "brand");

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const svg = fs.readFileSync(SVG);
const sizes = [256, 512, 1024, 2048];

for (const s of sizes) {
  const out = path.join(OUT_DIR, `aswallet-logo-${s}.png`);
  await sharp(svg, { density: 600 })
    .resize(s, s, { fit: "contain" })
    .png({ compressionLevel: 9, palette: false })
    .toFile(out);
  console.log(`✓ ${out} (${s}x${s})`);
}

// Version sur fond blanc (pour print / fond sombre)
for (const s of [512, 1024]) {
  const out = path.join(OUT_DIR, `aswallet-logo-${s}-onwhite.png`);
  await sharp(svg, { density: 600 })
    .resize(s, s, { fit: "contain" })
    .flatten({ background: "#ffffff" })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`✓ ${out} (${s}x${s} fond blanc)`);
}

// Version sur fond noir (pour usage dark)
for (const s of [512, 1024]) {
  const out = path.join(OUT_DIR, `aswallet-logo-${s}-onblack.png`);
  await sharp(svg, { density: 600 })
    .resize(s, s, { fit: "contain" })
    .flatten({ background: "#0a0a0a" })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`✓ ${out} (${s}x${s} fond noir)`);
}

console.log("\nTerminé. Fichiers dans public/brand/");
