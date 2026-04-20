import { DEFAULT_CARD_DESIGN, type CardType } from "@/lib/constants";
import type { StampIconKey } from "@/lib/stamp-icons";

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

// Curated Unsplash photos — object/food/product shots, no people.
// All verified 200 OK. Users can override per card.
const UNSPLASH = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=75`;

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
  accent: string,
  stampIcon: StampIconKey = "check",
  stampShape: typeof DEFAULT_CARD_DESIGN["stamp_shape"] = "circle",
  imageUnsplashId: string | null = null
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
    stamp_icon: stampIcon,
    stamp_shape: stampShape,
    banner_url: imageUnsplashId ? UNSPLASH(imageUnsplashId) : null,
  },
});

export const CARD_TEMPLATES: CardTemplate[] = [
  make("kebab", "Kebab", "🥙", "stamp", "Carte fidelite kebab", "Un kebab offert !", 10,
    "#fffbeb", "#1c1917", "#dc2626", "kebab", "circle",
    "1529006557810-274b9b2fc783"),
  make("boulangerie", "Boulangerie", "🥖", "stamp", "Le pain quotidien", "Une baguette offerte !", 10,
    "#fef3c7", "#1c1917", "#a16207", "baguette", "squircle",
    "1509440159596-0249088772ff"),
  make("pizzeria", "Pizzeria", "🍕", "stamp", "Pizza fidelite", "Une pizza margherita offerte !", 8,
    "#fff1f2", "#1c1917", "#e11d48", "pizza", "circle",
    "1513104890138-7c749659a591"),
  make("cafe", "Cafe & salon de the", "☕", "stamp", "Carte cafe", "Un cafe offert !", 9,
    "#f5f5f4", "#292524", "#92400e", "coffee", "circle",
    "1495474472287-4d71bcdd2085"),
  make("restaurant", "Restaurant", "🍽️", "stamp", "Carte fidelite", "10% sur l'addition !", 8,
    "#f0fdf4", "#14532d", "#16a34a", "star", "circle",
    "1414235077428-338989a2e8c0"),
  make("coiffeur", "Salon de coiffure", "💇", "stamp", "Salon fidelite", "Une coupe offerte !", 6,
    "#f5f3ff", "#1e1b4b", "#7c3aed", "scissors", "squircle", null),
  make("institut", "Institut de beaute", "💅", "stamp", "Carte beaute", "Un soin du visage offert !", 8,
    "#fdf2f8", "#831843", "#db2777", "flower", "circle",
    "1490750967868-88aa4486c946"),
  make("pressing", "Pressing", "👔", "stamp", "Pressing fidelite", "Un nettoyage offert !", 10,
    "#eff6ff", "#1e3a8a", "#2563eb", "sparkle", "squircle",
    "1489987707025-afc232f7ea0f"),
  make("fleuriste", "Fleuriste", "💐", "stamp", "Bouquet fidelite", "Un bouquet de saison offert !", 7,
    "#fef2f2", "#7f1d1d", "#f43f5e", "flower", "circle",
    "1563241527-3004b7be0ffd"),
  make("barbershop", "Barbier", "✂️", "stamp", "Barbershop loyalty", "Une coupe + barbe offerte !", 7,
    "#1c1917", "#fafaf9", "#fbbf24", "scissors", "squircle", null),
  make("epicerie", "Epicerie / Primeur", "🥗", "cashback", "Carte cashback", "5% cashback sur chaque achat", 10,
    "#f7fee7", "#14532d", "#65a30d", "leaf", "circle",
    "1542838132-92c53300491e"),
  make("vip", "VIP / Membre Premium", "👑", "membership", "Adhesion Premium", "Acces aux ventes privees + 15%", 1,
    "#1e1b4b", "#fef3c7", "#fbbf24", "crown", "hex",
    "1606293459339-aa5d34a7b0e1"),
  make("remise", "Remise permanente", "🎟️", "discount", "Carte VIP", "10% sur tous vos achats", 1,
    "#fef9c3", "#1c1917", "#ea580c", "diamond", "circle",
    "1505740420928-5e560c06d30e"),
  make("scratch", "Repartir de zero", "✨", "stamp", "", "", 8,
    "#ffffff", "#1a1a1a", "#10b981", "check", "circle", null),
];
