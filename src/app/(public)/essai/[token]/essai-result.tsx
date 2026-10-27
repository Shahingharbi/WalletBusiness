"use client";

/**
 * Résultat d'une carte d'essai, en 3 étapes numérotées (un seul geste par
 * étape) :
 *   1. Ajoutez-la à votre téléphone  (boutons wallet ; QR code sur ordinateur)
 *   2. Testez-la en direct           (tampon / promo / avis → vraie notif)
 *   3. Elle vous plaît ?             (je garde ma carte / WhatsApp / affiche)
 *
 * L'aperçu n'est pas une maquette : c'est l'image RÉELLE de la bande de
 * tampons servie au wallet (/api/wallet/banner/…), rechargée après chaque
 * tampon.
 */

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Check,
  Download,
  Lightbulb,
  LoaderCircle,
  MessageCircle,
  PartyPopper,
  Plus,
  RotateCcw,
  Smartphone,
  Star,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { WalletButtons } from "@/components/public/wallet-buttons";
import { useToast } from "@/components/ui/toast";
import { whatsappHref } from "@/lib/contact";
import { pickContrast } from "@/lib/utils";
import type {
  BrandColors,
  EssaiActionResponse,
  EssaiActionType,
  EssaiErrorResponse,
} from "@/lib/essai/types";

// Typographie française : les espaces avant « ! ? : » et à l'intérieur des
// guillemets « » sont des espaces insécables (U+00A0) écrits littéralement
// dans les chaînes, ou `&nbsp;` dans le JSX.

/** Données sérialisables préparées par la page serveur. */
export interface EssaiResultData {
  token: string;
  name: string;
  logoUrl: string | null;
  colors: BrandColors;
  /** Pastilles « vos couleurs » (hex, sans doublon, ≤ 5). */
  palette: string[];
  rewardText: string;
  labelStamps: string;
  stampCount: number;
  stamps: number;
  rewards: number;
  warnings: string[];
  claimed: boolean;
  /** Carte et carte client encore actives. */
  active: boolean;
  /** Démo de plus de `ttlDays` jours : tests en direct refusés par l'API. */
  expired: boolean;
  /** Durée de vie de la démo (ESSAI_TTL_DAYS, lib/essai/load.ts — server-only). */
  ttlDays: number;
  /** Date de fin de la démo, déjà formatée (« 2 novembre »). */
  expiresLabel: string;
  /** URL absolue de cette page (QR code, message WhatsApp). */
  pageUrl: string;
  qrDataUrl: string | null;
  appleWalletAvailable: boolean;
  googleWalletAvailable: boolean;
}

const FONT_TITLE = { fontFamily: "var(--font-ginto-nord)", fontWeight: 500 };
const FONT_UI = { fontFamily: "var(--font-maison-neue-extended)" };
const FONT_TEXT = { fontFamily: "var(--font-maison-neue)" };

/** Durée pendant laquelle un bouton de test reste « Envoyé ! » (anti double-clic). */
const COOLDOWN_MS = 8000;
/** Dimensions réelles de la bande de tampons générée pour le wallet. */
const BANNER_WIDTH = 1125;
const BANNER_HEIGHT = 369;

type ActionStatus = "idle" | "sending" | "sent" | "error";

const ACTIONS: ReadonlyArray<{
  type: EssaiActionType;
  title: string;
  hint: string;
  sentLabel: string;
  Icon: LucideIcon;
}> = [
  {
    type: "stamp",
    title: "Ajouter un tampon",
    hint: "Comme si votre client passait en caisse.",
    sentLabel: "Tampon ajouté ! Regardez votre téléphone 📲",
    Icon: Plus,
  },
  {
    type: "promo",
    title: "Recevoir une promo",
    hint: "Une notification, même téléphone verrouillé.",
    sentLabel: "Envoyé ! Regardez votre téléphone 📲",
    Icon: Bell,
  },
  {
    type: "review",
    title: "Demande d'avis Google",
    hint: "Vos clients vous notent en un appui.",
    sentLabel: "Envoyé ! Regardez votre téléphone 📲",
    Icon: Star,
  },
];

/** Erreur dont le message est déjà rédigé pour l'utilisateur. */
class FriendlyError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

// ─── Détection mobile / ordinateur ────────────────────────────────────────

type Platform = "ios" | "android" | "mobile" | "desktop";

function detectPlatform(): Platform {
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  // iPadOS 13+ se présente comme un Mac de bureau, mais tactile.
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return "ios";
  if (/Mobi|Opera Mini|IEMobile|Silk/i.test(ua)) return "mobile";
  return "desktop";
}

const subscribeNothing = () => () => {};

/**
 * Plateforme du visiteur, `null` pendant le rendu serveur. useSyncExternalStore
 * évite à la fois l'écart d'hydratation et le setState dans un effet.
 */
function usePlatform(): Platform | null {
  return useSyncExternalStore<Platform | null>(
    subscribeNothing,
    detectPlatform,
    () => null
  );
}

// ─── Aides ────────────────────────────────────────────────────────────────

function bannerUrl(token: string, stamps: number): string {
  return `/api/wallet/banner/${encodeURIComponent(token)}/${stamps}?kind=stamp`;
}

function isActionResponse(data: unknown): data is EssaiActionResponse {
  if (typeof data !== "object" || data === null) return false;
  const d = data as EssaiActionResponse;
  return (
    d.ok === true &&
    typeof d.stamps === "number" &&
    typeof d.stampCount === "number" &&
    typeof d.rewards === "number"
  );
}

function actionErrorMessage(status: number, data: unknown): string {
  if (status === 429) {
    return "Doucement 🙂 Beaucoup de tests d'un coup : patientez une minute.";
  }
  const fromServer =
    typeof data === "object" && data !== null
      ? (data as EssaiErrorResponse).error
      : undefined;
  if (typeof fromServer === "string" && fromServer.trim()) return fromServer.trim();
  if (status === 404) return "Cette carte d'essai est introuvable. Créez-en une nouvelle.";
  return "L'envoi n'a pas abouti. Réessayez dans un instant.";
}

// ─── Composant ────────────────────────────────────────────────────────────

export function EssaiResult({ data }: { data: EssaiResultData }) {
  const toast = useToast();
  const platform = usePlatform();
  const uid = useId();

  const [stamps, setStamps] = useState(data.stamps);
  const [stampCount, setStampCount] = useState(data.stampCount);
  const [rewards, setRewards] = useState(data.rewards);
  const [celebrate, setCelebrate] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [locked, setLocked] = useState<string | null>(
    data.expired
      ? `Cette démo a expiré au bout de ${data.ttlDays} jours : les tests en direct sont désactivés. Votre carte reste disponible : gardez-la ou créez-en une nouvelle.`
      : !data.active
        ? "Cette carte n'est plus active : les tests en direct sont désactivés."
        : null
  );
  const [status, setStatus] = useState<Record<EssaiActionType, ActionStatus>>({
    stamp: "idle",
    promo: "idle",
    review: "idle",
  });

  const [bannerSrc, setBannerSrc] = useState(() => bannerUrl(data.token, data.stamps));
  const [bannerLoading, setBannerLoading] = useState(false);
  const [bannerFailed, setBannerFailed] = useState(false);

  // Garde synchrone anti double-clic : l'état React n'est pas encore à jour
  // entre deux clics très rapprochés, un Set en ref l'est.
  const busyRef = useRef(new Set<EssaiActionType>());
  const timersRef = useRef(new Map<EssaiActionType, number>());
  const latestBannerRef = useRef<string | null>(null);

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, []);

  /**
   * Précharge la nouvelle bande de tampons puis l'affiche d'un coup : pas de
   * clignotement « image vide » entre l'ancienne et la nouvelle.
   */
  function refreshBanner(count: number) {
    const next = bannerUrl(data.token, count);
    latestBannerRef.current = next;
    setBannerLoading(true);
    const img = new window.Image();
    const settle = () => {
      // Une demande plus récente a pris le relais : on l'ignore.
      if (latestBannerRef.current !== next) return;
      setBannerSrc(next);
      setBannerFailed(false);
      setBannerLoading(false);
    };
    img.onload = settle;
    img.onerror = settle;
    img.src = next;
  }

  async function runAction(type: EssaiActionType) {
    if (locked || busyRef.current.has(type)) return;
    busyRef.current.add(type);
    if (type === "stamp") setCelebrate(false);
    setStatus((s) => ({ ...s, [type]: "sending" }));

    try {
      const res = await fetch(`/api/essai/${encodeURIComponent(data.token)}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok || !isActionResponse(body)) {
        throw new FriendlyError(actionErrorMessage(res.status, body), res.status);
      }

      setStampCount(body.stampCount);
      setStamps(body.stamps);
      if (body.rewards > rewards) setCelebrate(true);
      setRewards(body.rewards);
      if (type === "stamp") refreshBanner(body.stamps);
      if (body.message) setLastMessage(body.message);
      setStatus((s) => ({ ...s, [type]: "sent" }));

      const timerId = window.setTimeout(() => {
        busyRef.current.delete(type);
        timersRef.current.delete(type);
        setStatus((s) => ({ ...s, [type]: "idle" }));
      }, COOLDOWN_MS);
      timersRef.current.set(type, timerId);
    } catch (err) {
      busyRef.current.delete(type);
      setStatus((s) => ({ ...s, [type]: "error" }));
      if (err instanceof FriendlyError) {
        // 404 / 410 : démo expirée ou supprimée → on fige les tests avec le
        // message du serveur plutôt que de laisser réessayer en boucle.
        if (err.status === 404 || err.status === 410) setLocked(err.message);
        toast.error(err.message);
      } else {
        toast.error("Connexion impossible. Vérifiez votre connexion Internet, puis réessayez.");
      }
    }
  }

  const { background, text, accent } = data.colors;
  const accentText = pickContrast(accent);
  const isMobile = platform !== null && platform !== "desktop";
  const iosWithoutApple = platform === "ios" && !data.appleWalletAvailable;
  const noWallet = !data.appleWalletAvailable && !data.googleWalletAvailable;

  const whatsappText =
    `Bonjour ! Je viens de créer la carte de fidélité de « ${data.name} » ` +
    `avec aswallet et j'aimerais en parler avec vous. Voici ma carte : ${data.pageUrl}`;

  return (
    <div className="min-h-[calc(100dvh-52px)] bg-beige">
      <header className="mx-auto flex h-16 max-w-xl items-center justify-between gap-3 px-4 sm:px-6 lg:max-w-5xl">
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center rounded-md text-xl font-bold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
          style={{ fontFamily: "var(--font-ginto-nord)" }}
        >
          aswallet
        </Link>
        <Link
          href="/essai"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
          style={FONT_UI}
        >
          <RotateCcw size={15} aria-hidden />
          Recommencer
        </Link>
      </header>

      <div className="mx-auto max-w-xl px-4 pb-16 pt-2 sm:px-6 lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start lg:gap-10 lg:pt-6">
        {/* ── Colonne carte ── */}
        <div className="lg:sticky lg:top-6">
          <p
            className="inline-flex items-center gap-1.5 rounded-full bg-yellow px-3 py-1 text-[11px] font-bold uppercase text-foreground sm:text-xs"
            style={FONT_UI}
          >
            <PartyPopper size={13} aria-hidden />
            Votre carte est prête
          </p>

          {/* Carte aux couleurs du commerce — bande de tampons RÉELLE. */}
          <div
            className="mt-4 overflow-hidden rounded-[28px] p-4 shadow-[0_30px_60px_-24px_rgba(0,0,0,0.45)] ring-1 ring-black/5 sm:p-5"
            style={{ backgroundColor: background, color: text }}
          >
            <div className="flex items-center gap-3">
              {data.logoUrl ? (
                <Image
                  src={data.logoUrl}
                  alt={`Logo de ${data.name}`}
                  width={56}
                  height={56}
                  unoptimized
                  loading="eager"
                  className="h-14 w-14 shrink-0 rounded-2xl object-contain"
                />
              ) : (
                <span
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold"
                  style={{ backgroundColor: accent, color: accentText }}
                  aria-hidden
                >
                  {data.name.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p
                  className="text-[11px] font-semibold uppercase tracking-wider"
                  style={{ ...FONT_UI, opacity: 0.7 }}
                >
                  Carte de fidélité
                </p>
                <h1
                  className="break-words text-xl leading-tight sm:text-2xl"
                  style={FONT_TITLE}
                >
                  {data.name}
                </h1>
              </div>
            </div>

            <div
              className="relative mt-4 overflow-hidden rounded-2xl"
              style={{
                aspectRatio: `${BANNER_WIDTH} / ${BANNER_HEIGHT}`,
                backgroundColor: "rgba(0,0,0,0.12)",
              }}
            >
              {bannerFailed ? (
                <p
                  className="flex h-full items-center justify-center px-4 text-center text-sm"
                  style={{ ...FONT_TEXT, opacity: 0.75 }}
                >
                  Aperçu momentanément indisponible
                </p>
              ) : (
                <Image
                  src={bannerSrc}
                  alt={`Vos tampons : ${stamps} sur ${stampCount}`}
                  fill
                  unoptimized
                  loading="eager"
                  sizes="(min-width: 1024px) 440px, 100vw"
                  className="object-cover"
                  onError={() => setBannerFailed(true)}
                />
              )}
              {bannerLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/15">
                  <LoaderCircle
                    size={28}
                    className="text-white motion-safe:animate-spin"
                    aria-hidden
                  />
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] items-end gap-4">
              <div>
                <p
                  className="text-[11px] font-semibold uppercase tracking-wider"
                  style={{ ...FONT_UI, opacity: 0.7 }}
                >
                  {data.labelStamps}
                </p>
                <p
                  className="text-2xl font-semibold tabular-nums"
                  style={FONT_UI}
                  aria-live="polite"
                >
                  {stamps}
                  <span className="text-base" style={{ opacity: 0.7 }}>
                    {" "}
                    / {stampCount}
                  </span>
                </p>
              </div>
              <div className="min-w-0 text-right">
                <p
                  className="text-[11px] font-semibold uppercase tracking-wider"
                  style={{ ...FONT_UI, opacity: 0.7 }}
                >
                  Notre offre
                </p>
                <p
                  className="break-words text-sm font-semibold leading-snug sm:text-base"
                  style={FONT_UI}
                >
                  {data.rewardText}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1">
            <div
              className="flex items-center gap-2"
              role="img"
              aria-label="Couleurs détectées pour votre carte"
            >
              <span className="text-xs text-muted-foreground" style={FONT_TEXT}>
                Vos couleurs
              </span>
              <span className="flex -space-x-1.5">
                {data.palette.map((color) => (
                  <span
                    key={color}
                    className="h-6 w-6 rounded-full ring-2 ring-beige"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </span>
            </div>
            {!data.expired && (
              <p className="text-xs text-muted-foreground" style={FONT_TEXT}>
                Démo active jusqu&apos;au {data.expiresLabel}
              </p>
            )}
          </div>

          {data.warnings.length > 0 && (
            <div className="mt-4 flex gap-3 rounded-2xl bg-white p-4 ring-1 ring-foreground/5">
              <Lightbulb size={18} className="mt-0.5 shrink-0 text-amber-500" aria-hidden />
              <div className="min-w-0 text-sm leading-relaxed text-foreground/80" style={FONT_TEXT}>
                {data.warnings.map((w) => (
                  <p key={w}>{w}</p>
                ))}
                <Link
                  href="/essai?mode=photo"
                  className="mt-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-md font-semibold text-foreground underline underline-offset-4 hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
                  style={FONT_UI}
                >
                  Refaire avec une photo
                  <ArrowRight size={14} aria-hidden />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ── Colonne étapes ── */}
        <div className="mt-8 space-y-5 lg:mt-0">
          <Step n={1} id={`${uid}-step1`} title="Ajoutez-la à votre téléphone">
            {platform === null ? (
              // Rendu serveur : on ne sait pas encore s'il s'agit d'un
              // téléphone ou d'un ordinateur (réglé dès l'hydratation).
              <div className="h-28 rounded-2xl bg-beige motion-safe:animate-pulse" aria-hidden />
            ) : noWallet ? (
              <p className="text-sm leading-relaxed text-muted-foreground" style={FONT_TEXT}>
                L&apos;ajout au téléphone est momentanément indisponible.
                Réessayez un peu plus tard.
              </p>
            ) : isMobile ? (
              <>
                <p className="text-sm leading-relaxed text-muted-foreground" style={FONT_TEXT}>
                  Un seul appui&nbsp;: votre carte s&apos;ajoute à votre
                  téléphone, comme une carte d&apos;embarquement.
                </p>
                <div className="mt-4">
                  <WalletButtons
                    instanceToken={data.token}
                    appleWalletAvailable={data.appleWalletAvailable}
                    googleWalletAvailable={data.googleWalletAvailable}
                  />
                </div>
                {iosWithoutApple && (
                  <p
                    className="mt-3 rounded-xl bg-amber-50 p-3 text-sm leading-relaxed text-amber-900"
                    style={FONT_TEXT}
                  >
                    L&apos;ajout à Apple Wallet arrive très bientôt sur iPhone.
                    En attendant, vous pouvez tester avec un téléphone Android.
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="flex flex-col items-center gap-5 sm:flex-row">
                  {data.qrDataUrl && (
                    <div className="shrink-0 rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-foreground/10">
                      <Image
                        src={data.qrDataUrl}
                        alt="QR code à scanner avec votre téléphone"
                        width={184}
                        height={184}
                        unoptimized
                        className="h-[184px] w-[184px]"
                      />
                    </div>
                  )}
                  <div className="text-center sm:text-left">
                    <p className="flex items-center justify-center gap-2 font-semibold text-foreground sm:justify-start" style={FONT_UI}>
                      <Smartphone size={18} aria-hidden />
                      Scannez avec votre téléphone
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground" style={FONT_TEXT}>
                      Ouvrez l&apos;appareil photo et visez ce code. Cette page
                      s&apos;ouvre sur votre téléphone&nbsp;: touchez
                      «&nbsp;Ajouter&nbsp;», c&apos;est tout.
                    </p>
                  </div>
                </div>
                <div className="mt-5 border-t border-border pt-5">
                  <p className="mb-3 text-center text-sm text-muted-foreground" style={FONT_TEXT}>
                    Ou ajoutez-la depuis cet ordinateur&nbsp;:
                  </p>
                  <WalletButtons
                    instanceToken={data.token}
                    appleWalletAvailable={data.appleWalletAvailable}
                    googleWalletAvailable={data.googleWalletAvailable}
                  />
                </div>
              </>
            )}
          </Step>

          <Step n={2} id={`${uid}-step2`} title="Testez-la en direct">
            {locked ? (
              <p
                className="flex gap-2.5 rounded-xl bg-amber-50 p-3 text-sm leading-relaxed text-amber-900"
                style={FONT_TEXT}
              >
                <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden />
                {locked}
              </p>
            ) : (
              <>
                <p className="text-sm leading-relaxed text-muted-foreground" style={FONT_TEXT}>
                  {isMobile || platform === null
                    ? "Ajoutez d'abord la carte (étape 1), puis touchez un bouton : le résultat arrive sur votre téléphone."
                    : "Ajoutez d'abord la carte à votre téléphone (étape 1) : c'est là que tout s'affiche."}
                </p>
                <div className="mt-4 space-y-3">
                  {ACTIONS.map(({ type, title, hint, sentLabel, Icon }) => {
                    const state = status[type];
                    const busy = state === "sending" || state === "sent";
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => void runAction(type)}
                        aria-disabled={busy}
                        aria-busy={state === "sending"}
                        className={`flex w-full items-center gap-4 rounded-2xl border-2 p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow sm:p-4 ${
                          state === "sent"
                            ? "cursor-default border-emerald-400 bg-emerald-50"
                            : state === "sending"
                              ? "cursor-wait border-foreground/30 bg-white"
                              : "cursor-pointer border-border bg-white hover:border-foreground"
                        }`}
                      >
                        <span
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                          style={{ backgroundColor: accent, color: accentText }}
                          aria-hidden
                        >
                          <Icon size={22} strokeWidth={2.5} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className="block text-base font-semibold text-foreground"
                            style={FONT_UI}
                          >
                            {title}
                          </span>
                          <span
                            className={`mt-0.5 block text-sm leading-snug ${
                              state === "sent"
                                ? "font-semibold text-emerald-800"
                                : state === "error"
                                  ? "text-red-700"
                                  : "text-muted-foreground"
                            }`}
                            style={FONT_TEXT}
                            aria-live="polite"
                          >
                            {state === "sending"
                              ? "Envoi en cours…"
                              : state === "sent"
                                ? sentLabel
                                : state === "error"
                                  ? "Échec de l'envoi — touchez pour réessayer."
                                  : type === "stamp"
                                    ? `${hint} (${stamps}/${stampCount})`
                                    : hint}
                          </span>
                        </span>
                        <span className="shrink-0 text-foreground/40" aria-hidden>
                          {state === "sending" ? (
                            <LoaderCircle size={22} className="motion-safe:animate-spin" />
                          ) : state === "sent" ? (
                            <Check size={22} strokeWidth={3} className="text-emerald-600" />
                          ) : (
                            <ArrowRight size={20} />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {celebrate && (
                  <p
                    role="status"
                    className="mt-4 flex gap-2.5 rounded-2xl bg-yellow p-4 text-sm leading-relaxed text-foreground"
                    style={FONT_TEXT}
                  >
                    <PartyPopper size={18} className="mt-0.5 shrink-0" aria-hidden />
                    <span>
                      <strong style={FONT_UI}>Carte complète&nbsp;!</strong> Votre
                      client vient de débloquer&nbsp;: {data.rewardText}
                      {rewards > 1 ? ` (${rewards} récompenses en attente)` : ""}
                    </span>
                  </p>
                )}

                {lastMessage && (
                  <div className="mt-4 rounded-2xl bg-beige p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" style={FONT_UI}>
                      Message envoyé sur le téléphone
                    </p>
                    <p className="mt-1.5 break-words text-sm leading-relaxed text-foreground" style={FONT_TEXT}>
                      «&nbsp;{lastMessage}&nbsp;»
                    </p>
                  </div>
                )}
              </>
            )}
          </Step>

          <section
            aria-labelledby={`${uid}-step3`}
            className="relative overflow-hidden rounded-[28px] bg-foreground p-5 text-white sm:p-6"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-yellow/25 blur-3xl"
            />
            <div className="relative">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow text-sm font-bold text-foreground"
                  style={FONT_UI}
                  aria-hidden
                >
                  3
                </span>
                <h2 id={`${uid}-step3`} className="text-lg font-semibold sm:text-xl" style={FONT_UI}>
                  Elle vous plaît&nbsp;?
                </h2>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/75" style={FONT_TEXT}>
                Gardez cette carte telle quelle&nbsp;: on crée votre espace
                commerçant avec, sans rien ressaisir.
              </p>

              <Link
                href={`/essai/${encodeURIComponent(data.token)}/garder`}
                className="mt-5 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-yellow px-6 text-base font-semibold text-foreground shadow-xl transition-colors hover:bg-yellow-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
                style={FONT_UI}
              >
                {data.claimed ? "Retrouver ma carte" : "Je garde ma carte"}
                <ArrowRight size={18} aria-hidden />
              </Link>
              <p className="mt-2 text-center text-xs text-white/60" style={FONT_TEXT}>
                1er mois offert
              </p>

              <a
                href={whatsappHref(whatsappText)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full border-2 border-white/25 px-5 text-center text-sm font-semibold text-white transition-colors hover:border-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60 sm:text-base"
                style={FONT_UI}
              >
                <MessageCircle size={18} className="shrink-0" aria-hidden />
                Prendre rendez-vous sur WhatsApp
              </a>

              <a
                href={`/api/essai/${encodeURIComponent(data.token)}/poster`}
                className="mx-auto mt-3 flex min-h-[44px] w-fit items-center justify-center gap-2 rounded-md px-2 text-sm font-semibold text-white/80 underline underline-offset-4 transition-colors hover:text-yellow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                style={FONT_UI}
              >
                <Download size={16} className="shrink-0" aria-hidden />
                Télécharger l&apos;affiche comptoir (PDF)
              </a>
            </div>
          </section>

          <p className="pt-2 text-center text-sm text-muted-foreground" style={FONT_TEXT}>
            Pas tout à fait ça&nbsp;?{" "}
            <Link
              href="/essai"
              className="inline-flex min-h-[44px] items-center rounded-md font-semibold text-foreground underline underline-offset-4 hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
              style={FONT_UI}
            >
              Recommencer avec un autre lien ou une photo
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Step({
  n,
  id,
  title,
  children,
}: {
  n: number;
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-foreground/5 sm:p-6"
    >
      <div className="flex items-center gap-3">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow text-sm font-bold text-foreground"
          style={FONT_UI}
          aria-hidden
        >
          {n}
        </span>
        <h2 id={id} className="text-lg font-semibold text-foreground sm:text-xl" style={FONT_UI}>
          {title}
        </h2>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
