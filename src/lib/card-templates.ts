import { DEFAULT_CARD_DESIGN, type CardType } from "@/lib/constants";

export interface CardTemplate {
  id: string;
  label: string;
  emoji: string;
  type: CardType;
  name: string;
  rewardText: string;
  stampCount: number;
  design: typeof DEFAULT_CARD_DESIGN;
}

const make = (
  id: string,
  label: string,
  emoji: string,
  type: CardType,
  name: string,
  rewardText: string,
  stampCount: number,
  bg: string,
  text: string,
  accent: string
): CardTemplate => ({
  id,
  label,
  emoji,
  type,
  name,
  rewardText,
  stampCount,
  design: {
    ...DEFAULT_CARD_DESIGN,
    background_color: bg,
    text_color: text,
    accent_color: accent,
  },
});

export const CARD_TEMPLATES: CardTemplate[] = [
  make(
    "kebab",
    "Kebab",
    "🥙",
    "stamp",
    "Carte fidelite kebab",
    "Un kebab offert !",
    10,
    "#fffbeb",
    "#1c1917",
    "#dc2626"
  ),
  make(
    "boulangerie",
    "Boulangerie",
    "🥖",
    "stamp",
    "Le pain quotidien",
    "Une baguette offerte !",
    10,
    "#fef3c7",
    "#1c1917",
    "#a16207"
  ),
  make(
    "pizzeria",
    "Pizzeria",
    "🍕",
    "stamp",
    "Pizza fidelite",
    "Une pizza margherita offerte !",
    8,
    "#fff1f2",
    "#1c1917",
    "#e11d48"
  ),
  make(
    "cafe",
    "Cafe & salon de the",
    "☕",
    "stamp",
    "Carte cafe",
    "Un cafe offert !",
    9,
    "#f5f5f4",
    "#292524",
    "#92400e"
  ),
  make(
    "restaurant",
    "Restaurant",
    "🍽️",
    "stamp",
    "Carte fidelite",
    "10% sur l'addition !",
    8,
    "#f0fdf4",
    "#14532d",
    "#16a34a"
  ),
  make(
    "coiffeur",
    "Salon de coiffure",
    "💇",
    "stamp",
    "Salon fidelite",
    "Une coupe offerte !",
    6,
    "#f5f3ff",
    "#1e1b4b",
    "#7c3aed"
  ),
  make(
    "institut",
    "Institut de beaute",
    "💅",
    "stamp",
    "Carte beaute",
    "Un soin du visage offert !",
    8,
    "#fdf2f8",
    "#831843",
    "#db2777"
  ),
  make(
    "pressing",
    "Pressing",
    "👔",
    "stamp",
    "Pressing fidelite",
    "Un nettoyage offert !",
    10,
    "#eff6ff",
    "#1e3a8a",
    "#2563eb"
  ),
  make(
    "fleuriste",
    "Fleuriste",
    "💐",
    "stamp",
    "Bouquet fidelite",
    "Un bouquet de saison offert !",
    7,
    "#fef2f2",
    "#7f1d1d",
    "#f43f5e"
  ),
  make(
    "barbershop",
    "Barbier",
    "✂️",
    "stamp",
    "Barbershop loyalty",
    "Une coupe + barbe offerte !",
    7,
    "#1c1917",
    "#fafaf9",
    "#fbbf24"
  ),
  make(
    "epicerie",
    "Epicerie / Primeur",
    "🥗",
    "cashback",
    "Carte cashback",
    "5% cashback sur chaque achat",
    10,
    "#f7fee7",
    "#14532d",
    "#65a30d"
  ),
  make(
    "vip",
    "VIP / Membre Premium",
    "👑",
    "membership",
    "Adhesion Premium",
    "Acces aux ventes privees + 15%",
    1,
    "#1e1b4b",
    "#fef3c7",
    "#fbbf24"
  ),
  make(
    "remise",
    "Remise permanente",
    "🎟️",
    "discount",
    "Carte VIP",
    "10% sur tous vos achats",
    1,
    "#fef9c3",
    "#1c1917",
    "#ea580c"
  ),
  make(
    "scratch",
    "Repartir de zero",
    "✨",
    "stamp",
    "",
    "",
    8,
    "#ffffff",
    "#1a1a1a",
    "#10b981"
  ),
];
