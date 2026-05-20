// Génère le wordmark "aswallet" (texte noir) + le favicon (a sur jaune)
// via Playwright (le seul moyen fiable de rendre Ginto Nord woff2 → PNG
// en standalone, sharp/librsvg ne gère pas correctement les @font-face).
//
// Usage : node scripts/gen-wordmark.mjs
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "brand");
// Embed la font en base64 : Chromium bloque les file:// URLs dans @font-face,
// mais accepte les data: URIs. C'est le seul moyen fiable de rendre du
// Ginto Nord depuis un script Node standalone.
const FONT_BASE64 = fs
  .readFileSync(path.join(ROOT, "public", "fonts", "GintoNord-500.woff2"))
  .toString("base64");
const FONT_URL = `data:font/woff2;base64,${FONT_BASE64}`;

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();

async function renderHtml(html, w, h, outPath, omitBg = true) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 2, // retina 2x → PNG sortie 2*w × 2*h
  });
  const page = await ctx.newPage();
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: outPath, omitBackground: omitBg, type: "png" });
  await ctx.close();
  console.log(`✓ ${path.relative(ROOT, outPath)} (${w * 2}×${h * 2})`);
}

const fontFace = `
  @font-face {
    font-family: "GintoNord";
    src: url("${FONT_URL}") format("woff2");
    font-weight: 500;
    font-display: block;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: transparent; }
`;

// 1) WORDMARK noir sur transparent — taille principale (1200×320)
await renderHtml(
  `<html><head><style>${fontFace}
    body { display: flex; align-items: center; justify-content: center; height: 320px; }
    .w { font-family: "GintoNord"; font-weight: 500; font-size: 200px;
         color: #0a0a0a; letter-spacing: -0.02em; line-height: 1; }
  </style></head><body><div class="w">aswallet</div></body></html>`,
  1200,
  320,
  path.join(OUT_DIR, "aswallet-wordmark-black.png"),
);

// 2) WORDMARK blanc sur transparent (pour fond sombre)
await renderHtml(
  `<html><head><style>${fontFace}
    body { display: flex; align-items: center; justify-content: center; height: 320px; }
    .w { font-family: "GintoNord"; font-weight: 500; font-size: 200px;
         color: #ffffff; letter-spacing: -0.02em; line-height: 1; }
  </style></head><body><div class="w">aswallet</div></body></html>`,
  1200,
  320,
  path.join(OUT_DIR, "aswallet-wordmark-white.png"),
);

// 3) WORDMARK noir sur fond beige aswallet (réseaux sociaux)
await renderHtml(
  `<html><head><style>${fontFace}
    body { display: flex; align-items: center; justify-content: center;
           height: 320px; background: #f9f7f0; }
    .w { font-family: "GintoNord"; font-weight: 500; font-size: 200px;
         color: #0a0a0a; letter-spacing: -0.02em; line-height: 1; }
  </style></head><body><div class="w">aswallet</div></body></html>`,
  1200,
  320,
  path.join(OUT_DIR, "aswallet-wordmark-onbeige.png"),
  false,
);

// 4) FAVICON — "a" noir centré sur un carré arrondi jaune.
// Tailles : 512 pour Apple touch icon / 256 pour favicon source.
for (const size of [512, 256]) {
  const fontSize = Math.round(size * 0.7);
  const radius = Math.round(size * 0.22);
  await renderHtml(
    `<html><head><style>${fontFace}
      body { display: flex; align-items: center; justify-content: center;
             width: ${size}px; height: ${size}px; }
      .ico { width: ${size}px; height: ${size}px;
             background: #fff382; border-radius: ${radius}px;
             display: flex; align-items: center; justify-content: center;
             font-family: "GintoNord"; font-weight: 500;
             font-size: ${fontSize}px; color: #0a0a0a;
             line-height: 1; letter-spacing: -0.03em;
             padding-bottom: ${Math.round(size * 0.03)}px;
             box-shadow: 0 ${Math.round(size * 0.02)}px ${Math.round(size * 0.04)}px rgba(0,0,0,0.08); }
    </style></head><body><div class="ico">a</div></body></html>`,
    size,
    size,
    path.join(OUT_DIR, `aswallet-favicon-${size}.png`),
  );
}

await browser.close();
console.log("\nTerminé. Fichiers dans public/brand/");
