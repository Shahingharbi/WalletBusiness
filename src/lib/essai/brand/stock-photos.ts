/**
 * Photos de repli de la bande (quand le commerce n'a fourni aucune photo et
 * qu'aucune n'a été trouvée sur son site / sa fiche Google).
 *
 * Règle du projet (images par défaut « halal-friendly ») : AUCUNE personne,
 * aucun visage, aucune main ; pas d'alcool mis en avant ; pas de marque
 * visible. Plats, produits, vitrines et intérieurs vides uniquement. Chaque
 * photo ci-dessous a été vérifiée à l'œil dans son cadrage FINAL (3:2 centré,
 * paramètres de `stockPhotoUrl`) — en ajouter une impose la même vérification.
 *
 * Source : Unsplash (licence Unsplash, usage commercial autorisé), servie par
 * le CDN images.unsplash.com déjà recadrée et compressée.
 */

import type { EssaiCategory } from "../types";

const FOOD_KEBAB = ["photo-1529006557810-274b9b2fc783", "photo-1561651823-34feb02250e4"];
const FOOD_BURGER = ["photo-1568901346375-23c9450c58cd", "photo-1571091718767-18b5b1457add"];
const FOOD_TACOS = ["photo-1599974579688-8dbdd335c77f", "photo-1624300629298-e9de39c13be5"];
const FOOD_CHICKEN = [
  "photo-1626645738196-c2a7c87a8f58",
  "photo-1562967914-608f82629710",
  "photo-1567620832903-9fc6debc209f",
];
const FOOD_PIZZA = [
  "photo-1574071318508-1cdbab80d002",
  "photo-1513104890138-7c749659a591",
  "photo-1565299624946-b28f40a0ae38",
];
const FOOD_SUSHI = ["photo-1553621042-f6e147245754", "photo-1579871494447-9811cf80d66c"];
const RESTAURANT = ["photo-1517248135467-4c7edcad34c4", "photo-1504674900247-0877df9cc836"];
const BAKERY = [
  "photo-1509440159596-0249088772ff",
  "photo-1555507036-ab1f4038808a",
  "photo-1608198093002-ad4e005484ec",
];
const PASTRY = [
  "photo-1558326567-98ae2405596b",
  "photo-1578985545062-69928b1d9587",
  "photo-1488477181946-6428a0291777",
];
const COFFEE = ["photo-1509042239860-f550ce710b93", "photo-1501339847302-ac426a4a7cbb"];
/** Boissons fraîches (citronnade, thé glacé) : aucun alcool visible. */
const DRINKS = ["photo-1513558161293-cdaf765ed2fd", "photo-1556679343-c7306c1976bc"];
const ICE_CREAM = ["photo-1563805042-7684c019e1cb", "photo-1501443762994-82bd5dace89a"];
const SALON = ["photo-1633681926022-84c23e8cb2d6", "photo-1600948836101-f9ffda59d250"];
const BARBERSHOP = ["photo-1585747860715-2ba37e788b70", "photo-1633681926022-84c23e8cb2d6"];
const BEAUTY = [
  "photo-1540555700478-4be289fbecef",
  "photo-1600428877878-1a0fd85beda8",
  "photo-1596462502278-27bfdc403348",
];
const NAILS = ["photo-1596462502278-27bfdc403348", "photo-1540555700478-4be289fbecef"];
const FLOWERS = ["photo-1487530811176-3780de880c2d", "photo-1561181286-d3fee7d55364"];
const GROCERY = [
  "photo-1542838132-92c53300491e",
  "photo-1488459716781-31db52582fe9",
  "photo-1534723452862-4c874018d66d",
];
const BUTCHER = ["photo-1603048297172-c92544798d5a", "photo-1551028150-64b9f398f678"];
const LAUNDRY = ["photo-1545173168-9f1947eebb7f", "photo-1489274495757-95c7c837b101"];
const SHOP = [
  "photo-1528698827591-e19ccd7bc23d",
  "photo-1472851294608-062f824d29cc",
  "photo-1441986300917-64674bd600d8",
];

/** 1 à 3 photos par métier (identifiants images.unsplash.com). */
export const STOCK_PHOTOS: Record<EssaiCategory, readonly string[]> = {
  kebab: FOOD_KEBAB,
  burger: FOOD_BURGER,
  tacos: FOOD_TACOS,
  chicken: FOOD_CHICKEN,
  pizza: FOOD_PIZZA,
  sushi: FOOD_SUSHI,
  restaurant: RESTAURANT,
  boulangerie: BAKERY,
  patisserie: PASTRY,
  cafe: COFFEE,
  bar: DRINKS,
  glacier: ICE_CREAM,
  coiffeur: SALON,
  barbier: BARBERSHOP,
  beaute: BEAUTY,
  onglerie: NAILS,
  fleuriste: FLOWERS,
  epicerie: GROCERY,
  boucherie: BUTCHER,
  pressing: LAUNDRY,
  autre: SHOP,
};

/** Dimensions servies par le CDN (paysage 3:2, comme `BrandPhoto`). */
export const STOCK_WIDTH = 1600;
export const STOCK_HEIGHT = 1067;

/** URL CDN d'une photo, recadrée 3:2 au centre, JPEG. */
export function stockPhotoUrl(id: string): string {
  return `https://images.unsplash.com/${id}?w=${STOCK_WIDTH}&h=${STOCK_HEIGHT}&fit=crop&q=80&fm=jpg`;
}

/** Hachage stable (FNV-1a) : un même commerce retombe sur la même photo. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * URLs à essayer pour un métier, la photo « attribuée » au commerce
 * (`seed` = son nom) d'abord, puis les autres du même métier.
 */
export function stockPhotoUrls(category: EssaiCategory, seed: string): string[] {
  const list = STOCK_PHOTOS[category]?.length ? STOCK_PHOTOS[category] : STOCK_PHOTOS.autre;
  const start = hash((seed ?? "").toLowerCase().trim()) % list.length;
  return list.map((_, i) => stockPhotoUrl(list[(start + i) % list.length]));
}
