"use client";

/**
 * Page résultat d'une carte d'essai.
 *
 *  - En vedette : la réplique Apple Wallet / Google Wallet de la carte
 *    (bande RÉELLE du pass), qui glisse dans le téléphone, s'incline à la
 *    souris / au gyroscope et réagit à chaque retouche ;
 *  - « Personnalisez-la en direct » : type, textes, couleurs, logo, photo —
 *    seulement pour le créateur (`boot.canEdit`) et tant que la carte n'est
 *    ni gardée ni expirée (sinon un court message à la place) ;
 *  - « Ajoutez-la à votre téléphone » (boutons wallet ; QR code sur
 *    ordinateur) ;
 *  - « Testez-la en direct » (tampon / promo / avis → vraie notification) ;
 *  - « Elle vous plaît ? » (je garde ma carte / WhatsApp / affiche).
 *
 * Aucun message technique : les suggestions du serveur deviennent des
 * invitations douces (« Ajoutez votre logo pour un rendu parfait »).
 */

import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bell,
  Check,
  Download,
  ImagePlus,
  LoaderCircle,
  MessageCircle,
  PartyPopper,
  Plus,
  RotateCcw,
  Smartphone,
  Star,
  Store,
  type LucideIcon,
} from "lucide-react";
import { WalletButtons } from "@/components/public/wallet-buttons";
import { useToast } from "@/components/ui/toast";
import { burstConfetti } from "@/components/essai/confetti";
import { looksLikeImage } from "@/components/essai/compress-image";
import { prefersReducedMotion, useDevicePlatform } from "@/components/essai/motion";
import { WalletPreviewStage, type WalletPlatform } from "@/components/essai/wallet-stage";
import { hasCounter, type StampPop, type WalletPassData } from "@/components/essai/wallet-pass-preview";
import styles from "@/components/essai/essai-wallet.module.css";
import { whatsappHref } from "@/lib/contact";
import { cn, pickContrast } from "@/lib/utils";
import type {
  EssaiActionResponse,
  EssaiActionType,
  EssaiCardView,
  EssaiErrorResponse,
  EssaiSuggestion,
} from "@/lib/essai/types";
import { RetouchPanel, type RetouchTab } from "./retouch-panel";
import { useEssaiView, type MediaKind } from "./use-essai-view";

/** Données sérialisables préparées par la page serveur. */
export interface EssaiResultBoot {
  /** Vue initiale (identique à GET /api/essai/<token>?view=full). */
  view: EssaiCardView;
  /** Couleurs détectées (pastilles « vos couleurs »). */
  palette: string[];
  /** Lien d'origine (Instagram…) pour refaire la carte avec une capture. */
  sourceUrl: string | null;
  /** Carte et carte client encore actives. */
  active: boolean;
  ttlDays: number;
  /**
   * Ce navigateur peut retoucher la carte (cookie de clé d'édition du
   * créateur, ou carte ancienne sans clé). Sinon : aucune retouche affichée.
   */
  canEdit: boolean;
  /** URL absolue de cette page (QR code, message WhatsApp). */
  pageUrl: string;
  qrDataUrl: string | null;
  appleWalletAvailable: boolean;
  googleWalletAvailable: boolean;
}

const FONT_UI = { fontFamily: "var(--font-maison-neue-extended)" };
const FONT_TEXT = { fontFamily: "var(--font-maison-neue)" };

/** Durée pendant laquelle un bouton de test reste « Envoyé » (anti double-clic). */
const COOLDOWN_MS = 8000;
const NAV_DELAY_MS = 650;

type ActionStatus = "idle" | "sending" | "sent" | "error";

/** Erreur dont le message est déjà rédigé pour le commerçant. */
class FriendlyError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
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
  if (status === 429) return "Beaucoup de tests d'un coup : patientez une minute.";
  const raw =
    typeof data === "object" && data !== null ? (data as EssaiErrorResponse).error : undefined;
  const msg = typeof raw === "string" ? raw.trim() : "";
  if (msg && status < 500 && !/\b\d{3}\b|erreur|error/i.test(msg)) return msg;
  return "L'envoi n'a pas abouti. Réessayez dans un instant.";
}

/** « 4 novembre », à l'heure de Paris (identique serveur / navigateur). */
function formatDay(iso: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      timeZone: "Europe/Paris",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

// ─── Composant ────────────────────────────────────────────────────────────

export function EssaiResult({ boot }: { boot: EssaiResultBoot }) {
  const toast = useToast();
  const router = useRouter();
  const device = useDevicePlatform();
  const uid = useId();
  const essai = useEssaiView(boot.view, toast);
  const { view } = essai;

  const [platformChoice, setPlatformChoice] = useState<WalletPlatform | null>(null);
  const platform: WalletPlatform = platformChoice ?? (device === "android" ? "google" : "apple");
  const [pop, setPop] = useState<StampPop | null>(null);
  const [tab, setTab] = useState<RetouchTab>("type");
  const [dismissed, setDismissed] = useState<EssaiSuggestion[]>([]);
  const [celebrate, setCelebrate] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [locked, setLocked] = useState<string | null>(
    boot.view.expired
      ? "Cette démo est terminée : les tests en direct sont en pause. Votre carte reste disponible : gardez-la ou créez-en une nouvelle."
      : !boot.active
        ? "Les tests en direct sont en pause pour cette carte."
        : null
  );
  const [status, setStatus] = useState<Record<EssaiActionType, ActionStatus>>({
    stamp: "idle",
    promo: "idle",
    review: "idle",
  });

  // Garde synchrone anti double-clic (l'état React n'est pas encore à jour
  // entre deux clics très rapprochés, un Set en ref l'est).
  const busyRef = useRef(new Set<EssaiActionType>());
  const timersRef = useRef(new Map<EssaiActionType, number>());
  const fileInputs = useRef<Record<MediaKind, HTMLInputElement | null>>({ logo: null, photo: null });

  // Relecture de la carte à l'ouverture (le serveur fait foi).
  const initialRefresh = useEffectEvent(() => {
    void essai.refresh();
  });
  useEffect(() => {
    initialRefresh();
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, []);

  const brandColors = [view.colors.accent, view.colors.background];

  // ── Images ──

  function openPicker(kind: MediaKind) {
    fileInputs.current[kind]?.click();
  }

  async function onFile(kind: MediaKind, file: File) {
    if (!looksLikeImage(file)) {
      toast.info("Ce fichier n'est pas une image. Choisissez une photo (JPG, PNG…).");
      return;
    }
    const ok = await essai.uploadMedia(kind, file);
    if (ok) {
      setDismissed((d) => [...d, ...(kind === "logo" ? (["add_logo", "add_screenshot"] as const) : (["add_photo"] as const))]);
      toast.success(kind === "logo" ? "Votre logo est en place." : "Votre photo est en place.");
    }
  }

  // ── Tests en direct ──

  async function runAction(type: EssaiActionType) {
    if (locked || busyRef.current.has(type)) return;
    busyRef.current.add(type);
    if (type === "stamp") setCelebrate(false);
    setStatus((s) => ({ ...s, [type]: "sending" }));
    const rewardsBefore = view.rewards;

    try {
      const res = await fetch(`/api/essai/${encodeURIComponent(view.token)}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok || !isActionResponse(body)) {
        throw new FriendlyError(actionErrorMessage(res.status, body), res.status);
      }
      if (body.message) setLastMessage(body.message);

      if (type === "stamp") {
        const completed = body.rewards > rewardsBefore;
        // La nouvelle bande est préchargée puis affichée en même temps que
        // le « pop » du tampon et le compteur.
        await essai.refresh({
          preloadBanner: true,
          onApplied: () => {
            if (completed) {
              setCelebrate(true);
              burstConfetti({ colors: brandColors });
            } else if (body.stamps > 0) {
              setPop({ key: Date.now(), index: body.stamps - 1 });
            }
          },
        });
      }
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
        if (err.status === 404 || err.status === 410) {
          setLocked("Les tests en direct sont en pause pour cette carte.");
        } else {
          toast.info(err.message);
        }
      } else {
        toast.info("Connexion impossible. Vérifiez votre connexion Internet, puis réessayez.");
      }
    }
  }

  // ── Confettis ──

  function onWalletClick(e: MouseEvent<HTMLDivElement>) {
    const link = (e.target as HTMLElement).closest("a");
    if (link) burstConfetti({ origin: link, colors: brandColors });
  }

  const garderHref = `/essai/${encodeURIComponent(view.token)}/garder`;
  function onKeep(e: MouseEvent<HTMLAnchorElement>) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    e.preventDefault();
    burstConfetti({ origin: e.currentTarget, colors: brandColors });
    window.setTimeout(() => router.push(garderHref), prefersReducedMotion() ? 0 : NAV_DELAY_MS);
  }

  // ── Dérivés ──

  const counter = hasCounter(view.cardType);
  const passData: WalletPassData = {
    token: view.token,
    name: view.name,
    logoUrl: view.logoUrl,
    colors: view.colors,
    cardType: view.cardType,
    stamps: view.stamps,
    stampCount: view.stampCount,
    labelStamps: view.labelStamps,
    rewardText: view.rewardText,
    firstName: view.firstName,
    bannerUrl: view.bannerUrl,
    photoUrl: view.photoUrl,
  };
  const ariaLabel = [
    `Aperçu de votre carte ${platform === "apple" ? "Apple Wallet" : "Google Wallet"} : ${view.name}.`,
    counter ? `${view.labelStamps} : ${view.stamps} sur ${view.stampCount}.` : "",
    view.firstName ? `Bonjour ${view.firstName}.` : "",
    `Notre offre : ${view.rewardText}.`,
  ]
    .filter(Boolean)
    .join(" ");

  // Retouches : créateur seulement, et tant que la carte est une démo vivante
  // (gardée → elle se modifie depuis le tableau de bord ; démo terminée).
  const editable = boot.canEdit && !view.claimed && !view.expired;
  const suggestions = view.suggestions.filter((s) => !dismissed.includes(s));
  const isMobile = device !== null && device !== "desktop";
  const iosWithoutApple = device === "ios" && !boot.appleWalletAvailable;
  const noWallet = !boot.appleWalletAvailable && !boot.googleWalletAvailable;
  const expiresLabel = formatDay(view.expiresAt);

  const whatsappText =
    `Bonjour ! Je viens de créer la carte de fidélité de « ${view.name} » ` +
    `avec aswallet et j'aimerais en parler avec vous. Voici ma carte : ${boot.pageUrl}`;

  const actions: ReadonlyArray<{
    type: EssaiActionType;
    title: string;
    hint: string;
    sentLabel: string;
    Icon: LucideIcon;
  }> = [
    ...(counter
      ? [
          {
            type: "stamp" as const,
            title: view.cardType === "cashback" ? "Créditer des points" : "Ajouter un tampon",
            hint: "Comme si votre client passait en caisse.",
            sentLabel: "C'est fait ! Regardez votre téléphone.",
            Icon: Plus,
          },
        ]
      : []),
    {
      type: "promo",
      title: "Recevoir une promo",
      hint: "Une notification, même téléphone verrouillé.",
      sentLabel: "Envoyé ! Regardez votre téléphone.",
      Icon: Bell,
    },
    {
      type: "review",
      title: "Demande d'avis Google",
      hint: "Vos clients vous notent en un appui.",
      sentLabel: "Envoyé ! Regardez votre téléphone.",
      Icon: Star,
    },
  ];
  const accent = view.colors.accent;
  const accentText = pickContrast(accent);

  return (
    <div className="min-h-[calc(100dvh-52px)] overflow-x-clip bg-beige">
      <header className="mx-auto flex h-16 max-w-xl items-center justify-between gap-3 px-4 sm:px-6 lg:max-w-6xl">
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

      <div className="mx-auto max-w-xl px-4 pb-16 pt-1 sm:px-6 lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:items-start lg:gap-12 lg:pt-4">
        {/* ── Colonne aperçu ── */}
        <div className="lg:sticky lg:top-4">
          <div className="text-center">
            <p
              className="inline-flex items-center gap-1.5 rounded-full bg-yellow px-3 py-1 text-[11px] font-bold uppercase text-foreground sm:text-xs"
              style={FONT_UI}
            >
              <PartyPopper size={13} aria-hidden />
              Votre carte est prête
            </p>
            <h1 className="sr-only">Votre carte de fidélité {view.name}</h1>
          </div>

          <WalletPreviewStage
            className="mt-4"
            data={passData}
            platform={platform}
            onPlatformChange={(p) => {
              setPop(null);
              setPlatformChoice(p);
            }}
            pop={pop}
            busy={{
              logo: essai.mediaBusy === "logo",
              strip: essai.mediaBusy === "photo",
              reward: essai.rewriting,
            }}
            ariaLabel={ariaLabel}
          />

          {!view.expired && expiresLabel && (
            <p className="mt-4 text-center text-xs text-muted-foreground" style={FONT_TEXT}>
              Démo active jusqu&apos;au {expiresLabel}
            </p>
          )}
        </div>

        {/* ── Colonne actions ── */}
        <div className="mt-8 space-y-5 lg:mt-0">
          {editable ? (
            <>
              {suggestions.length > 0 && (
                <Suggestions
                  suggestions={suggestions}
                  sourceUrl={boot.sourceUrl}
                  onPick={openPicker}
                />
              )}

              <RetouchPanel
                view={view}
                palette={boot.palette}
                tab={tab}
                onTab={setTab}
                saveState={essai.saveState}
                rewriting={essai.rewriting}
                mediaBusy={essai.mediaBusy}
                onUpdate={essai.update}
                onFlush={() => void essai.flush()}
                onRewrite={essai.rewriteOffer}
                onPick={openPicker}
              />
            </>
          ) : (
            <RetouchLockedNote reason={view.claimed ? "claimed" : view.expired ? "expired" : "viewer"} />
          )}

          <Step n={1} id={`${uid}-step1`} title="Ajoutez-la à votre téléphone">
            <div onClickCapture={onWalletClick}>
              {device === null ? (
                <div className="h-28 rounded-2xl bg-beige motion-safe:animate-pulse" aria-hidden />
              ) : noWallet ? (
                <p className="text-sm leading-relaxed text-muted-foreground" style={FONT_TEXT}>
                  L&apos;ajout au téléphone revient dans un instant. Réessayez un peu plus tard.
                </p>
              ) : isMobile ? (
                <>
                  <p className="text-sm leading-relaxed text-muted-foreground" style={FONT_TEXT}>
                    Un seul appui&nbsp;: votre carte s&apos;ajoute à votre téléphone,
                    comme une carte d&apos;embarquement.
                  </p>
                  <div className="mt-4">
                    <WalletButtons
                      instanceToken={view.token}
                      appleWalletAvailable={boot.appleWalletAvailable}
                      googleWalletAvailable={boot.googleWalletAvailable}
                    />
                  </div>
                  {iosWithoutApple && (
                    <p className="mt-3 rounded-xl bg-beige p-3 text-sm leading-relaxed text-foreground/80" style={FONT_TEXT}>
                      L&apos;ajout à Apple Wallet arrive très bientôt sur iPhone. En
                      attendant, vous pouvez tester avec un téléphone Android.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="flex flex-col items-center gap-5 sm:flex-row">
                    {boot.qrDataUrl && (
                      <div className="shrink-0 rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-foreground/10">
                        <Image
                          src={boot.qrDataUrl}
                          alt="QR code à scanner avec votre téléphone"
                          width={176}
                          height={176}
                          unoptimized
                          className="h-[176px] w-[176px]"
                        />
                      </div>
                    )}
                    <div className="text-center sm:text-left">
                      <p
                        className="flex items-center justify-center gap-2 font-semibold text-foreground sm:justify-start"
                        style={FONT_UI}
                      >
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
                      instanceToken={view.token}
                      appleWalletAvailable={boot.appleWalletAvailable}
                      googleWalletAvailable={boot.googleWalletAvailable}
                    />
                  </div>
                </>
              )}
            </div>
          </Step>

          <Step n={2} id={`${uid}-step2`} title="Testez-la en direct">
            {locked ? (
              <p className="rounded-xl bg-beige p-3 text-sm leading-relaxed text-foreground/80" style={FONT_TEXT}>
                {locked}
              </p>
            ) : (
              <>
                <p className="text-sm leading-relaxed text-muted-foreground" style={FONT_TEXT}>
                  {isMobile || device === null
                    ? "Ajoutez d'abord la carte (étape 1), puis touchez un bouton : le résultat arrive sur votre téléphone et sur l'aperçu."
                    : "Ajoutez d'abord la carte à votre téléphone (étape 1) : c'est là que tout s'affiche."}
                </p>
                <div className="mt-4 space-y-3">
                  {actions.map(({ type, title, hint, sentLabel, Icon }) => {
                    const state = status[type];
                    const busy = state === "sending" || state === "sent";
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => void runAction(type)}
                        aria-disabled={busy}
                        aria-busy={state === "sending"}
                        className={cn(
                          "flex w-full items-center gap-4 rounded-2xl border-2 p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow sm:p-4",
                          state === "sent"
                            ? "cursor-default border-emerald-400 bg-emerald-50"
                            : state === "sending"
                              ? "cursor-wait border-foreground/30 bg-white"
                              : "cursor-pointer border-border bg-white hover:border-foreground"
                        )}
                      >
                        <span
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                          style={{ backgroundColor: accent, color: accentText, transition: "background-color 500ms ease, color 500ms ease" }}
                          aria-hidden
                        >
                          <Icon size={22} strokeWidth={2.5} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-base font-semibold text-foreground" style={FONT_UI}>
                            {title}
                          </span>
                          <span
                            className={cn(
                              "mt-0.5 block text-sm leading-snug",
                              state === "sent" ? "font-semibold text-emerald-800" : "text-muted-foreground"
                            )}
                            style={FONT_TEXT}
                            aria-live="polite"
                          >
                            {state === "sending"
                              ? "Envoi en cours…"
                              : state === "sent"
                                ? sentLabel
                                : state === "error"
                                  ? "Touchez pour réessayer."
                                  : type === "stamp"
                                    ? `${hint} (${view.stamps}/${view.stampCount})`
                                    : hint}
                          </span>
                        </span>
                        <span className="shrink-0 text-foreground/40" aria-hidden>
                          {state === "sending" ? (
                            <LoaderCircle size={22} className="motion-safe:animate-spin" />
                          ) : state === "sent" ? (
                            <Check size={22} strokeWidth={3} className={cn("text-emerald-600", styles.checkPop)} />
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
                    className={cn("mt-4 flex gap-2.5 rounded-2xl bg-yellow p-4 text-sm leading-relaxed text-foreground", styles.riseIn)}
                    style={FONT_TEXT}
                  >
                    <PartyPopper size={18} className="mt-0.5 shrink-0" aria-hidden />
                    <span>
                      <strong style={FONT_UI}>Carte complète&nbsp;!</strong> Votre client
                      vient de débloquer&nbsp;: {view.rewardText}
                    </span>
                  </p>
                )}

                {lastMessage && (
                  <div className={cn("mt-4 rounded-2xl bg-beige p-4", styles.riseIn)}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" style={FONT_UI}>
                      Message reçu sur le téléphone
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
              className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-30"
              style={{ background: "radial-gradient(closest-side, #fff382, transparent)" }}
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
                Gardez cette carte telle quelle&nbsp;: on crée votre espace commerçant
                avec, sans rien ressaisir.
              </p>

              <Link
                href={garderHref}
                onClick={onKeep}
                className="mt-5 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-yellow px-6 text-base font-semibold text-foreground shadow-xl transition-colors hover:bg-yellow-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
                style={FONT_UI}
              >
                {view.claimed ? "Retrouver ma carte" : "Je garde ma carte"}
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
                href={`/api/essai/${encodeURIComponent(view.token)}/poster`}
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
              Recommencer avec un autre lien
            </Link>
          </p>
        </div>
      </div>

      {/* Sélecteurs de fichiers (logo / photo), ouverts par les boutons. */}
      {editable && (["logo", "photo"] as const).map((kind) => (
        <input
          key={kind}
          ref={(node) => {
            fileInputs.current[kind] = node;
          }}
          type="file"
          accept="image/*"
          className="hidden"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void onFile(kind, file);
          }}
        />
      ))}
    </div>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────

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
    <section aria-labelledby={id} className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-foreground/5 sm:p-6">
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

/** Remplace le panneau de retouches quand elles ne sont pas possibles ici. */
function RetouchLockedNote({ reason }: { reason: "claimed" | "expired" | "viewer" }) {
  const content =
    reason === "claimed" ? (
      <>
        <p className="font-semibold leading-snug text-foreground" style={FONT_UI}>
          Votre carte est dans votre espace
        </p>
        <p className="mt-0.5 text-sm leading-snug text-muted-foreground" style={FONT_TEXT}>
          Modifiez-la depuis votre{" "}
          <Link
            href="/dashboard"
            className="font-semibold text-foreground underline underline-offset-4 hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
          >
            tableau de bord
          </Link>
          .
        </p>
      </>
    ) : reason === "expired" ? (
      <>
        <p className="font-semibold leading-snug text-foreground" style={FONT_UI}>
          Démo terminée
        </p>
        <p className="mt-0.5 text-sm leading-snug text-muted-foreground" style={FONT_TEXT}>
          Les retouches sont fermées&nbsp;: gardez votre carte telle quelle, ou créez-en
          une nouvelle en 30&nbsp;secondes.
        </p>
      </>
    ) : (
      <p className="text-sm leading-snug text-muted-foreground" style={FONT_TEXT}>
        Les retouches se font depuis l&apos;appareil sur lequel la carte a été créée.
      </p>
    );
  return (
    <div className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-foreground/5">{content}</div>
  );
}

/** Invitations douces tirées de `view.suggestions` (jamais d'alerte). */
function Suggestions({
  suggestions,
  sourceUrl,
  onPick,
}: {
  suggestions: EssaiSuggestion[];
  sourceUrl: string | null;
  onPick: (kind: MediaKind) => void;
}) {
  const items: Array<{
    key: string;
    icon: ReactNode;
    title: string;
    text: string;
    action: ReactNode;
  }> = [];

  const btn =
    "inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-foreground px-4 text-sm font-semibold text-white transition-colors hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow cursor-pointer";

  if (suggestions.includes("add_screenshot")) {
    const href = sourceUrl
      ? `/essai?url=${encodeURIComponent(sourceUrl)}&mode=capture`
      : "/essai?mode=capture";
    items.push({
      key: "add_screenshot",
      icon: <InstagramGlyph />,
      title: "Votre vrai logo Instagram, en une capture",
      text: "Une capture d'écran de votre profil suffit : on y récupère votre logo et vos couleurs exactes.",
      action: (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link href={href} className={btn} style={FONT_UI}>
            Ajouter une capture
          </Link>
          <button
            type="button"
            onClick={() => onPick("logo")}
            className="inline-flex min-h-[44px] items-center rounded-md px-1 text-sm font-semibold text-foreground underline underline-offset-4 hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground cursor-pointer"
            style={FONT_UI}
          >
            ou importer mon logo
          </button>
        </div>
      ),
    });
  } else if (suggestions.includes("add_logo")) {
    items.push({
      key: "add_logo",
      icon: <ImagePlus size={18} aria-hidden />,
      title: "Ajoutez votre logo pour un rendu parfait",
      text: "Il s'affiche en haut de votre carte, à côté de votre nom.",
      action: (
        <button type="button" onClick={() => onPick("logo")} className={btn} style={FONT_UI}>
          <Plus size={16} aria-hidden />
          Ajouter mon logo
        </button>
      ),
    });
  }
  if (suggestions.includes("add_photo")) {
    items.push({
      key: "add_photo",
      icon: <Store size={18} aria-hidden />,
      title: "Ajoutez une photo de votre devanture",
      text: "Elle remplit la bande de votre carte, derrière les tampons.",
      action: (
        <button type="button" onClick={() => onPick("photo")} className={btn} style={FONT_UI}>
          <Plus size={16} aria-hidden />
          Ajouter une photo
        </button>
      ),
    });
  }

  if (items.length === 0) return null;
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.key}
          className={cn("flex gap-3 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-foreground/5", styles.riseIn)}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow text-foreground" aria-hidden>
            {item.icon}
          </span>
          <div className="min-w-0">
            <p className="font-semibold leading-snug text-foreground" style={FONT_UI}>
              {item.title}
            </p>
            <p className="mt-0.5 text-sm leading-snug text-muted-foreground" style={FONT_TEXT}>
              {item.text}
            </p>
            <div className="mt-3">{item.action}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function InstagramGlyph() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}
