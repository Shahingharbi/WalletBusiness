"use client";

/**
 * Petits hooks d'environnement pour /essai : réduction des animations et
 * type d'appareil. `useSyncExternalStore` évite à la fois l'écart
 * d'hydratation (valeur serveur fixe) et le setState dans un effet.
 */

import { useSyncExternalStore } from "react";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReduced(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** Lecture ponctuelle (hors rendu React : confettis, navigation…). */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia(REDUCED_QUERY).matches;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false
  );
}

export type DevicePlatform = "ios" | "android" | "mobile" | "desktop";

export function detectPlatform(): DevicePlatform {
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  // iPadOS 13+ se présente comme un Mac de bureau, mais tactile.
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return "ios";
  if (/Mobi|Opera Mini|IEMobile|Silk/i.test(ua)) return "mobile";
  return "desktop";
}

const subscribeNothing = () => () => {};

/** Appareil du visiteur ; `null` pendant le rendu serveur. */
export function useDevicePlatform(): DevicePlatform | null {
  return useSyncExternalStore<DevicePlatform | null>(
    subscribeNothing,
    detectPlatform,
    () => null
  );
}
