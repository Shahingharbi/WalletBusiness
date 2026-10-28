"use client";

/**
 * État de la carte d'essai affichée + retouches EN DIRECT.
 *
 *  - Chaque retouche s'applique IMMÉDIATEMENT à l'aperçu (optimiste), puis
 *    part au serveur (PATCH, regroupé et temporisé pour la saisie) ;
 *  - toutes les écritures (PATCH, remplacement de logo / photo, relecture)
 *    passent dans UNE file : jamais deux réponses qui se doublent ;
 *  - la réponse du serveur (EssaiCardView) fait foi, en gardant par-dessus
 *    ce que l'utilisateur a modifié depuis (rien ne « saute » à l'écran) ;
 *  - en cas d'échec : retour à la dernière version confirmée + message doux.
 */

import { useRef, useState } from "react";
import type {
  EssaiCardView,
  EssaiErrorResponse,
  EssaiUpdateRequest,
} from "@/lib/essai/types";
import { ImageUnreadableError, compressImage } from "@/components/essai/compress-image";

export type SaveState = "idle" | "saving" | "saved";
export type MediaKind = "logo" | "photo";

interface Notifier {
  info: (message: string) => void;
}

export function isCardView(data: unknown): data is EssaiCardView {
  if (typeof data !== "object" || data === null) return false;
  const d = data as EssaiCardView;
  return (
    typeof d.token === "string" &&
    typeof d.name === "string" &&
    typeof d.bannerUrl === "string" &&
    typeof d.cardType === "string" &&
    typeof d.colors === "object" &&
    d.colors !== null
  );
}

function isEmpty(patch: EssaiUpdateRequest): boolean {
  return Object.keys(patch).length === 0;
}

function mergePatch(a: EssaiUpdateRequest, b: EssaiUpdateRequest): EssaiUpdateRequest {
  const out: EssaiUpdateRequest = { ...a, ...b };
  if (a.colors || b.colors) out.colors = { ...a.colors, ...b.colors };
  return out;
}

/** Applique localement une retouche à une vue (aperçu optimiste). */
function overlay(base: EssaiCardView, patch: EssaiUpdateRequest | null): EssaiCardView {
  if (!patch) return base;
  let next = base;
  if (patch.cardType !== undefined && patch.cardType !== base.cardType) {
    const labelStamps =
      patch.cardType === "cashback"
        ? "Points"
        : base.cardType === "cashback"
          ? "Tampons"
          : base.labelStamps;
    next = { ...next, cardType: patch.cardType, labelStamps };
  }
  if (typeof patch.rewardText === "string") next = { ...next, rewardText: patch.rewardText };
  if (patch.firstName !== undefined) next = { ...next, firstName: patch.firstName };
  if (patch.name !== undefined) next = { ...next, name: patch.name };
  if (patch.colors) next = { ...next, colors: { ...next.colors, ...patch.colors } };
  return next;
}

/**
 * Statuts dont le message serveur est déjà rédigé pour le commerçant :
 * requête refusée (400 / 422), carte d'un autre créateur (403), carte gardée
 * (409), démo terminée (410). Un « réessayez » y serait faux.
 */
const SERVER_MESSAGE_STATUSES = new Set([400, 403, 409, 410, 422]);

/** Message d'échec d'une retouche : jamais de détail technique. */
function softError(
  status: number,
  data: unknown,
  fallback = "Cette modification n'a pas pu être enregistrée. Réessayez dans un instant.",
  tooMany = "Beaucoup de retouches d'un coup : patientez quelques secondes."
): string {
  if (status === 429) return tooMany;
  const raw =
    typeof data === "object" && data !== null ? (data as EssaiErrorResponse).error : undefined;
  const msg = typeof raw === "string" ? raw.trim() : "";
  if (
    SERVER_MESSAGE_STATUSES.has(status) &&
    msg &&
    !/\b\d{3}\b|\bMo\b|erreur|error/i.test(msg)
  ) {
    return msg;
  }
  return fallback;
}

/** Carte gardée / démo terminée : l'état affiché doit être relu. */
function isStateConflict(status: number): boolean {
  return status === 409 || status === 410;
}

/** Précharge une image (bande) avant de l'afficher ; ne rejette jamais. */
export function preloadImage(url: string, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve) => {
    const img = new window.Image();
    const done = () => {
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(done, timeoutMs);
    img.onload = done;
    img.onerror = done;
    img.src = url;
  });
}

export function useEssaiView(initial: EssaiCardView, notify: Notifier) {
  const token = initial.token;
  const base = `/api/essai/${encodeURIComponent(token)}`;

  const [view, setView] = useState(initial);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [rewriting, setRewriting] = useState(false);
  const [mediaBusy, setMediaBusy] = useState<MediaKind | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);

  const confirmedRef = useRef(initial);
  const pendingRef = useRef<EssaiUpdateRequest>({});
  const inflightRef = useRef<EssaiUpdateRequest | null>(null);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const timerRef = useRef<number | null>(null);
  const savedTimerRef = useRef<number | null>(null);

  /** Vue serveur + retouches pas encore confirmées. */
  const withLocal = (server: EssaiCardView) =>
    overlay(overlay(server, inflightRef.current), pendingRef.current);

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = queueRef.current.then(task, task);
    queueRef.current = run.catch(() => undefined);
    return run;
  }

  function applyServer(data: EssaiCardView) {
    confirmedRef.current = data;
    setView(withLocal(data));
  }

  async function sendPending(): Promise<void> {
    const body = pendingRef.current;
    if (isEmpty(body)) return;
    pendingRef.current = {};
    inflightRef.current = body;
    const rewrites = body.rewardText === null || body.cardType !== undefined;
    if (rewrites) setRewriting(true);
    setSaveState("saving");
    if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
    try {
      const res = await fetch(base, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: unknown = await res.json().catch(() => null);
      inflightRef.current = null;
      if (!res.ok || !isCardView(data)) {
        setView(withLocal(confirmedRef.current));
        setSaveState("idle");
        notify.info(softError(res.status, data));
        // Gardée / terminée entre-temps : la relecture remplace le panneau
        // de retouches par le message adapté.
        if (isStateConflict(res.status)) void refresh();
        return;
      }
      applyServer(data);
      if (isEmpty(pendingRef.current)) {
        setSaveState("saved");
        savedTimerRef.current = window.setTimeout(() => setSaveState("idle"), 2400);
      }
    } catch {
      inflightRef.current = null;
      setView(withLocal(confirmedRef.current));
      setSaveState("idle");
      notify.info("Connexion impossible : votre modification n'a pas été enregistrée.");
    } finally {
      if (rewrites) setRewriting(false);
    }
  }

  /** Envoie tout de suite ce qui attend. */
  function flush(): Promise<void> {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (isEmpty(pendingRef.current)) return Promise.resolve();
    return enqueue(sendPending);
  }

  /**
   * Retouche : aperçu immédiat, envoi après `delayMs` d'inactivité
   * (saisie au clavier, sélecteur de couleur qu'on fait glisser…).
   */
  function update(patch: EssaiUpdateRequest, delayMs = 0) {
    pendingRef.current = mergePatch(pendingRef.current, patch);
    setView((v) => overlay(v, patch));
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    if (delayMs > 0) {
      timerRef.current = window.setTimeout(() => void flush(), delayMs);
    } else {
      void flush();
    }
  }

  /** « Écrire pour moi » : le serveur réécrit l'offre (métier + type). */
  function rewriteOffer() {
    pendingRef.current = mergePatch(pendingRef.current, { rewardText: null });
    void flush();
  }

  /**
   * Relit la carte. `preloadBanner` : attend que la nouvelle bande soit
   * chargée avant de l'afficher ; `onApplied` est appelé dans la même
   * mise à jour (synchronisation du « pop » du tampon).
   */
  function refresh(options: {
    preloadBanner?: boolean;
    onApplied?: (view: EssaiCardView) => void;
  } = {}): Promise<EssaiCardView | null> {
    return enqueue(async () => {
      try {
        const res = await fetch(`${base}?view=full`, { cache: "no-store" });
        const data: unknown = await res.json().catch(() => null);
        if (!res.ok || !isCardView(data)) return null;
        if (options.preloadBanner && data.bannerUrl !== confirmedRef.current.bannerUrl) {
          await preloadImage(data.bannerUrl);
        }
        applyServer(data);
        options.onApplied?.(data);
        return data;
      } catch {
        return null;
      }
    });
  }

  /**
   * Lie la fiche Google du commerce (lien Google Maps collé) : les demandes
   * d'avis mèneront à SA fiche. Pas d'aperçu optimiste (le serveur résout le
   * lien). Renvoie `null` si c'est fait, sinon un message doux à afficher
   * sous le champ.
   */
  async function linkGoogleMaps(url: string): Promise<string | null> {
    setReviewBusy(true);
    try {
      // Les retouches en attente partent d'abord (même file, même ordre).
      await flush();
      return await enqueue(async () => {
        try {
          const res = await fetch(base, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ googleMapsUrl: url } satisfies EssaiUpdateRequest),
          });
          const data: unknown = await res.json().catch(() => null);
          if (!res.ok || !isCardView(data)) {
            if (isStateConflict(res.status)) void refresh();
            return softError(
              res.status,
              data,
              "Ce lien n'a pas pu être utilisé. Copiez-le à nouveau depuis Google Maps (bouton « Partager »).",
              "Beaucoup d'essais d'un coup : patientez quelques minutes."
            );
          }
          applyServer(data);
          return null;
        } catch {
          return "Connexion impossible : votre fiche n'a pas été liée. Réessayez.";
        }
      });
    } finally {
      setReviewBusy(false);
    }
  }

  /** Remplace le logo ou la photo (image compressée dans le navigateur). */
  async function uploadMedia(kind: MediaKind, file: File): Promise<boolean> {
    setMediaBusy(kind);
    try {
      let prepared: File;
      try {
        prepared = await compressImage(file, kind);
      } catch (err) {
        notify.info(
          err instanceof ImageUnreadableError
            ? err.message
            : "Cette image n'a pas pu être lue. Essayez avec une autre photo."
        );
        return false;
      }
      return await enqueue(async () => {
        const form = new FormData();
        form.set("kind", kind);
        form.set("file", prepared, prepared.name);
        try {
          const res = await fetch(`${base}/media`, { method: "POST", body: form });
          const data: unknown = await res.json().catch(() => null);
          if (!res.ok || !isCardView(data)) {
            notify.info(
              softError(
                res.status,
                data,
                "Cette image n'a pas pu être utilisée. Essayez avec une autre photo.",
                "Beaucoup d'images d'un coup : patientez une minute."
              )
            );
            if (isStateConflict(res.status)) void refresh();
            return false;
          }
          await preloadImage(data.bannerUrl, 6000);
          applyServer(data);
          return true;
        } catch {
          notify.info("Connexion impossible : votre image n'a pas été envoyée.");
          return false;
        }
      });
    } finally {
      setMediaBusy(null);
    }
  }

  return {
    view,
    saveState,
    rewriting,
    mediaBusy,
    reviewBusy,
    update,
    flush,
    rewriteOffer,
    refresh,
    uploadMedia,
    linkGoogleMaps,
  };
}
