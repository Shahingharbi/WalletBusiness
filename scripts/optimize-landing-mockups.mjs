// Optimise les mockups de la LP :
// - Crop les 2 captures iPhone du user (Safari Burger + Kaptainfry) pour
//   garder juste la zone carte + status bar, virer l'indicateur de pile
//   "Acheter en ligne" en bas (moche en contexte marketing)
// - Resize l'editor desktop screenshot 2880x1800 -> 1800x1125 (Vercel
//   image optim plante sur des trop gros PNG)
//
// Sortie : wallet-front.png + wallet-back.png + editor-desktop.png
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs";

const ROOT = "C:/Users/superindep/WalletBusiness/fidpass";
const DIR = path.join(ROOT, "public", "landing-mockups");

// ─── Captures user iPhone : crop le bas pour virer "Acheter en ligne" ───
// Les screenshots iPhone 15 Pro font ~1290x2796. La carte va du haut
// (status bar) jusqu'à ~2400px. En dessous c'est l'indicateur de pile
// qui pollue visuellement.

async function cropIphoneCard(input, output) {
  const meta = await sharp(input).metadata();
  const w = meta.width;
  const h = meta.height;
  // Garde top status bar (~200px) + carte (~la majorité) → crop à 78% de h
  const cropH = Math.round(h * 0.78);
  await sharp(input)
    .extract({ left: 0, top: 0, width: w, height: cropH })
    .png({ compressionLevel: 9 })
    .toFile(output);
  const out = await sharp(output).metadata();
  console.log(
    `✓ ${path.basename(output)} : ${w}×${h} → ${out.width}×${out.height}`,
  );
}

await cropIphoneCard(
  path.join(DIR, "safariburger.jpeg"),
  path.join(DIR, "wallet-safariburger.png"),
);
await cropIphoneCard(
  path.join(DIR, "kaptainfry.jpeg"),
  path.join(DIR, "wallet-kaptainfry.png"),
);

// ─── Editor desktop : resize de 2880x1800 → 1800x1125 ───
// Next/Image optim a tendance à timeout / fail sur les très gros PNG
// (visible chez le user : section affichait noir avec juste alt text).
const editorSrc = path.join(DIR, "editor-desktop.png");
const editorOut = path.join(DIR, "editor-desktop.png"); // overwrite
const backup = path.join(DIR, "editor-desktop.original.png");
if (!fs.existsSync(backup)) {
  fs.copyFileSync(editorSrc, backup);
  console.log(`  backup : ${path.basename(backup)}`);
}
await sharp(backup)
  .resize({ width: 1800, withoutEnlargement: true })
  .png({ compressionLevel: 9, palette: false })
  .toFile(editorOut + ".tmp");
fs.renameSync(editorOut + ".tmp", editorOut);
const editorMeta = await sharp(editorOut).metadata();
console.log(
  `✓ editor-desktop.png : 2880×1800 → ${editorMeta.width}×${editorMeta.height}`,
);

// Idem pour dashboard si trop gros
const dashSrc = path.join(DIR, "dashboard-desktop.png");
const dashMeta = await sharp(dashSrc).metadata();
if (dashMeta.width > 1800) {
  const dashBackup = path.join(DIR, "dashboard-desktop.original.png");
  if (!fs.existsSync(dashBackup)) fs.copyFileSync(dashSrc, dashBackup);
  await sharp(dashBackup)
    .resize({ width: 1800, withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toFile(dashSrc + ".tmp");
  fs.renameSync(dashSrc + ".tmp", dashSrc);
  console.log(`✓ dashboard-desktop.png resized → 1800px wide`);
}

console.log("\n✓ Optimisation terminée");
