// Polish des captures Apple Wallet du user (safariburger.jpeg + kaptainfry.jpeg) :
// - Crop plus serré : enlève le bord inférieur du iPhone (bezel noir) + les
//   dots de pagination "Acheter en ligne", garde la status bar pour le
//   feel "iPhone réel"
// - Légère saturation boost (+10%) + brightness +3% : la carte ressort mieux
// - Mask coins arrondis (rx=48) + alpha → fond transparent, plus joli sur
//   la LP (sans bord noir disgracieux)
// - Sortie en PNG haute qualité dans public/landing-mockups/

import sharp from "sharp";
import path from "node:path";

const DIR =
  "C:/Users/superindep/WalletBusiness/fidpass/public/landing-mockups";

async function polish(input, output) {
  const meta = await sharp(input).metadata();
  const w = meta.width;
  const h = meta.height;

  // Crop TIGHT sur la carte elle-même : drop status bar (13:53...) +
  // bezel iPhone + indicateur "Acheter en ligne" pour rester pro.
  // Garde ~7% margin top (où la carte commence) jusqu'à ~70% (juste
  // après "Propulsé par aswallet") = la carte pure, rien d'autre.
  const cropTop = Math.round(h * 0.07);
  const cropBottom = Math.round(h * 0.71);
  // Crop côtés aussi pour virer la marge noire iPhone gauche/droite.
  const cropLeft = Math.round(w * 0.05);
  const cropRight = Math.round(w * 0.95);
  const cropW = cropRight - cropLeft;
  const cropH = cropBottom - cropTop;

  // Mask coins arrondis légèrement (la carte Apple Wallet a déjà ses
  // propres coins arrondis dans le screenshot, on rajoute juste un soft
  // rounding par-dessus pour éviter les pixels durs sur les bords coupés).
  const radius = Math.round(cropW * 0.04);
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${cropW}" height="${cropH}">
       <rect x="0" y="0" width="${cropW}" height="${cropH}"
             rx="${radius}" ry="${radius}" fill="white"/>
     </svg>`,
  );

  await sharp(input)
    .extract({ left: cropLeft, top: cropTop, width: cropW, height: cropH })
    .modulate({ saturation: 1.08, brightness: 1.03 })
    .composite([{ input: mask, blend: "dest-in" }])
    .png({ compressionLevel: 9 })
    .toFile(output);

  const m = await sharp(output).metadata();
  console.log(
    `✓ ${path.basename(output)} — ${w}×${h} → ${m.width}×${m.height} (rounded)`,
  );
}

await polish(
  path.join(DIR, "safariburger.jpeg"),
  path.join(DIR, "wallet-safariburger.png"),
);
await polish(
  path.join(DIR, "kaptainfry.jpeg"),
  path.join(DIR, "wallet-kaptainfry.png"),
);

console.log("\n✓ Captures polished — fond transparent + coins arrondis");
