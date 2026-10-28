"use client";

/**
 * Scène « waouh » de l'aperçu : un iPhone (app Cartes, fond noir) ou un
 * Android (Google Wallet) qui affiche la réplique du pass, avec :
 *  - la carte qui glisse et se pose dans le Wallet à l'apparition ;
 *  - une inclinaison 3D à la souris / au gyroscope (useTilt) ;
 *  - un reflet holographique qui suit l'inclinaison ;
 *  - un halo à la couleur de la marque derrière le téléphone.
 *
 * Écran iPhone modélisé à 393 × 852 pt (iPhone 15 / 16) : `pt(n)` convertit
 * une cote en points en `cqw` de l'écran, d'où des proportions exactes à
 * toute taille d'affichage.
 */

import { useRef, type CSSProperties, type ReactNode } from "react";
import { ArrowLeft, EllipsisVertical, Info } from "lucide-react";
import { luminance } from "@/lib/wallet-colors";
import { cn } from "@/lib/utils";
import styles from "./essai-wallet.module.css";
import { useReducedMotion } from "./motion";
import { useTilt } from "./use-tilt";
import {
  AppleWalletPass,
  GoogleWalletPass,
  type PassBusy,
  type StampPop,
  type WalletPassData,
} from "./wallet-pass-preview";

export type WalletPlatform = "apple" | "google";

const SCREEN_W = 393;
const pt = (n: number) => `${((n * 100) / SCREEN_W).toFixed(3)}cqw`;

export function WalletPreviewStage({
  data,
  platform,
  onPlatformChange,
  pop,
  busy,
  ariaLabel,
  className,
  phoneClassName = "w-[min(76vw,320px)] lg:w-[340px]",
}: {
  data: WalletPassData;
  platform: WalletPlatform;
  onPlatformChange?: (platform: WalletPlatform) => void;
  pop?: StampPop | null;
  busy?: PassBusy;
  /** Description de la carte pour les lecteurs d'écran. */
  ariaLabel: string;
  className?: string;
  phoneClassName?: string;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  useTilt(stageRef, !reducedMotion);

  const bg = data.colors.background;
  const auraColor = luminance(bg) > 0.82 ? data.colors.accent : bg;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      {onPlatformChange && <PlatformToggle value={platform} onChange={onPlatformChange} />}
      <div
        ref={stageRef}
        className={cn(styles.stage, "flex w-full justify-center", onPlatformChange && "mt-5")}
        role="img"
        aria-label={ariaLabel}
      >
        <span className={styles.aura} style={{ backgroundColor: auraColor }} aria-hidden />
        <div className={cn(styles.tilt, phoneClassName)}>
          <div key={platform} className={styles.phoneEnter}>
            {platform === "apple" ? (
              <IPhoneFrame>
                <AppleWalletPass data={data} pop={pop} busy={busy} />
              </IPhoneFrame>
            ) : (
              <AndroidFrame>
                <GoogleWalletPass data={data} pop={pop} busy={busy} />
              </AndroidFrame>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Bascule iPhone / Android ─────────────────────────────────────────────

function PlatformToggle({
  value,
  onChange,
}: {
  value: WalletPlatform;
  onChange: (platform: WalletPlatform) => void;
}) {
  const options: Array<{ id: WalletPlatform; label: string; icon: ReactNode }> = [
    { id: "apple", label: "iPhone", icon: <AppleGlyph /> },
    { id: "google", label: "Android", icon: <AndroidGlyph /> },
  ];
  return (
    <div
      role="group"
      aria-label="Choisir le téléphone de l'aperçu"
      className="relative grid grid-cols-2 rounded-full bg-white p-1 shadow-sm ring-1 ring-foreground/10"
    >
      <span
        aria-hidden
        className="absolute bottom-1 left-1 top-1 w-[calc(50%-4px)] rounded-full bg-foreground shadow-md transition-transform duration-300 ease-out motion-reduce:transition-none"
        style={{ transform: value === "google" ? "translateX(100%)" : "none" }}
      />
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.id)}
            className={cn(
              "relative z-10 inline-flex min-h-[44px] min-w-[118px] items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow focus-visible:ring-offset-2 cursor-pointer",
              active ? "text-white" : "text-foreground/70 hover:text-foreground"
            )}
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function AppleGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function AndroidGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.6 9.48 19.44 6.3a.38.38 0 0 0-.66-.38l-1.87 3.23a11.4 11.4 0 0 0-9.82 0L5.22 5.92a.38.38 0 0 0-.66.38L6.4 9.48A10.8 10.8 0 0 0 1 18h22a10.8 10.8 0 0 0-5.4-8.52ZM7 15.25A1.25 1.25 0 1 1 8.25 14 1.25 1.25 0 0 1 7 15.25Zm10 0A1.25 1.25 0 1 1 18.25 14 1.25 1.25 0 0 1 17 15.25Z" />
    </svg>
  );
}

// ─── iPhone (app Cartes) ──────────────────────────────────────────────────

const sideButton = (style: CSSProperties): CSSProperties => ({
  position: "absolute",
  width: "1.15%",
  borderRadius: "2px",
  background: "linear-gradient(90deg, #2a2a2d, #4b4b50 50%, #2a2a2d)",
  ...style,
});

function IPhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative" style={{ aspectRatio: "419 / 878" }}>
      {/* Boutons latéraux (action, volume, marche). */}
      <span aria-hidden style={sideButton({ left: "-0.9%", top: "15.5%", height: "3.4%" })} />
      <span aria-hidden style={sideButton({ left: "-0.9%", top: "21.5%", height: "6.6%" })} />
      <span aria-hidden style={sideButton({ left: "-0.9%", top: "29.4%", height: "6.6%" })} />
      <span aria-hidden style={sideButton({ right: "-0.9%", top: "24%", height: "10.4%" })} />

      {/* Châssis titane + écran. */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius: "16.2% / 7.74%",
          background:
            "linear-gradient(150deg, #57575c 0%, #232326 22%, #2e2e32 55%, #141416 100%)",
          boxShadow:
            "0 60px 90px -40px rgba(0,0,0,0.6), 0 26px 44px -26px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.1)",
        }}
      >
        <div
          className="absolute bg-black"
          style={{
            left: "0.9%",
            right: "0.9%",
            top: "0.43%",
            bottom: "0.43%",
            borderRadius: "15.6% / 7.45%",
          }}
        />
        <div
          className="absolute overflow-hidden bg-black"
          style={{
            left: "3.1%",
            right: "3.1%",
            top: "1.48%",
            bottom: "1.48%",
            borderRadius: "14% / 6.46%",
            containerType: "inline-size",
          }}
        >
          <IosStatusBar />
          {/* Dynamic Island */}
          <span
            aria-hidden
            className="absolute left-1/2 block -translate-x-1/2 bg-black"
            style={{
              top: pt(11),
              width: pt(124),
              height: pt(36),
              borderRadius: pt(18),
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05)",
            }}
          >
            <span
              className="absolute block rounded-full"
              style={{
                right: pt(13),
                top: pt(12),
                width: pt(12),
                height: pt(12),
                background: "radial-gradient(circle at 35% 35%, #2b3a55, #0b0f18 60%)",
              }}
            />
          </span>

          {/* Bords des cartes voisines (carrousel du Wallet). */}
          <span
            aria-hidden
            className="absolute block"
            style={{
              left: pt(-16),
              top: pt(60),
              width: pt(22),
              height: pt(531),
              borderRadius: pt(11),
              background: "#1c1c1e",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.22)",
            }}
          />
          <span
            aria-hidden
            className="absolute block"
            style={{
              left: pt(387),
              top: pt(60),
              width: pt(22),
              height: pt(531),
              borderRadius: pt(11),
              background: "#e9e6df",
            }}
          />

          {/* La carte. */}
          <div className={cn("absolute", styles.passEnter)} style={{ left: pt(15.5), top: pt(60), width: pt(362) }}>
            {children}
          </div>

          <PageDots />

          <span
            aria-hidden
            className="absolute block"
            style={{
              left: pt(18),
              right: pt(18),
              top: pt(690),
              height: "1px",
              background: "rgba(255,255,255,0.16)",
            }}
          />
          <Info
            aria-hidden
            color="#ffffff"
            strokeWidth={1.7}
            className="absolute"
            style={{ right: pt(19), top: pt(700), width: pt(25), height: pt(25) }}
          />

          {/* Pile des autres cartes, en bas de l'écran. */}
          {[
            { top: 752, inset: 22, color: "#7f9bb8" },
            { top: 764, inset: 18, color: "#173b2f" },
            { top: 778, inset: 15, color: "#24324d" },
          ].map((c) => (
            <span
              key={c.top}
              aria-hidden
              className="absolute block"
              style={{
                left: pt(c.inset),
                right: pt(c.inset),
                top: pt(c.top),
                height: pt(120),
                borderRadius: pt(12),
                background: c.color,
                boxShadow: "0 -1px 0 rgba(255,255,255,0.12)",
              }}
            />
          ))}
          <span
            aria-hidden
            className="absolute left-1/2 block -translate-x-1/2 rounded-full bg-white/85"
            style={{ bottom: pt(8), width: pt(134), height: pt(5) }}
          />
        </div>
      </div>
    </div>
  );
}

function IosStatusBar() {
  return (
    <span
      aria-hidden
      className="absolute inset-x-0 top-0 block text-white"
      style={{
        height: pt(54),
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <span
        className="absolute block text-center"
        style={{ left: pt(28), width: pt(56), top: pt(18), fontSize: pt(17), fontWeight: 600, lineHeight: 1.2 }}
      >
        9:41
      </span>
      <span className="absolute flex items-center" style={{ right: pt(26), top: pt(22), gap: pt(6) }}>
        {/* Réseau */}
        <svg viewBox="0 0 18 12" style={{ width: pt(18), height: pt(12) }} fill="currentColor">
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
          <rect x="10" y="3" width="3" height="9" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" />
        </svg>
        {/* Wi-Fi */}
        <svg viewBox="0 0 16 12" style={{ width: pt(16), height: pt(12) }} fill="currentColor">
          <path d="M8 2.4c2.3 0 4.4.9 6 2.4l1.1-1.1A10 10 0 0 0 8 .8 10 10 0 0 0 .9 3.7L2 4.8a8.4 8.4 0 0 1 6-2.4Zm0 3.2c1.4 0 2.7.5 3.7 1.4l1.1-1.1A6.9 6.9 0 0 0 8 4a6.9 6.9 0 0 0-4.8 1.9L4.3 7A5.4 5.4 0 0 1 8 5.6Zm0 3.2c.6 0 1.1.2 1.5.6L8 11 6.5 9.4c.4-.4.9-.6 1.5-.6Z" />
        </svg>
        {/* Batterie */}
        <svg viewBox="0 0 27 13" style={{ width: pt(27), height: pt(13) }}>
          <rect x="0.5" y="0.5" width="23" height="12" rx="3.6" fill="none" stroke="currentColor" strokeOpacity="0.4" />
          <rect x="2" y="2" width="17" height="9" rx="2.2" fill="currentColor" />
          <path d="M25 4.3v4.4a2.3 2.3 0 0 0 0-4.4Z" fill="currentColor" fillOpacity="0.4" />
        </svg>
      </span>
    </span>
  );
}

/** Points de pagination du carrousel (3e carte active, extrémités réduites). */
function PageDots() {
  const dots = [3.6, 5.4, 7.4, 7.4, 7.4, 7.4, 7.4, 7.4, 5.4, 3.6];
  const active = 2;
  return (
    <span
      aria-hidden
      className="absolute inset-x-0 flex items-center justify-center"
      style={{ top: pt(601), height: pt(10), gap: pt(9) }}
    >
      {dots.map((d, i) => (
        <span
          key={i}
          className="block rounded-full"
          style={{
            width: pt(d),
            height: pt(d),
            background: i === active ? "#ffffff" : "rgba(255,255,255,0.33)",
          }}
        />
      ))}
    </span>
  );
}

// ─── Android (Google Wallet) ──────────────────────────────────────────────

function AndroidFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative" style={{ aspectRatio: "413 / 893" }}>
      <span aria-hidden style={sideButton({ right: "-0.9%", top: "20%", height: "6.5%" })} />
      <span aria-hidden style={sideButton({ right: "-0.9%", top: "30%", height: "12%" })} />
      <div
        className="absolute inset-0"
        style={{
          borderRadius: "11% / 5.1%",
          background: "linear-gradient(150deg, #4a4c52 0%, #1f2024 25%, #2a2c31 60%, #121316 100%)",
          boxShadow:
            "0 60px 90px -40px rgba(0,0,0,0.6), 0 26px 44px -26px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.1)",
        }}
      >
        <div
          className="absolute overflow-hidden"
          style={{
            left: "2.42%",
            right: "2.42%",
            top: "1.12%",
            bottom: "1.12%",
            borderRadius: "9.4% / 4.3%",
            background: "#101113",
            containerType: "inline-size",
          }}
        >
          {/* Barre d'état */}
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 block text-white"
            style={{ height: pt(40), fontFamily: 'Roboto, "Google Sans", system-ui, sans-serif' }}
          >
            <span
              className="absolute block"
              style={{ left: pt(26), top: pt(13), fontSize: pt(14), fontWeight: 500, lineHeight: 1.2 }}
            >
              9:41
            </span>
            <span
              className="absolute left-1/2 block -translate-x-1/2 rounded-full bg-black"
              style={{ top: pt(11), width: pt(14), height: pt(14), boxShadow: "inset 0 0 0 1.5px #1f2125" }}
            />
            <span className="absolute flex items-center" style={{ right: pt(24), top: pt(14), gap: pt(6) }}>
              <svg viewBox="0 0 16 12" style={{ width: pt(15), height: pt(12) }} fill="currentColor">
                <path d="M8 2.4c2.3 0 4.4.9 6 2.4l1.1-1.1A10 10 0 0 0 8 .8 10 10 0 0 0 .9 3.7L2 4.8a8.4 8.4 0 0 1 6-2.4Zm0 3.2c1.4 0 2.7.5 3.7 1.4l1.1-1.1A6.9 6.9 0 0 0 8 4a6.9 6.9 0 0 0-4.8 1.9L4.3 7A5.4 5.4 0 0 1 8 5.6Zm0 3.2c.6 0 1.1.2 1.5.6L8 11 6.5 9.4c.4-.4.9-.6 1.5-.6Z" />
              </svg>
              <svg viewBox="0 0 12 12" style={{ width: pt(12), height: pt(12) }} fill="currentColor">
                <path d="M12 0v12H0Z" />
              </svg>
              <svg viewBox="0 0 8 14" style={{ width: pt(8), height: pt(14) }} fill="currentColor">
                <rect x="2.5" y="0" width="3" height="1.6" rx="0.5" />
                <rect x="0" y="1.4" width="8" height="12.6" rx="1.4" />
              </svg>
            </span>
          </span>

          {/* Barre d'application Google Wallet */}
          <span aria-hidden className="absolute inset-x-0 flex items-center justify-between text-white" style={{ top: pt(46), height: pt(52), padding: `0 ${pt(14)}` }}>
            <ArrowLeft style={{ width: pt(24), height: pt(24) }} strokeWidth={2} />
            <EllipsisVertical style={{ width: pt(24), height: pt(24) }} strokeWidth={2} />
          </span>

          <div className={cn("absolute", styles.passEnter)} style={{ left: pt(16), top: pt(108), width: pt(361) }}>
            {children}
          </div>

          <span
            aria-hidden
            className="absolute left-1/2 block -translate-x-1/2 rounded-full bg-white/70"
            style={{ bottom: pt(9), width: pt(108), height: pt(4) }}
          />
        </div>
      </div>
    </div>
  );
}
