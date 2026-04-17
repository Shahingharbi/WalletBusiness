export const CARD_TYPES = {
  stamp: { label: "Tampon", icon: "Stamp", available: true },
  cashback: { label: "Cashback", icon: "CircleDollarSign", available: true },
  discount: { label: "Remise", icon: "Percent", available: true },
  membership: { label: "Adhesion", icon: "Users", available: true },
  reward: { label: "Recompense", icon: "Gift", available: false },
  coupon: { label: "Coupon", icon: "Tag", available: false },
  gift: { label: "Carte cadeau", icon: "CreditCard", available: false },
  multipass: { label: "Multipass", icon: "Layers", available: false },
} as const;

export type CardType = keyof typeof CARD_TYPES;

export const ROLES = {
  super_admin: "Super Admin",
  business_owner: "Commercant",
  employee: "Employe",
} as const;

export type UserRole = keyof typeof ROLES;

export const CARD_STATUSES = {
  draft: { label: "Brouillon", color: "bg-gray-100 text-gray-700" },
  active: { label: "Active", color: "bg-emerald-100 text-emerald-700" },
  paused: { label: "En pause", color: "bg-amber-100 text-amber-700" },
  archived: { label: "Archivee", color: "bg-red-100 text-red-700" },
} as const;

export const BARCODE_TYPES = {
  qr: "QR Code",
  pdf417: "PDF 417",
} as const;

export const EXPIRATION_TYPES = {
  unlimited: "Illimitee",
  fixed_date: "Date fixe",
  days_after_install: "Jours apres installation",
} as const;

export const MAX_STAMPS = 30;
export const MIN_STAMPS = 1;
export const DEFAULT_STAMPS = 8;

export const DEFAULT_CARD_DESIGN = {
  logo_url: null as string | null,
  icon_url: null as string | null,
  banner_url: null as string | null,
  background_color: "#ffffff",
  text_color: "#1a1a1a",
  accent_color: "#e53e3e",
  stamp_active_icon: "check",
  stamp_inactive_icon: "circle",
  stamp_active_url: null as string | null,
  stamp_inactive_url: null as string | null,
  label_stamps: "Tampons avant recompense",
  label_rewards: "Recompenses disponibles",
};

export const BUSINESS_CATEGORIES = [
  "Restaurant",
  "Fast-food",
  "Boulangerie",
  "Patisserie",
  "Cafe / Salon de the",
  "Bar",
  "Coiffeur",
  "Barbier",
  "Institut de beaute",
  "Spa / Bien-etre",
  "Pressing / Laverie",
  "Fleuriste",
  "Epicerie",
  "Primeur",
  "Fromagerie",
  "Boucherie / Charcuterie",
  "Caviste",
  "Pizzeria",
  "Kebab",
  "Sushi",
  "Glacier",
  "Fitness / Salle de sport",
  "Yoga / Pilates",
  "Auto-ecole",
  "Garage / Mecanicien",
  "Veterinaire",
  "Pharmacie",
  "Opticien",
  "Librairie",
  "Autre",
] as const;
