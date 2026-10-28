"use client";

/**
 * Choix du type de carte : Tampons / Points / Remise / Carte VIP.
 * Quatre grosses tuiles illustrées = un groupe de boutons radio natifs
 * (flèches du clavier, lecteurs d'écran : tout fonctionne d'office).
 */

import { Check } from "lucide-react";
import {
  ESSAI_CARD_TYPES,
  ESSAI_CARD_TYPE_LABELS,
  type EssaiCardType,
} from "@/lib/essai/types";
import { cn } from "@/lib/utils";
import styles from "./essai-wallet.module.css";

const FONT_UI = { fontFamily: "var(--font-maison-neue-extended)" };
const FONT_TEXT = { fontFamily: "var(--font-maison-neue)" };

export const CARD_TYPE_COPY: Record<EssaiCardType, { subtitle: string; example: string }> = {
  stamp: {
    subtitle: "Un tampon à chaque passage, un cadeau au bout.",
    example: "10 cafés = 1 offert",
  },
  cashback: {
    subtitle: "Des points à chaque achat, échangés contre une récompense.",
    example: "100 points = 5 € offerts",
  },
  discount: {
    subtitle: "Une réduction permanente pour vos habitués.",
    example: "−10 % sur tout",
  },
  membership: {
    subtitle: "Des avantages réservés à vos meilleurs clients.",
    example: "Dessert offert aux membres",
  },
};

export function CardTypePicker({
  name,
  value,
  onChange,
  size = "lg",
  disabled = false,
  legend,
}: {
  /** Nom du groupe radio (unique dans la page). */
  name: string;
  value: EssaiCardType;
  onChange: (type: EssaiCardType) => void;
  size?: "lg" | "sm";
  disabled?: boolean;
  legend: string;
}) {
  const large = size === "lg";
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="sr-only">{legend}</legend>
      <div className={cn("grid grid-cols-2", large ? "gap-3" : "gap-2.5")}>
        {ESSAI_CARD_TYPES.map((type) => {
          const checked = value === type;
          return (
            <label
              key={type}
              className={cn(
                "group relative flex min-w-0 cursor-pointer flex-col rounded-[22px] border-2 bg-white text-left transition-[border-color,box-shadow,transform] duration-200",
                "has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-yellow",
                large ? "p-3 sm:p-4" : "p-2.5 sm:p-3",
                checked
                  ? "border-foreground shadow-[0_14px_30px_-18px_rgba(26,30,34,0.55)]"
                  : "border-foreground/10 hover:border-foreground/35",
                disabled && !checked && "opacity-55",
                disabled ? "cursor-default" : "active:scale-[0.985]"
              )}
            >
              <input
                type="radio"
                name={name}
                value={type}
                checked={checked}
                onChange={() => onChange(type)}
                className="sr-only"
              />
              <span
                className={cn(
                  "relative block overflow-hidden rounded-2xl bg-beige transition-transform duration-300",
                  checked && "scale-[1.02]"
                )}
                aria-hidden
              >
                <TypeIllustration type={type} active={checked} />
              </span>
              <span
                className={cn(
                  "mt-2.5 block font-semibold leading-tight text-foreground",
                  large ? "text-base sm:text-lg" : "text-sm sm:text-base"
                )}
                style={FONT_UI}
              >
                {ESSAI_CARD_TYPE_LABELS[type]}
              </span>
              <span
                className={cn(
                  "mt-1 block leading-snug text-foreground/65",
                  large ? "text-[13px] sm:text-sm" : "text-xs"
                )}
                style={FONT_TEXT}
              >
                {CARD_TYPE_COPY[type].subtitle}
              </span>
              {large && (
                <span
                  className="mt-2 inline-flex w-fit max-w-full rounded-full bg-beige px-2.5 py-1 text-[11px] font-semibold leading-tight text-foreground/80 sm:text-xs"
                  style={FONT_UI}
                >
                  Ex.&nbsp;: {CARD_TYPE_COPY[type].example}
                </span>
              )}
              {checked && (
                <span
                  className={cn(
                    "absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-white shadow-md",
                    styles.checkPop
                  )}
                  aria-hidden
                >
                  <Check size={15} strokeWidth={3} />
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// ─── Illustrations (mini-cartes Wallet) ───────────────────────────────────

const INK = "#1a1e22";
const YELLOW = "#fff382";

function TypeIllustration({ type, active }: { type: EssaiCardType; active: boolean }) {
  return (
    <svg viewBox="0 0 160 84" className="block h-auto w-full" role="presentation">
      <rect x="14" y="8" width="132" height="70" rx="11" fill={INK} />
      <circle cx="28" cy="21" r="6" fill={YELLOW} />
      <rect x="39" y="18" width="40" height="6" rx="3" fill="#fff" opacity="0.85" />
      {type === "stamp" && <StampArt active={active} />}
      {type === "cashback" && <PointsArt active={active} />}
      {type === "discount" && <DiscountArt active={active} />}
      {type === "membership" && <VipArt active={active} />}
    </svg>
  );
}

function StampArt({ active }: { active: boolean }) {
  const filled = active ? 4 : 3;
  return (
    <g>
      {Array.from({ length: 10 }, (_, i) => {
        const col = i % 5;
        const row = Math.floor(i / 5);
        const cx = 40 + col * 20;
        const cy = 42 + row * 19;
        const on = i < filled;
        return (
          <g key={i}>
            <rect
              x={cx - 7.5}
              y={cy - 7.5}
              width="15"
              height="15"
              rx="4.5"
              fill={on ? "#fff" : "none"}
              stroke={on ? YELLOW : "rgba(255,255,255,0.35)"}
              strokeWidth="2"
            />
            {on && (
              <path
                d={`M${cx - 3.6} ${cy + 0.2} l2.5 2.6 l4.9 -5.2`}
                fill="none"
                stroke={INK}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </g>
        );
      })}
    </g>
  );
}

function PointsArt({ active }: { active: boolean }) {
  return (
    <g>
      <circle cx="46" cy="51" r="16" fill={YELLOW} />
      <circle cx="46" cy="51" r="11" fill="none" stroke={INK} strokeOpacity="0.25" strokeWidth="2" />
      <path
        d="M46 43.5 l2.3 4.7 5.2 .8 -3.8 3.6 .9 5.1 -4.6 -2.4 -4.6 2.4 .9 -5.1 -3.8 -3.6 5.2 -.8 Z"
        fill={INK}
      />
      <text
        x="72"
        y="50"
        fill="#fff"
        fontSize="17"
        fontWeight="700"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {active ? "+10" : "320"}
      </text>
      <rect x="72" y="57" width="58" height="7" rx="3.5" fill="#fff" opacity="0.2" />
      <rect x="72" y="57" width={active ? 44 : 34} height="7" rx="3.5" fill={YELLOW} />
    </g>
  );
}

function DiscountArt({ active }: { active: boolean }) {
  return (
    <g>
      <path
        d="M40 36 h62 a6 6 0 0 1 4.6 2.2 l9 10.8 a3 3 0 0 1 0 3.8 l-9 10.8 A6 6 0 0 1 102 66 H40 a6 6 0 0 1 -6 -6 V42 a6 6 0 0 1 6 -6 Z"
        fill={YELLOW}
      />
      <circle cx="105" cy="51" r="3" fill={INK} />
      <text
        x="66"
        y="57.5"
        textAnchor="middle"
        fill={INK}
        fontSize="17"
        fontWeight="800"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {active ? "−15 %" : "−10 %"}
      </text>
    </g>
  );
}

function VipArt({ active }: { active: boolean }) {
  return (
    <g>
      <defs>
        <linearGradient id="essai-vip-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff6b0" />
          <stop offset="0.55" stopColor="#f2c94c" />
          <stop offset="1" stopColor="#c99a2e" />
        </linearGradient>
      </defs>
      <path
        d="M58 64 l-4 -21 11 9 15 -15 15 15 11 -9 -4 21 Z"
        fill="url(#essai-vip-gold)"
        transform={active ? "translate(0 -2)" : undefined}
      />
      <rect x="58" y="66" width="44" height="4" rx="2" fill="url(#essai-vip-gold)" />
      <circle cx="80" cy="34" r="2.6" fill="#fff6b0" opacity={active ? 1 : 0.6} />
      <circle cx="122" cy="40" r="1.8" fill="#fff" opacity="0.5" />
      <circle cx="38" cy="44" r="1.4" fill="#fff" opacity="0.45" />
    </g>
  );
}
