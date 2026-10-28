"use client";

/**
 * Confettis légers, sans dépendance ni canvas : ~90 éléments DOM animés en
 * CSS (transform + opacity uniquement), ajoutés à <body> puis retirés.
 * Aucun état React → aucun re-rendu. Rien ne se passe si l'utilisateur a
 * demandé à réduire les animations.
 */

import styles from "./essai-wallet.module.css";
import { prefersReducedMotion } from "./motion";

const DEFAULT_COLORS = ["#fff382", "#ffe94d", "#1a1e22", "#ffffff", "#f59e0b", "#34d399"];
const LIFETIME_MS = 2700;

export interface ConfettiOptions {
  /** Point de départ : un élément (centre) ou des coordonnées écran. */
  origin?: HTMLElement | { x: number; y: number } | null;
  /** Couleurs de la marque, complétées par le jaune aswallet. */
  colors?: string[];
  count?: number;
}

export function burstConfetti({ origin = null, colors, count }: ConfettiOptions = {}) {
  if (typeof document === "undefined" || prefersReducedMotion()) return;

  let x = window.innerWidth / 2;
  let y = window.innerHeight * 0.4;
  if (origin instanceof HTMLElement) {
    const r = origin.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top + r.height / 2;
  } else if (origin) {
    x = origin.x;
    y = origin.y;
  }

  const palette = Array.from(
    new Set([...(colors ?? []).filter((c) => /^#[0-9a-f]{6}$/i.test(c)), ...DEFAULT_COLORS])
  );
  const total = count ?? (window.innerWidth < 640 ? 70 : 110);
  const spread = Math.min(window.innerWidth, 900);

  const layer = document.createElement("div");
  layer.className = styles.confettiLayer;
  layer.setAttribute("aria-hidden", "true");

  for (let i = 0; i < total; i++) {
    const piece = document.createElement("i");
    piece.className = styles.confettiPiece;
    // Cône vers le haut (−155° … −25°), vitesse variable.
    const angle = ((-155 + Math.random() * 130) * Math.PI) / 180;
    const speed = spread * (0.18 + Math.random() * 0.32);
    const dx = Math.cos(angle) * speed;
    const up = Math.sin(angle) * speed * 0.9;
    const fall = window.innerHeight * (0.45 + Math.random() * 0.45);
    const w = 6 + Math.random() * 6;
    const ratio = Math.random() < 0.5 ? 0.45 : 1.5;

    piece.style.left = `${x}px`;
    piece.style.top = `${y}px`;
    piece.style.width = `${w.toFixed(1)}px`;
    piece.style.height = `${(w * ratio).toFixed(1)}px`;
    piece.style.background = palette[i % palette.length];
    if (Math.random() < 0.22) piece.style.borderRadius = "50%";
    piece.style.setProperty("--dx", `${dx.toFixed(1)}px`);
    piece.style.setProperty("--up", `${up.toFixed(1)}px`);
    piece.style.setProperty("--fall", `${fall.toFixed(1)}px`);
    piece.style.setProperty("--rot", `${Math.round(Math.random() * 1000 - 500)}deg`);
    piece.style.setProperty("--dur", `${Math.round(1500 + Math.random() * 900)}ms`);
    piece.style.setProperty("--delay", `${Math.round(Math.random() * 140)}ms`);
    layer.appendChild(piece);
  }

  document.body.appendChild(layer);
  window.setTimeout(() => layer.remove(), LIFETIME_MS);
}
