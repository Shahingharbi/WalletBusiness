"use client";

/**
 * Inclinaison 3D de l'aperçu : souris (ordinateur) et gyroscope (téléphone).
 *
 * Le hook n'écrit que trois variables CSS sur l'élément scène, à chaque
 * frame d'animation, sans passer par React :
 *   --tilt-x, --tilt-y  ∈ [−1, 1]  (position relative / inclinaison)
 *   --tilt-m            ∈ [0, 1]   (amplitude, pour l'intensité du reflet)
 * Le CSS (essai-wallet.module.css) en déduit transform / opacity → 60 fps.
 *
 * iOS 13+ exige une permission explicite pour DeviceOrientation, demandée
 * au premier toucher de l'aperçu (geste utilisateur obligatoire).
 */

import { useEffect, type RefObject } from "react";

const EASE = 0.12;
const MAX_GYRO_DEG = 22;

type OrientationPermission = "granted" | "denied" | "default";
type OrientationEventCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<OrientationPermission>;
};

function clamp(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

export function useTilt(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let raf = 0;

    const write = () => {
      el.style.setProperty("--tilt-x", x.toFixed(4));
      el.style.setProperty("--tilt-y", y.toFixed(4));
      el.style.setProperty("--tilt-m", Math.min(1, Math.hypot(x, y)).toFixed(4));
    };

    const loop = () => {
      x += (targetX - x) * EASE;
      y += (targetY - y) * EASE;
      write();
      if (Math.abs(targetX - x) > 0.0015 || Math.abs(targetY - y) > 0.0015) {
        raf = requestAnimationFrame(loop);
      } else {
        x = targetX;
        y = targetY;
        write();
        raf = 0;
      }
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };

    // ── Souris ──
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      targetX = clamp(((e.clientX - r.left) / r.width) * 2 - 1);
      targetY = clamp(((e.clientY - r.top) / r.height) * 2 - 1);
      kick();
    };
    const onPointerLeave = () => {
      targetX = 0;
      targetY = 0;
      kick();
    };
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerleave", onPointerLeave);

    // ── Gyroscope ──
    // Position de repos = première mesure, qui dérive lentement vers la
    // position courante : l'effet reste centré quelle que soit la façon
    // dont on tient le téléphone.
    let base: { beta: number; gamma: number } | null = null;
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return;
      if (!base) base = { beta: e.beta, gamma: e.gamma };
      base.beta += (e.beta - base.beta) * 0.015;
      base.gamma += (e.gamma - base.gamma) * 0.015;
      targetX = clamp((e.gamma - base.gamma) / MAX_GYRO_DEG);
      targetY = clamp((e.beta - base.beta) / MAX_GYRO_DEG);
      kick();
    };

    let listening = false;
    const startOrientation = () => {
      if (listening) return;
      listening = true;
      window.addEventListener("deviceorientation", onOrientation);
    };

    const Ctor = (typeof window !== "undefined" ? window.DeviceOrientationEvent : undefined) as
      | OrientationEventCtor
      | undefined;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    let askOnTouch: (() => void) | null = null;

    if (Ctor && coarse) {
      if (typeof Ctor.requestPermission === "function") {
        const request = Ctor.requestPermission.bind(Ctor);
        askOnTouch = () => {
          request()
            .then((state) => {
              if (state === "granted") startOrientation();
            })
            .catch(() => {
              /* refus ou contexte non sécurisé : l'aperçu reste immobile */
            });
        };
        el.addEventListener("click", askOnTouch, { once: true });
      } else {
        startOrientation();
      }
    }

    return () => {
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerleave", onPointerLeave);
      if (askOnTouch) el.removeEventListener("click", askOnTouch);
      if (listening) window.removeEventListener("deviceorientation", onOrientation);
      if (raf) cancelAnimationFrame(raf);
      el.style.removeProperty("--tilt-x");
      el.style.removeProperty("--tilt-y");
      el.style.removeProperty("--tilt-m");
    };
  }, [ref, enabled]);
}
