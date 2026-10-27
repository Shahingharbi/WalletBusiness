"use client";

/**
 * Générateur « Votre carte de fidélité en 30 secondes ».
 *
 * Public visé : commerçants peu à l'aise avec l'informatique. D'où :
 *  - UN champ, UN gros bouton ; la photo est l'alternative, pas un 2e parcours ;
 *  - aucun bouton grisé mystérieux : on explique quoi faire à la place ;
 *  - un nom tapé à la place d'un lien n'est pas une « erreur » : on bascule
 *    gentiment vers la photo avec le nom pré-rempli ;
 *  - un écran d'attente qui montre ce qui se passe (étapes + progression).
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
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Camera,
  Check,
  ClipboardPaste,
  Globe,
  ImagePlus,
  Link2,
  LoaderCircle,
  MapPin,
  RotateCcw,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import type {
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
import {
  MAX_UPLOAD_BYTES,
  looksLikeImage,
  prepareImageForUpload,
} from "./prepare-image";

// ─── Constantes ───────────────────────────────────────────────────────────

// Typographie française : les espaces avant « ! ? : » et à l'intérieur des
// guillemets « » sont des espaces insécables (U+00A0) écrits littéralement
// dans les chaînes, ou `&nbsp;` dans le JSX.

const FONT_TITLE = { fontFamily: "var(--font-ginto-nord)", fontWeight: 500 };
const FONT_UI = { fontFamily: "var(--font-maison-neue-extended)" };
const FONT_TEXT = { fontFamily: "var(--font-maison-neue)" };

const LINK_STEPS = [
  "Analyse du lien…",
  "Récupération du logo…",
  "Extraction de vos couleurs…",
  "Fabrication de votre carte…",
];
const PHOTO_STEPS = [
  "Lecture de votre photo…",
  "Repérage de votre logo…",
  "Extraction de vos couleurs…",
  "Fabrication de votre carte…",
];
const READY_LABEL = "C'est prêt !";
/**
 * Début (ms) de chaque étape. Calé sur les temps réels observés côté serveur
 * (récupération du site ~3 s, logo ~4 s, couleurs + IA ~4 s, puis création).
 * La dernière étape reste affichée jusqu'à la réponse : on n'annonce jamais
 * « C'est prêt » avant que la carte existe vraiment.
 */
const STEP_STARTS_MS = [0, 2800, 7000, 11500];
/** La route a `maxDuration = 60` : au-delà, inutile d'attendre. */
const CLIENT_TIMEOUT_MS = 75_000;
/** Le temps de lire « C'est prêt ! » avant d'afficher la carte. */
const READY_PAUSE_MS = 700;
/** Une photo plus lourde ne vaut pas le temps de réduction sur un téléphone. */
const MAX_RAW_PHOTO_BYTES = 30 * 1024 * 1024;
const NAME_MAX = 40;

type Phase = "idle" | "loading" | "done" | "error";
type HelpTopic = "website" | "maps" | "instagram";

interface Photo {
  file: File;
  previewUrl: string;
}

interface Job {
  mode: "link" | "photo";
  /** Ce qu'on est en train de traiter (« kebab-du-coin.fr », « @coq.rizo »…). */
  label: string | null;
  previewUrl: string | null;
}

/** Erreur dont le message est déjà rédigé pour l'utilisateur. */
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

function serverMessage(data: unknown): string {
  if (typeof data !== "object" || data === null) return "";
  const msg = (data as EssaiErrorResponse).error;
  return typeof msg === "string" ? msg.trim() : "";
}

/** Message affiché quand POST /api/essai échoue (le serveur rédige en FR). */
function createErrorMessage(status: number, data: unknown): string {
  // Le message générique du rate-limit (« Trop de requêtes… ») est remplacé
  // par une consigne concrète.
  if (status === 429) {
    return "Beaucoup d'essais en peu de temps. Patientez une minute, puis réessayez.";
  }
  const fromServer = serverMessage(data);
  if (fromServer) return fromServer;
  if (status === 413) {
    return "Cette photo est trop lourde (8 Mo maximum). Essayez avec une capture d'écran.";
  }
  if (status === 400 || status === 422) {
    return "Nous n'avons pas pu lire ce lien. Vérifiez-le, ou prenez une photo de votre enseigne.";
  }
  if (status === 504 || status === 408) {
    return "Le site de votre commerce a mis trop de temps à répondre. Réessayez, ou prenez une photo de votre enseigne.";
  }
  return "Un souci technique nous a empêchés de créer votre carte. Réessayez dans un instant.";
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

/** Progression « réaliste » : rapide au début, ralentit, plafonne à 94 %. */
function progressFor(elapsedMs: number): number {
  return 94 * (1 - Math.exp(-elapsedMs / 9000));
}

function currentStepIndex(elapsedMs: number): number {
  let index = 0;
  STEP_STARTS_MS.forEach((start, i) => {
    if (elapsedMs >= start) index = i;
  });
  return index;
}

// ─── Composant principal ──────────────────────────────────────────────────

export function EssaiForm({
  initialUrl,
  initialPhotoMode,
}: {
  initialUrl: string;
  initialPhotoMode: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const uid = useId();
  const urlId = `${uid}-url`;
  const urlHintId = `${uid}-url-hint`;
  const nameId = `${uid}-name`;
  const helpPanelId = `${uid}-help`;

  const [urlValue, setUrlValue] = useState(initialUrl);
  const [urlTouched, setUrlTouched] = useState(false);
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [previewBroken, setPreviewBroken] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(initialPhotoMode);
  const [notALinkNotice, setNotALinkNotice] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [helpTopic, setHelpTopic] = useState<HelpTopic | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [job, setJob] = useState<Job | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const urlInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoZoneRef = useRef<HTMLDivElement>(null);
  const statusHeadingRef = useRef<HTMLHeadingElement>(null);
  const errorHeadingRef = useRef<HTMLHeadingElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const navTimerRef = useRef<number | null>(null);
  // URL d'aperçu courante, pour la libérer au démontage (pas de fuite mémoire
  // quand l'utilisateur change plusieurs fois de photo).
  const previewUrlRef = useRef<string | null>(null);

  const linkKind = detectLinkKind(urlValue);
  // Un texte sans espace en cours de frappe (« kebab-du-co ») n'est pas encore
  // « invalide » : on attend la sortie du champ pour le signaler.
  const showInvalid =
    linkKind === "invalid" && (urlTouched || /\s/.test(urlValue.trim()));

  // ── Chronomètre de l'écran d'attente ──
  useEffect(() => {
    if (phase !== "loading") return;
    const startedAt = Date.now();
    const id = window.setInterval(() => setElapsed(Date.now() - startedAt), 200);
    return () => window.clearInterval(id);
  }, [phase]);

  // ── Focus : l'utilisateur au clavier / lecteur d'écran suit l'écran ──
  useEffect(() => {
    if (phase === "loading") statusHeadingRef.current?.focus();
    if (phase === "error") errorHeadingRef.current?.focus();
  }, [phase]);

  // ── Nettoyage au démontage (navigation vers la carte, retour arrière…) ──
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (navTimerRef.current) window.clearTimeout(navTimerRef.current);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  // ── Photo ──

  function selectPhoto(file: File) {
    if (!looksLikeImage(file)) {
      toast.error("Ce fichier n'est pas une photo. Choisissez une image (JPG, PNG…).");
      return;
    }
    if (file.size > MAX_RAW_PHOTO_BYTES) {
      toast.error("Cette photo est trop lourde. Essayez avec une capture d'écran.");
      return;
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const previewUrl = URL.createObjectURL(file);
    previewUrlRef.current = previewUrl;
    setPhoto({ file, previewUrl });
    setPreviewBroken(false);
    setPhotoOpen(true);
    setNotALinkNotice(false);
  }

  function removePhoto() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPhoto(null);
  }

  function openPhotoPanel(openPicker: boolean) {
    setPhotoOpen(true);
    // Le sélecteur de fichiers ne s'ouvre que pendant un geste utilisateur :
    // on l'appelle donc directement dans le gestionnaire de clic.
    if (openPicker) fileInputRef.current?.click();
  }

  // Panneau photo ouvert (bouton, ?mode=photo, nom tapé à la place d'un
  // lien) : on le fait entrer dans l'écran s'il est sous la ligne de flottaison.
  useEffect(() => {
    if (!photoOpen) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    photoZoneRef.current?.scrollIntoView({
      block: "nearest",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [photoOpen, notALinkNotice]);

  function closePhotoPanel() {
    removePhoto();
    setPhotoOpen(false);
    setNotALinkNotice(false);
  }

  function onDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) selectPhoto(file);
  }

  // Coller une capture d'écran (Ctrl+V / Cmd+V) : très courant sur ordinateur
  // juste après une capture du profil Instagram.
  const onPaste = useEffectEvent((e: ClipboardEvent) => {
    if (phase === "loading" || phase === "done") return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          selectPhoto(file);
          toast.success("Capture ajoutée.");
        }
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
        toast.info("Rien à coller : copiez d'abord le lien de votre commerce.");
        return;
      }
      setUrlValue(text.slice(0, MAX_LINK_LENGTH));
      setUrlTouched(true);
    } catch {
      // Navigateur sans accès au presse-papiers (ou refus) : on guide vers
      // le geste natif.
      urlInputRef.current?.focus();
      toast.info("Appuyez longuement dans le champ, puis choisissez « Coller ».");
    }
  }

  // ── Création ──

  async function createCard() {
    const rawUrl = urlValue.trim();
    let url = rawUrl ? normalizeLinkInput(rawUrl) : "";
    let businessName = name.trim().slice(0, NAME_MAX);

    if (!url && !photo) {
      urlInputRef.current?.focus();
      toast.info("Collez le lien de votre commerce, ou ajoutez une photo.");
      return;
    }

    if (url && detectLinkKind(rawUrl) === "invalid") {
      // Presque toujours le NOM du commerce tapé à la main : on le garde
      // comme nom (sauf s'il ressemble à un lien raté) et on propose la
      // photo, sans parler d'« erreur ».
      if (!businessName && !/[/:@]/.test(rawUrl)) {
        businessName = rawUrl.slice(0, NAME_MAX);
        setName(businessName);
      }
      setUrlValue("");
      setUrlTouched(false);
      url = "";
      if (!photo) {
        setNotALinkNotice(true);
        openPhotoPanel(false);
        return;
      }
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, CLIENT_TIMEOUT_MS);

    setJob({
      mode: url ? "link" : "photo",
      label: url ? displayHost(url) : businessName || null,
      previewUrl: photo && !previewBroken ? photo.previewUrl : null,
    });
    setElapsed(0);
    setErrorMessage(null);
    setPhase("loading");

    try {
      const body = new FormData();
      if (url) body.set("url", url);
      if (businessName) body.set("name", businessName);
      if (photo) {
        const prepared = await prepareImageForUpload(photo.file);
        if (prepared.size > MAX_UPLOAD_BYTES) {
          throw new FriendlyError(
            "Cette photo est trop lourde (8 Mo maximum). Essayez avec une capture d'écran."
          );
        }
        body.set("image", prepared, prepared.name);
      }

      const res = await fetch("/api/essai", {
        method: "POST",
        body,
        signal: controller.signal,
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok || !isCreateResponse(data)) {
        throw new FriendlyError(createErrorMessage(res.status, data));
      }

      const target = `/essai/${encodeURIComponent(data.token)}`;
      router.prefetch(target);
      setPhase("done");
      navTimerRef.current = window.setTimeout(
        () => router.push(target),
        READY_PAUSE_MS
      );
    } catch (err) {
      // Annulation volontaire (bouton « Annuler » ou départ de la page) :
      // rien à afficher.
      if (controller.signal.aborted && !timedOut) return;
      let message: string;
      if (timedOut) {
        message =
          "La création prend plus de temps que prévu. Réessayez, ou prenez une photo de votre enseigne.";
      } else if (err instanceof FriendlyError) {
        message = err.message;
      } else {
        message =
          "Connexion impossible. Vérifiez votre connexion Internet, puis réessayez.";
      }
      setErrorMessage(message);
      setPhase("error");
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
  const autoStart = useEffectEvent(() => {
    // On retire ?url= de la barre d'adresse : sinon « Retour » depuis la
    // carte relancerait une nouvelle création.
    window.history.replaceState(null, "", "/essai");
    void createCard();
  });

  useEffect(() => {
    if (!initialUrl.trim()) return;
    // setTimeout : en mode strict (dev), React monte/démonte/remonte ; le
    // clearTimeout du 1er passage évite d'envoyer deux créations.
    const id = window.setTimeout(() => autoStart(), 0);
    return () => window.clearTimeout(id);
  }, [initialUrl]);

  // ── Rendu ──

  if ((phase === "loading" || phase === "done") && job) {
    return (
      <Shell>
        <LoadingCard
          job={job}
          elapsed={elapsed}
          done={phase === "done"}
          headingRef={statusHeadingRef}
          onCancel={cancel}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-yellow px-3 py-1 text-[11px] sm:text-xs font-bold uppercase text-foreground"
          style={FONT_UI}
        >
          <Sparkles size={12} aria-hidden />
          Votre logo, vos couleurs
        </span>
        {/* Dès sm, le titre déborde de la colonne du formulaire (marges
            négatives) : Ginto Nord est large et « Votre carte de fidélité »
            doit tenir sur une ligne, le surlignage sur la suivante. */}
        <h1
          className="mt-5 text-[26px] leading-[1.2] sm:-mx-10 sm:text-[44px] sm:leading-[1.12] lg:-mx-24 text-foreground"
          style={FONT_TITLE}
        >
          <span className="sm:block">Votre carte de fidélité</span>{" "}
          <span className="bg-yellow px-2 rounded-md [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
            en 30&nbsp;secondes
          </span>
        </h1>
        <p
          className="mt-4 text-base sm:text-lg leading-relaxed text-foreground/75"
          style={FONT_TEXT}
        >
          Collez le lien de votre commerce ou prenez une photo de votre
          enseigne. On s&apos;occupe du reste.
        </p>
      </div>

      {phase === "error" && errorMessage && (
        <div
          role="alert"
          className="mt-6 rounded-2xl border-2 border-red-200 bg-red-50 p-4 sm:p-5"
        >
          <div className="flex gap-3">
            <TriangleAlert
              size={22}
              className="mt-0.5 shrink-0 text-red-600"
              aria-hidden
            />
            <div className="min-w-0">
              <h2
                ref={errorHeadingRef}
                tabIndex={-1}
                className="font-semibold text-red-900 outline-none"
                style={FONT_UI}
              >
                La carte n&apos;a pas pu être créée
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-red-800" style={FONT_TEXT}>
                {errorMessage}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void createCard()}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-white transition-colors hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-300 cursor-pointer"
                  style={FONT_UI}
                >
                  <RotateCcw size={16} aria-hidden />
                  Réessayer
                </button>
                {!photoOpen && (
                  <button
                    type="button"
                    onClick={() => openPhotoPanel(true)}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full border-2 border-red-200 bg-white px-5 text-sm font-semibold text-red-900 transition-colors hover:border-red-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-300 cursor-pointer"
                    style={FONT_UI}
                  >
                    <Camera size={16} aria-hidden />
                    Prendre une photo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <form
        onSubmit={onSubmit}
        noValidate
        className="mt-7 rounded-[28px] bg-white p-4 sm:p-6 shadow-xl shadow-foreground/5 ring-1 ring-foreground/5"
      >
        <label
          htmlFor={urlId}
          className="block text-sm font-semibold text-foreground"
          style={FONT_UI}
        >
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
            // Court exprès : à 360 px, le bouton « Coller » laisse ~150 px
            // de texte visible.
            placeholder="Collez le lien ici"
            value={urlValue}
            onChange={(e) => {
              setUrlValue(e.target.value);
              setUrlTouched(false);
            }}
            onBlur={() => setUrlTouched(true)}
            aria-describedby={urlHintId}
            aria-invalid={showInvalid || undefined}
            className={`h-14 w-full rounded-2xl border-2 border-border bg-white pl-12 text-base text-foreground placeholder:text-foreground/40 outline-none transition-colors focus:border-foreground ${
              urlValue ? "pr-14" : "pr-[100px]"
            }`}
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
          <LinkKindHint
            kind={showInvalid ? "invalid" : linkKind === "invalid" ? "empty" : linkKind}
            hasPhoto={Boolean(photo)}
            onAddPhoto={() => openPhotoPanel(true)}
          />
        </div>

        {photoOpen && (
          <div ref={photoZoneRef} className="mt-3 rounded-2xl bg-beige p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="pl-1 text-sm font-semibold text-foreground" style={FONT_UI}>
                Votre photo
              </p>
              <button
                type="button"
                onClick={closePhotoPanel}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-full px-3 text-sm text-foreground/60 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground cursor-pointer"
                style={FONT_TEXT}
              >
                <X size={16} aria-hidden />
                Retirer
              </button>
            </div>

            {notALinkNotice && (
              <p
                role="status"
                className="mt-2 rounded-xl bg-yellow/70 p-3 text-sm leading-relaxed text-foreground"
                style={FONT_TEXT}
              >
                Pas de lien&nbsp;? Aucun souci&nbsp;: prenez une photo de votre
                enseigne ou de votre logo, on s&apos;occupe du reste.
              </p>
            )}

            {photo ? (
              <div className="mt-2 flex items-center gap-3 rounded-2xl bg-white p-3">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-beige ring-1 ring-foreground/5">
                  {previewBroken ? (
                    <div className="flex h-full w-full items-center justify-center text-foreground/50">
                      <ImagePlus size={24} aria-hidden />
                    </div>
                  ) : (
                    <Image
                      src={photo.previewUrl}
                      alt="Aperçu de votre photo"
                      fill
                      unoptimized
                      sizes="80px"
                      className="object-cover"
                      onError={() => setPreviewBroken(true)}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground" style={FONT_UI}>
                    {photo.file.name || "Photo"}
                  </p>
                  <p className="text-xs text-muted-foreground" style={FONT_TEXT}>
                    {formatSize(photo.file.size)}
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="-ml-1 mt-0.5 inline-flex min-h-[44px] items-center px-1 text-sm font-semibold text-foreground underline underline-offset-4 hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground rounded-md cursor-pointer"
                    style={FONT_UI}
                  >
                    Changer de photo
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={`mt-2 flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-white px-4 py-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground cursor-pointer ${
                  dragOver ? "border-foreground" : "border-foreground/20 hover:border-foreground/60"
                }`}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow text-foreground">
                  <Camera size={22} aria-hidden />
                </span>
                <span className="text-base font-semibold text-foreground" style={FONT_UI}>
                  Choisir ou prendre une photo
                </span>
                <span className="text-xs leading-relaxed text-muted-foreground" style={FONT_TEXT}>
                  Votre enseigne, votre logo ou une capture d&apos;écran de
                  votre profil Instagram
                </span>
              </button>
            )}

            <label
              htmlFor={nameId}
              className="mt-4 block pl-1 text-sm font-semibold text-foreground"
              style={FONT_UI}
            >
              Nom du commerce{" "}
              <span className="font-normal text-muted-foreground">(facultatif)</span>
            </label>
            <input
              id={nameId}
              type="text"
              autoComplete="organization"
              maxLength={NAME_MAX}
              placeholder={"Ex. : Boulangerie Martin"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 h-12 w-full rounded-xl border-2 border-transparent bg-white px-4 text-base text-foreground placeholder:text-foreground/40 outline-none transition-colors focus:border-foreground"
              style={FONT_TEXT}
            />
          </div>
        )}

        {/* Toujours présent (même panneau fermé) : « Ajouter une capture »
            depuis la pastille Instagram doit pouvoir ouvrir le sélecteur. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Remise à zéro : re-choisir la même photo doit redéclencher onChange.
            e.target.value = "";
            if (file) selectPhoto(file);
          }}
        />

        <button
          type="submit"
          className="mt-4 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-foreground px-6 text-base font-semibold text-white shadow-lg transition-colors hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow cursor-pointer"
          style={FONT_UI}
        >
          Créer ma carte
          <ArrowRight size={18} aria-hidden />
        </button>

        {!photoOpen && (
          <>
            <div className="my-3 flex items-center gap-3" aria-hidden>
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground" style={FONT_UI}>
                ou
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <button
              type="button"
              onClick={() => openPhotoPanel(true)}
              className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-full border-2 border-foreground/15 bg-white px-6 text-base font-semibold text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow cursor-pointer"
              style={FONT_UI}
            >
              <Camera size={18} aria-hidden />
              Prendre une photo
            </button>
          </>
        )}
      </form>

      {/* Où trouver mon lien ? — courtes explications plutôt que de faux exemples */}
      <section className="mt-8 text-center" aria-labelledby={`${uid}-help-title`}>
        <h2
          id={`${uid}-help-title`}
          className="text-sm font-semibold text-foreground"
          style={FONT_UI}
        >
          Où trouver mon lien&nbsp;?
        </h2>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {(
            [
              ["website", "Site web", <Globe key="i" size={16} aria-hidden />],
              ["maps", "Google Maps", <MapPin key="i" size={16} aria-hidden />],
              ["instagram", "Instagram", <InstagramGlyph key="i" size={16} />],
            ] as const
          ).map(([topic, label, icon]) => {
            const active = helpTopic === topic;
            return (
              <button
                key={topic}
                type="button"
                aria-expanded={active}
                aria-controls={helpPanelId}
                onClick={() => setHelpTopic(active ? null : topic)}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground cursor-pointer ${
                  active
                    ? "border-foreground bg-foreground text-white"
                    : "border-foreground/15 bg-white text-foreground hover:border-foreground"
                }`}
                style={FONT_UI}
              >
                {icon}
                {label}
              </button>
            );
          })}
        </div>
        <div id={helpPanelId} aria-live="polite">
          {helpTopic && (
            <p
              className="mx-auto mt-3 max-w-md rounded-2xl bg-white p-4 text-left text-sm leading-relaxed text-foreground/80 ring-1 ring-foreground/5"
              style={FONT_TEXT}
            >
              {HELP_TEXT[helpTopic]}
            </p>
          )}
        </div>
      </section>

      <ul
        className="mt-8 grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3"
        style={FONT_TEXT}
      >
        {[
          "Votre logo et vos couleurs, récupérés automatiquement",
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

const HELP_TEXT: Record<HelpTopic, ReactNode> = {
  website: (
    <>
      Ouvrez votre site, touchez la barre d&apos;adresse en haut de l&apos;écran,
      puis «&nbsp;Copier&nbsp;». Exemple&nbsp;: <strong>boulangerie-martin.fr</strong>
    </>
  ),
  maps: (
    <>
      Dans Google Maps, cherchez votre commerce, touchez «&nbsp;Partager&nbsp;»
      puis «&nbsp;Copier le lien&nbsp;». Exemple&nbsp;:{" "}
      <strong>maps.app.goo.gl/…</strong>
    </>
  ),
  instagram: (
    <>
      Sur votre profil, touchez «&nbsp;Partager le profil&nbsp;» puis
      «&nbsp;Copier le lien&nbsp;» — ou tapez simplement{" "}
      <strong>@votrepseudo</strong>. Pour un logo et des couleurs parfaits,
      ajoutez aussi une capture d&apos;écran de votre profil.
    </>
  ),
};

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[calc(100dvh-52px)] bg-beige">
      <header className="mx-auto flex h-16 max-w-xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center text-xl font-bold tracking-tight text-foreground rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
          style={{ fontFamily: "var(--font-ginto-nord)" }}
        >
          aswallet
        </Link>
        <span className="text-xs text-muted-foreground" style={FONT_TEXT}>
          Sans inscription
        </span>
      </header>
      <div className="mx-auto max-w-xl px-4 pb-14 pt-3 sm:px-6 sm:pt-8">
        {children}
      </div>
    </div>
  );
}

/** Pictogramme Instagram (lucide-react v1 n'embarque plus les logos de marque). */
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
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

function LinkKindHint({
  kind,
  hasPhoto,
  onAddPhoto,
}: {
  kind: LinkKind;
  hasPhoto: boolean;
  onAddPhoto: () => void;
}) {
  if (kind === "empty") return null;

  const pill = (className: string, icon: ReactNode, label: string) => (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${className}`}
      style={FONT_UI}
    >
      {icon}
      {label}
    </span>
  );

  const addPhotoButton = (label: string) =>
    hasPhoto ? null : (
      <button
        type="button"
        onClick={onAddPhoto}
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-foreground underline underline-offset-4 hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground rounded-md cursor-pointer"
        style={FONT_UI}
      >
        <Camera size={15} aria-hidden />
        {label}
      </button>
    );

  switch (kind) {
    case "website":
      return pill(
        "bg-emerald-50 text-emerald-800",
        <Globe size={13} aria-hidden />,
        "Site web détecté"
      );
    case "maps":
      return pill(
        "bg-sky-50 text-sky-800",
        <MapPin size={13} aria-hidden />,
        "Fiche Google Maps détectée"
      );
    case "instagram":
      return (
        <div>
          {pill(
            "bg-fuchsia-50 text-fuchsia-800",
            <InstagramGlyph size={13} />,
            "Instagram détecté"
          )}
          <p className="mt-1.5 text-sm leading-snug text-foreground/70" style={FONT_TEXT}>
            {hasPhoto
              ? "Parfait : votre capture servira pour le logo et les couleurs."
              : "Ajoutez une capture d'écran de votre profil pour récupérer le logo et les couleurs exactes."}
          </p>
          {addPhotoButton("Ajouter une capture")}
        </div>
      );
    case "facebook":
      return (
        <div>
          {pill(
            "bg-amber-50 text-amber-900",
            <TriangleAlert size={13} aria-hidden />,
            "Lien Facebook"
          )}
          <p className="mt-1.5 text-sm leading-snug text-foreground/70" style={FONT_TEXT}>
            Facebook ne partage pas les logos&nbsp;: ajoutez une capture de
            votre page ou une photo de votre enseigne.
          </p>
          {addPhotoButton("Ajouter une photo")}
        </div>
      );
    case "invalid":
      return (
        <div>
          {pill(
            "bg-amber-50 text-amber-900",
            <TriangleAlert size={13} aria-hidden />,
            "Ce n'est pas un lien"
          )}
          <p className="mt-1.5 text-sm leading-snug text-foreground/70" style={FONT_TEXT}>
            Un lien ressemble à <strong>monsite.fr</strong>. Pas de lien&nbsp;?
            Prenez simplement une photo de votre enseigne.
          </p>
          {addPhotoButton("Prendre une photo")}
        </div>
      );
    default:
      return null;
  }
}

function LoadingCard({
  job,
  elapsed,
  done,
  headingRef,
  onCancel,
}: {
  job: Job;
  elapsed: number;
  done: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onCancel: () => void;
}) {
  const steps = job.mode === "link" ? LINK_STEPS : PHOTO_STEPS;
  const current = done ? steps.length : currentStepIndex(elapsed);
  const progress = done ? 100 : progressFor(elapsed);
  const liveLabel = done ? READY_LABEL : steps[current];

  return (
    <div className="mt-2 sm:mt-6 rounded-[28px] bg-white p-5 sm:p-8 shadow-xl shadow-foreground/5 ring-1 ring-foreground/5">
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-yellow">
          {job.previewUrl ? (
            <Image
              src={job.previewUrl}
              alt=""
              fill
              unoptimized
              sizes="64px"
              className="object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-foreground">
              {done ? (
                <Check size={28} strokeWidth={3} aria-hidden />
              ) : (
                <Sparkles size={26} className="motion-safe:animate-pulse" aria-hidden />
              )}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-xl sm:text-2xl leading-tight text-foreground outline-none"
            style={FONT_TITLE}
          >
            {done ? READY_LABEL : "Création de votre carte…"}
          </h1>
          {job.label && (
            <p className="mt-1 truncate text-sm text-muted-foreground" style={FONT_TEXT}>
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
        aria-valuenow={Math.round(progress)}
        className="mt-6 h-2.5 overflow-hidden rounded-full bg-beige"
      >
        <div
          className="h-full rounded-full bg-foreground motion-safe:transition-[width] motion-safe:duration-500 motion-safe:ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ol className="mt-6 space-y-3.5" style={FONT_TEXT}>
        {[...steps, READY_LABEL].map((label, i) => {
          const state = i < current ? "done" : i === current ? "current" : "pending";
          const isFinal = i === steps.length;
          return (
            <li key={label} className="flex items-center gap-3">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
                  state === "done" || (isFinal && done)
                    ? "bg-emerald-500 text-white"
                    : state === "current"
                      ? "bg-yellow text-foreground"
                      : "bg-beige text-foreground/30"
                }`}
                aria-hidden
              >
                {state === "done" || (isFinal && done) ? (
                  <Check size={15} strokeWidth={3} />
                ) : state === "current" ? (
                  <LoaderCircle size={15} className="motion-safe:animate-spin" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                )}
              </span>
              <span
                className={`text-base ${
                  state === "pending" && !(isFinal && done)
                    ? "text-foreground/40"
                    : "font-semibold text-foreground"
                }`}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Annonce vocale de l'étape en cours (les icônes sont décoratives). */}
      <p className="sr-only" role="status" aria-live="polite">
        {liveLabel}
      </p>

      {!done && (
        <div className="mt-7 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
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
    </div>
  );
}
