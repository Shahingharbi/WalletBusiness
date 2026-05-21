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
  /**
   * Sous-titre affiché dans la grille du wizard pour décrire ce que
   * le template propose concrètement (offre, type de fidélisation).
   */
  description?: string;
}

// Photos Unsplash food/beauté halal-friendly (sans visages, sans personnes).
// Format: photo-{id} qu'on suffix avec les params Unsplash de fit/crop.
const UNSPLASH = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1600&q=80`;

/**
 * Templates curatés — 2 modèles "vraies marques fictives" + 1 brouillon.
 *
 * Chaque template a :
 *  - Une palette 3 couleurs cohérente (fond / texte / accent)
 *  - Un banner photo qui pose l'ambiance
 *  - Un logo SVG dédié dans `public/template-assets/` (vrai design, pas
 *    placeholder générique)
 *  - Un nb de tampons + récompense pertinents pour le secteur
 *  - Une description courte pour la grille du wizard
 *
 * Les 11 anciens templates moyens (kebab, boulangerie, pizzeria, café,
 * restaurant, coiffeur, pressing, fleuriste, barbier, épicerie, VIP,
 * remise) ont été retirés — préférable de proposer 2 templates **bien
 * faits** que 12 templates **moyens** qu'aucun merchant ne reprend tel
 * quel.
 */
export const CARD_TEMPLATES: CardTemplate[] = [
  {
    id: "chicken-street",
    label: "Chicken Street",
    emoji: "🍗",
    type: "stamp",
    name: "Chicken Street",
    rewardText: "10 menus achetés = 1 menu offert",
    stampCount: 10,
    description: "Fast-food premium — palette sombre + or doré, photo plat appétissant.",
    design: {
      ...DEFAULT_CARD_DESIGN,
      // Palette : noir profond + cream + or doré (DA fast-food premium type
      // Chick-fil-A / Five Guys / Burger King premium ranges).
      background_color: "#1a0d0d", // noir/marron carbonisé
      text_color: "#fff8e1",       // cream chaud
      accent_color: "#d4a017",     // or doré (tampons, highlights)
      stamp_icon: "check",
      stamp_shape: "squircle",
      label_stamps: "Menus",
      label_rewards: "Menus offerts",
      logo_url: "/template-assets/chicken-street-logo.svg",
      // Photo poulet/wings appétissante (halal-friendly, no people)
      banner_url: UNSPLASH("1626082896492-766af4eb6501"),
      // Welcome offer pour acquérir le client à l'install
      welcome_reward: "Une boisson offerte pour votre premier passage",
    },
  },
  {
    id: "institut-beaute",
    label: "Institut de beauté",
    emoji: "🌸",
    type: "stamp",
    name: "Institut Beauté",
    rewardText: "Après 8 soins, un soin du visage offert",
    stampCount: 8,
    description: "Spa & soins — palette nude rose poudré, photo univers soin.",
    design: {
      ...DEFAULT_CARD_DESIGN,
      // Palette : nude rosé + brun chocolat + or rose (DA spa/Sephora-like).
      background_color: "#f5e6e0", // nude rosé doux
      text_color: "#5c3a28",       // brun chaud sombre
      accent_color: "#c48b6f",     // or rose / nude foncé
      stamp_icon: "flower",
      stamp_shape: "circle",
      label_stamps: "Soins",
      label_rewards: "Soins offerts",
      logo_url: "/template-assets/institut-beaute-logo.svg",
      // Photo univers soin : fleurs / pierres / cosmétiques (no people)
      banner_url: UNSPLASH("1571781926291-c477ebfd024b"),
      welcome_reward: "Diagnostic peau offert à votre premier rendez-vous",
    },
  },
  {
    id: "scratch",
    label: "Repartir de zéro",
    emoji: "✨",
    type: "stamp",
    name: "",
    rewardText: "",
    stampCount: 8,
    description: "Modèle vide — vous configurez tout depuis zéro.",
    design: { ...DEFAULT_CARD_DESIGN },
  },
];
