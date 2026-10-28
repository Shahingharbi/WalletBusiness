/**
 * Site web d'un commerce → signaux de marque (nom, description, couleurs
 * déclarées, candidats logo, photos, types schema.org, adresse, coordonnées,
 * texte).
 *
 * SERVER-ONLY (safeFetch).
 *
 * Parsing par expressions régulières robustes plutôt qu'un parseur DOM : pas
 * de nouvelle dépendance, et on ne lit que des balises très structurées
 * (<title>, <meta>, <link>, <script type="application/ld+json">, <img>, <svg>).
 * Les valeurs sont décodées (entités HTML) et les URLs rendues absolues
 * (URL finale après redirections + <base href>).
 *
 * Ordre de confiance des logos renvoyés (le premier est le meilleur) :
 *   jsonld > img-logo > inline-svg > apple-touch-icon > manifest-icon >
 *   icon (png/svg ≥ 64 px) > og-image (si quasi carrée) > favicon.
 * Le téléchargement / la validation des images est le travail de logo.ts.
 *
 * Photos candidates pour la bande (`photoCandidates`) : og:image /
 * twitter:image paysage, image JSON-LD du commerce, grandes images et fonds
 * CSS du haut de page — validées ensuite par photo.ts.
 */

import { clampName, nameFromDomain, normalizeForMatch } from "@/lib/essai/brand/category";
import { normalizeUserUrl, safeFetch, SafeFetchError } from "@/lib/essai/brand/safe-fetch";
import type { LogoCandidate, WebsiteSignals } from "@/lib/essai/types";

const HTML_MAX_BYTES = 1.5 * 1024 * 1024;
const HTML_TIMEOUT_MS = 8_000;
const MANIFEST_MAX_BYTES = 200 * 1024;
const MANIFEST_TIMEOUT_MS = 4_000;
const SVG_MAX_CHARS = 200 * 1024;
const TEXT_SAMPLE_MAX = 2_000;
const DESCRIPTION_MAX = 300;
const MAX_CANDIDATES = 12;

// ─── Entités HTML ─────────────────────────────────────────────────────────

/** Noms HTML 4 des caractères Latin-1 160 → 255, dans l'ordre. */
const LATIN1_NAMES =
  "nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml";

const NAMED_ENTITIES: Record<string, number> = {
  amp: 38, lt: 60, gt: 62, quot: 34, apos: 39, Tab: 9, NewLine: 10,
  OElig: 338, oelig: 339, Scaron: 352, scaron: 353, Yuml: 376, fnof: 402, circ: 710, tilde: 732,
  ensp: 8194, emsp: 8195, thinsp: 8201, zwnj: 8204, zwj: 8205, lrm: 8206, rlm: 8207,
  ndash: 8211, mdash: 8212, lsquo: 8216, rsquo: 8217, sbquo: 8218, ldquo: 8220, rdquo: 8221,
  bdquo: 8222, dagger: 8224, Dagger: 8225, bull: 8226, hellip: 8230, permil: 8240, prime: 8242,
  Prime: 8243, lsaquo: 8249, rsaquo: 8250, euro: 8364, trade: 8482, hearts: 9829,
};
LATIN1_NAMES.split(" ").forEach((name, i) => {
  NAMED_ENTITIES[name] = 160 + i;
});

/** Références numériques 128–159 : les navigateurs les lisent en Windows-1252 (&#146; → ’). */
const CP1252: Record<number, number> = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020,
  0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160, 0x8b: 0x2039, 0x8c: 0x0152,
  0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022,
  0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a,
  0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178,
};

/**
 * Décode les entités HTML (« &amp; », « &#039; », « &eacute; », « &#x2019; »).
 * Les entités nommées exigent le « ; » final (évite de casser « ?a=1&copy=2 »).
 */
export function decodeHtmlEntities(input: string): string {
  if (!input || !input.includes("&")) return input ?? "";
  return input.replace(/&(?:#(\d{1,7});?|#[xX]([0-9a-fA-F]{1,6});?|([A-Za-z][A-Za-z0-9]{1,31});)/g, (m, dec, hex, name) => {
    if (name) {
      const cp = NAMED_ENTITIES[name];
      return cp === undefined ? m : String.fromCodePoint(cp);
    }
    let cp = dec ? parseInt(dec, 10) : parseInt(hex, 16);
    if (CP1252[cp]) cp = CP1252[cp];
    if (!cp || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return "\ufffd";
    return String.fromCodePoint(cp);
  });
}

// ─── Utilitaires HTML ─────────────────────────────────────────────────────

const ATTR_RE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

/** Attributs d'une balise ouvrante (noms en minuscules, valeurs décodées, 1re occurrence). */
function parseAttrs(src: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(src))) {
    const name = m[1].toLowerCase();
    if (name in attrs) continue;
    attrs[name] = decodeHtmlEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return attrs;
}

interface Tag {
  attrs: Record<string, string>;
  /** Position du « < » dans le HTML. */
  index: number;
  /** Position juste après le « > ». */
  end: number;
}

/** Toutes les balises ouvrantes `<name …>` (les « > » entre guillemets sont gérés). */
function findTags(html: string, name: string): Tag[] {
  const re = new RegExp(`<${name}\\b((?:[^>"']|"[^"]*"|'[^']*')*)>`, "gi");
  const out: Tag[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    out.push({ attrs: parseAttrs(m[1]), index: m.index, end: m.index + m[0].length });
  }
  return out;
}

/**
 * Balise HTML complète, y compris quand une valeur d'attribut contient « > »
 * (liaisons Knockout/Alpine : data-bind="… => x > 0 …").
 */
const TAG_RE = /<[a-zA-Z/!](?:[^>"']|"[^"]*"|'[^']*')*>/g;

/** Texte compacté (balises retirées, entités décodées, espaces insécables → espaces). */
function cleanText(s: string | null | undefined): string {
  // 2e passe après décodage : HTML échappé dans les meta (« &lt;p&gt;… »),
  // fréquent avec les extraits WordPress. TAG_RE exige une lettre après « < »
  // pour ne pas manger un texte comme « moins de < 10 € ».
  return decodeHtmlEntities((s ?? "").replace(TAG_RE, " "))
    .replace(TAG_RE, " ")
    .replace(/[\u00a0\u2000-\u200b\u202f\u205f\u3000\ufeff]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cutAtWord(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trim();
}

/** URL absolue http(s) depuis un attribut, ou null (javascript:, #ancre, data: non-svg…). */
function absolutize(href: string | null | undefined, base: URL): string | null {
  const h = (href ?? "").trim();
  if (!h || h.startsWith("#") || /^(?:javascript|mailto|tel|data|blob|about):/i.test(h)) return null;
  try {
    const u = new URL(h.startsWith("//") ? `${base.protocol}${h}` : h, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

/** Plus grande dimension déclarée dans `sizes` (« 192x192 », « 16x16 32x32 », « any »). */
function parseSizes(sizes: string | undefined): number | null {
  if (!sizes) return null;
  if (/\bany\b/i.test(sizes)) return 512;
  let max = 0;
  for (const m of sizes.matchAll(/(\d+)\s*[xX×]\s*(\d+)/g)) max = Math.max(max, Number(m[1]), Number(m[2]));
  return max || null;
}

function isSvgUrl(url: string, type?: string): boolean {
  return /svg/i.test(type ?? "") || /\.svgz?(?:$|\?)/i.test(url);
}

// ─── Couleurs CSS ─────────────────────────────────────────────────────────

const NAMED_COLORS: Record<string, string> = {
  white: "#ffffff", black: "#000000", red: "#ff0000", green: "#008000", blue: "#0000ff",
  yellow: "#ffff00", orange: "#ffa500", purple: "#800080", gray: "#808080", grey: "#808080",
  silver: "#c0c0c0", maroon: "#800000", navy: "#000080", teal: "#008080", olive: "#808000",
  lime: "#00ff00", aqua: "#00ffff", fuchsia: "#ff00ff", pink: "#ffc0cb", gold: "#ffd700",
  brown: "#a52a2a", crimson: "#dc143c", darkred: "#8b0000", darkgreen: "#006400",
};

/** Couleur CSS (#rgb, #rrggbb(aa), rgb()/rgba(), nom courant) → « #rrggbb » ou null. */
function parseCssColor(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return null;
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    const h = m[1];
    if (h.length === 3 || h.length === 4) return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
    if (h.length === 6 || h.length === 8) return `#${h.slice(0, 6)}`;
    return null;
  }
  m = /^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)/.exec(s);
  if (m) {
    const channel = (v: string) => {
      const n = v.endsWith("%") ? (parseFloat(v) * 255) / 100 : parseFloat(v);
      return Math.max(0, Math.min(255, Math.round(n)));
    };
    return `#${[m[1], m[2], m[3]].map((v) => channel(v).toString(16).padStart(2, "0")).join("")}`;
  }
  return NAMED_COLORS[s] ?? null;
}

// ─── Décodage du HTML (charset) ───────────────────────────────────────────

function decodeBody(body: Buffer, contentTypeHeader: string | null): string {
  let charset = /charset\s*=\s*["']?([\w-]+)/i.exec(contentTypeHeader ?? "")?.[1] ?? null;
  if (!charset) {
    if (body[0] === 0xef && body[1] === 0xbb && body[2] === 0xbf) charset = "utf-8";
    else if (body[0] === 0xfe && body[1] === 0xff) charset = "utf-16be";
    else if (body[0] === 0xff && body[1] === 0xfe) charset = "utf-16le";
    else {
      const head = body.subarray(0, 4096).toString("latin1");
      charset = /<meta[^>]+charset\s*=\s*["']?\s*([\w-]+)/i.exec(head)?.[1] ?? null;
    }
  }
  const decode = (label: string) => new TextDecoder(label).decode(body);
  try {
    const text = decode(charset ?? "utf-8");
    // Pas de charset déclaré et de l'UTF-8 invalide : vieux site en Windows-1252.
    if (!charset && text.includes("\ufffd")) return decode("windows-1252");
    return text;
  } catch {
    return decode("utf-8");
  }
}

// ─── Nom du commerce ──────────────────────────────────────────────────────

/** Segments jamais acceptés comme nom (comparés après normalizeForMatch). */
const GENERIC_NAMES = new Set(
  [
    "accueil", "home", "homepage", "home page", "page d accueil", "bienvenue", "welcome",
    "site officiel", "site internet", "site web", "official site", "official website", "officiel",
    "official", "index", "untitled", "sans titre", "default", "mon site", "my site", "site",
    "just another wordpress site", "un site utilisant wordpress", "my wordpress", "my blog",
    "mon blog", "blog", "wordpress", "wix", "wix com", "shopify", "squarespace", "jimdo", "webnode",
    "site123", "godaddy", "e monsite", "react app", "vite app", "vue app", "next js", "nuxt",
    "my app", "web app", "app", "pwa", "contact", "a propos", "about", "about us", "page",
    "page introuvable", "page not found", "404", "403", "erreur", "error", "loading",
    "chargement", "coming soon", "bientot", "en construction", "under construction",
    "maintenance", "site en construction",
  ].map(normalizeForMatch),
);

/** Descriptions par défaut des CMS (« Boutique propulsée par PrestaShop »…) : sans valeur. */
const DEFAULT_DESCRIPTION_RE =
  /^(?:boutique\s+)?(?:propuls[ée]e?\s+par|powered\s+by|cr[ée]{1,2}\s+avec|made\s+with)\b|just another wordpress site|un (?:autre )?site (?:utilisant|propuls[ée] par) wordpress|^site\s+(?:web|internet)\s+de\s*$|^description$/i;

/** Formules d'accueil retirées en tête de nom (« Bienvenue chez Paul » → « Paul »). */
const NAME_PREFIXES: RegExp[] = [
  /^bienvenue\s+(?:sur\s+(?:le\s+site\s+(?:officiel\s+)?(?:de\s+la\s+|de\s+l['’]|de\s+|du\s+|des\s+|d['’])?|notre\s+site\s*)?|chez\s+|à\s+la\s+|à\s+l['’]|à\s+|au\s+|aux\s+|dans\s+)?/i,
  /^site\s+officiel\s+(?:de\s+la\s+|de\s+l['’]|de\s+|du\s+|des\s+|d['’])/i,
  /^(?:the\s+)?official\s+(?:site|website)\s+(?:of\s+)?/i,
  /^welcome\s+to\s+/i,
];

/**
 * Séparateurs de titre : « | – — · • » toujours ; « - ~ » › » seulement
 * entourés d'espaces (« Saint-Germain » et les guillemets « … » restent
 * intacts) ; « : » suivi d'un espace.
 */
const TITLE_SEPARATORS = /\s*[|–—·•]\s*|\s+[-~»›]\s+|\s*:\s+/;

/** Mot(s) de métier en tête de nom (voir cleanNameCandidate). */
const TRADE_PREFIX_RE =
  /^(?:salon\s+de\s+coiffure|institut\s+de\s+beaut[ée]|boulangerie(?:[\s-]+p[âa]tisserie)?|p[âa]tisserie|coiffeur|coiffeuse|coiffure|pressing|pizzeria|pizza|restaurant|resto|caf[ée]|bar|brasserie|boucherie|fleuriste|[ée]picerie|onglerie|barbier|barber|glacier|traiteur|kebab|tacos|sushi|burger|snack|institut|spa)\s+/i;

/** Suffixe pays / « officiel » en fin de nom (voir cleanNameCandidate). */
const COUNTRY_SUFFIX_RE = /\s+(?:france|fr|officiel(?:le)?|official)$/i;

const LOWERCASE_PARTICLES = new Set(["de", "du", "des", "la", "le", "les", "et", "à", "au", "aux", "en", "sur"]);

/**
 * « BIG MAMMA GROUP » → « Big Mamma Group », « L'ATELIER DU PAIN » →
 * « L'Atelier du Pain ». Seulement pour un nom de plusieurs mots entièrement
 * en capitales (souvent du référencement) : un mot seul (« PAUL », « KFC »)
 * est un choix de marque, on le garde.
 */
function fixShouting(name: string): string {
  const letters = name.replace(/[^\p{L}]/gu, "");
  if (letters.length <= 6 || letters !== letters.toUpperCase() || !/\s/.test(name.trim())) return name;
  return name
    .toLowerCase()
    .split(/(\s+)/)
    .map((word, i) => {
      if (/^\s+$/.test(word)) return word;
      if (i > 0 && LOWERCASE_PARTICLES.has(word)) return word;
      // Sigles sans voyelle (« bbq ») : en capitales.
      if (word.length <= 4 && !/[aeiouyàâäéèêëîïôöùûü]/.test(word)) return word.toUpperCase();
      // Majuscule après début, apostrophe et trait d'union (« l'atelier » → « L'Atelier »).
      return word.replace(/(^|['’-])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
    })
    .join("");
}

function stripNamePrefixes(s: string): string {
  let out = s.trim();
  for (const re of NAME_PREFIXES) out = out.replace(re, "").trim();
  return out.replace(/^[\s\-–—|:·•,]+|[\s\-–—|:·•,!]+$/g, "").trim();
}

function isGenericName(s: string): boolean {
  const n = normalizeForMatch(s);
  return !n || n.length < 2 || GENERIC_NAMES.has(n);
}

/** Clé compacte d'un domaine pour comparer (« boulangerie-dupont.fr » → « boulangeriedupont »). */
function domainKey(hostname: string): string {
  return normalizeForMatch(nameFromDomain(hostname)).replace(/ /g, "");
}

/** Ressemblance entre un segment et le domaine (0 = aucune). */
function domainScore(segment: string, key: string): number {
  if (!key) return 0;
  const n = normalizeForMatch(segment);
  const compact = n.replace(/ /g, "");
  if (!compact) return 0;
  if (compact === key) return 100;
  if (compact.length >= 3 && key.includes(compact)) return 60 + Math.min(compact.length, 20);
  if (key.length >= 3 && compact.includes(key)) return 50;
  const tokens = n.split(" ").filter((t) => t.length >= 3);
  if (tokens.length === 0) return 0;
  const inKey = tokens.filter((t) => key.includes(t)).length;
  return inKey > 0 ? 40 * (inKey / tokens.length) : 0;
}

/**
 * Nettoie un candidat de nom (titre, og:site_name…) : découpe sur les
 * séparateurs, retire les segments génériques (« Accueil », « Site
 * officiel »…), puis garde le segment le plus probable : celui qui ressemble
 * au domaine, sinon le premier restant (motif « Nom – slogan » des pages
 * d'accueil ; le motif « Accueil | Nom » est couvert par le retrait des
 * segments génériques).
 */
function cleanNameCandidate(raw: string | null | undefined, key: string): string | null {
  const text = cleanText(raw);
  if (!text) return null;
  const segments = text
    .split(TITLE_SEPARATORS)
    .map(stripNamePrefixes)
    .filter((s) => s && !isGenericName(s));
  if (segments.length === 0) return null;

  let best = segments[0];
  if (segments.length > 1) {
    let bestScore = -Infinity;
    segments.forEach((seg, i) => {
      const words = seg.split(" ").length;
      const score =
        domainScore(seg, key) +
        (i === 0 ? 5 : 0) -
        Math.max(0, words - 5) * 2 -
        (seg.length > 40 ? 10 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = seg;
      }
    });
  }

  // Un « nom » qui n'est qu'un domaine (« paul.fr ») → forme lisible.
  if (/^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(best)) {
    best = nameFromDomain(best) || best;
  }
  // Préfixe métier ajouté pour le référencement (« Coiffeur Franck Provost »,
  // « Pressing 5àsec ») : retiré seulement si le reste correspond EXACTEMENT
  // au domaine (franckprovost.com) — « Boulangerie Dupont » sur
  // boulangerie-dupont.fr reste intact.
  // Même logique pour un suffixe pays / « officiel » (« Chicken Street France »).
  for (const re of [TRADE_PREFIX_RE, COUNTRY_SUFFIX_RE]) {
    const trimmed = best.replace(re, "").trim();
    if (trimmed !== best && key.length >= 5 && normalizeForMatch(trimmed).replace(/ /g, "") === key) {
      best = trimmed;
    }
  }
  const out = clampName(fixShouting(best));
  return out && !isGenericName(out) ? out : null;
}

// ─── JSON-LD ──────────────────────────────────────────────────────────────

type JsonObject = Record<string, unknown>;

/** Types schema.org purement structurels (pas un métier). */
const STRUCTURAL_TYPES = new Set([
  "WebSite", "WebPage", "CollectionPage", "ItemPage", "AboutPage", "ContactPage", "FAQPage",
  "SearchResultsPage", "ProfilePage", "BreadcrumbList", "ListItem", "ItemList", "ImageObject",
  "VideoObject", "MediaObject", "SearchAction", "EntryPoint", "ReadAction", "Person", "Article",
  "BlogPosting", "NewsArticle", "Product", "ProductGroup", "Offer", "AggregateOffer",
  "AggregateRating", "Rating", "Review", "PostalAddress", "GeoCoordinates", "ContactPoint",
  "OpeningHoursSpecification", "PropertyValueSpecification", "PropertyValue",
  "SiteNavigationElement", "WPHeader", "WPFooter", "WPSideBar", "Menu", "MenuSection",
  "MenuItem", "Event", "HowTo", "Question", "Answer", "Thing", "CreativeWork", "Country",
  "City", "State", "AdministrativeArea", "PriceSpecification", "MonetaryAmount", "Language",
  "DataFeed", "Service", "OfferCatalog", "QuantitativeValue", "DefinedRegion", "GeoShape",
  "GeoCircle", "Place", "VirtualLocation", "Schedule", "Breadcrumb", "WebApplication",
  "SoftwareApplication", "Recipe", "JobPosting", "SpecialAnnouncement", "LocationFeatureSpecification",
]);
const ORGANIZATION_TYPES = new Set(["Organization", "Corporation", "Brand", "NGO", "OnlineBusiness", "OnlineStore"]);

function typesOf(node: JsonObject): string[] {
  const t = node["@type"];
  const list = Array.isArray(t) ? t : [t];
  return list
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.replace(/^.*[/#:]/, "").trim())
    .filter(Boolean);
}

/**
 * Types « commerce » reconnaissables : la hiérarchie LocalBusiness de
 * schema.org est trop vaste pour une liste exhaustive, mais ses noms suivent
 * ces motifs (Restaurant, Bakery, HairSalon, IceCreamShop, BarOrPub…).
 */
const BUSINESS_TYPE_RE =
  /Business|Store|Shop|Restaurant|Establishment|Salon|Bakery|Cafe|Bar|Pub|Florist|Butcher|Laundry|Cleaning|Spa|Barber|Hair|Beauty|Nail|IceCream|Grocery|Market|Brewery|Winery|Food|Takeaway|Bistro|Brasserie/;
/** Propriétés qui trahissent un établissement physique, quel que soit son type. */
const BUSINESS_PROPS = ["address", "geo", "telephone", "openingHours", "openingHoursSpecification", "priceRange", "servesCuisine", "hasMenu"];

/** 3 = commerce (LocalBusiness & co), 2 = organisation, 1 = WebSite, 0 = autre. */
function nodeRank(node: JsonObject): number {
  const types = typesOf(node);
  // Un type inconnu (« Breadcrumb », « WebApplication »…) ne suffit pas : il
  // faut un nom de type « commerce » ou des propriétés d'établissement.
  const other = types.filter((t) => !STRUCTURAL_TYPES.has(t) && !ORGANIZATION_TYPES.has(t));
  if (other.some((t) => BUSINESS_TYPE_RE.test(t)) || (other.length > 0 && BUSINESS_PROPS.some((p) => p in node))) {
    return 3;
  }
  if (types.some((t) => ORGANIZATION_TYPES.has(t))) return 2;
  if (types.includes("WebSite")) return 1;
  return 0;
}

function parseJsonLoose(raw: string): unknown {
  const s = raw
    .trim()
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .trim();
  try {
    return JSON.parse(s);
  } catch {
    // JSON-LD mal formé courant : retours à la ligne bruts dans les chaînes,
    // virgules finales.
    try {
      let noControl = "";
      for (const ch of s) noControl += ch.charCodeAt(0) < 0x20 ? " " : ch;
      return JSON.parse(noControl.replace(/,\s*([}\]])/g, "$1"));
    } catch {
      return null;
    }
  }
}

function collectNodes(data: unknown, out: JsonObject[], depth = 0): void {
  if (depth > 10 || data === null || typeof data !== "object") return;
  if (Array.isArray(data)) {
    for (const item of data) collectNodes(item, out, depth + 1);
    return;
  }
  const obj = data as JsonObject;
  if ("@type" in obj) out.push(obj);
  for (const [k, v] of Object.entries(obj)) {
    if (k === "@context") continue;
    if (v && typeof v === "object") collectNodes(v, out, depth + 1);
  }
}

function str(v: unknown): string | null {
  if (typeof v === "string") return cleanText(v) || null;
  if (typeof v === "number") return String(v);
  return null;
}

/** URL d'une image JSON-LD : chaîne, ImageObject {url|contentUrl}, référence {@id}, tableau. */
function imageUrlOf(v: unknown, byId: Map<string, JsonObject>, depth = 0): string | null {
  if (depth > 3 || v == null) return null;
  if (typeof v === "string") return v.trim() || null;
  if (Array.isArray(v)) {
    for (const item of v) {
      const u = imageUrlOf(item, byId, depth + 1);
      if (u) return u;
    }
    return null;
  }
  if (typeof v === "object") {
    const o = v as JsonObject;
    const direct = (typeof o.url === "string" && o.url) || (typeof o.contentUrl === "string" && o.contentUrl);
    if (direct) return direct.trim();
    if (typeof o["@id"] === "string" && byId.has(o["@id"])) {
      const target = byId.get(o["@id"]);
      if (target && target !== o) return imageUrlOf(target, byId, depth + 1);
    }
  }
  return null;
}

/** PostalAddress → « rue, CP ville ». */
function addressOf(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return cleanText(v) || null;
  if (Array.isArray(v)) {
    for (const item of v) {
      const a = addressOf(item);
      if (a) return a;
    }
    return null;
  }
  if (typeof v === "object") {
    const o = v as JsonObject;
    const street = str(o.streetAddress);
    const locality = str(o.addressLocality);
    // Un code postal seul (« 92110 ») n'est pas une adresse exploitable.
    if (!street && !locality) return null;
    const cityLine = [str(o.postalCode), locality].filter(Boolean).join(" ");
    return [street, cityLine].filter(Boolean).join(", ") || null;
  }
  return null;
}

function geoOf(v: unknown): { lat: number; lng: number } | null {
  if (!v || typeof v !== "object") return null;
  const o = (Array.isArray(v) ? v[0] : v) as JsonObject | undefined;
  if (!o) return null;
  const lat = Number(o.latitude);
  const lng = Number(o.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
  return { lat, lng };
}

interface JsonLdInfo {
  types: string[];
  businessName: string | null;
  siteName: string | null;
  description: string | null;
  logos: string[];
  /** `image` / `photo` des nœuds commerce (souvent une photo de devanture). */
  photos: string[];
  address: string | null;
  location: { lat: number; lng: number } | null;
}

function extractJsonLd(html: string): JsonLdInfo {
  const nodes: JsonObject[] = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (!/application\/ld\+json/i.test(m[1])) continue;
    const data = parseJsonLoose(m[2]);
    if (data) collectNodes(data, nodes);
  }

  const byId = new Map<string, JsonObject>();
  for (const n of nodes) if (typeof n["@id"] === "string") byId.set(n["@id"], n);

  const types: string[] = [];
  for (const n of nodes) {
    for (const t of typesOf(n)) if (!STRUCTURAL_TYPES.has(t) && !types.includes(t)) types.push(t);
  }

  // Commerces d'abord, puis organisations ; ordre du document à rang égal.
  const ranked = nodes
    .map((node, i) => ({ node, rank: nodeRank(node), i }))
    .filter((x) => x.rank >= 2)
    .sort((a, b) => b.rank - a.rank || a.i - b.i)
    .map((x) => x.node);

  const info: JsonLdInfo = {
    types,
    businessName: null,
    siteName: null,
    description: null,
    logos: [],
    photos: [],
    address: null,
    location: null,
  };
  for (const node of ranked) {
    info.businessName ??= str(node.name) ?? str(node.legalName);
    info.description ??= str(node.description);
    const logo = imageUrlOf(node.logo, byId);
    if (logo && !info.logos.includes(logo)) info.logos.push(logo);
    // `image` d'un commerce = souvent une photo de devanture : seulement si le fichier s'appelle « logo ».
    const image = imageUrlOf(node.image, byId);
    if (image && /logo/i.test(image) && !info.logos.includes(image)) info.logos.push(image);
    for (const photo of [image, imageUrlOf(node.photo, byId)]) {
      if (photo && !NOT_A_PHOTO_RE.test(photo) && !info.photos.includes(photo)) info.photos.push(photo);
    }
    const place = node.location && typeof node.location === "object" ? (node.location as JsonObject) : null;
    info.address ??= addressOf(node.address) ?? addressOf(place?.address);
    info.location ??= geoOf(node.geo) ?? geoOf(place?.geo);
  }
  const website = nodes.find((n) => typesOf(n).includes("WebSite"));
  if (website) info.siteName = str(website.name) ?? str(website.alternateName);
  return info;
}

// ─── Logos dans le HTML (<img>, <svg> inline) ─────────────────────────────

/**
 * Logos de tiers à ignorer (paiement, réseaux sociaux, plateformes, labels…).
 * Les mots courts ou ambigus exigent des frontières de mot (« visa » ne doit
 * pas exclure « logo-visagiste.png »).
 */
const THIRD_PARTY_RE =
  /(?:paypal|mastercard|master-card|american-express|apple-?pay|google|gpay|tripadvisor|deliveroo|uber-?eats|just-?eat|thefork|lafourchette|planity|treatwell|trustpilot|yelp|facebook|instagram|twitter|tiktok|youtube|linkedin|whatsapp|pinterest|snapchat|app-?store|play-?store|appstore|michelin|petit-?fute|routard|sumup|ticket-?resto|swile|edenred|carte-?bancaire|qualirepar|partenaire|partner|sponsor|shopify|wordpress|powered|made-?by|webdesign|certif|payment|paiement)|(?:^|[^a-z])(?:visa|amex|cb|label|clients?|awards?|gault|lydia|stripe|wix|agence|agency)(?=[^a-z]|$)/i;

/** Classes « marque » courantes (Bootstrap, WordPress…) en plus de tout ce qui contient « logo ». */
const BRAND_CLASS_RE = /(?:^|\s)(?:brand|navbar-brand|site-brand|brand-logo|site-title|header-brand|header__brand|custom-logo-link)(?:\s|$)/i;

function hasLogoHint(attrs: Record<string, string>): boolean {
  return /logo/i.test(`${attrs.class ?? ""} ${attrs.id ?? ""} ${attrs["aria-label"] ?? ""}`) || BRAND_CLASS_RE.test(attrs.class ?? "");
}

/** Plages [début, fin] des éléments <header> et <footer> (pour pondérer la position). */
function elementRanges(html: string, name: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const re = new RegExp(`<${name}\\b[\\s\\S]*?<\\/${name}\\s*>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) ranges.push([m.index, m.index + m[0].length]);
  return ranges;
}

function inRanges(pos: number, ranges: Array<[number, number]>): boolean {
  return ranges.some(([a, b]) => pos >= a && pos <= b);
}

/**
 * Contexte englobant : les 2 dernières balises ouvrantes avant `pos` (dans
 * les 600 caractères précédents) portent-elles un indice « logo » ? Et
 * l'élément est-il dans un lien vers la page d'accueil ?
 */
function enclosingHints(html: string, pos: number, base: URL): { logo: boolean; homeLink: boolean } {
  const before = html.slice(Math.max(0, pos - 600), pos);
  const opens = [...before.matchAll(/<(a|div|span|figure|picture|h1|p|header|li|strong)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi)];
  const lastTwo = opens.slice(-2).map((o) => ({ tag: o[1].toLowerCase(), attrs: parseAttrs(o[2]), index: o.index ?? 0 }));
  const logo = lastTwo.some((o) => hasLogoHint(o.attrs));

  let homeLink = false;
  const lastA = [...opens].reverse().find((o) => o[1].toLowerCase() === "a");
  if (lastA && !/<\/a\s*>/i.test(before.slice((lastA.index ?? 0) + lastA[0].length))) {
    const href = parseAttrs(lastA[2]).href;
    const abs = absolutize(href, base);
    if (abs) {
      const u = new URL(abs);
      homeLink =
        u.origin === base.origin &&
        /^\/(?:index\.(?:html?|php))?(?:[a-z]{2}(?:-[a-z]{2})?\/?)?$/i.test(u.pathname) &&
        !u.search;
    }
  }
  return { logo, homeLink };
}

/** Meilleure URL d'un <img> : attributs de lazy-loading, srcset (plus grande variante), src. */
function imgSource(attrs: Record<string, string>): { url: string | null; svgData: string | null } {
  const pickSrcset = (srcset: string | undefined): string | null => {
    if (!srcset) return null;
    let best: string | null = null;
    let bestW = -1;
    for (const part of srcset.split(/,\s+/)) {
      const [u, d] = part.trim().split(/\s+/);
      if (!u) continue;
      const w = d ? parseFloat(d) * (d.endsWith("x") ? 1000 : 1) : 1;
      if (w > bestW) {
        bestW = w;
        best = u;
      }
    }
    return best;
  };
  const candidates = [
    attrs["data-src"],
    attrs["data-lazy-src"],
    attrs["data-original"],
    pickSrcset(attrs["data-srcset"]),
    pickSrcset(attrs.srcset),
    attrs.src,
  ].filter((s): s is string => Boolean(s && s.trim()));

  for (const c of candidates) {
    const s = c.trim();
    if (/^data:image\/svg\+xml/i.test(s)) {
      const svg = decodeSvgDataUri(s);
      if (svg) return { url: null, svgData: svg };
      continue;
    }
    if (/^data:/i.test(s)) continue; // pixel transparent de lazy-loading
    return { url: s, svgData: null };
  }
  return { url: null, svgData: null };
}

function decodeSvgDataUri(uri: string): string | null {
  const comma = uri.indexOf(",");
  if (comma < 0) return null;
  const meta = uri.slice(0, comma);
  const data = uri.slice(comma + 1);
  try {
    const text = /;base64/i.test(meta) ? Buffer.from(data, "base64").toString("utf8") : decodeURIComponent(data);
    return text.includes("<svg") && text.length <= SVG_MAX_CHARS ? text : null;
  } catch {
    return null;
  }
}

/** Rend un SVG inline autonome (xmlns) ; null s'il dépend de symboles externes (<use href="#…">). */
function standaloneSvg(svg: string): string | null {
  if (svg.length > SVG_MAX_CHARS) return null;
  const usesExternal = /<use\b[^>]*href\s*=\s*["']#/i.test(svg);
  if (usesExternal && !/<(?:symbol|defs)\b/i.test(svg)) return null;
  let out = svg.trim();
  if (!/^<svg\b[^>]*\sxmlns\s*=/i.test(out)) out = out.replace(/^<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  if (/xlink:/i.test(out) && !/xmlns:xlink\s*=/i.test(out)) {
    out = out.replace(/^<svg\b/i, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
  }
  // Un SVG sans contenu dessiné est inutile.
  return /<(?:path|rect|circle|ellipse|polygon|polyline|line|text|image|g|use)\b/i.test(out) ? out : null;
}

/** Élément <svg> complet à partir de sa balise ouvrante (gère les <svg> imbriqués). */
function extractSvgElement(html: string, start: number): string | null {
  const re = /<\/?svg\b[^>]*>/gi;
  re.lastIndex = start;
  let depth = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m.index - start > SVG_MAX_CHARS) return null;
    if (m[0][1] === "/") {
      depth--;
      if (depth === 0) return html.slice(start, m.index + m[0].length);
    } else if (!m[0].endsWith("/>")) {
      depth++;
    }
  }
  return null;
}

/** Dimension déclarée (width/height/viewBox) la plus grande, ou null. */
function declaredSize(attrs: Record<string, string>): number | null {
  const w = parseFloat(attrs.width ?? "");
  const h = parseFloat(attrs.height ?? "");
  const dims = [w, h].filter((n) => Number.isFinite(n) && n > 0);
  if (dims.length) return Math.max(...dims);
  const vb = (attrs.viewbox ?? "").trim().split(/[\s,]+/).map(Number);
  if (vb.length === 4 && vb.every(Number.isFinite)) return Math.max(vb[2], vb[3]);
  return null;
}

interface RankedCandidate {
  candidate: LogoCandidate;
  score: number;
}

function findHtmlLogos(
  html: string,
  base: URL,
  pageName: string | null,
): { images: RankedCandidate[]; svgs: RankedCandidate[] } {
  const headers = elementRanges(html, "header");
  const footers = elementRanges(html, "footer");
  const bodyStart = Math.max(0, html.search(/<body\b/i));
  const length = Math.max(1, html.length - bodyStart);
  const nameKey = pageName ? normalizeForMatch(pageName) : "";

  const positionBonus = (pos: number) => 2 * (1 - Math.min(1, Math.max(0, pos - bodyStart) / length));

  const images: RankedCandidate[] = [];
  for (const tag of findTags(html, "img")) {
    const a = tag.attrs;
    const { url, svgData } = imgSource(a);
    const filename = (url ?? "").split(/[?#]/)[0].split("/").pop() ?? "";
    const ownText = `${filename} ${a.alt ?? ""} ${a.title ?? ""}`;
    if (THIRD_PARTY_RE.test(ownText) || THIRD_PARTY_RE.test(a.class ?? "")) continue;
    const size = declaredSize(a);
    if (size !== null && size < 24) continue;

    let score = 0;
    if (/logo/i.test(`${a.class ?? ""} ${a.id ?? ""}`)) score += 4;
    if (/logo/i.test(filename)) score += 4;
    if (/logo/i.test(a.alt ?? "")) score += 2;
    if (BRAND_CLASS_RE.test(a.class ?? "")) score += 3;
    const ctx = enclosingHints(html, tag.index, base);
    if (ctx.logo) score += 3;
    if (ctx.homeLink) score += 2;
    if (score === 0) continue; // aucun indice « logo » : on ne devine pas
    if (nameKey && a.alt && normalizeForMatch(a.alt).includes(nameKey)) score += 3;
    if (inRanges(tag.index, headers)) score += 3;
    if (inRanges(tag.index, footers)) score -= 3;
    score += positionBonus(tag.index);

    if (svgData) {
      const svg = standaloneSvg(svgData);
      if (svg) images.push({ candidate: { svg, kind: "inline-svg" }, score });
      continue;
    }
    const abs = absolutize(url, base);
    if (!abs) continue;
    images.push({ candidate: { url: abs, kind: "img-logo", ...(size ? { size } : {}) }, score });
  }

  const svgs: RankedCandidate[] = [];
  for (const tag of findTags(html, "svg")) {
    const a = tag.attrs;
    const own = hasLogoHint(a) || /logo/i.test(a.role === "img" ? (a["aria-label"] ?? "") : "");
    const ctx = enclosingHints(html, tag.index, base);
    if (!own && !ctx.logo && !ctx.homeLink) continue;
    const element = extractSvgElement(html, tag.index);
    if (!element) continue;
    const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(element)?.[1] ?? "";
    if (THIRD_PARTY_RE.test(`${a.class ?? ""} ${a.id ?? ""} ${a["aria-label"] ?? ""} ${title}`)) continue;
    // Petites icônes (menu burger, panier, loupe) : ignorées sauf indice explicite sur le SVG lui-même.
    const size = declaredSize(a);
    if (!own && size !== null && size <= 32) continue;
    const svg = standaloneSvg(element);
    if (!svg) continue;

    let score = (own ? 4 : 0) + (ctx.logo ? 3 : 0) + (ctx.homeLink ? 2 : 0);
    if (/logo/i.test(title)) score += 2;
    if (nameKey && title && normalizeForMatch(title).includes(nameKey)) score += 2;
    if (inRanges(tag.index, headers)) score += 3;
    if (inRanges(tag.index, footers)) score -= 3;
    score += positionBonus(tag.index);
    svgs.push({ candidate: { svg, kind: "inline-svg" }, score });
  }

  const byScore = (x: RankedCandidate, y: RankedCandidate) => y.score - x.score;
  return { images: images.sort(byScore).slice(0, 4), svgs: svgs.sort(byScore).slice(0, 2) };
}

// ─── Photos pour la bande ─────────────────────────────────────────────────

/** Fichiers qui ne sont pas des photos (logos, icônes, pixels, drapeaux…). */
const NOT_A_PHOTO_RE =
  /logo|icon|favicon|sprite|placeholder|blank|pixel|spacer|avatar|badge|flag|loader|loading|transparent|qr-?code|arrow|picto|signature|\.svgz?(?:$|\?)|\.gif(?:$|\?)/i;
/** Classes / alt d'une grande image de mise en avant. */
const HERO_HINT_RE = /hero|banner|banniere|slider|slide|carousel|cover|jumbotron|header|masthead|bg|background|fond|full-?width|splash|vitrine|devanture|facade/i;
const MAX_PHOTO_CANDIDATES = 6;

/** Largeur max annoncée dans un srcset (« a.jpg 800w, b.jpg 1600w » → 1600). */
function maxSrcsetWidth(srcset: string | undefined): number {
  let max = 0;
  for (const m of (srcset ?? "").matchAll(/\s(\d{2,5})w\b/g)) max = Math.max(max, Number(m[1]));
  return max;
}

/**
 * Photos candidates pour la bande, meilleure d'abord : og:image /
 * twitter:image en paysage, image(s) JSON-LD du commerce, puis les grandes
 * images (ou fonds CSS) du haut de la page. Le téléchargement et le contrôle
 * « vraie photo, assez grande, paysage » sont le travail de photo.ts.
 */
function findPhotoCandidates(
  html: string,
  base: URL,
  metas: Map<string, string>,
  jsonLdPhotos: string[],
): string[] {
  const out: string[] = [];
  const push = (raw: string | null | undefined) => {
    const abs = absolutize(raw, base);
    if (!abs || NOT_A_PHOTO_RE.test(abs) || THIRD_PARTY_RE.test(abs.split(/[?#]/)[0].split("/").pop() ?? "")) return;
    if (!out.includes(abs)) out.push(abs);
  };

  // 1. Images de partage, si paysage (ou dimensions inconnues).
  const ogW = Number(metas.get("og:image:width"));
  const ogH = Number(metas.get("og:image:height"));
  const ogLandscape = !(ogW > 0 && ogH > 0) || (ogW >= 600 && ogW / ogH >= 1.2);
  if (ogLandscape) {
    push(metas.get("og:image:secure_url") ?? metas.get("og:image"));
    push(metas.get("og:image:url"));
  }
  push(metas.get("twitter:image") ?? metas.get("twitter:image:src"));

  // 2. JSON-LD du commerce.
  for (const p of jsonLdPhotos.slice(0, 2)) push(p);

  // 3. Haut de page : grandes <img> et fonds CSS des sections « hero ».
  const bodyStart = Math.max(0, html.search(/<body\b/i));
  const topEnd = bodyStart + Math.max(60_000, Math.round((html.length - bodyStart) * 0.4));
  const top = html.slice(bodyStart, topEnd);
  const ranked: { url: string; score: number }[] = [];
  for (const tag of findTags(top, "img")) {
    const a = tag.attrs;
    const hints = `${a.class ?? ""} ${a.id ?? ""} ${a.alt ?? ""}`;
    if (hasLogoHint(a) || THIRD_PARTY_RE.test(hints)) continue;
    const { url } = imgSource(a);
    if (!url) continue;
    const width = Math.max(
      parseFloat(a.width ?? "") || 0,
      maxSrcsetWidth(a.srcset),
      maxSrcsetWidth(a["data-srcset"]),
    );
    const hero = HERO_HINT_RE.test(hints);
    if (width < 600 && !hero) continue;
    ranked.push({ url, score: (hero ? 3 : 0) + Math.min(width, 2400) / 800 - tag.index / Math.max(1, top.length) });
  }
  for (const m of top.matchAll(/<([a-z][\w-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi)) {
    const attrs = parseAttrs(m[2]);
    const style = attrs.style ?? "";
    const bg = /background(?:-image)?\s*:[^;]*url\(\s*['"]?([^'")]+)['"]?\s*\)/i.exec(style)?.[1];
    const lazyBg = attrs["data-bg"] ?? attrs["data-background"] ?? attrs["data-bg-src"] ?? attrs["data-background-image"];
    const url = bg ?? lazyBg;
    if (!url) continue;
    const hero = HERO_HINT_RE.test(`${attrs.class ?? ""} ${attrs.id ?? ""}`);
    ranked.push({ url, score: (hero ? 3 : 1) - (m.index ?? 0) / Math.max(1, top.length) });
  }
  ranked.sort((a, b) => b.score - a.score);
  for (const r of ranked) {
    if (out.length >= MAX_PHOTO_CANDIDATES) break;
    push(r.url);
  }
  return out.slice(0, MAX_PHOTO_CANDIDATES);
}

// ─── Manifest ─────────────────────────────────────────────────────────────

interface ManifestInfo {
  name: string | null;
  shortName: string | null;
  themeColor: string | null;
  backgroundColor: string | null;
  icons: RankedCandidate[];
}

async function fetchManifest(href: string): Promise<ManifestInfo | null> {
  try {
    const res = await safeFetch(href, {
      maxBytes: MANIFEST_MAX_BYTES,
      timeoutMs: MANIFEST_TIMEOUT_MS,
      accept: "application/manifest+json,application/json;q=0.9,*/*;q=0.5",
    });
    const json = JSON.parse(res.body.toString("utf8").replace(/^\ufeff/, "")) as JsonObject;
    if (!json || typeof json !== "object") return null;
    const base = new URL(res.url);

    const icons: RankedCandidate[] = [];
    if (Array.isArray(json.icons)) {
      for (const raw of json.icons as JsonObject[]) {
        if (!raw || typeof raw.src !== "string") continue;
        const purpose = typeof raw.purpose === "string" ? raw.purpose : "any";
        if (/monochrome/i.test(purpose) && !/any/i.test(purpose)) continue;
        const url = absolutize(raw.src, base);
        if (!url) continue;
        const svg = isSvgUrl(url, typeof raw.type === "string" ? raw.type : undefined);
        const size = svg ? 512 : parseSizes(typeof raw.sizes === "string" ? raw.sizes : undefined);
        if (!size || size < 192) continue;
        // Les icônes « maskable » ont une grosse marge de sécurité : légèrement moins bonnes.
        const score = size - (/maskable/i.test(purpose) && !/any/i.test(purpose) ? 1000 : 0);
        icons.push({ candidate: { url, kind: "manifest-icon", size }, score });
      }
    }
    icons.sort((a, b) => b.score - a.score);

    return {
      name: typeof json.name === "string" ? json.name : null,
      shortName: typeof json.short_name === "string" ? json.short_name : null,
      themeColor: parseCssColor(typeof json.theme_color === "string" ? json.theme_color : null),
      backgroundColor: parseCssColor(typeof json.background_color === "string" ? json.background_color : null),
      icons: icons.slice(0, 2),
    };
  } catch {
    // Manifest absent, protégé ou invalide : signal secondaire, on s'en passe.
    return null;
  }
}

// ─── Texte visible ────────────────────────────────────────────────────────

function visibleText(html: string): string {
  const bodyStart = html.search(/<body\b/i);
  let s = bodyStart >= 0 ? html.slice(bodyStart) : html.replace(/<head\b[\s\S]*?<\/head\s*>/i, " ");
  s = s
    .replace(/<(script|style|noscript|svg|template|nav|iframe|object|select|button)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(TAG_RE, " ");
  return cutAtWord(cleanText(s), TEXT_SAMPLE_MAX);
}

// ─── Pages « parking » / hébergeur par défaut ─────────────────────────────

/**
 * Domaine à vendre, parking publicitaire ou page par défaut d'un hébergeur :
 * leur nom et leur logo seraient ceux du revendeur / de l'hébergeur
 * (« Dovendi », logo OVH), pas ceux du commerce.
 */
const PLACEHOLDER_HTML_RE =
  /window\.location\.href\s*=\s*["']\/lander["']|\/__ovh\/|parkingcrew\.net|sedoparking\.com|bodis\.com|img\.sedoparking|dovendi\.|afternic\.com|hugedomains\.com|dan\.com\/buy-domain/i;
const PLACEHOLDER_TEXT_RE =
  /this domain (?:name )?(?:is|may be) (?:for sale|available)|domain (?:name )?is (?:for sale|parked)|buy this domain|ce (?:nom de )?domaine (?:est (?:à vendre|en vente|réservé|parqué)|vient d['’]être (?:enregistré|réservé))|achetez ce (?:nom de )?domaine|welcome to nginx|apache2? (?:ubuntu |debian )?default page|^it works!|^index of \//i;

function isPlaceholderPage(html: string, title: string | null, text: string): boolean {
  return PLACEHOLDER_HTML_RE.test(html.slice(0, 200_000)) || PLACEHOLDER_TEXT_RE.test(`${title ?? ""}\n${text.slice(0, 600)}`);
}

// ─── Récupération de la page ──────────────────────────────────────────────

const HTML_ACCEPT = "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5";

/** Redirection HTML `<meta http-equiv="refresh" content="0; url=…">` (pages « parking » de domaine). */
function metaRefreshTarget(html: string, base: URL): string | null {
  for (const tag of findTags(html.slice(0, 20_000), "meta")) {
    if ((tag.attrs["http-equiv"] ?? "").toLowerCase() !== "refresh") continue;
    const m = /^\s*(\d+(?:\.\d+)?)?\s*[;,]?\s*url\s*=\s*['"]?([^'"]+)['"]?/i.exec(tag.attrs.content ?? "");
    if (!m || Number(m[1] ?? 0) > 5) continue;
    return absolutize(m[2], base);
  }
  return null;
}

async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string; isHtml: boolean }> {
  const load = async (target: string) => {
    const res = await safeFetch(target, {
      maxBytes: HTML_MAX_BYTES,
      timeoutMs: HTML_TIMEOUT_MS,
      accept: HTML_ACCEPT,
      truncate: true,
    });
    const isHtml = !res.contentType || /html|xml|text\/plain/.test(res.contentType);
    return { html: isHtml ? decodeBody(res.body, res.headers.get("content-type")) : "", finalUrl: res.url, isHtml };
  };

  let first: Awaited<ReturnType<typeof load>>;
  try {
    first = await load(url);
  } catch (err) {
    // Beaucoup de petits sites (vieux hébergements mutualisés) n'ont pas de
    // HTTPS fonctionnel (port fermé, certificat expiré) alors que la saisie
    // sans « https:// » a été complétée en https : on retente en http. Le
    // saut reste validé par safeFetch.
    if (!(err instanceof SafeFetchError) || err.code !== "network" || !url.startsWith("https://")) throw err;
    first = await load(`http://${url.slice("https://".length)}`);
  }
  if (!first.isHtml) return first;
  const refresh = metaRefreshTarget(first.html, new URL(first.finalUrl));
  if (refresh && refresh !== first.finalUrl && visibleText(first.html).length < 500) {
    try {
      return await load(refresh);
    } catch {
      return first;
    }
  }
  return first;
}

// ─── API publique ─────────────────────────────────────────────────────────

/**
 * Analyse la page d'accueil d'un site.
 *
 * Lève `SafeFetchError` si la page elle-même est inaccessible (lien invalide
 * ou bloqué, site injoignable, erreur HTTP…) : l'orchestrateur décide alors
 * de dégrader. Les signaux secondaires (manifest, JSON-LD invalide…) se
 * dégradent silencieusement.
 *
 * `name` vaut `null` quand rien d'autre que le domaine n'est exploitable :
 * l'appelant applique `nameFromDomain` (repli explicite, signal « incertain »).
 */
export async function extractWebsiteSignals(url: string): Promise<WebsiteSignals> {
  const normalized = normalizeUserUrl(url);
  if (!normalized) throw new SafeFetchError("invalid_url", "Ce lien n'est pas valide. Vérifiez-le ou copiez-le à nouveau.");

  const page = await fetchHtml(normalized);
  const finalUrl = page.finalUrl;
  const empty: WebsiteSignals = {
    finalUrl,
    name: null,
    description: null,
    themeColor: null,
    manifestColors: [],
    logoCandidates: [],
    jsonLdTypes: [],
    address: null,
    location: null,
    textSample: "",
    photoCandidates: [],
  };
  if (!page.isHtml || !page.html) return empty;

  const html = page.html.replace(/<!--[\s\S]*?-->/g, " ");
  const headEnd = html.search(/<\/head\s*>/i);
  const head = headEnd > 0 ? html.slice(0, headEnd) : html.slice(0, 200_000);

  // Base des URLs relatives : URL finale, éventuellement remplacée par <base href>.
  let base = new URL(finalUrl);
  const baseHref = findTags(head, "base").find((t) => t.attrs.href)?.attrs.href;
  if (baseHref) {
    const abs = absolutize(baseHref, base);
    if (abs) base = new URL(abs);
  }
  const key = domainKey(new URL(finalUrl).hostname);

  // <meta> : property / name / itemprop → content (première valeur non vide).
  const metas = new Map<string, string>();
  const themeColors: Array<{ color: string; media: string }> = [];
  for (const tag of findTags(html, "meta")) {
    const k = (tag.attrs.property ?? tag.attrs.name ?? tag.attrs.itemprop ?? "").toLowerCase().trim();
    const content = (tag.attrs.content ?? "").trim();
    if (!k || !content) continue;
    if (k === "theme-color") {
      const color = parseCssColor(content);
      if (color) themeColors.push({ color, media: (tag.attrs.media ?? "").toLowerCase() });
      continue;
    }
    if (!metas.has(k)) metas.set(k, content);
  }

  const titleMatch =
    /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(head) ??
    (() => {
      // Pas de <title> dans le <head> : on accepte le premier du document s'il
      // précède tout <svg> (un <title> de SVG n'est pas le titre de la page).
      const m = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(html);
      const firstSvg = html.search(/<svg\b/i);
      return m && (firstSvg < 0 || m.index < firstSvg) ? m : null;
    })();
  const title = titleMatch ? cleanText(titleMatch[1]) : null;

  const textSample = visibleText(html);
  if (isPlaceholderPage(html, title, textSample)) return empty;

  const jsonLd = extractJsonLd(html);

  // Liens <link rel=…> : icônes et manifest.
  // Tout le document : certains CMS injectent les <link rel="icon"> hors du <head>.
  const links = findTags(html, "link");
  let manifestHref: string | null = null;
  const iconCandidates: RankedCandidate[] = [];
  let hasAppleTouchIcon = false;
  let hasAnyIcon = false;
  for (const { attrs } of links) {
    const rels = (attrs.rel ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    if (rels.length === 0) continue;
    if (rels.includes("manifest")) {
      manifestHref ??= absolutize(attrs.href, base);
      continue;
    }
    const href = absolutize(attrs.href, base);
    if (!href) continue;
    if (rels.includes("apple-touch-icon") || rels.includes("apple-touch-icon-precomposed")) {
      hasAppleTouchIcon = true;
      const size = parseSizes(attrs.sizes) ?? 180;
      iconCandidates.push({ candidate: { url: href, kind: "apple-touch-icon", size }, score: size });
    } else if (rels.includes("icon")) {
      hasAnyIcon = true;
      const svg = isSvgUrl(href, attrs.type);
      const size = svg ? 512 : parseSizes(attrs.sizes);
      const isIco = /\.ico(?:$|\?)/i.test(href) || /x-icon|vnd\.microsoft/i.test(attrs.type ?? "");
      const kind: LogoCandidate["kind"] = svg || (!isIco && (size ?? 0) >= 64) ? "icon" : "favicon";
      iconCandidates.push({ candidate: { url: href, kind, ...(size ? { size } : {}) }, score: size ?? 16 });
    }
  }
  const tile = metas.get("msapplication-tileimage");
  const tileUrl = tile ? absolutize(tile, base) : null;
  if (tileUrl) iconCandidates.push({ candidate: { url: tileUrl, kind: "icon", size: 144 }, score: 144 });
  // Beaucoup de sites servent /apple-touch-icon.png sans le déclarer : candidat
  // spéculatif (logo.ts passe au suivant s'il n'existe pas). Origine de la
  // page elle-même, pas celle d'un éventuel <base href> vers un CDN.
  const pageOrigin = new URL(finalUrl).origin;
  if (!hasAppleTouchIcon) {
    iconCandidates.push({
      candidate: { url: new URL("/apple-touch-icon.png", pageOrigin).toString(), kind: "apple-touch-icon", size: 180 },
      score: 0,
    });
  }
  if (!hasAnyIcon) {
    iconCandidates.push({ candidate: { url: new URL("/favicon.ico", pageOrigin).toString(), kind: "favicon" }, score: 0 });
  }

  // Manifest en parallèle de l'analyse des logos du HTML.
  const manifestPromise = manifestHref ? fetchManifest(manifestHref) : Promise.resolve(null);

  // og:image : seulement si (quasi) carrée quand les dimensions sont connues.
  const ogImageRaw = metas.get("og:image:secure_url") ?? metas.get("og:image") ?? metas.get("twitter:image");
  const ogImage = ogImageRaw ? absolutize(ogImageRaw, base) : null;
  const ogW = Number(metas.get("og:image:width"));
  const ogH = Number(metas.get("og:image:height"));
  const ogKnown = ogW > 0 && ogH > 0;
  const ogSquare = !ogKnown || (ogW / ogH >= 0.8 && ogW / ogH <= 1.25);

  const manifest = await manifestPromise;

  // Nom : og:site_name > JSON-LD (commerce puis site) > application-name >
  // apple-mobile-web-app-title > manifest > <title> > og:title.
  const nameSources = [
    metas.get("og:site_name"),
    jsonLd.businessName,
    jsonLd.siteName,
    metas.get("application-name"),
    metas.get("apple-mobile-web-app-title"),
    manifest?.name,
    manifest?.shortName,
    title,
    metas.get("og:title"),
  ];
  let name: string | null = null;
  for (const source of nameSources) {
    name = cleanNameCandidate(source, key);
    if (name) break;
  }

  const { images, svgs } = findHtmlLogos(html, base, name);

  const ranked: RankedCandidate[] = [
    ...jsonLd.logos
      .map((u) => absolutize(u, base))
      .filter((u): u is string => Boolean(u))
      .map((u, i) => ({ candidate: { url: u, kind: "jsonld" as const }, score: -i })),
    ...images,
    ...svgs,
    ...iconCandidates,
    ...(manifest?.icons ?? []),
  ];
  if (ogImage && ogSquare) {
    ranked.push({
      candidate: { url: ogImage, kind: "og-image", ...(ogKnown ? { size: Math.min(ogW, ogH) } : {}) },
      score: 0,
    });
  }

  const KIND_ORDER: LogoCandidate["kind"][] = [
    "jsonld",
    "img-logo",
    "inline-svg",
    "apple-touch-icon",
    "manifest-icon",
    "icon",
    "og-image",
    "favicon",
  ];
  // Tri par confiance de la source, puis score interne (taille, position…) ;
  // dédoublonnage par URL en gardant la source la plus fiable.
  const sorted = ranked
    .map((r, i) => ({ ...r, i }))
    .sort(
      (a, b) =>
        KIND_ORDER.indexOf(a.candidate.kind) - KIND_ORDER.indexOf(b.candidate.kind) ||
        b.score - a.score ||
        a.i - b.i,
    );
  // Plafond par source : inutile de proposer 9 tailles du même apple-touch-icon
  // (logo.ts télécharge les candidats dans l'ordre, chaque essai coûte du temps).
  const PER_KIND_MAX: Record<LogoCandidate["kind"], number> = {
    jsonld: 2,
    "img-logo": 4,
    "inline-svg": 2,
    "apple-touch-icon": 2,
    "manifest-icon": 2,
    icon: 2,
    "og-image": 1,
    favicon: 1,
    "places-photo": 1,
  };
  const perKind = new Map<LogoCandidate["kind"], number>();
  const seen = new Set<string>();
  const logoCandidates: LogoCandidate[] = [];
  for (const { candidate } of sorted) {
    const id = candidate.url ?? `svg:${candidate.svg?.length}:${candidate.svg?.slice(0, 200)}`;
    const count = perKind.get(candidate.kind) ?? 0;
    if (seen.has(id) || count >= PER_KIND_MAX[candidate.kind]) continue;
    seen.add(id);
    perKind.set(candidate.kind, count + 1);
    logoCandidates.push(candidate);
    if (logoCandidates.length >= MAX_CANDIDATES) break;
  }

  // theme-color : sans media ou thème clair d'abord, sinon le premier.
  const theme =
    themeColors.find((t) => !t.media) ??
    themeColors.find((t) => t.media.includes("light")) ??
    themeColors[0];
  const manifestColors = [manifest?.themeColor, manifest?.backgroundColor].filter(
    (c, i, all): c is string => Boolean(c) && all.indexOf(c) === i,
  );

  // Description : la première qui n'est pas un texte par défaut du CMS.
  const description =
    [metas.get("og:description"), metas.get("description"), jsonLd.description]
      .map((d) => (d ? cutAtWord(cleanText(d), DESCRIPTION_MAX) : ""))
      .find((d) => d.length > 0 && !DEFAULT_DESCRIPTION_RE.test(d)) ?? null;

  // Coordonnées hors JSON-LD : place:location:*, geo.position « lat;lng », ICBM « lat, lng ».
  let location = jsonLd.location;
  if (!location) {
    const pairs: Array<[string | undefined, string | undefined]> = [
      [metas.get("place:location:latitude"), metas.get("place:location:longitude")],
      [metas.get("og:latitude"), metas.get("og:longitude")],
      (metas.get("geo.position") ?? metas.get("icbm") ?? "").split(/[;,]\s*/) as [string, string],
    ];
    for (const [la, ln] of pairs) {
      const lat = Number(la);
      const lng = Number(ln);
      if (la && ln && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat || lng)) {
        location = { lat, lng };
        break;
      }
    }
  }

  return {
    finalUrl,
    name,
    description,
    themeColor: theme?.color ?? manifest?.themeColor ?? null,
    manifestColors,
    logoCandidates,
    jsonLdTypes: jsonLd.types,
    address: jsonLd.address,
    location,
    textSample,
    photoCandidates: findPhotoCandidates(html, base, metas, jsonLd.photos),
  };
}
