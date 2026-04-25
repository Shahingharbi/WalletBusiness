// Génère les icones Apple Wallet (icon.png + icon@2x + icon@3x, et idem pour logo)
// depuis le SVG racine /public/icon.svg.
// Usage: node scripts/gen-apple-wallet-icons.mjs
import sharp from "sharp";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const SVG = readFileSync(resolve("public/icon.svg"));
const OUT_DIR = resolve("public/apple-wallet");
mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  // icon.png : utilisé comme icone principale du pass + sur la page lock screen
  { name: "icon.png", w: 29 },
  { name: "icon@2x.png", w: 58 },
  { name: "icon@3x.png", w: 87 },
  // logo.png : top-left du pass (max 160x50, on garde carre 50x50 pour le SVG)
  { name: "logo.png", w: 160, h: 50 },
  { name: "logo@2x.png", w: 320, h: 100 },
  { name: "logo@3x.png", w: 480, h: 150 },
];

for (const t of targets) {
  const w = t.w;
  const h = t.h ?? t.w;
  await sharp(SVG)
    .resize(w, h, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(resolve(OUT_DIR, t.name));
  console.log(`  generated ${t.name}  (${w}x${h})`);
}
console.log("\nDone. Commit public/apple-wallet/*.png so the .pkpass endpoint can read them.");
