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
const NOISE_WORDS = new Set(["official", "officiel", "officielle", "offical", "insta", "ig", "page", "fr", "france"]);

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
  // On retire les mots parasites en fin (« _official », « .fr ») sauf s'il ne resterait rien.
  while (words.length > 1 && NOISE_WORDS.has(words[words.length - 1].toLowerCase())) words.pop();
  const guess = humanizeSlug(words.join("_"));
  return clampName(guess || handle);
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
