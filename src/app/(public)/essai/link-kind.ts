/**
 * Détection « live » du type de lien collé dans le générateur /essai.
 *
 * Pourquoi un module à part (et pas `lib/essai/brand/maps.ts` /
 * `instagram.ts`) : ces modules sont server-only (ils importent safe-fetch →
 * `node:dns`), les importer ici casserait le bundle client. On ne fait donc
 * qu'une reconnaissance syntaxique légère, alignée sur les règles du
 * serveur ; c'est le serveur qui reste seul juge (normalisation + sécurité).
 */

export type LinkKind =
  | "empty"
  | "website"
  | "maps"
  | "instagram"
  | "facebook"
  | "invalid";

/** Longueur max acceptée côté client (une URL plus longue n'a pas de sens ici). */
export const MAX_LINK_LENGTH = 2048;

const SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i;
// Pseudo Instagram saisi tel quel (« @coq.rizo ») : beaucoup de commerçants
// connaissent leur pseudo mais pas l'URL de leur profil.
const HANDLE_RE = /^@([a-z0-9._]{1,30})$/i;

/**
 * Nettoie la saisie avant envoi : espaces autour, pseudo « @xxx » → URL du
 * profil Instagram. Le reste (ajout de https://, etc.) est fait côté serveur.
 */
export function normalizeLinkInput(raw: string): string {
  const value = raw.trim().slice(0, MAX_LINK_LENGTH);
  const handle = HANDLE_RE.exec(value);
  if (handle) return `https://www.instagram.com/${handle[1]}/`;
  return value;
}

function parseLoose(value: string): URL | null {
  try {
    return new URL(SCHEME_RE.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
}

function isMapsLink(host: string, url: URL): boolean {
  const path = url.pathname.toLowerCase();
  if (host === "maps.app.goo.gl") return true;
  if (host === "goo.gl" && path.startsWith("/maps")) return true;
  if (host === "g.co" && path.startsWith("/kgs")) return true;
  if (/^maps\.google\.[a-z.]+$/.test(host)) return true;
  if (/^google\.[a-z.]+$/.test(host)) {
    if (path.startsWith("/maps")) return true;
    // Fiche affichée dans la recherche Google (« ludocid » / « kgmid »).
    if (
      path.startsWith("/search") &&
      (url.searchParams.has("ludocid") || url.searchParams.has("kgmid"))
    ) {
      return true;
    }
  }
  return false;
}

/** Type de lien reconnu, pour la pastille affichée sous le champ. */
export function detectLinkKind(raw: string): LinkKind {
  const value = normalizeLinkInput(raw);
  if (!value) return "empty";
  // Un nom de commerce tapé à la main contient presque toujours un espace.
  if (/\s/.test(value)) return "invalid";

  const url = parseLoose(value);
  if (!url || (url.protocol !== "http:" && url.protocol !== "https:")) {
    return "invalid";
  }
  // Identifiants dans l'URL : refusés par le serveur. Couvre aussi
  // « mailto:a@b.fr », que l'ajout de https:// transforme en user:pass@hôte.
  if (url.username || url.password) return "invalid";

  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, "");
  const tld = host.split(".").pop() ?? "";
  if (!host.includes(".") || host.endsWith(".") || tld.length < 2) {
    return "invalid";
  }

  if (
    host === "instagram.com" ||
    host.endsWith(".instagram.com") ||
    host === "instagr.am"
  ) {
    return "instagram";
  }
  if (
    host === "facebook.com" ||
    host.endsWith(".facebook.com") ||
    host === "fb.com" ||
    host === "fb.me"
  ) {
    return "facebook";
  }
  if (isMapsLink(host, url)) return "maps";
  return "website";
}

/** Nom de domaine lisible (« kebab-du-coin.fr ») pour l'écran de chargement. */
export function displayHost(raw: string): string | null {
  const url = parseLoose(normalizeLinkInput(raw));
  if (!url) return null;
  const host = url.hostname.replace(/^www\./, "");
  if (host === "instagram.com") {
    const handle = url.pathname.split("/").filter(Boolean)[0];
    return handle ? `@${handle}` : host;
  }
  return host || null;
}
