/**
 * Récupération HTTP « sûre » des URLs fournies par les visiteurs de /essai.
 *
 * SERVER-ONLY (node:http, node:dns). Ne jamais importer depuis un composant client.
 *
 * Pourquoi ce module plutôt qu'un simple `fetch(url)` : l'URL vient d'un
 * inconnu sur Internet. Sans garde-fous, il suffirait de coller
 * `http://169.254.169.254/latest/meta-data` (métadonnées cloud),
 * `http://localhost:3000/api/...` ou un domaine qui résout vers 10.x.x.x pour
 * faire exécuter des requêtes internes par notre serveur (SSRF).
 *
 * Défenses, dans l'ordre :
 *  1. Seulement http/https, ports 80/443, aucun identifiant dans l'URL.
 *  2. Hôtes interdits : localhost, *.local, *.internal…, noms sans point,
 *     IP littérales privées/réservées, et Instagram/Facebook (pages protégées
 *     par leurs conditions d'utilisation : on ne les récupère jamais).
 *  3. Résolution DNS de TOUTES les adresses : une seule adresse privée ou
 *     réservée (IPv4 ou IPv6, y compris IPv4 encapsulée) ⇒ refus.
 *  4. Les adresses validées sont ÉPINGLÉES sur la connexion (option `lookup`
 *     de node:http) : pas de seconde résolution DNS, donc pas de « DNS
 *     rebinding » (un domaine qui répond une IP publique au contrôle puis
 *     127.0.0.1 à la connexion).
 *  5. Redirections en mode manuel : chaque saut est re-validé (étapes 1 à 4),
 *     4 sauts maximum.
 *  6. Délai global (AbortController) et taille maximale mesurée APRÈS
 *     décompression, en lecture streamée (protège aussi des « zip bombs »).
 *
 * On utilise node:http(s) plutôt que le `fetch` global (undici) parce que
 * `fetch` ne permet pas d'épingler l'IP de connexion sans dépendance externe.
 */

import http from "node:http";
import https from "node:https";
import type { LookupAddress } from "node:dns";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP, type LookupFunction } from "node:net";
import zlib from "node:zlib";
import type { Readable } from "node:stream";

export type SafeFetchErrorCode =
  | "invalid_url"
  | "blocked_host"
  | "timeout"
  | "too_large"
  | "http_error"
  | "too_many_redirects"
  | "network";

/**
 * Erreur typée : `code` permet à l'appelant de décider (dégrader, afficher un
 * message, réessayer) sans parser le texte. `message` est en français et
 * affichable tel quel à un commerçant.
 */
export class SafeFetchError extends Error {
  code: SafeFetchErrorCode;
  status?: number;

  constructor(code: SafeFetchErrorCode, message: string, status?: number) {
    super(message);
    this.name = "SafeFetchError";
    this.code = code;
    if (status !== undefined) this.status = status;
  }
}

export interface SafeFetchOptions {
  /** Taille max du corps décompressé (défaut 2 Mo). */
  maxBytes?: number;
  /** Délai global, redirections et lecture du corps comprises (défaut 8 s). */
  timeoutMs?: number;
  /** En-tête Accept (défaut « *\/* »). */
  accept?: string;
  /** Nombre max de redirections suivies (défaut 4). */
  maxRedirects?: number;
  /**
   * `false` : ne suit pas les redirections et renvoie la réponse 3xx telle
   * quelle (corps vide) pour que l'appelant lise `Location` lui-même — utilisé
   * pour les liens courts Google Maps. Défaut `true`.
   */
  followRedirects?: boolean;
  /**
   * `true` : au-delà de `maxBytes`, on coupe le téléchargement et on renvoie
   * le début du corps au lieu de lever `too_large`. Utile pour le HTML (le
   * <head> est au début) ; inutile pour une image (tronquée = illisible).
   * Défaut `false`.
   */
  truncate?: boolean;
}

export interface SafeFetchResult {
  /** URL finale, après redirections. */
  url: string;
  status: number;
  headers: Headers;
  /** Corps décompressé (vide pour une réponse 3xx non suivie). */
  body: Buffer;
  /** Type MIME sans paramètres, en minuscules (ex. « text/html »). Le charset reste lisible via `headers`. */
  contentType: string;
}

/** User-Agent honnête : on s'identifie, avec un lien de contact. */
export const SAFE_FETCH_USER_AGENT =
  "Mozilla/5.0 (compatible; aswalletBot/1.0; +https://aswallet.fr)";

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_REDIRECTS = 4;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const MESSAGES = {
  invalidUrl: "Ce lien n'est pas valide. Vérifiez-le ou copiez-le à nouveau.",
  credentials: "Ce lien contient des identifiants : il ne peut pas être analysé.",
  blocked: "Ce lien ne peut pas être analysé.",
  social:
    "Instagram et Facebook ne peuvent pas être lus directement : ajoutez plutôt une capture d'écran du profil.",
  timeout: "Le site met trop de temps à répondre.",
  tooLarge: "La page est trop volumineuse pour être analysée.",
  tooManyRedirects: "Ce lien redirige trop de fois.",
  notFound: "Ce site est introuvable. Vérifiez l'adresse.",
  network: "Impossible de joindre ce site pour le moment.",
} as const;

// ─── Normalisation de la saisie ───────────────────────────────────────────

/** Pseudo Instagram saisi seul (« @coq.rizo ») — 30 caractères max. */
const BARE_INSTAGRAM_HANDLE = /^@([A-Za-z0-9._]{1,30})$/;

/**
 * Transforme la saisie d'un visiteur en URL http(s) exploitable, ou `null`.
 *
 *  - trim, retire les chevrons/guillemets autour ;
 *  - si la saisie contient du texte autour d'un lien (partage depuis
 *    l'application Google Maps : « Nom\nAdresse\nhttps://maps.app.goo.gl/… »),
 *    on garde le premier lien ;
 *  - « @pseudo » → https://www.instagram.com/pseudo/ (les gens collent souvent
 *    leur pseudo plutôt que le lien) ;
 *  - ajoute `https://` si aucun schéma ; refuse tout schéma autre que http(s)
 *    (file:, ftp:, javascript:, data:…) ;
 *  - refuse les identifiants (user:pass@) et les hôtes sans point (« boulangerie »).
 *
 * Ne fait AUCUNE vérification réseau : la sécurité est assurée par `safeFetch`.
 */
export function normalizeUserUrl(input: string): string | null {
  if (typeof input !== "string") return null;
  let s = input.trim().replace(/^[<"'«\s]+|[>"'»\s]+$/g, "");
  if (!s || s.length > 2048) return null;

  const handle = BARE_INSTAGRAM_HANDLE.exec(s);
  if (handle) return `https://www.instagram.com/${handle[1].toLowerCase()}/`;

  if (/\s/.test(s)) {
    // Texte libre contenant un lien : on extrait le premier lien http(s).
    const m = /https?:\/\/[^\s<>"'«»]+/i.exec(s);
    if (!m) return null;
    s = m[0].replace(/[.,;:!?)\]}]+$/, "");
  }

  if (s.startsWith("//")) {
    s = `https:${s}`;
  } else if (!/^https?:\/\//i.test(s)) {
    // Un autre schéma explicite (« ftp://x », « file:///… », « mailto:… »,
    // « javascript:… ») est refusé. On ne confond pas « hote:port » avec un
    // schéma : un schéma n'est jamais suivi d'un chiffre seul.
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return null;
    if (/^(?:javascript|data|mailto|tel|sms|file|blob|about|vbscript|ftp|ws|wss|chrome|view-source):/i.test(s)) {
      return null;
    }
    s = `https://${s}`;
  }

  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  const host = u.hostname.replace(/\.$/, "");
  if (!host) return null;
  // Hôte sans point (« boulangerie », « localhost ») : jamais un site public.
  // Exception : IPv6 littérale ([…]) — laissée à safeFetch qui la refusera si
  // elle est privée.
  if (!host.includes(".") && !host.startsWith("[")) return null;
  u.hash = "";
  return u.toString();
}

// ─── Adresses IP interdites ───────────────────────────────────────────────

/** Plages IPv4 privées / réservées : [adresse de base, longueur du préfixe]. */
const BLOCKED_IPV4_RANGES: ReadonlyArray<readonly [string, number]> = [
  ["0.0.0.0", 8], // « ce réseau »
  ["10.0.0.0", 8], // privé
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local (métadonnées cloud 169.254.169.254)
  ["172.16.0.0", 12], // privé
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation (TEST-NET-1)
  ["192.168.0.0", 16], // privé
  ["198.18.0.0", 15], // benchmark
  ["198.51.100.0", 24], // documentation (TEST-NET-2)
  ["203.0.113.0", 24], // documentation (TEST-NET-3)
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // réservé + broadcast 255.255.255.255
];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

const BLOCKED_IPV4_INT = BLOCKED_IPV4_RANGES.map(([base, bits]) => {
  const size = 2 ** (32 - bits);
  const start = ipv4ToInt(base) as number;
  return { start, end: start + size - 1 };
});

function isBlockedIPv4Int(n: number): boolean {
  return BLOCKED_IPV4_INT.some((r) => n >= r.start && n <= r.end);
}

/** IPv6 → 8 mots de 16 bits (gère « :: », IPv4 finale et zone « %eth0 »). */
function parseIPv6(input: string): number[] | null {
  let s = input.replace(/^\[|\]$/g, "");
  const zone = s.indexOf("%");
  if (zone >= 0) s = s.slice(0, zone);

  // Partie IPv4 finale (::ffff:1.2.3.4) → deux mots de 16 bits.
  const lastColon = s.lastIndexOf(":");
  const tail = s.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = ipv4ToInt(tail);
    if (v4 === null) return null;
    s = `${s.slice(0, lastColon + 1)}${(v4 >>> 16).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }

  const halves = s.split("::");
  if (halves.length > 2) return null;
  const parseHalf = (h: string) => (h === "" ? [] : h.split(":"));
  const head = parseHalf(halves[0]);
  const rest = halves.length === 2 ? parseHalf(halves[1]) : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;

  const words = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...rest];
  const out: number[] = [];
  for (const w of words) {
    if (!/^[0-9a-f]{1,4}$/i.test(w)) return null;
    out.push(parseInt(w, 16));
  }
  return out.length === 8 ? out : null;
}

function isBlockedIPv6(ip: string): boolean {
  const w = parseIPv6(ip);
  if (!w) return true; // illisible ⇒ refus par prudence
  const embeddedV4 = (hi: number, lo: number) => hi * 65536 + lo;
  const zeros = (from: number, to: number) => w.slice(from, to).every((x) => x === 0);

  if (zeros(0, 8)) return true; // :: (non spécifiée)
  if (zeros(0, 7) && w[7] === 1) return true; // ::1 (loopback)
  if (zeros(0, 5) && w[5] === 0xffff) return isBlockedIPv4Int(embeddedV4(w[6], w[7])); // ::ffff:a.b.c.d
  if (zeros(0, 6)) return true; // ::a.b.c.d (IPv4-compatible, obsolète)
  if (w[0] === 0x64 && w[1] === 0xff9b) {
    // NAT64 : 64:ff9b::/96 encapsule une IPv4 ; 64:ff9b:1::/48 est local.
    return zeros(2, 6) ? isBlockedIPv4Int(embeddedV4(w[6], w[7])) : true;
  }
  if (w[0] === 0x2002) return isBlockedIPv4Int(embeddedV4(w[1], w[2])); // 6to4
  if (w[0] === 0x2001 && w[1] === 0x0000) return true; // Teredo
  if (w[0] === 0x2001 && w[1] === 0x0db8) return true; // documentation
  if (w[0] === 0x0100 && zeros(1, 4)) return true; // 100::/64 (discard)
  if ((w[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 (ULA, privé)
  if ((w[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 (link-local)
  if ((w[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 (site-local, obsolète)
  if ((w[0] & 0xff00) === 0xff00) return true; // ff00::/8 (multicast)
  return false;
}

/** `true` si l'adresse IP (v4 ou v6) est privée, réservée ou illisible. */
export function isBlockedIp(ip: string): boolean {
  const family = isIP(ip.replace(/^\[|\]$/g, "").replace(/%.*$/, ""));
  if (family === 4) {
    const n = ipv4ToInt(ip);
    return n === null || isBlockedIPv4Int(n);
  }
  if (family === 6) return isBlockedIPv6(ip);
  return true;
}

// ─── Hôtes interdits ──────────────────────────────────────────────────────

const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".intranet",
  ".lan",
  ".home.arpa",
  ".localdomain",
];

/**
 * Domaines jamais récupérés (pages protégées, conditions d'utilisation) :
 * pour Instagram on se contente de parser le pseudo (instagram.ts).
 */
const SOCIAL_DOMAINS = [
  "instagram.com",
  "instagr.am",
  "cdninstagram.com",
  "facebook.com",
  "fb.com",
  "fb.me",
  "fbcdn.net",
  "m.me",
];

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function isSocialHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return SOCIAL_DOMAINS.some((d) => hostMatches(host, d));
}

/**
 * Valide une URL (syntaxe + règles d'hôte + DNS) et renvoie les adresses à
 * épingler pour la connexion. Lève `SafeFetchError` sinon.
 */
async function validateTarget(
  rawUrl: string,
  deadline: number,
): Promise<{ url: URL; hostname: string; addresses: LookupAddress[] | null }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SafeFetchError("invalid_url", MESSAGES.invalidUrl);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SafeFetchError("invalid_url", MESSAGES.invalidUrl);
  }
  if (url.username || url.password) {
    throw new SafeFetchError("invalid_url", MESSAGES.credentials);
  }
  if (url.port !== "" && url.port !== "80" && url.port !== "443") {
    throw new SafeFetchError("blocked_host", MESSAGES.blocked);
  }

  // `URL` normalise déjà les IPv4 exotiques (2130706433, 0x7f.1…) en
  // « 127.0.0.1 » : le test isIP ci-dessous les attrape.
  const hostname = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (!hostname) throw new SafeFetchError("invalid_url", MESSAGES.invalidUrl);

  if (isIP(hostname)) {
    if (isBlockedIp(hostname)) throw new SafeFetchError("blocked_host", MESSAGES.blocked);
    // IP littérale publique : node:net ne fait pas de résolution DNS.
    return { url, hostname, addresses: null };
  }

  if (
    hostname === "localhost" ||
    !hostname.includes(".") ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    throw new SafeFetchError("blocked_host", MESSAGES.blocked);
  }
  if (isSocialHost(hostname)) {
    throw new SafeFetchError("blocked_host", MESSAGES.social);
  }

  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new SafeFetchError("timeout", MESSAGES.timeout);

  let addresses: LookupAddress[];
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // dns.lookup (getaddrinfo) n'est pas annulable : on le met en course
    // avec le délai restant.
    addresses = await Promise.race([
      dnsLookup(hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new SafeFetchError("timeout", MESSAGES.timeout)),
          remaining,
        );
      }),
    ]);
  } catch (err) {
    if (err instanceof SafeFetchError) throw err;
    throw new SafeFetchError("network", MESSAGES.notFound);
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (addresses.length === 0) throw new SafeFetchError("network", MESSAGES.notFound);
  // UNE seule adresse interne suffit à refuser : un attaquant peut publier
  // une IP publique ET une IP privée pour le même nom.
  if (addresses.some((a) => isBlockedIp(a.address))) {
    throw new SafeFetchError("blocked_host", MESSAGES.blocked);
  }
  return { url, hostname, addresses };
}

/**
 * `lookup` épinglé : la connexion n'utilise QUE les adresses déjà validées
 * (aucune nouvelle requête DNS ⇒ pas de DNS rebinding).
 */
function pinnedLookup(addresses: LookupAddress[]): LookupFunction {
  return (_hostname, options, callback) => {
    const wanted = options?.family;
    const familyNum = wanted === "IPv4" ? 4 : wanted === "IPv6" ? 6 : wanted;
    const list =
      familyNum === 4 || familyNum === 6
        ? addresses.filter((a) => a.family === familyNum)
        : addresses;
    if (list.length === 0) {
      const err: NodeJS.ErrnoException = new Error("Aucune adresse compatible");
      err.code = "ENOTFOUND";
      callback(err, "", 0);
      return;
    }
    if (options?.all) callback(null, list);
    else callback(null, list[0].address, list[0].family);
  };
}

// ─── Requête HTTP bas niveau ──────────────────────────────────────────────

function toHeaders(raw: http.IncomingHttpHeaders): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    try {
      if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
      else headers.set(key, value);
    } catch {
      // Valeur d'en-tête invalide pour l'API Headers (caractères de contrôle) : ignorée.
    }
  }
  return headers;
}

function mimeOf(contentType: string | null): string {
  return (contentType ?? "").split(";")[0].trim().toLowerCase();
}

function openRequest(
  target: { url: URL; hostname: string; addresses: LookupAddress[] | null },
  accept: string,
  signal: AbortSignal,
): Promise<http.IncomingMessage> {
  const { url, hostname, addresses } = target;
  const isHttps = url.protocol === "https:";
  const options: https.RequestOptions = {
    protocol: url.protocol,
    hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: `${url.pathname}${url.search}`,
    method: "GET",
    // Agent dédié, sans keep-alive : aucune socket ne survit à la requête et
    // aucune connexion d'un autre appel ne peut être réutilisée.
    agent: false,
    signal,
    headers: {
      "User-Agent": SAFE_FETCH_USER_AGENT,
      Accept: accept,
      "Accept-Language": "fr-FR,fr;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "close",
    },
  };
  if (addresses) options.lookup = pinnedLookup(addresses);

  return new Promise((resolve, reject) => {
    const req = (isHttps ? https : http).request(options, resolve);
    req.on("error", reject);
    req.end();
  });
}

function decodedStream(res: http.IncomingMessage): Readable {
  const encoding = String(res.headers["content-encoding"] ?? "").trim().toLowerCase();
  if (encoding === "gzip" || encoding === "x-gzip") return res.pipe(zlib.createGunzip());
  if (encoding === "br") return res.pipe(zlib.createBrotliDecompress());
  if (encoding === "deflate") return res.pipe(zlib.createInflate());
  return res;
}

/** Lit le corps (décompressé) en s'arrêtant à `maxBytes`. */
function readBody(
  res: http.IncomingMessage,
  maxBytes: number,
  truncate: boolean,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const stream = decodedStream(res);
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };
    const stop = () => {
      stream.removeAllListeners("data");
      res.destroy();
      if (stream !== res) stream.destroy();
    };

    stream.on("data", (chunk: Buffer) => {
      if (settled) return;
      if (total + chunk.length > maxBytes) {
        if (truncate) {
          chunks.push(chunk.subarray(0, maxBytes - total));
          total = maxBytes;
          finish(() => resolve(Buffer.concat(chunks, total)));
        } else {
          finish(() => reject(new SafeFetchError("too_large", MESSAGES.tooLarge)));
        }
        stop();
        return;
      }
      chunks.push(chunk);
      total += chunk.length;
    });
    stream.on("end", () => finish(() => resolve(Buffer.concat(chunks, total))));
    stream.on("error", (err) => finish(() => reject(err)));
    res.on("error", (err) => finish(() => reject(err)));
    // Connexion coupée par le serveur avant la fin.
    res.on("aborted", () => finish(() => reject(new Error("aborted"))));
  });
}

function toSafeFetchError(err: unknown, signal: AbortSignal): SafeFetchError {
  if (err instanceof SafeFetchError) return err;
  if (signal.aborted) return new SafeFetchError("timeout", MESSAGES.timeout);
  return new SafeFetchError("network", MESSAGES.network);
}

// ─── API publique ─────────────────────────────────────────────────────────

/**
 * GET sécurisé d'une URL publique. Voir l'en-tête du fichier pour les règles.
 *
 * Lève `SafeFetchError` :
 *  - `invalid_url` / `blocked_host` : URL refusée (aucune requête n'est partie
 *    vers une adresse interne) ;
 *  - `http_error` (avec `status`) : réponse ≥ 400 ou 3xx sans `Location` ;
 *  - `too_many_redirects`, `timeout`, `too_large`, `network`.
 */
export async function safeFetch(
  url: string,
  opts: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const accept = opts.accept ?? "*/*";
  const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const followRedirects = opts.followRedirects ?? true;
  const truncate = opts.truncate ?? false;

  const deadline = Date.now() + timeoutMs;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let current = url;
    for (let hop = 0; ; hop++) {
      const target = await validateTarget(current, deadline);
      let res: http.IncomingMessage;
      try {
        res = await openRequest(target, accept, controller.signal);
      } catch (err) {
        throw toSafeFetchError(err, controller.signal);
      }

      const status = res.statusCode ?? 0;
      const headers = toHeaders(res.headers);
      const finalUrl = target.url.toString();

      if (REDIRECT_STATUSES.has(status)) {
        res.destroy(); // le corps d'une redirection ne nous intéresse pas
        const location = headers.get("location");
        if (!location) {
          throw new SafeFetchError("http_error", `Le site a répondu avec une erreur (HTTP ${status}).`, status);
        }
        if (!followRedirects) {
          return { url: finalUrl, status, headers, body: Buffer.alloc(0), contentType: mimeOf(headers.get("content-type")) };
        }
        if (hop >= maxRedirects) {
          throw new SafeFetchError("too_many_redirects", MESSAGES.tooManyRedirects);
        }
        let next: URL;
        try {
          next = new URL(location, target.url);
        } catch {
          throw new SafeFetchError("invalid_url", MESSAGES.invalidUrl);
        }
        current = next.toString(); // re-validé au tour suivant
        continue;
      }

      if (status < 200 || status >= 300) {
        res.destroy();
        throw new SafeFetchError("http_error", `Le site a répondu avec une erreur (HTTP ${status}).`, status);
      }

      // Refus anticipé si le serveur annonce déjà une taille trop grande
      // (corps non compressé uniquement : sinon la taille annoncée est compressée).
      const declared = Number(headers.get("content-length"));
      if (!truncate && !headers.get("content-encoding") && Number.isFinite(declared) && declared > maxBytes) {
        res.destroy();
        throw new SafeFetchError("too_large", MESSAGES.tooLarge);
      }

      let body: Buffer;
      try {
        body = await readBody(res, maxBytes, truncate);
      } catch (err) {
        throw toSafeFetchError(err, controller.signal);
      }
      return { url: finalUrl, status, headers, body, contentType: mimeOf(headers.get("content-type")) };
    }
  } finally {
    clearTimeout(timer);
  }
}
