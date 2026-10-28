"use client";

/**
 * Générateur « Votre carte de fidélité en 30 secondes » — une seule page,
 * pensée d'abord pour le téléphone et pour des commerçants peu à l'aise
 * avec l'informatique :
 *  - UN champ (lien du site, de la fiche Google Maps ou d'Instagram) ;
 *  - trois tuiles facultatives : logo, photo de la devanture, capture du
 *    profil Instagram (mise en avant, avec un guide en 3 étapes, dès qu'un
 *    lien Instagram est collé) ;
 *  - le prénom (facultatif) pour « Bonjour <prénom> » sur la carte ;
 *  - pendant la création : le choix du type de carte (4 grosses tuiles)
 *    et les étapes qui défilent.
 *
 * Les images sont TOUJOURS compressées dans le navigateur avant l'envoi ;
 * aucune taille ni limite n'est jamais affichée.
 */

import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  ClipboardPaste,
  Globe,
  ImagePlus,
  Link2,
  LoaderCircle,
  MapPin,
  RotateCcw,
  Smartphone,
  Sparkles,
  Store,
  X,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { CardTypePicker } from "@/components/essai/card-type-picker";
import {
  ImageUnreadableError,
  compressImage,
  fitUploadBudget,
  looksLikeImage,
  type ImageRole,
} from "@/components/essai/compress-image";
import styles from "@/components/essai/essai-wallet.module.css";
import { cn } from "@/lib/utils";
import type {
  EssaiCardType,
  EssaiCardView,
  EssaiCreateResponse,
  EssaiErrorResponse,
} from "@/lib/essai/types";
import {
  MAX_LINK_LENGTH,
  detectLinkKind,
  displayHost,
  normalizeLinkInput,
  type LinkKind,
} from "./link-kind";

// Typographie française : espaces insécables (U+00A0) avant « : ; ! ? »
// et à l'intérieur des guillemets, écrits ` ` ou `&nbsp;`.

const FONT_TITLE = { fontFamily: "var(--font-ginto-nord)", fontWeight: 500 };
const FONT_UI = { fontFamily: "var(--font-maison-neue-extended)" };
const FONT_TEXT = { fontFamily: "var(--font-maison-neue)" };

const ROLES: readonly ImageRole[] = ["logo", "photo", "screenshot"];
const NAME_MAX = 40;
const FIRST_NAME_MAX = 30;
/** La route a `maxDuration = 60` : au-delà, inutile d'attendre. */
const CLIENT_TIMEOUT_MS = 75_000;
/** Le temps de lire « C'est prêt ! » avant d'ouvrir la carte. */
const READY_PAUSE_MS = 750;
/** Au-delà, une photo ne vaut pas le temps de réduction sur un téléphone. */
const MAX_RAW_BYTES = 40 * 1024 * 1024;

const LINK_STEPS = [
  "Analyse de votre lien…",
  "Récupération de votre logo…",
  "Choix de vos couleurs…",
  "Sélection de la plus belle photo…",
  "Rédaction de votre offre…",
  "Fabrication de votre carte…",
];
const IMAGE_STEPS = [
  "Lecture de vos images…",
  "Mise au propre de votre logo…",
  "Choix de vos couleurs…",
  "Mise en valeur de votre photo…",
  "Rédaction de votre offre…",
  "Fabrication de votre carte…",
];
/**
 * Début (ms) de chaque étape, calé sur les temps réels du serveur. La
 * dernière reste affichée jusqu'à la réponse : on n'annonce jamais « C'est
 * prêt » avant que la carte existe vraiment.
 */
const STEP_STARTS_MS = [0, 2600, 5600, 8800, 12000, 15000];

type Phase = "idle" | "loading" | "finishing" | "done";

interface Picked {
  file: File;
  previewUrl: string;
  /** Compression lancée dès la sélection (prête au moment de l'envoi). */
  prepared: Promise<File>;
}

type PickedMap = Record<ImageRole, Picked | null>;

interface Job {
  label: string | null;
  thumbUrl: string | null;
  steps: string[];
  needsPatch: boolean;
}

const TILES: Record<ImageRole, { title: string; hint: string; icon: ReactNode }> = {
  logo: { title: "Logo", hint: "Un fichier ou une photo", icon: <ImagePlus size={22} aria-hidden /> },
  photo: {
    title: "Photo de la devanture",
    hint: "Façade ou intérieur",
    icon: <Store size={22} aria-hidden />,
  },
  screenshot: {
    title: "Capture du profil Instagram",
    hint: "Votre page, en capture",
    icon: <InstagramGlyph size={22} />,
  },
};

/** Erreur dont le message est déjà rédigé pour le commerçant. */
class FriendlyError extends Error {}

// ─── Aides ────────────────────────────────────────────────────────────────

function isCreateResponse(data: unknown): data is EssaiCreateResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as EssaiCreateResponse).token === "string" &&
    (data as EssaiCreateResponse).token.length > 0
  );
}

/**
 * Message affiché si la création échoue. Jamais de détail technique :
 * seuls les messages serveur déjà rédigés pour le commerçant passent.
 */
function createErrorMessage(status: number, data: unknown): string {
  if (status === 429) {
    return "Beaucoup d'essais en peu de temps. Patientez une minute, puis réessayez.";
  }
  if (status === 413) {
    return "Une de vos images n'a pas pu être envoyée. Essayez avec une autre photo.";
  }
  if (status >= 500) {
    return "Votre carte n'a pas pu être créée cette fois-ci. Réessayez dans un instant.";
  }
  const raw =
    typeof data === "object" && data !== null ? (data as EssaiErrorResponse).error : undefined;
  const fromServer = typeof raw === "string" ? raw.trim() : "";
  if (fromServer && !/\b\d{3}\b|\bMo\b|erreur|error/i.test(fromServer)) return fromServer;
  return "Nous n'avons pas pu lire ce lien. Vérifiez-le, ou ajoutez votre logo et une photo de votre devanture.";
}

/** Progression « réaliste » : rapide au début, ralentit, plafonne à 94 %. */
function progressFor(elapsedMs: number): number {
  return 0.94 * (1 - Math.exp(-elapsedMs / 9500));
}

function currentStepIndex(elapsedMs: number): number {
  let index = 0;
  STEP_STARTS_MS.forEach((start, i) => {
    if (elapsedMs >= start) index = i;
  });
  return index;
}

function emptyPicked(): PickedMap {
  return { logo: null, photo: null, screenshot: null };
}

// ─── Composant principal ──────────────────────────────────────────────────

export function EssaiForm({
  initialUrl,
  initialMode,
}: {
  initialUrl: string;
  /** « photo » : arrivée par « prenez une photo » ; « capture » : guide Instagram. */
  initialMode: "photo" | "capture" | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const uid = useId();
  const urlId = `${uid}-url`;
  const urlHintId = `${uid}-url-hint`;
  const firstNameId = `${uid}-first`;
  const firstNameHintId = `${uid}-first-hint`;
  const helpId = `${uid}-help`;
  const tilesTitleId = `${uid}-tiles`;

  const [urlValue, setUrlValue] = useState(initialUrl);
  const [urlTouched, setUrlTouched] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [picked, setPicked] = useState<PickedMap>(emptyPicked);
  const [dragRole, setDragRole] = useState<ImageRole | null>(null);
  const [highlight, setHighlight] = useState<ImageRole | null>(
    initialMode === "photo" ? "photo" : initialMode === "capture" ? "screenshot" : null
  );
  const [helpOpen, setHelpOpen] = useState(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [job, setJob] = useState<Job | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cardType, setCardType] = useState<EssaiCardType>("stamp");

  const urlInputRef = useRef<HTMLInputElement>(null);
  const tilesRef = useRef<HTMLDivElement>(null);
  const statusHeadingRef = useRef<HTMLHeadingElement>(null);
  const errorHeadingRef = useRef<HTMLHeadingElement>(null);
  const fileInputs = useRef<Record<ImageRole, HTMLInputElement | null>>({
    logo: null,
    photo: null,
    screenshot: null,
  });
  const abortRef = useRef<AbortController | null>(null);
  const navTimerRef = useRef<number | null>(null);
  const cardTypeRef = useRef<EssaiCardType>("stamp");
  // URLs d'aperçu à libérer (changement d'image, démontage).
  const previewUrlsRef = useRef(new Set<string>());

  const linkKind = detectLinkKind(urlValue);
  const social = linkKind === "instagram" || linkKind === "facebook";
  // Un texte sans espace en cours de frappe n'est pas encore « un nom ».
  const typedName =
    linkKind === "invalid" && (urlTouched || /\s/.test(urlValue.trim())) && !/[/:@]/.test(urlValue);
  const brokenLink = linkKind === "invalid" && urlTouched && /[/:@]/.test(urlValue);
  const hasAnyImage = ROLES.some((r) => picked[r]);

  // ── Chronomètre de l'écran d'attente ──
  useEffect(() => {
    if (phase !== "loading") return;
    const startedAt = Date.now();
    const id = window.setInterval(() => setElapsed(Date.now() - startedAt), 250);
    return () => window.clearInterval(id);
  }, [phase]);

  // ── Focus : clavier / lecteur d'écran suivent l'écran ──
  useEffect(() => {
    if (phase === "loading") statusHeadingRef.current?.focus();
  }, [phase]);
  useEffect(() => {
    if (errorMessage) errorHeadingRef.current?.focus();
  }, [errorMessage]);

  // ── Nettoyage au démontage ──
  useEffect(() => {
    const urls = previewUrlsRef.current;
    return () => {
      abortRef.current?.abort();
      if (navTimerRef.current) window.clearTimeout(navTimerRef.current);
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls.clear();
    };
  }, []);

  // ── Arrivée « prenez une photo » / « capture » : tuile visible ──
  useEffect(() => {
    if (!initialMode) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setTimeout(() => {
      tilesRef.current?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    }, 120);
    return () => window.clearTimeout(id);
  }, [initialMode]);

  // ── Images ──

  function selectImage(role: ImageRole, file: File) {
    if (!looksLikeImage(file)) {
      toast.info("Ce fichier n'est pas une image. Choisissez une photo (JPG, PNG…).");
      return;
    }
    if (file.size > MAX_RAW_BYTES) {
      toast.info("Cette image n'a pas pu être lue. Essayez avec une autre photo.");
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    previewUrlsRef.current.add(previewUrl);
    const prepared = compressImage(file, role);
    // Rejet traité à l'envoi : on évite juste l'alerte « non géré ».
    prepared.catch(() => {});
    setPicked((current) => {
      const previous = current[role];
      if (previous) {
        URL.revokeObjectURL(previous.previewUrl);
        previewUrlsRef.current.delete(previous.previewUrl);
      }
      return { ...current, [role]: { file, previewUrl, prepared } };
    });
    setHighlight((h) => (h === role ? null : h));
    setErrorMessage(null);
  }

  function removeImage(role: ImageRole) {
    setPicked((current) => {
      const previous = current[role];
      if (previous) {
        URL.revokeObjectURL(previous.previewUrl);
        previewUrlsRef.current.delete(previous.previewUrl);
      }
      return { ...current, [role]: null };
    });
  }

  function openPicker(role: ImageRole) {
    // Le sélecteur ne s'ouvre que pendant un geste utilisateur : appel direct.
    fileInputs.current[role]?.click();
  }

  function onTileDrop(role: ImageRole, e: DragEvent<HTMLElement>) {
    e.preventDefault();
    setDragRole(null);
    const file = e.dataTransfer.files?.[0];
    if (file) selectImage(role, file);
  }

  // Coller une image (Ctrl+V / Cmd+V), très courant juste après une capture.
  const onPaste = useEffectEvent((e: ClipboardEvent) => {
    if (phase !== "idle") return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (!file) return;
        e.preventDefault();
        const role: ImageRole = social || picked.photo ? "screenshot" : "photo";
        selectImage(role, file);
        toast.success(role === "screenshot" ? "Capture ajoutée." : "Photo ajoutée.");
        return;
      }
    }
  });

  useEffect(() => {
    const handler = (e: ClipboardEvent) => onPaste(e);
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, []);

  async function pasteFromClipboard() {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        toast.info("Rien à coller : copiez d'abord le lien de votre commerce.");
        return;
      }
      setUrlValue(text.slice(0, MAX_LINK_LENGTH));
      setUrlTouched(true);
    } catch {
      urlInputRef.current?.focus();
      toast.info("Appuyez longuement dans le champ, puis choisissez « Coller ».");
    }
  }

  // ── Choix du type pendant la création ──

  function chooseCardType(type: EssaiCardType) {
    cardTypeRef.current = type;
    setCardType(type);
  }

  // ── Création ──

  async function createCard() {
    const raw = urlValue.trim();
    const kind = detectLinkKind(raw);
    let url = "";
    let name = "";
    if (raw) {
      if (kind !== "invalid") url = normalizeLinkInput(raw);
      else if (!/[/:@]/.test(raw)) name = raw.slice(0, NAME_MAX);
    }
    const roles = ROLES.filter((r) => picked[r]);

    if (!url && !name && roles.length === 0) {
      urlInputRef.current?.focus();
      setUrlTouched(true);
      toast.info(
        raw
          ? "Ce lien semble incomplet. Vérifiez-le, ou ajoutez votre logo ou une photo."
          : "Collez le lien de votre commerce, ou ajoutez votre logo ou une photo."
      );
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, CLIENT_TIMEOUT_MS);

    const sentType: EssaiCardType = "stamp";
    cardTypeRef.current = sentType;
    setCardType(sentType);
    const thumb = picked.logo ?? picked.photo ?? picked.screenshot;
    setJob({
      label: url ? displayHost(url) : name || null,
      thumbUrl: thumb?.previewUrl ?? null,
      steps: url ? LINK_STEPS : IMAGE_STEPS,
      needsPatch: false,
    });
    setElapsed(0);
    setErrorMessage(null);
    setPhase("loading");

    try {
      const originals: Partial<Record<ImageRole, File>> = {};
      const prepared: Partial<Record<ImageRole, File>> = {};
      for (const role of roles) {
        const p = picked[role] as Picked;
        originals[role] = p.file;
        prepared[role] = await p.prepared;
      }
      const ready = await fitUploadBudget(originals, prepared);

      const body = new FormData();
      if (url) body.set("url", url);
      if (name) body.set("name", name);
      const first = firstName.replace(/\s+/g, " ").trim().slice(0, FIRST_NAME_MAX);
      if (first) body.set("firstName", first);
      body.set("cardType", sentType);
      for (const role of roles) {
        const file = ready[role];
        if (file) body.set(role, file, file.name);
      }

      const res = await fetch("/api/essai", { method: "POST", body, signal: controller.signal });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok || !isCreateResponse(data)) {
        throw new FriendlyError(createErrorMessage(res.status, data));
      }

      const target = `/essai/${encodeURIComponent(data.token)}`;
      router.prefetch(target);

      // Type choisi pendant l'attente → appliqué avant d'ouvrir la carte.
      const chosen = cardTypeRef.current;
      setJob((j) => (j ? { ...j, needsPatch: chosen !== sentType } : j));
      setPhase("finishing");
      if (chosen !== sentType) {
        try {
          const patch = await fetch(`/api/essai/${encodeURIComponent(data.token)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cardType: chosen }),
            signal: controller.signal,
          });
          const view: unknown = await patch.json().catch(() => null);
          if (!patch.ok || typeof (view as EssaiCardView | null)?.cardType !== "string") {
            toast.info("Votre carte est prête : vous pourrez changer son type dans un instant.");
          }
        } catch {
          if (controller.signal.aborted && !timedOut) return;
          // Sans gravité : le type se change aussi depuis la carte.
        }
      }

      setPhase("done");
      navTimerRef.current = window.setTimeout(() => router.push(target), READY_PAUSE_MS);
    } catch (err) {
      // Annulation volontaire (bouton ou départ de la page) : rien à dire.
      if (controller.signal.aborted && !timedOut) return;
      let message: string;
      if (timedOut) {
        message =
          "La création prend plus de temps que prévu. Réessayez, ou ajoutez votre logo et une photo de votre devanture.";
      } else if (err instanceof FriendlyError || err instanceof ImageUnreadableError) {
        message = err.message;
      } else {
        message = "Connexion impossible. Vérifiez votre connexion Internet, puis réessayez.";
      }
      setErrorMessage(message);
      setPhase("idle");
    } finally {
      window.clearTimeout(timeoutId);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void createCard();
  }

  function cancel() {
    abortRef.current?.abort();
    setPhase("idle");
  }

  // ── Démarrage automatique depuis l'accueil (/essai?url=…) ──
  // Uniquement pour un site ou une fiche Maps : un lien Instagram mérite
  // d'abord la capture du profil (guide affiché), un nom tapé à la main
  // mérite un logo ou une photo.
  const autoStart = useEffectEvent(() => {
    window.history.replaceState(null, "", "/essai");
    void createCard();
  });

  useEffect(() => {
    const kind = detectLinkKind(initialUrl);
    if (initialMode || (kind !== "website" && kind !== "maps")) return;
    // setTimeout : en mode strict (dev), le 1er montage est annulé ici.
    const id = window.setTimeout(() => autoStart(), 0);
    return () => window.clearTimeout(id);
  }, [initialUrl, initialMode]);

  // ── Rendu : écran de création ──

  if (phase !== "idle" && job) {
    return (
      <Shell>
        <GeneratingView
          job={job}
          elapsed={elapsed}
          phase={phase}
          headingRef={statusHeadingRef}
          cardType={cardType}
          onCardType={chooseCardType}
          onCancel={cancel}
          pickerName={`${uid}-type`}
        />
      </Shell>
    );
  }

  // ── Rendu : formulaire ──

  const tileOrder: ImageRole[] = social ? ["screenshot", "logo", "photo"] : ["logo", "photo", "screenshot"];

  return (
    <Shell>
      <div className="text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-yellow px-3 py-1 text-[11px] font-bold uppercase text-foreground sm:text-xs"
          style={FONT_UI}
        >
          <Sparkles size={12} aria-hidden />
          Votre logo, vos couleurs, votre photo
        </span>
        <h1
          className="mt-5 text-[26px] leading-[1.2] text-foreground sm:-mx-10 sm:text-[44px] sm:leading-[1.12] lg:-mx-24"
          style={FONT_TITLE}
        >
          <span className="sm:block">Votre carte de fidélité</span>{" "}
          <span className="rounded-md bg-yellow px-2 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
            en 30&nbsp;secondes
          </span>
        </h1>
        <p className="mt-4 text-base leading-relaxed text-foreground/75 sm:text-lg" style={FONT_TEXT}>
          Collez le lien de votre commerce. Ajoutez votre logo ou une photo
          si vous les avez&nbsp;: on s&apos;occupe du reste.
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className={cn("mt-6 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-foreground/10 sm:p-5", styles.riseIn)}
        >
          <div className="flex gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow" aria-hidden>
              <Sparkles size={17} />
            </span>
            <div className="min-w-0">
              <h2
                ref={errorHeadingRef}
                tabIndex={-1}
                className="font-semibold text-foreground outline-none"
                style={FONT_UI}
              >
                On réessaie&nbsp;?
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-foreground/75" style={FONT_TEXT}>
                {errorMessage}
              </p>
              <button
                type="button"
                onClick={() => void createCard()}
                className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-white transition-colors hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow cursor-pointer"
                style={FONT_UI}
              >
                <RotateCcw size={16} aria-hidden />
                Réessayer
              </button>
            </div>
          </div>
        </div>
      )}

      <form
        onSubmit={onSubmit}
        noValidate
        className="mt-7 rounded-[28px] bg-white p-4 shadow-xl shadow-foreground/5 ring-1 ring-foreground/5 sm:p-6"
      >
        {/* 1. Le lien */}
        <label htmlFor={urlId} className="block text-sm font-semibold text-foreground" style={FONT_UI}>
          Le lien de votre commerce
          <span className="block text-xs font-normal text-muted-foreground" style={FONT_TEXT}>
            Site web, fiche Google Maps ou Instagram
          </span>
        </label>
        <div className="relative mt-2">
          <Link2
            size={20}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40"
            aria-hidden
          />
          <input
            ref={urlInputRef}
            id={urlId}
            type="text"
            inputMode="url"
            autoComplete="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            maxLength={MAX_LINK_LENGTH}
            placeholder="Collez le lien ici"
            value={urlValue}
            onChange={(e) => {
              setUrlValue(e.target.value);
              setUrlTouched(false);
            }}
            onBlur={() => setUrlTouched(true)}
            aria-describedby={urlHintId}
            className={cn(
              "h-14 w-full rounded-2xl border-2 border-border bg-white pl-12 text-base text-foreground outline-none transition-colors placeholder:text-foreground/40 focus:border-foreground",
              urlValue ? "pr-14" : "pr-[104px]"
            )}
            style={FONT_TEXT}
          />
          {urlValue ? (
            <button
              type="button"
              onClick={() => {
                setUrlValue("");
                setUrlTouched(false);
                urlInputRef.current?.focus();
              }}
              aria-label="Effacer le lien"
              className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-foreground/50 transition-colors hover:bg-beige hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground cursor-pointer"
            >
              <X size={18} aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void pasteFromClipboard()}
              className="absolute right-1.5 top-1/2 inline-flex h-11 -translate-y-1/2 items-center gap-1.5 rounded-xl bg-beige px-3 text-sm font-semibold text-foreground transition-colors hover:bg-beige-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground cursor-pointer"
              style={FONT_UI}
            >
              <ClipboardPaste size={16} aria-hidden />
              Coller
            </button>
          )}
        </div>

        <div id={urlHintId} aria-live="polite" className="mt-2 min-h-[8px]">
          <LinkHint
            kind={linkKind}
            typedName={typedName}
            brokenLink={brokenLink}
            name={urlValue.trim()}
          />
        </div>

        <button
          type="button"
          aria-expanded={helpOpen}
          aria-controls={helpId}
          onClick={() => setHelpOpen((o) => !o)}
          className="-ml-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-1 text-sm font-semibold text-foreground/70 underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground cursor-pointer"
          style={FONT_UI}
        >
          Où trouver mon lien&nbsp;?
        </button>
        <div id={helpId} hidden={!helpOpen}>
          <ul className="mt-1 space-y-2 rounded-2xl bg-beige p-4 text-sm leading-relaxed text-foreground/80" style={FONT_TEXT}>
            <li className="flex gap-2.5">
              <Globe size={16} className="mt-0.5 shrink-0" aria-hidden />
              <span>
                <strong>Site web&nbsp;:</strong> ouvrez votre site, touchez la barre
                d&apos;adresse puis «&nbsp;Copier&nbsp;».
              </span>
            </li>
            <li className="flex gap-2.5">
              <MapPin size={16} className="mt-0.5 shrink-0" aria-hidden />
              <span>
                <strong>Google Maps&nbsp;:</strong> cherchez votre commerce, touchez
                «&nbsp;Partager&nbsp;» puis «&nbsp;Copier le lien&nbsp;».
              </span>
            </li>
            <li className="flex gap-2.5">
              <InstagramGlyph size={16} />
              <span>
                <strong>Instagram&nbsp;:</strong> sur votre profil, «&nbsp;Partager le
                profil&nbsp;» puis «&nbsp;Copier le lien&nbsp;», ou tapez
                simplement <strong>@votrepseudo</strong>.
              </span>
            </li>
          </ul>
        </div>

        {/* 2. Guide Instagram / Facebook */}
        {social && (
          <SocialGuide
            kind={linkKind === "facebook" ? "facebook" : "instagram"}
            done={Boolean(picked.screenshot)}
            onImport={() => openPicker("screenshot")}
          />
        )}

        {/* 3. Images facultatives */}
        <div ref={tilesRef} className="mt-5" role="group" aria-labelledby={tilesTitleId}>
          <p id={tilesTitleId} className="text-sm font-semibold text-foreground" style={FONT_UI}>
            Pour un rendu parfait{" "}
            <span className="font-normal text-muted-foreground">(facultatif)</span>
          </p>
          <p className="text-xs text-muted-foreground" style={FONT_TEXT}>
            Ajoutez ce que vous avez sous la main, on s&apos;occupe du reste.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 pt-2 sm:gap-3">
            {tileOrder.map((role) => (
              <ImageTile
                key={role}
                role={role}
                picked={picked[role]}
                recommended={role === "screenshot" && social}
                highlight={highlight === role}
                dragOver={dragRole === role}
                onPick={() => openPicker(role)}
                onRemove={() => removeImage(role)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragRole(role);
                }}
                onDragLeave={() => setDragRole((r) => (r === role ? null : r))}
                onDrop={(e) => onTileDrop(role, e)}
              />
            ))}
          </div>
          {!social && (
            <p className="mt-2 hidden text-xs text-muted-foreground sm:block" style={FONT_TEXT}>
              Astuce&nbsp;: glissez une image sur une tuile, ou collez-la avec Ctrl+V.
            </p>
          )}
        </div>

        {/* Sélecteurs de fichiers (cachés, ouverts par les tuiles). */}
        {ROLES.map((role) => (
          <input
            key={role}
            ref={(node) => {
              fileInputs.current[role] = node;
            }}
            type="file"
            accept="image/*"
            className="hidden"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              // Remise à zéro : re-choisir la même image redéclenche onChange.
              e.target.value = "";
              if (file) selectImage(role, file);
            }}
          />
        ))}

        {/* 4. Prénom */}
        <label htmlFor={firstNameId} className="mt-5 block text-sm font-semibold text-foreground" style={FONT_UI}>
          Votre prénom <span className="font-normal text-muted-foreground">(facultatif)</span>
        </label>
        <input
          id={firstNameId}
          type="text"
          autoComplete="given-name"
          autoCapitalize="words"
          enterKeyHint="go"
          maxLength={FIRST_NAME_MAX}
          placeholder={"Ex. : Shahin"}
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          aria-describedby={firstNameHintId}
          className="mt-2 h-12 w-full rounded-xl border-2 border-border bg-white px-4 text-base text-foreground outline-none transition-colors placeholder:text-foreground/40 focus:border-foreground"
          style={FONT_TEXT}
        />
        <p id={firstNameHintId} className="mt-1.5 text-xs text-muted-foreground" style={FONT_TEXT}>
          Il s&apos;affiche sur la carte&nbsp;: «&nbsp;Bonjour {firstName.trim() || "Shahin"}&nbsp;».
        </p>

        <button
          type="submit"
          className="mt-5 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-foreground px-6 text-base font-semibold text-white shadow-lg transition-colors hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow cursor-pointer"
          style={FONT_UI}
        >
          Créer ma carte
          <ArrowRight size={18} aria-hidden />
        </button>
        {!urlValue.trim() && hasAnyImage && (
          <p className="mt-2 text-center text-xs text-muted-foreground" style={FONT_TEXT}>
            Pas de lien&nbsp;? Aucun souci, vos images suffisent.
          </p>
        )}
      </form>

      <ul className="mt-8 grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3" style={FONT_TEXT}>
        {[
          "Votre logo, vos couleurs et votre photo, automatiquement",
          "La vraie carte, dans Apple Wallet et Google Wallet",
          "Sans inscription, rien à installer",
        ].map((item) => (
          <li
            key={item}
            className="flex items-start gap-2.5 rounded-2xl bg-white/70 p-3 text-sm leading-snug text-foreground/80"
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-yellow">
              <Check size={12} strokeWidth={3} aria-hidden />
            </span>
            {item}
          </li>
        ))}
      </ul>
    </Shell>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[calc(100dvh-52px)] overflow-x-clip bg-beige">
      <header className="mx-auto flex h-16 max-w-xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center rounded-md text-xl font-bold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
          style={{ fontFamily: "var(--font-ginto-nord)" }}
        >
          aswallet
        </Link>
        <span className="text-xs text-muted-foreground" style={FONT_TEXT}>
          Sans inscription
        </span>
      </header>
      <div className="mx-auto max-w-xl px-4 pb-14 pt-3 sm:px-6 sm:pt-8">{children}</div>
    </div>
  );
}

/** Pictogramme Instagram (lucide-react n'embarque plus les logos de marque). */
function InstagramGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

function LinkHint({
  kind,
  typedName,
  brokenLink,
  name,
}: {
  kind: LinkKind;
  typedName: boolean;
  brokenLink: boolean;
  name: string;
}) {
  const pill = (className: string, icon: ReactNode, label: string) => (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", className)}
      style={FONT_UI}
    >
      {icon}
      {label}
    </span>
  );

  if (typedName) {
    return (
      <p className="text-sm leading-snug text-foreground/70" style={FONT_TEXT}>
        Pas de lien&nbsp;? Aucun souci&nbsp;: «&nbsp;{name.slice(0, NAME_MAX)}&nbsp;» sera le
        nom de votre carte. Ajoutez votre logo ou une photo ci-dessous.
      </p>
    );
  }
  if (brokenLink) {
    return (
      <p className="text-sm leading-snug text-foreground/70" style={FONT_TEXT}>
        Un lien ressemble à <strong>monsite.fr</strong>. Pas de lien sous la
        main&nbsp;? Ajoutez simplement votre logo ou une photo.
      </p>
    );
  }
  switch (kind) {
    case "website":
      return pill("bg-emerald-50 text-emerald-800", <Globe size={13} aria-hidden />, "Site web détecté");
    case "maps":
      return pill("bg-sky-50 text-sky-800", <MapPin size={13} aria-hidden />, "Fiche Google Maps détectée");
    case "instagram":
      return pill("bg-fuchsia-50 text-fuchsia-800", <InstagramGlyph size={13} />, "Instagram détecté");
    case "facebook":
      return pill("bg-blue-50 text-blue-800", <Globe size={13} aria-hidden />, "Facebook détecté");
    default:
      return null;
  }
}

function SocialGuide({
  kind,
  done,
  onImport,
}: {
  kind: "instagram" | "facebook";
  done: boolean;
  onImport: () => void;
}) {
  const network = kind === "instagram" ? "Instagram" : "Facebook";
  if (done) {
    return (
      <p
        className={cn(
          "mt-3 flex items-center gap-2.5 rounded-2xl bg-emerald-50 p-3 text-sm leading-snug text-emerald-900",
          styles.riseIn
        )}
        style={FONT_TEXT}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Check size={15} strokeWidth={3} aria-hidden />
        </span>
        Parfait&nbsp;: on récupère votre logo et vos couleurs sur votre capture.
      </p>
    );
  }
  const steps = [
    `Ouvrez le profil ${network} du commerce`,
    "Faites une capture d'écran",
    "Importez-la ici",
  ];
  return (
    <section
      className={cn(
        "mt-3 rounded-[22px] bg-gradient-to-br from-fuchsia-50 via-rose-50 to-amber-50 p-4 ring-1 ring-fuchsia-100",
        styles.riseIn
      )}
      aria-label={`Récupérer votre logo ${network} en 3 étapes`}
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground" style={FONT_UI}>
        <InstagramGlyph size={16} />
        Votre logo {network} en 3&nbsp;étapes
      </p>
      <ol className="mt-3 grid grid-cols-3 gap-2">
        {steps.map((label, i) => (
          <li key={label} className="flex flex-col items-center text-center">
            <span className="relative">
              <GuideArt step={i} />
              <span
                className="absolute -left-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-[11px] font-bold text-white"
                style={FONT_UI}
                aria-hidden
              >
                {i + 1}
              </span>
            </span>
            <span className="mt-2 text-xs leading-snug text-foreground/80" style={FONT_TEXT}>
              {label}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs leading-relaxed text-foreground/60" style={FONT_TEXT}>
        Capture d&apos;écran&nbsp;: sur iPhone, bouton latéral + volume haut&nbsp;;
        sur Android, marche/arrêt + volume bas.
      </p>
      <button
        type="button"
        onClick={onImport}
        className="mt-3 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-white transition-colors hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow cursor-pointer"
        style={FONT_UI}
      >
        <Smartphone size={17} aria-hidden />
        Importer ma capture
      </button>
    </section>
  );
}

/** Mini-illustrations du guide (téléphone stylisé, 56 × 88). */
function GuideArt({ step }: { step: number }) {
  return (
    <svg width="56" height="88" viewBox="0 0 56 88" aria-hidden className="block">
      <rect x="3" y="2" width="50" height="84" rx="10" fill="#1a1e22" />
      <rect x="6" y="5" width="44" height="78" rx="7.5" fill="#ffffff" />
      <rect x="22" y="8" width="12" height="3.2" rx="1.6" fill="#1a1e22" />
      {step === 0 && (
        <g>
          <defs>
            <linearGradient id="essai-ig-ring" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#f59e0b" />
              <stop offset="0.5" stopColor="#ec4899" />
              <stop offset="1" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          <circle cx="18" cy="24" r="7.5" fill="none" stroke="url(#essai-ig-ring)" strokeWidth="2" />
          <circle cx="18" cy="24" r="5" fill="#fff382" />
          <rect x="29" y="20" width="16" height="3" rx="1.5" fill="#1a1e22" opacity="0.7" />
          <rect x="29" y="26" width="11" height="3" rx="1.5" fill="#1a1e22" opacity="0.3" />
          {Array.from({ length: 9 }, (_, i) => (
            <rect
              key={i}
              x={9 + (i % 3) * 13}
              y={38 + Math.floor(i / 3) * 13}
              width="12"
              height="12"
              rx="1.5"
              fill={i % 2 === 0 ? "#f2eee0" : "#e5e1d3"}
            />
          ))}
        </g>
      )}
      {step === 1 && (
        <g>
          <circle cx="18" cy="24" r="5" fill="#fff382" />
          <rect x="27" y="21" width="16" height="3" rx="1.5" fill="#1a1e22" opacity="0.6" />
          <path
            d="M12 34 v-4 h4 M44 34 v-4 h-4 M12 66 v4 h4 M44 66 v4 h-4"
            fill="none"
            stroke="#1a1e22"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <rect x="16" y="38" width="24" height="24" rx="3" fill="#fff382" opacity="0.6" />
          <path d="M28 44 v12 M22 50 h12" stroke="#1a1e22" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
        </g>
      )}
      {step === 2 && (
        <g>
          <rect
            x="11"
            y="42"
            width="34"
            height="30"
            rx="6"
            fill="#f9f7f0"
            stroke="#1a1e22"
            strokeWidth="1.6"
            strokeDasharray="3.5 3"
          />
          <path
            d="M28 63 V49 M22.5 54.5 L28 49 l5.5 5.5"
            fill="none"
            stroke="#1a1e22"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="16" y="20" width="24" height="15" rx="3" fill="#fff382" />
          <circle cx="23" cy="27.5" r="3.2" fill="#1a1e22" opacity="0.75" />
        </g>
      )}
    </svg>
  );
}

function ImageTile({
  role,
  picked,
  recommended,
  highlight,
  dragOver,
  onPick,
  onRemove,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  role: ImageRole;
  picked: Picked | null;
  recommended: boolean;
  highlight: boolean;
  dragOver: boolean;
  onPick: () => void;
  onRemove: () => void;
  onDragOver: (e: DragEvent<HTMLElement>) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent<HTMLElement>) => void;
}) {
  const tile = TILES[role];
  return (
    <div className="relative min-w-0">
      <button
        type="button"
        onClick={onPick}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        aria-label={picked ? `${tile.title} : changer l'image` : `Ajouter : ${tile.title}`}
        className={cn(
          "flex h-full min-h-[136px] w-full flex-col items-center gap-2 rounded-2xl border-2 bg-white p-2 pb-2.5 text-center transition-[border-color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow cursor-pointer",
          picked
            ? "border-foreground/15"
            : recommended || highlight
              ? "border-foreground"
              : "border-dashed border-foreground/25 hover:border-foreground/60",
          dragOver && "border-solid border-foreground bg-yellow/30",
          highlight && !picked && styles.pulseRing
        )}
      >
        <span
          className={cn(
            "relative flex h-16 w-full items-center justify-center overflow-hidden rounded-xl",
            picked ? (role === "logo" ? "bg-beige" : "bg-foreground/5") : recommended ? "bg-yellow" : "bg-beige"
          )}
        >
          {picked ? (
            // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:), rien à optimiser.
            <img
              src={picked.previewUrl}
              alt=""
              className={cn(
                "h-full w-full",
                role === "logo" ? "object-contain p-1.5" : "object-cover",
                role === "screenshot" && "object-top"
              )}
            />
          ) : (
            <span className="text-foreground">{tile.icon}</span>
          )}
        </span>
        <span className="text-[13px] font-semibold leading-tight text-foreground" style={FONT_UI}>
          {tile.title}
        </span>
        <span className="text-[11px] leading-tight text-muted-foreground" style={FONT_TEXT}>
          {picked ? "Touchez pour changer" : tile.hint}
        </span>
      </button>

      {recommended && !picked && (
        <span
          className="pointer-events-none absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
          style={FONT_UI}
        >
          Recommandé
        </span>
      )}

      {picked && (
        <>
          <span
            className={cn(
              "pointer-events-none absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow",
              styles.checkPop
            )}
            aria-hidden
          >
            <Check size={13} strokeWidth={3} />
          </span>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Retirer : ${tile.title}`}
            className="absolute -right-1.5 -top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-white shadow-md transition-transform after:absolute after:-inset-1.5 hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow cursor-pointer"
          >
            <X size={15} strokeWidth={2.5} aria-hidden />
          </button>
        </>
      )}
    </div>
  );
}

// ─── Écran de création ────────────────────────────────────────────────────

function GeneratingView({
  job,
  elapsed,
  phase,
  headingRef,
  cardType,
  onCardType,
  onCancel,
  pickerName,
}: {
  job: Job;
  elapsed: number;
  phase: Exclude<Phase, "idle">;
  headingRef: RefObject<HTMLHeadingElement | null>;
  cardType: EssaiCardType;
  onCardType: (type: EssaiCardType) => void;
  onCancel: () => void;
  pickerName: string;
}) {
  const done = phase === "done";
  const finishing = phase === "finishing";
  const steps = job.steps;
  const current = done || finishing ? steps.length - 1 : currentStepIndex(elapsed);
  const progress = done ? 1 : finishing ? 0.97 : progressFor(elapsed);
  const label = done
    ? "Ouverture de votre carte…"
    : finishing
      ? job.needsPatch
        ? "Application de votre choix…"
        : "Dernières finitions…"
      : steps[current];

  return (
    <>
      <div className="rounded-[28px] bg-white p-5 shadow-xl shadow-foreground/5 ring-1 ring-foreground/5 sm:p-7">
        <div className="flex items-center gap-4">
          <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-yellow text-foreground">
            {job.thumbUrl && !done ? (
              // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:).
              <img src={job.thumbUrl} alt="" className="h-full w-full object-cover" />
            ) : done ? (
              <Check size={26} strokeWidth={3} className={styles.checkPop} aria-hidden />
            ) : (
              <Sparkles size={24} className="motion-safe:animate-pulse" aria-hidden />
            )}
          </span>
          <div className="min-w-0">
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="text-xl leading-tight text-foreground outline-none sm:text-2xl"
              style={FONT_TITLE}
            >
              {done ? "C'est prêt !" : "Création de votre carte…"}
            </h1>
            {job.label && (
              <p className="mt-0.5 truncate text-sm text-muted-foreground" style={FONT_TEXT}>
                {job.label}
              </p>
            )}
          </div>
        </div>

        <div
          role="progressbar"
          aria-label="Avancement de la création"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          className="mt-5 h-2 overflow-hidden rounded-full bg-beige"
        >
          <div
            className={cn("h-full w-full rounded-full bg-foreground", styles.progressFill)}
            style={{ transform: `scaleX(${progress.toFixed(3)})` }}
          />
        </div>

        <div className="mt-4 flex items-center gap-2.5" style={FONT_TEXT}>
          <span className="flex h-6 w-6 shrink-0 items-center justify-center" aria-hidden>
            {done ? (
              <Check size={18} strokeWidth={3} className="text-emerald-600" />
            ) : (
              <LoaderCircle size={18} className="text-foreground/70 motion-safe:animate-spin" />
            )}
          </span>
          <p key={label} className={cn("text-base font-semibold text-foreground", styles.riseIn)} role="status" aria-live="polite">
            {label}
          </p>
        </div>
        <ol className="mt-3 flex gap-1.5" aria-hidden>
          {steps.map((s, i) => (
            <li
              key={s}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors duration-500",
                i < current || done ? "bg-emerald-500" : i === current ? "bg-foreground" : "bg-beige"
              )}
            />
          ))}
        </ol>
      </div>

      <section className="mt-7" aria-labelledby={`${pickerName}-title`}>
        <h2
          id={`${pickerName}-title`}
          className="text-lg font-semibold leading-snug text-foreground sm:text-xl"
          style={FONT_UI}
        >
          Pendant ce temps, quel type de carte voulez-vous&nbsp;?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground" style={FONT_TEXT}>
          Votre offre sera écrite pour ce type. Vous pourrez en changer à tout moment.
        </p>
        <div className="mt-4">
          <CardTypePicker
            name={pickerName}
            legend="Type de carte"
            value={cardType}
            onChange={onCardType}
            disabled={finishing || done}
          />
        </div>
      </section>

      {phase === "loading" && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground" style={FONT_TEXT}>
            En général 15 à 30&nbsp;secondes.
          </p>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-[44px] items-center rounded-md px-2 text-sm font-semibold text-foreground/60 underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground cursor-pointer"
            style={FONT_UI}
          >
            Annuler
          </button>
        </div>
      )}
    </>
  );
}
