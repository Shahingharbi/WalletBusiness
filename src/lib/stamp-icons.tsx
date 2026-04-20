import React from "react";

type IconProps = { className?: string };

const Check = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Star = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2.5l2.95 6.15 6.8.78-5 4.77 1.32 6.7L12 17.6l-6.07 3.3L7.25 14.2l-5-4.77 6.8-.78L12 2.5z" />
  </svg>
);

const Heart = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 20.5s-7.5-4.4-7.5-10.2A4.3 4.3 0 0 1 12 7.1a4.3 4.3 0 0 1 7.5 3.2C19.5 16.1 12 20.5 12 20.5z" />
  </svg>
);

const Coffee = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 8h1a4 4 0 0 1 0 8h-1" />
    <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z" />
    <path d="M6 2v2M10 2v2M14 2v2" />
  </svg>
);

const Pizza = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2a10 10 0 0 1 8.66 5L12 22 3.34 7A10 10 0 0 1 12 2z" opacity="0.2" />
    <path d="M12 2a10 10 0 0 1 8.66 5L12 22 3.34 7A10 10 0 0 1 12 2zm0 2a8 8 0 0 0-6.56 3.43L12 18.55 18.56 7.43A8 8 0 0 0 12 4z" />
    <circle cx="9" cy="10" r="1.1" /><circle cx="13.5" cy="9" r="1.1" /><circle cx="11.5" cy="14" r="1.1" />
  </svg>
);

const Flower = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <circle cx="12" cy="12" r="2.2" />
    <path d="M12 2a3.3 3.3 0 0 1 3 4.8c1.8-.3 3.5 1.4 3.2 3.2A3.3 3.3 0 0 1 22 12a3.3 3.3 0 0 1-3.8 2c.3 1.8-1.4 3.5-3.2 3.2A3.3 3.3 0 0 1 12 22a3.3 3.3 0 0 1-3-4.8c-1.8.3-3.5-1.4-3.2-3.2A3.3 3.3 0 0 1 2 12a3.3 3.3 0 0 1 3.8-2C5.5 8.2 7.2 6.5 9 6.8A3.3 3.3 0 0 1 12 2z" opacity="0.9" />
  </svg>
);

const Scissors = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" />
    <path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" />
  </svg>
);

const Crown = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M2 18l2-10 5 4 3-7 3 7 5-4 2 10H2zm0 2h20v2H2v-2z" />
  </svg>
);

const Leaf = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M20 3c-7 0-13 4-13 11 0 2 .6 3.8 1.6 5.3L5 22l1.4 1.4 3.3-3.3C11 21 12.7 21.5 14.5 21.5 19 21.5 21 16 21 10c0-3 .4-5.7-1-7zM9 16c0-5 4-9 9-9-1 6-5 9-9 9z" />
  </svg>
);

const Gift = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 12v10H4V12" />
    <path d="M2 7h20v5H2z" />
    <path d="M12 22V7" />
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
  </svg>
);

const Baguette = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18.5 3c1.5 0 2.5 1 2.5 2.5 0 .8-.3 1.3-.9 1.9L7.4 20.1c-.6.6-1.1.9-1.9.9C4 21 3 20 3 18.5c0-.8.3-1.3.9-1.9L16.6 3.9c.6-.6 1.1-.9 1.9-.9z" opacity="0.85" />
    <path d="M6 16l2 2M9 13l2 2M12 10l2 2M15 7l2 2" stroke="#fff" strokeWidth={1.1} strokeLinecap="round" opacity="0.5" />
  </svg>
);

const Kebab = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <rect x="3" y="11" width="18" height="3" rx="1.5" opacity="0.9" />
    <circle cx="6.5" cy="7.5" r="2.5" />
    <circle cx="12" cy="6.5" r="3" />
    <circle cx="17.5" cy="7.5" r="2.5" />
    <circle cx="7" cy="17" r="2" /><circle cx="12.5" cy="18" r="2" /><circle cx="17.5" cy="17" r="2" />
  </svg>
);

const Diamond = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M6 3h12l4 6-10 12L2 9l4-6zm1.3 2L4.8 8.6 12 17l7.2-8.4L16.7 5H7.3z" />
  </svg>
);

const Sparkle = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2l1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2z" />
  </svg>
);

export type StampIconKey =
  | "check" | "star" | "heart" | "coffee" | "pizza" | "flower"
  | "scissors" | "crown" | "leaf" | "gift" | "baguette" | "kebab"
  | "diamond" | "sparkle";

export const STAMP_ICONS: Record<StampIconKey, { label: string; Icon: React.FC<IconProps> }> = {
  check: { label: "Coche", Icon: Check },
  star: { label: "Etoile", Icon: Star },
  heart: { label: "Coeur", Icon: Heart },
  coffee: { label: "Cafe", Icon: Coffee },
  pizza: { label: "Pizza", Icon: Pizza },
  flower: { label: "Fleur", Icon: Flower },
  scissors: { label: "Ciseaux", Icon: Scissors },
  crown: { label: "Couronne", Icon: Crown },
  leaf: { label: "Feuille", Icon: Leaf },
  gift: { label: "Cadeau", Icon: Gift },
  baguette: { label: "Baguette", Icon: Baguette },
  kebab: { label: "Kebab", Icon: Kebab },
  diamond: { label: "Diamant", Icon: Diamond },
  sparkle: { label: "Paillettes", Icon: Sparkle },
};

export function isStampIconKey(k: string | null | undefined): k is StampIconKey {
  return Boolean(k) && k! in STAMP_ICONS;
}

export function getStampIcon(key: string | null | undefined): StampIconKey {
  return isStampIconKey(key) ? key : "check";
}
