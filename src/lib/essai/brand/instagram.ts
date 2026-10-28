/**
 * Liens Instagram : on n'en extrait QUE le pseudo, sans jamais récupérer la
 * page (instagram.com est protégé par ses conditions d'utilisation et bloque
 * les robots de toute façon — cf. safe-fetch.ts qui refuse ce domaine).
 *
 * Le logo et les couleurs exactes viennent alors d'une capture d'écran du
 * profil (analysée par l'IA / logo.ts). Même principe pour Facebook.
 */

import { clampName, humanizeSlug } from "@/lib/essai/brand/category";

const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com", "m.instagram.com", "instagr.am", "www.instagr.am"]);

/** Premiers segments de chemin qui ne sont PAS des pseudos. */
const RESERVED_PATHS = new Set([
  "p", "reel", "reels", "tv", "stories", "explore", "accounts", "direct", "about", "legal",
  "developer", "challenge", "web", "s", "share", "tags", "locations", "emails", "session",
  "privacy", "terms", "help", "press", "api", "oauth", "static", "graphql", "ar",
]);

/** Pseudo Instagram : lettres, chiffres, points, tirets bas ; 30 car. max. */
const HANDLE_RE = /^[a-z0-9._]{1,30}$/;

/** Saisie seule « @pseudo » (sans lien). */
const BARE_HANDLE_RE = /^@([A-Za-z0-9._]{1,30})$/;

/** Suffixes de pseudo sans valeur pour le nom (« chezali_officiel » → « Chez Ali »). */
const NOISE_WORDS = new Set([
  "official", "officiel", "officielle", "offical", "officiel1", "off", "insta", "ig", "page", "fr", "france",
]);

/**
 * Ville / métier en fin de pseudo : retirés seulement s'il reste au moins
 * 2 mots (« chez_ali_paris » → « Chez Ali », mais « bistrot_paris » reste entier).
 */
const PLACE_TRADE_WORDS = new Set([
  "paris", "lyon", "marseille", "lille", "toulouse", "nantes", "bordeaux", "nice", "strasbourg", "montpellier",
  "rennes", "resto", "restaurant", "shop", "store",
]);

/** Mot qui ne peut pas finir un nom (« cafe_de_paris » ne devient pas « Café de »). */
const PARTICLE_RE = /^(?:de|du|des|d|la|le|les|l|a|au|aux|en|sur|in|of|the|chez)$/;

/**
 * Suffixes COLLÉS au nom (« chickenspotfrance » → « chickenspot »), du plus
 * long au plus court. Jamais une ville ni un métier collés (« berenice »,
 * « kickoff », « monstore » restent entiers). Retirés s'il reste ≥ 3 lettres.
 */
const GLUED_SUFFIXES = ["officielle", "officiel", "official", "offical", "france"];

/**
 * Restes trop génériques pour être un nom (« sushishop » ne devient pas
 * « Sushi », « pizzaparis » ne devient pas « Pizza ») : on garde alors le suffixe.
 */
const GENERIC_REMAINDERS = new Set([
  "sushi", "pizza", "pizzeria", "kebab", "burger", "burgers", "tacos", "chicken", "poulet", "wings", "food",
  "coffee", "cafe", "the", "tea", "bar", "wine", "barber", "barbier", "beauty", "beaute", "nail", "nails",
  "hair", "coiffure", "flower", "flowers", "fleurs", "bakery", "boulangerie", "patisserie", "bagel", "poke",
  "ramen", "bubble", "street", "kitchen", "grill", "snack", "glace", "glacier", "crepe", "creperie", "bio",
  "vintage", "concept", "le", "la", "les", "chez", "petit", "petite", "grand", "bon", "bonne", "vieux", "lepetit",
  "lapetite", "legrand", "lebon", "labonne",
]);

/** Retire les suffixes collés (« chickenspotfranceofficiel » → « chickenspot »). */
function stripGluedSuffixes(word: string): string {
  let current = word;
  for (let guard = 0; guard < 3; guard++) {
    const lower = current.toLowerCase();
    const suffix = GLUED_SUFFIXES.find((s) => lower.length > s.length && lower.endsWith(s));
    if (!suffix) break;
    const rest = current.slice(0, -suffix.length).replace(/[\s._-]+$/, "");
    const letters = rest.replace(/[^a-z]/gi, "");
    if (letters.length < 3 || GENERIC_REMAINDERS.has(rest.toLowerCase())) break;
    current = rest;
  }
  return current;
}

function parseUrl(input: string): URL | null {
  const s = (input ?? "").trim();
  if (!s) return null;
  try {
    return new URL(/^https?:\/\//i.test(s) ? s : `https://${s.replace(/^\/+/, "")}`);
  } catch {
    return null;
  }
}

/** `true` pour un lien instagram.com / instagr.am, ou un « @pseudo » seul. */
export function isInstagramUrl(url: string): boolean {
  if (BARE_HANDLE_RE.test((url ?? "").trim())) return true;
  const u = parseUrl(url);
  return Boolean(u && INSTAGRAM_HOSTS.has(u.hostname.toLowerCase()));
}

/**
 * Pseudo → nom probable : « coq.rizo_rotisserie » → « Coq Rizo Rôtisserie ».
 * Retire les séparateurs et chiffres finaux (« kebab_du_coin75 »), découpe
 * camelCase et mots collés connus, puis met en forme (Title Case).
 */
function guessNameFromHandle(handle: string): string {
  const base = handle.replace(/[._\d]+$/g, "").replace(/^[._]+/, "") || handle;
  const words = base.split(/[._]+/).filter(Boolean);
  // On retire les mots parasites en fin (« _official », « .fr », ville) sauf
  // s'il ne resterait qu'un reste générique (« sushi_shop », « le_petit_paris »)
  // ou un mot de liaison (« cafe_de_paris »).
  while (words.length > 1) {
    const last = words[words.length - 1].toLowerCase();
    const noise = NOISE_WORDS.has(last);
    if (!noise && !PLACE_TRADE_WORDS.has(last)) break;
    if (!noise && words.length < 3) break;
    const rest = words.slice(0, -1);
    if (PARTICLE_RE.test(rest[rest.length - 1].toLowerCase())) break;
    if (GENERIC_REMAINDERS.has(rest.join("").toLowerCase())) break;
    words.pop();
  }
  // Puis les suffixes collés au dernier mot (« chickenspotfrance »).
  if (words.length > 0) words[words.length - 1] = stripGluedSuffixes(words[words.length - 1]);
  const guess = humanizeSlug(words.join("_"));
  return clampName(guess || handle);
}

const HANDLE_CITIES = [...PLACE_TRADE_WORDS].filter(
  (w) => !["resto", "restaurant", "shop", "store"].includes(w)
);

/**
 * Ville lue dans un pseudo (« lafabrique.bordeaux », « chezali_paris »,
 * « pizzalyon ») → indice pour trouver la bonne fiche Google, ou null.
 */
export function cityFromHandle(handle: string | null | undefined): string | null {
  const h = (handle ?? "").trim().replace(/^@/, "").toLowerCase().replace(/[._\d]+$/g, "");
  const words = h.split(/[._]+/).filter(Boolean);
  if (words.length > 1 && HANDLE_CITIES.includes(words[words.length - 1])) return words[words.length - 1];
  const last = words[words.length - 1] ?? "";
  // Collée : jamais « nice » (« berenice », « pizzanice » = mot anglais).
  const glued = HANDLE_CITIES.find((c) => c !== "nice" && last.length - c.length >= 3 && last.endsWith(c));
  return glued ?? null;
}

/**
 * Nom lisible à partir d'un pseudo (« chickenspotfrance » → « Chicken Spot »).
 * Exporté pour l'orchestrateur : l'IA renvoie parfois le pseudo brut.
 */
export function nameFromHandle(handle: string): string {
  return guessNameFromHandle((handle ?? "").trim().replace(/^@/, "").toLowerCase());
}

/**
 * Extrait le pseudo d'un lien Instagram (ou d'un « @pseudo »).
 * Gère `instagram.com/<pseudo>`, `/<pseudo>/reel/<id>`, `/stories/<pseudo>/…`,
 * ignore la query (`?igsh=…`) ; renvoie `null` pour un lien de publication
 * (`/p/<id>`, `/reel/<id>`) qui ne contient pas le pseudo.
 */
export function parseInstagram(url: string): { handle: string; nameGuess: string } | null {
  const bare = BARE_HANDLE_RE.exec((url ?? "").trim());
  let handle: string | null = bare ? bare[1].toLowerCase() : null;

  if (!handle) {
    const u = parseUrl(url);
    if (!u || !INSTAGRAM_HOSTS.has(u.hostname.toLowerCase())) return null;
    const segments = u.pathname
      .split("/")
      .map((s) => {
        try {
          return decodeURIComponent(s).trim().toLowerCase();
        } catch {
          return "";
        }
      })
      .filter(Boolean);
    if (segments.length === 0) return null;

    let candidate = segments[0].replace(/^@/, "");
    // Story : /stories/<pseudo>/<id> → le pseudo est le 2e segment.
    if (candidate === "stories" && segments[1] && !RESERVED_PATHS.has(segments[1])) {
      candidate = segments[1].replace(/^@/, "");
    } else if (RESERVED_PATHS.has(candidate)) {
      return null;
    }
    handle = candidate;
  }

  // Un pseudo ne peut ni commencer ni finir par un point, ni en contenir deux d'affilée.
  if (!HANDLE_RE.test(handle) || /^\.|\.$|\.\./.test(handle)) return null;
  return { handle, nameGuess: guessNameFromHandle(handle) };
}

// ─── Facebook (même principe : jamais récupéré, seul le lien est lu) ──────

const FACEBOOK_HOSTS = /^(?:(?:www|m|mobile|web|business|fr-fr|fr)\.)?(?:facebook\.com|fb\.com|fb\.me)$/i;

/** Segments de chemin Facebook qui ne désignent pas une page de commerce. */
const FACEBOOK_RESERVED = new Set([
  "profile.php", "groups", "events", "watch", "marketplace", "share", "sharer", "sharer.php",
  "photo", "photo.php", "photos", "story.php", "permalink.php", "reel", "reels", "login",
  "login.php", "help", "policies", "privacy", "gaming", "hashtag", "search", "home.php",
  "settings", "messages", "notifications", "bookmarks", "stories", "l.php", "dialog", "plugins",
]);

/** `true` pour un lien facebook.com / fb.com / fb.me. */
export function isFacebookUrl(url: string): boolean {
  const u = parseUrl(url);
  return Boolean(u && FACEBOOK_HOSTS.test(u.hostname));
}

/**
 * Nom probable d'une page Facebook à partir de son lien :
 * `facebook.com/BoulangerieDupont` → « Boulangerie Dupont » ;
 * `/p/Chez-Ali-100063…/`, `/people/Chez-Ali/100…/`, `/pages/Chez-Ali/123…` → « Chez Ali ».
 * null pour un lien sans nom (profile.php?id=…, publication, groupe…).
 */
export function parseFacebook(url: string): { handle: string; nameGuess: string } | null {
  const u = parseUrl(url);
  if (!u || !FACEBOOK_HOSTS.test(u.hostname)) return null;
  const segments = u.pathname
    .split("/")
    .map((s) => {
      try {
        return decodeURIComponent(s).trim();
      } catch {
        return "";
      }
    })
    .filter(Boolean);
  if (segments.length === 0) return null;
  let raw = segments[0];
  if (["p", "people", "pages", "pg"].includes(raw.toLowerCase())) raw = segments[1] ?? "";
  if (!raw || FACEBOOK_RESERVED.has(raw.toLowerCase())) return null;
  // « Chez-Ali-100063512345678 » : l'identifiant numérique final n'est pas le nom.
  const handle = raw.replace(/[-.]?\d{6,}$/, "");
  if (!/^[\p{L}\p{N}._-]{2,80}$/u.test(handle)) return null;
  const guess = humanizeSlug(handle.replace(/-/g, "_"));
  return guess ? { handle, nameGuess: clampName(guess) } : null;
}
