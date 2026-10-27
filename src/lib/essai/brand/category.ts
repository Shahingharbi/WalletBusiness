/**
 * Métier du commerce : détection (mots-clés FR/EN + types schema.org / Google
 * Places) et préréglages de carte (icône, forme, nombre de tampons,
 * récompense, libellé) pour chaque métier de `ESSAI_CATEGORIES`.
 *
 * Aucune dépendance Node : importable partout (server et client).
 *
 * Pourquoi un scoring pondéré plutôt qu'un simple « premier mot trouvé » :
 * une pizzeria parle aussi de « desserts », un coiffeur offre « un café »,
 * un kebab vend des « tacos poulet ». On additionne des indices pondérés
 * (le nom pèse beaucoup plus que le texte de la page), on « consomme » les
 * expressions avant les mots isolés (« bar à ongles » ne doit pas compter
 * comme un bar, « salon de thé » pas comme un salon de coiffure), puis on
 * garde le meilleur score au-dessus d'un seuil — sinon « autre ».
 */

import { ESSAI_CATEGORIES, type CategoryPreset, type EssaiCategory } from "@/lib/essai/types";

// ─── Normalisation de texte (partagée avec website / instagram / maps) ────

/**
 * Minuscules, sans accents, ligatures dépliées, ponctuation → espaces.
 * « Boulangerie-Pâtisserie L'Œuf » → « boulangerie patisserie l oeuf ».
 */
export function normalizeForMatch(input: string): string {
  return (input ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// ─── Préréglages par métier ───────────────────────────────────────────────

const NBSP = "\u00a0";

/**
 * Récompenses volontairement modestes et crédibles (≤ 60 car.) : un
 * commerçant doit pouvoir se dire « oui, je ferais ça » en voyant la démo.
 * Libellés de tampons ≤ 14 car. (slots étroits Apple / Google Wallet).
 */
export const CATEGORY_PRESETS: Record<EssaiCategory, CategoryPreset> = {
  kebab: {
    label: "Kebab",
    stampIcon: "kebab",
    stampShape: "squircle",
    stampCount: 10,
    rewardText: "10 menus achetés = 1 menu offert",
    labelStamps: "Menus",
  },
  burger: {
    label: "Burger",
    stampIcon: "star",
    stampShape: "squircle",
    stampCount: 10,
    rewardText: "10 burgers achetés = 1 burger offert",
    labelStamps: "Burgers",
  },
  tacos: {
    label: "Tacos",
    stampIcon: "star",
    stampShape: "squircle",
    stampCount: 10,
    rewardText: "10 tacos achetés = 1 tacos offert",
    labelStamps: "Tacos",
  },
  chicken: {
    label: "Poulet",
    stampIcon: "crown",
    stampShape: "squircle",
    stampCount: 10,
    rewardText: "10 menus achetés = 1 menu offert",
    labelStamps: "Menus",
  },
  pizza: {
    label: "Pizzeria",
    stampIcon: "pizza",
    stampShape: "circle",
    stampCount: 10,
    rewardText: "La 10e pizza offerte",
    labelStamps: "Pizzas",
  },
  sushi: {
    label: "Sushi",
    stampIcon: "star",
    stampShape: "circle",
    stampCount: 8,
    rewardText: "8 commandes = 1 menu offert",
    labelStamps: "Commandes",
  },
  restaurant: {
    label: "Restaurant",
    stampIcon: "star",
    stampShape: "circle",
    stampCount: 10,
    rewardText: "10 repas = 1 plat offert",
    labelStamps: "Repas",
  },
  boulangerie: {
    label: "Boulangerie",
    stampIcon: "baguette",
    stampShape: "circle",
    stampCount: 10,
    rewardText: "10 passages = 1 viennoiserie offerte",
    labelStamps: "Passages",
  },
  patisserie: {
    label: "Pâtisserie",
    stampIcon: "heart",
    stampShape: "circle",
    stampCount: 8,
    rewardText: "8 achats = 1 pâtisserie offerte",
    labelStamps: "Achats",
  },
  cafe: {
    label: "Café",
    stampIcon: "coffee",
    stampShape: "circle",
    stampCount: 9,
    rewardText: "9 cafés achetés = le 10e offert",
    labelStamps: "Cafés",
  },
  bar: {
    label: "Bar",
    stampIcon: "star",
    stampShape: "hex",
    stampCount: 8,
    rewardText: "8 verres achetés = le 9e offert",
    labelStamps: "Verres",
  },
  glacier: {
    label: "Glacier",
    stampIcon: "heart",
    stampShape: "circle",
    stampCount: 8,
    rewardText: "8 glaces achetées = 1 glace offerte",
    labelStamps: "Glaces",
  },
  coiffeur: {
    label: "Coiffeur",
    stampIcon: "scissors",
    stampShape: "circle",
    stampCount: 8,
    rewardText: "8 coupes = la 9e offerte",
    labelStamps: "Coupes",
  },
  barbier: {
    label: "Barbier",
    stampIcon: "crown",
    stampShape: "shield",
    stampCount: 8,
    rewardText: "8 coupes = la 9e offerte",
    labelStamps: "Coupes",
  },
  beaute: {
    label: "Institut de beauté",
    stampIcon: "sparkle",
    stampShape: "circle",
    stampCount: 6,
    rewardText: `−20${NBSP}% sur votre 6e soin`,
    labelStamps: "Soins",
  },
  onglerie: {
    label: "Onglerie",
    stampIcon: "diamond",
    stampShape: "circle",
    stampCount: 6,
    rewardText: `−20${NBSP}% sur votre 6e pose`,
    labelStamps: "Poses",
  },
  fleuriste: {
    label: "Fleuriste",
    stampIcon: "flower",
    stampShape: "circle",
    stampCount: 8,
    rewardText: "8 achats = 1 bouquet offert",
    labelStamps: "Achats",
  },
  epicerie: {
    label: "Épicerie",
    stampIcon: "leaf",
    stampShape: "squircle",
    stampCount: 10,
    rewardText: `10 passages = 5${NBSP}€ offerts`,
    labelStamps: "Passages",
  },
  boucherie: {
    label: "Boucherie",
    stampIcon: "star",
    stampShape: "shield",
    stampCount: 10,
    rewardText: `10 achats = 5${NBSP}€ offerts`,
    labelStamps: "Achats",
  },
  pressing: {
    label: "Pressing",
    stampIcon: "sparkle",
    stampShape: "hex",
    stampCount: 10,
    rewardText: "10 articles = 1 article nettoyé offert",
    labelStamps: "Articles",
  },
  autre: {
    label: "Commerce",
    stampIcon: "star",
    stampShape: "circle",
    stampCount: 10,
    rewardText: "10 passages = 1 cadeau offert",
    labelStamps: "Passages",
  },
};

// ─── Message promo de démo ────────────────────────────────────────────────

const PROMO_MAX = 120;

/**
 * Une phrase vendeuse par métier. `{n}` = nom du commerce. Espaces
 * insécables avant « : » et « ! » (typographie française).
 */
const PROMO_TEMPLATES: Record<EssaiCategory, string> = {
  kebab: `🔥 {n}${NBSP}: −20${NBSP}% sur votre menu ce soir de 18${NBSP}h à 20${NBSP}h${NBSP}!`,
  burger: `🍔 {n}${NBSP}: votre 2e burger à −50${NBSP}% aujourd'hui seulement${NBSP}!`,
  tacos: `🌮 {n}${NBSP}: la boisson offerte avec votre tacos ce soir${NBSP}!`,
  chicken: `🍗 {n}${NBSP}: 3 tenders offerts avec votre menu ce soir${NBSP}!`,
  pizza: `🍕 {n}${NBSP}: la 2e pizza à −50${NBSP}% ce soir, sur place ou à emporter${NBSP}!`,
  sushi: `🍣 {n}${NBSP}: −15${NBSP}% sur votre commande ce midi${NBSP}!`,
  restaurant: `🍽️ {n}${NBSP}: le dessert vous est offert ce midi${NBSP}!`,
  boulangerie: `🥐 {n}${NBSP}: 1 croissant offert pour 1 baguette achetée ce matin${NBSP}!`,
  patisserie: `🍰 {n}${NBSP}: −20${NBSP}% sur les entremets ce week-end${NBSP}!`,
  cafe: `☕ {n}${NBSP}: votre cappuccino à −50${NBSP}% jusqu'à 11${NBSP}h${NBSP}!`,
  bar: `🍹 {n}${NBSP}: happy hour prolongée jusqu'à 21${NBSP}h ce soir${NBSP}!`,
  glacier: `🍦 {n}${NBSP}: 1 boule offerte pour 2 achetées cet après-midi${NBSP}!`,
  coiffeur: `✂️ {n}${NBSP}: −20${NBSP}% sur les colorations cette semaine${NBSP}!`,
  barbier: `💈 {n}${NBSP}: la taille de barbe offerte avec votre coupe cette semaine${NBSP}!`,
  beaute: `✨ {n}${NBSP}: −20${NBSP}% sur votre soin du visage cette semaine${NBSP}!`,
  onglerie: `💅 {n}${NBSP}: −15${NBSP}% sur votre pose semi-permanent cette semaine${NBSP}!`,
  fleuriste: `💐 {n}${NBSP}: −15${NBSP}% sur tous les bouquets ce week-end${NBSP}!`,
  epicerie: `🛒 {n}${NBSP}: −10${NBSP}% sur vos courses aujourd'hui${NBSP}!`,
  boucherie: `🥩 {n}${NBSP}: −10${NBSP}% sur les colis de viande ce week-end${NBSP}!`,
  pressing: `👔 {n}${NBSP}: −20${NBSP}% sur le nettoyage de vos chemises cette semaine${NBSP}!`,
  autre: `🎁 {n}${NBSP}: −10${NBSP}% sur votre prochain passage cette semaine${NBSP}!`,
};

/**
 * Texte de la notification « promo » envoyée pendant la démo (≤ 120 car.).
 * Le nom est raccourci (…) si besoin pour tenir dans la limite.
 */
export function promoMessageFor(category: EssaiCategory, name: string): string {
  const template = PROMO_TEMPLATES[category] ?? PROMO_TEMPLATES.autre;
  let n = (name ?? "").replace(/\s+/g, " ").trim() || "Votre commerce";
  const room = PROMO_MAX - template.replace("{n}", "").length;
  if (n.length > room) n = `${n.slice(0, Math.max(1, room - 1)).trimEnd()}…`;
  return template.replace("{n}", n);
}

// ─── Détection du métier ──────────────────────────────────────────────────

type Scored = Exclude<EssaiCategory, "autre">;
/** Poids → mots-clés (écrits naturellement, accents compris : normalisés au chargement). */
type KeywordSpec = Record<number, string[]>;

/**
 * Mots-clés par métier. Une entrée avec espace est une EXPRESSION (comparée
 * mot à mot, prioritaire sur les mots isolés qu'elle contient).
 * Poids : 3 = quasi certain, 2 = fort, 1–1,5 = indice, < 1 = faible.
 */
const KEYWORDS: Record<Scored, KeywordSpec> = {
  kebab: {
    3: ["sandwich grec", "galette kebab", "assiette kebab"],
    2: ["kebab", "kebap", "döner", "dürüm", "shawarma", "chawarma", "gyros"],
    1.5: ["grec"],
  },
  burger: {
    3: ["five guys", "big fernand", "burger king", "mcdonald", "mcdonalds", "mc donald", "smash burger"],
    2: ["burger", "hamburger", "cheeseburger", "smashburger"],
    1: ["smash"],
  },
  tacos: {
    3: ["french tacos", "o tacos", "otacos"],
    2: ["tacos", "taco", "burrito", "quesadilla", "fajitas", "tex mex", "texmex"],
    1.5: ["mexicain", "mexicaine"],
    1: ["nachos"],
  },
  chicken: {
    3: ["fried chicken", "poulet rôti", "poulet braisé", "chicken wings", "kfc", "popeyes"],
    2: ["chicken", "rôtisserie", "rôtisseur", "wings", "tenders", "crousty"],
    1.2: ["poulet", "nuggets"],
  },
  pizza: {
    3: ["domino s", "dominos", "pizza hut"],
    2: ["pizza", "pizzeria", "pizzaiolo", "pizzaiola", "calzone"],
    1: ["napolitaine", "margherita", "feu de bois", "four à bois"],
  },
  sushi: {
    2.5: ["poke bowl", "sushi shop", "planet sushi"],
    2: ["sushi", "maki", "sashimi", "chirashi", "temaki", "uramaki"],
    1.5: ["japonais", "japonaise", "japanese", "poke", "poké", "ramen", "yakitori"],
    1: ["california", "gyoza", "bento"],
  },
  restaurant: {
    1.5: ["crêperie", "steakhouse", "sandwicherie", "plat du jour", "bar à salade", "bar à salades"],
    1.2: ["menu du jour", "traiteur", "trattoria", "osteria"],
    1: ["couscous", "tajine", "libanais", "gastronomique", "gastronomie"],
    0.8: [
      "restaurant", "resto", "brasserie", "bistrot", "bistro", "cantine", "snack",
      "fast food", "street food", "grill", "indien", "thaï", "vietnamien",
    ],
    0.6: ["sandwich", "chinois", "italien", "italienne"],
    0.4: ["cuisine", "déjeuner", "dîner"],
  },
  boulangerie: {
    3: ["artisan boulanger", "boulangerie pâtisserie", "boulanger pâtissier"],
    2.5: ["boulangerie", "boulanger", "boulangère", "boulange", "fournil"],
    2: ["baguette", "viennoiserie", "bakery"],
    1.5: ["pain au chocolat", "pains au chocolat"],
    1.2: ["croissant", "levain"],
    1: ["pain", "bread", "brioche", "pain de mie"],
  },
  patisserie: {
    3: ["jeff de bruges", "pierre hermé", "ladurée", "lenôtre"],
    2.5: ["pâtisserie", "pâtissier", "pâtissière", "pastry", "pastries", "chocolatier", "chocolaterie"],
    1.5: ["gâteau", "entremets", "macaron", "confiserie", "cupcake", "donuts"],
    0.8: ["cake", "éclair", "cheesecake"],
    0.6: ["chocolat", "cookies"],
    0.5: ["dessert"],
    0.4: ["tarte"],
  },
  cafe: {
    3: ["starbucks", "dunkin"],
    2.5: ["salon de thé", "coffee shop", "coffeeshop"],
    2: ["coffee", "torréfacteur", "torréfaction", "bubble tea", "tea room"],
    1.5: ["café", "espresso", "expresso", "cappuccino", "barista", "brunch", "bar à café", "bar à jus"],
    1: ["latte", "matcha", "petit déjeuner"],
    0.8: ["bagel", "pancakes"],
    0.6: ["tea"],
  },
  bar: {
    2.5: ["bar à vin", "bar à vins", "bar à cocktails", "bar à bières", "wine bar", "bar tabac", "bar à chicha"],
    2: ["pub", "chicha", "shisha", "narguilé", "hookah", "bar lounge"],
    1.5: ["cocktail", "happy hour", "discothèque", "brewery"],
    1.2: ["bar"],
    1: ["lounge", "bière", "beer", "tapas", "whisky", "mojito", "tabac"],
  },
  glacier: {
    3: ["amorino", "häagen dazs", "ben jerry"],
    2.5: ["ice cream", "crème glacée", "frozen yogurt", "gelateria"],
    2: ["glacier", "gelato", "gelati", "coupe glacée", "glace artisanale", "glaces artisanales", "glace à l italienne"],
    1.2: ["glace", "sorbet"],
    0.6: ["milkshake"],
  },
  coiffeur: {
    3: [
      "salon de coiffure", "hair salon", "franck provost", "jean louis david", "dessange",
      "saint algue", "tchip", "camille albane",
    ],
    2.5: ["coiffeur", "coiffeuse", "coiffure", "hairdresser"],
    1.5: ["brushing", "balayage", "visagiste", "coupe femme", "coupe enfant"],
    1.2: ["coloration", "mèches", "lissage"],
    1: ["hair", "kératine", "permanente", "chignon", "shampoing", "shampooing", "coupe homme"],
    0.4: ["coupe"],
    0.3: ["salon"],
  },
  barbier: {
    3: ["barbier", "barber", "barbershop", "barber shop"],
    2: ["taille de barbe", "rasage à l ancienne", "bar à barbe"],
    1.5: ["barbe", "rasage"],
    1.2: ["dégradé"],
    1: ["fade", "moustache"],
  },
  beaute: {
    3: [
      "institut de beauté", "salon de beauté", "beauty salon", "yves rocher", "nocibé",
      "sephora", "marionnaud", "body minute",
    ],
    2.5: ["esthéticienne"],
    2: [
      "beauté", "beauty", "esthétique", "soin du visage", "soins du visage", "extension de cils",
      "extensions de cils", "microblading", "brow bar", "bar à sourcils",
    ],
    1.5: [
      "institut", "spa", "épilation", "lash", "skincare", "rehaussement", "dermopigmentation",
      "parfumerie",
    ],
    1.2: ["massage", "hammam", "cils", "sourcils", "maquillage", "makeup", "brow"],
    1: ["cosmétique", "wellness", "bien être", "minceur", "bronzage"],
    0.8: ["soin"],
  },
  onglerie: {
    3: ["onglerie", "bar à ongles", "nail bar", "prothésiste ongulaire"],
    2.5: ["nails"],
    2: ["ongle", "nail", "nail art", "manucure", "manicure", "french manucure"],
    1.5: ["pédicure", "semi permanent", "prothésiste"],
    1: ["vernis", "capsules"],
  },
  fleuriste: {
    3: ["fleuriste", "florist", "interflora"],
    2.5: ["art floral", "composition florale", "compositions florales"],
    2: ["flowers"],
    1.5: ["fleur", "flower", "floral", "florale", "bouquet"],
    1: ["orchidée"],
    0.8: ["deuil"],
    0.6: ["plante"],
  },
  epicerie: {
    3: [
      "supérette", "alimentation générale", "épicerie fine", "franprix", "monoprix", "monop",
      "proxi", "spar", "vival", "g20", "casino shop", "8 à huit", "intermarché", "lidl",
      "biocoop", "naturalia", "la vie claire", "auchan", "leclerc", "picard", "carrefour city",
      "carrefour express",
    ],
    2.5: ["épicerie", "épicier", "primeur", "grocery", "minimarket", "mini market"],
    2: ["supermarché", "supermarket", "caviste", "fromagerie", "fromager", "fruits et légumes", "carrefour", "coccinelle"],
    1.5: ["cave à vin", "cave à vins", "produits du monde"],
    1.2: ["alimentation"],
    1: ["vrac", "épices"],
    0.8: ["market"],
  },
  boucherie: {
    3: ["boucherie", "boucherie halal", "boucherie charcuterie"],
    2.5: ["boucher", "bouchère", "butcher"],
    2: ["charcutier", "volailler", "triperie", "colis de viande"],
    1.5: ["charcuterie"],
    0.8: ["volaille"],
    0.6: ["viande"],
  },
  pressing: {
    3: ["pressing", "blanchisserie", "lavomatic", "nettoyage à sec", "dry cleaning", "dry cleaner", "laverie automatique", "5 à sec"],
    2.5: ["laverie", "laundry", "teinturerie"],
    1.5: ["repassage", "cordonnerie", "cordonnier"],
    1.2: ["retouche"],
    0.5: ["nettoyage"],
  },
};

/** Expressions neutres : consommées pour ne PAS déclencher un métier (« fleur de sel » ≠ fleuriste). */
const NEUTRAL_PHRASES = ["fleur de sel", "fleur d oranger", "eau de rose", "glace pilée"];

/**
 * Types schema.org (JSON-LD) et Google Places → métier, avec un facteur de
 * confiance (multiplié par TYPE_WEIGHT). Clés normalisées : minuscules sans
 * séparateurs (« HairSalon » / « hair_salon » → « hairsalon »).
 */
const TYPE_HINTS: Record<string, readonly [Scored, number]> = {
  kebabshop: ["kebab", 1],
  turkishrestaurant: ["kebab", 0.6],
  middleeasternrestaurant: ["kebab", 0.4],
  hamburgerrestaurant: ["burger", 1],
  burgerrestaurant: ["burger", 1],
  mexicanrestaurant: ["tacos", 0.6],
  tacorestaurant: ["tacos", 1],
  texmexrestaurant: ["tacos", 0.8],
  chickenrestaurant: ["chicken", 1],
  chickenwingsrestaurant: ["chicken", 1],
  friedchickenrestaurant: ["chicken", 1],
  pizzarestaurant: ["pizza", 1],
  pizzeria: ["pizza", 1],
  pizzadeliveryservice: ["pizza", 1],
  sushirestaurant: ["sushi", 1],
  japaneserestaurant: ["sushi", 0.8],
  ramenrestaurant: ["sushi", 0.7],
  pokerestaurant: ["sushi", 1],
  restaurant: ["restaurant", 0.6],
  foodestablishment: ["restaurant", 0.3],
  fastfoodrestaurant: ["restaurant", 0.5],
  mealtakeaway: ["restaurant", 0.4],
  mealdelivery: ["restaurant", 0.3],
  frenchrestaurant: ["restaurant", 0.8],
  italianrestaurant: ["restaurant", 0.7],
  indianrestaurant: ["restaurant", 0.8],
  chineserestaurant: ["restaurant", 0.8],
  thairestaurant: ["restaurant", 0.8],
  vietnameserestaurant: ["restaurant", 0.8],
  lebaneserestaurant: ["restaurant", 0.8],
  greekrestaurant: ["restaurant", 0.8],
  mediterraneanrestaurant: ["restaurant", 0.8],
  seafoodrestaurant: ["restaurant", 0.8],
  steakhouse: ["restaurant", 0.8],
  finediningrestaurant: ["restaurant", 0.8],
  sandwichshop: ["restaurant", 0.6],
  barandgrill: ["restaurant", 0.5],
  bakery: ["boulangerie", 1],
  bagelshop: ["boulangerie", 0.4],
  pastryshop: ["patisserie", 1],
  dessertshop: ["patisserie", 0.8],
  dessertrestaurant: ["patisserie", 0.6],
  chocolateshop: ["patisserie", 0.9],
  chocolatefactory: ["patisserie", 0.7],
  confectionery: ["patisserie", 0.8],
  cakeshop: ["patisserie", 1],
  donutshop: ["patisserie", 0.8],
  candystore: ["patisserie", 0.5],
  cafe: ["cafe", 1],
  cafeorcoffeeshop: ["cafe", 1],
  coffeeshop: ["cafe", 1],
  teahouse: ["cafe", 1],
  cafeteria: ["cafe", 0.5],
  juiceshop: ["cafe", 0.6],
  acaishop: ["cafe", 0.5],
  catcafe: ["cafe", 1],
  dogcafe: ["cafe", 1],
  breakfastrestaurant: ["cafe", 0.6],
  brunchrestaurant: ["cafe", 0.7],
  bar: ["bar", 1],
  barorpub: ["bar", 1],
  pub: ["bar", 1],
  winebar: ["bar", 1],
  nightclub: ["bar", 0.8],
  cocktailbar: ["bar", 1],
  loungebar: ["bar", 1],
  sportsbar: ["bar", 1],
  hookahbar: ["bar", 1],
  brewpub: ["bar", 1],
  brewery: ["bar", 0.7],
  icecreamshop: ["glacier", 1],
  frozenyogurtshop: ["glacier", 1],
  hairsalon: ["coiffeur", 1],
  haircare: ["coiffeur", 1],
  hairdresser: ["coiffeur", 1],
  barbershop: ["barbier", 1],
  barber: ["barbier", 1],
  beautysalon: ["beaute", 1],
  dayspa: ["beaute", 1],
  spa: ["beaute", 0.8],
  healthandbeautybusiness: ["beaute", 0.7],
  massage: ["beaute", 0.7],
  skincareclinic: ["beaute", 0.8],
  beautician: ["beaute", 1],
  makeupartist: ["beaute", 0.8],
  tanningsalon: ["beaute", 0.7],
  nailsalon: ["onglerie", 1],
  florist: ["fleuriste", 1],
  grocerystore: ["epicerie", 1],
  grocery: ["epicerie", 1],
  supermarket: ["epicerie", 0.8],
  conveniencestore: ["epicerie", 1],
  market: ["epicerie", 0.6],
  foodstore: ["epicerie", 0.6],
  asiangrocerystore: ["epicerie", 1],
  liquorstore: ["epicerie", 0.5],
  delicatessen: ["epicerie", 0.6],
  butchershop: ["boucherie", 1],
  butcher: ["boucherie", 1],
  drycleaningorlaundry: ["pressing", 1],
  laundry: ["pressing", 1],
  drycleaner: ["pressing", 1],
  laundromat: ["pressing", 1],
};

/** Poids d'un type schema.org / Places (signal structuré, très fiable). */
const TYPE_WEIGHT = 6;
/** Poids d'un texte selon sa position : nom, puis description, puis le reste. */
const TEXT_FACTORS = [4, 2];
const OTHER_TEXT_FACTOR = 1;
/** Occurrences comptées au maximum par mot-clé et par texte. */
const MAX_HITS_NAME = 1;
const MAX_HITS_TEXT = 3;
/** Score minimal pour affirmer un métier (sinon « autre »). */
const MIN_SCORE = 1.5;

interface Phrase {
  tokens: string[];
  key: string;
  cat: Scored | null;
  weight: number;
}

/** Index construit une seule fois au chargement du module. */
const INDEX = (() => {
  const words = new Map<string, { cat: Scored; weight: number }[]>();
  const phrasesByFirst = new Map<string, Phrase[]>();

  const addPhrase = (p: Phrase) => {
    const list = phrasesByFirst.get(p.tokens[0]) ?? [];
    list.push(p);
    // Plus longue expression d'abord : « bar à vins » avant « bar à ».
    list.sort((a, b) => b.tokens.length - a.tokens.length);
    phrasesByFirst.set(p.tokens[0], list);
  };

  for (const [cat, spec] of Object.entries(KEYWORDS) as [Scored, KeywordSpec][]) {
    for (const [w, list] of Object.entries(spec)) {
      const weight = Number(w);
      for (const raw of list) {
        const key = normalizeForMatch(raw);
        if (!key) continue;
        const tokens = key.split(" ");
        if (tokens.length > 1) {
          addPhrase({ tokens, key, cat, weight });
        } else {
          const entries = words.get(key) ?? [];
          entries.push({ cat, weight });
          words.set(key, entries);
        }
      }
    }
  }
  for (const raw of NEUTRAL_PHRASES) {
    const key = normalizeForMatch(raw);
    addPhrase({ tokens: key.split(" "), key, cat: null, weight: 0 });
  }
  return { words, phrasesByFirst };
})();

function lookupWord(token: string) {
  const direct = INDEX.words.get(token);
  if (direct) return { key: token, entries: direct };
  // Pluriels simples : « pizzas », « gâteaux », « ongles » → singulier.
  if (token.length > 3 && /[sx]$/.test(token)) {
    const singular = token.slice(0, -1);
    const entries = INDEX.words.get(singular);
    if (entries) return { key: singular, entries };
  }
  return null;
}

/** Ajoute à `scores` les points d'un texte (expressions puis mots isolés). */
function scoreText(text: string, factor: number, maxHits: number, scores: Map<Scored, number>) {
  const tokens = normalizeForMatch(text).split(" ").filter(Boolean);
  if (tokens.length === 0) return;
  const hits = new Map<string, number>();

  const add = (key: string, cat: Scored, weight: number) => {
    const id = `${cat}:${key}`;
    const n = hits.get(id) ?? 0;
    if (n >= maxHits) return;
    hits.set(id, n + 1);
    scores.set(cat, (scores.get(cat) ?? 0) + weight * factor);
  };

  for (let i = 0; i < tokens.length; i++) {
    const candidates = INDEX.phrasesByFirst.get(tokens[i]);
    let consumed = 0;
    if (candidates) {
      for (const p of candidates) {
        if (i + p.tokens.length > tokens.length) continue;
        let ok = true;
        for (let k = 1; k < p.tokens.length; k++) {
          if (tokens[i + k] !== p.tokens[k]) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        if (p.cat) add(p.key, p.cat, p.weight);
        consumed = p.tokens.length;
        break;
      }
    }
    if (consumed > 0) {
      i += consumed - 1;
      continue;
    }
    const found = lookupWord(tokens[i]);
    if (found) for (const e of found.entries) add(found.key, e.cat, e.weight);
  }
}

/**
 * Devine le métier d'un commerce.
 *
 * @param hints.texts Textes du PLUS fiable au moins fiable : le nom du
 *   commerce EN PREMIER (poids ×4), puis la description (×2), puis le reste
 *   (texte de la page, légendes…, ×1). Les valeurs vides sont ignorées.
 * @param hints.types Types schema.org (« Bakery », « HairSalon »…) et/ou
 *   Google Places (« bakery », « hair_salon »…), primaryType en premier.
 * @returns Le métier le plus probable, ou « autre » si aucun indice suffisant.
 */
export function detectCategory(hints: { texts: string[]; types?: string[] }): EssaiCategory {
  const scores = new Map<Scored, number>();

  (hints.texts ?? []).forEach((text, i) => {
    if (typeof text !== "string" || !text.trim()) return;
    const factor = TEXT_FACTORS[i] ?? OTHER_TEXT_FACTOR;
    scoreText(text, factor, i === 0 ? MAX_HITS_NAME : MAX_HITS_TEXT, scores);
  });

  const seenTypes = new Set<string>();
  for (const t of hints.types ?? []) {
    if (typeof t !== "string") continue;
    // « https://schema.org/Bakery » → « bakery » ; « hair_salon » → « hairsalon ».
    const key = t.replace(/^.*[/#]/, "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!key || seenTypes.has(key)) continue;
    seenTypes.add(key);
    const hint = TYPE_HINTS[key];
    if (hint) scores.set(hint[0], (scores.get(hint[0]) ?? 0) + TYPE_WEIGHT * hint[1]);
  }

  let best: EssaiCategory = "autre";
  let bestScore = MIN_SCORE - 1e-9;
  // Parcours dans l'ordre de ESSAI_CATEGORIES : à égalité, le premier gagne
  // (ex. « Boulangerie Pâtisserie » → boulangerie).
  for (const cat of ESSAI_CATEGORIES) {
    if (cat === "autre") continue;
    const s = scores.get(cat) ?? 0;
    if (s > bestScore) {
      best = cat;
      bestScore = s;
    }
  }
  // Une boulangerie vend presque toujours des pâtisseries (et son site en
  // parle beaucoup), l'inverse est rare : dès que les indices « pain /
  // viennoiserie » pèsent au moins 40 % des indices « pâtisserie », c'est une
  // boulangerie.
  if (best === "patisserie" && (scores.get("boulangerie") ?? 0) >= 0.4 * bestScore) {
    return "boulangerie";
  }
  return best;
}

// ─── Noms lisibles à partir d'un pseudo ou d'un domaine ───────────────────

/**
 * Mots fréquents dans les noms de commerces : servent à découper les pseudos
 * et domaines collés (« sushishop » → « sushi shop »). Volontairement limité
 * aux mots très spécifiques, pour ne pas massacrer les marques
 * (« starbucks » ne doit pas devenir « Star Bucks »).
 */
const SEGMENT_WORDS = new Set([
  "kebab", "doner", "tacos", "burger", "chicken", "poulet", "wings", "pizza", "pizzeria",
  "pizzaiolo", "sushi", "poke", "ramen", "resto", "restaurant", "bistrot", "bistro", "brasserie",
  "cantine", "traiteur", "boulangerie", "patisserie", "fournil", "bakery", "cafe", "cafeteria",
  "coffee", "barista", "salon", "coiffure", "coiffeur", "hair", "barber", "barbier", "beauty",
  "beaute", "institut", "nails", "ongles", "onglerie", "fleurs", "fleuriste", "flowers",
  "epicerie", "market", "boucherie", "pressing", "glacier", "gelato", "delices", "gourmet",
  "saveurs", "maison", "atelier", "studio", "kitchen", "lounge", "club", "shop", "house", "food",
  "street", "king", "express", "grill", "snack", "family", "factory", "corner", "creperie",
  "rotisserie", "spa", "bar", "paris", "lyon", "marseille", "lille", "toulouse", "nantes",
  "bordeaux", "strasbourg", "montpellier", "rennes",
]);

/** Particules qui peuvent préfixer un mot connu (« lekebab », « chezali »). */
const PREFIX_PARTICLES = new Set(["le", "la", "les", "the", "au", "aux", "du", "des", "de", "chez"]);

function isSegmentWord(t: string): boolean {
  return SEGMENT_WORDS.has(t) || (t.length > 3 && t.endsWith("s") && SEGMENT_WORDS.has(t.slice(0, -1)));
}

const SEGMENT_BY_LENGTH = [...SEGMENT_WORDS].sort((a, b) => b.length - a.length);

/** Découpe gloutonne d'un mot collé en mots connus (minuscules a-z). */
function segment(token: string, depth = 0): string[] {
  if (depth > 6 || token.length < 4 || isSegmentWord(token)) return [token];

  // Mot connu en tête (« pizzanapoli », « delicesdeparis ») — testé AVANT les
  // particules pour que « delices… » ne soit pas lu « de lices… ».
  for (const w of SEGMENT_BY_LENGTH) {
    if (w === token || !token.startsWith(w)) continue;
    const rest = token.slice(w.length);
    if (isSegmentWord(rest) || (w.length >= 4 && rest.length >= 4)) {
      return [w, ...segment(rest, depth + 1)];
    }
  }
  // « chez » + prénom ; « le/la/the… » seulement devant un mot connu
  // (« lekebab » → « le kebab », mais « desormais » reste entier).
  for (const p of PREFIX_PARTICLES) {
    if (!token.startsWith(p)) continue;
    const rest = token.slice(p.length);
    if (p === "chez" && rest.length >= 2) return [p, ...segment(rest, depth + 1)];
    if (rest.length >= 3) {
      const parts = segment(rest, depth + 1);
      if (isSegmentWord(parts[0])) return [p, ...parts];
    }
  }
  // Mot connu en fin (« columbuscafe »).
  for (const w of SEGMENT_BY_LENGTH) {
    if (w === token || !token.endsWith(w)) continue;
    const head = token.slice(0, -w.length);
    if (isSegmentWord(head) || (w.length >= 4 && head.length >= 3)) {
      return [...segment(head, depth + 1), w];
    }
  }
  return [token];
}

/** Accents restitués sur des mots français sans ambiguïté. */
const ACCENTED: Record<string, string> = {
  cafe: "café",
  patisserie: "pâtisserie",
  patissier: "pâtissier",
  epicerie: "épicerie",
  beaute: "beauté",
  creperie: "crêperie",
  rotisserie: "rôtisserie",
  doner: "döner",
  gateau: "gâteau",
  gateaux: "gâteaux",
  creme: "crème",
  cremerie: "crèmerie",
  delice: "délice",
  delices: "délices",
  superette: "supérette",
  esthetique: "esthétique",
  boulangere: "boulangère",
  bouchere: "bouchère",
  fournee: "fournée",
  chateau: "château",
  etoile: "étoile",
};

/** Mots en minuscules à l'intérieur d'un nom (« Boulangerie de la Gare »). */
const LOWERCASE_WORDS = new Set(["de", "du", "des", "la", "le", "les", "et", "l", "d", "au", "aux", "en", "sur", "sous", "of", "and", "by"]);

function titleCase(words: string[]): string {
  return words
    .map((w, i) => {
      const lower = w.toLowerCase();
      const word = ACCENTED[lower] ?? lower;
      if (i > 0 && LOWERCASE_WORDS.has(lower)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/**
 * Pseudo ou étiquette de domaine → nom lisible.
 * « coq.rizo_rotisserie » → « Coq Rizo Rôtisserie » ; « sushishop » → « Sushi Shop » ;
 * « LaMaisonDuPain » → « La Maison du Pain ».
 */
export function humanizeSlug(raw: string): string {
  const spaced = (raw ?? "")
    // camelCase AVANT de tout passer en minuscules.
    .replace(/([a-zà-ÿ])([A-Z])/g, "$1 $2")
    .replace(/([a-zA-Zà-ÿ])(\d)/g, "$1 $2")
    .replace(/(\d)([a-zA-Zà-ÿ])/g, "$1 $2")
    .replace(/[._\-+~'’]+/g, " ");
  const words: string[] = [];
  for (const part of spaced.split(/\s+/)) {
    if (!part) continue;
    const ascii = normalizeForMatch(part);
    if (!ascii) continue;
    // On ne découpe que les mots entièrement en minuscules d'origine (un
    // « CamelCase » a déjà été découpé ci-dessus) et purement alphabétiques.
    if (/^[a-z]+$/.test(ascii) && part === part.toLowerCase()) words.push(...segment(ascii));
    else words.push(...ascii.split(" "));
  }
  return clampName(titleCase(words));
}

/** Coupe un nom à 40 caractères sur une frontière de mot. */
export function clampName(name: string, max = 40): string {
  const s = (name ?? "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(" ");
  const out = lastSpace >= Math.floor(max / 2) ? cut.slice(0, lastSpace) : s.slice(0, max);
  return out.replace(/[\s\-–—|·•:,;]+$/, "").trim();
}

/** Hébergeurs où le nom du commerce est le SOUS-domaine (« monkebab.wixsite.com »). */
const HOSTING_SUFFIXES = [
  "wixsite.com", "business.site", "myshopify.com", "webnode.fr", "webnode.com", "webnode.page",
  "jimdofree.com", "jimdosite.com", "jimdo.com", "wordpress.com", "squarespace.com",
  "blogspot.com", "over-blog.com", "e-monsite.com", "github.io", "vercel.app", "netlify.app",
  "site123.me", "godaddysites.com", "webflow.io", "carrd.co", "ueniweb.com", "simplesite.com",
  "eatbu.com", "pagesperso-orange.fr", "free.fr", "zenchef.com", "sumupstore.com",
];

/** Suffixes publics à deux niveaux (le nom est l'étiquette d'avant). */
const SECOND_LEVEL_SUFFIXES = new Set([
  "co.uk", "org.uk", "me.uk", "com.au", "co.ma", "com.tn", "com.dz", "com.fr", "asso.fr",
  "gouv.fr", "nom.fr", "co.za", "com.br", "com.tr", "co.jp", "com.es", "com.mx", "co.nz",
]);

/** Sous-domaines techniques ignorés (www, m, fr…). */
const IGNORED_SUBDOMAIN = /^(?:www\d*|m|mobile|fr|en|shop|boutique|site|web|app|home)$/;

/**
 * Nom lisible déduit d'un nom d'hôte (« www.boulangerie-dupont.fr » →
 * « Boulangerie Dupont »). Renvoie « » si rien d'exploitable (IP, hôte vide) :
 * l'appelant applique alors son propre repli (« Mon commerce »).
 */
export function nameFromDomain(hostname: string): string {
  let host = (hostname ?? "").trim().toLowerCase();
  if (host.includes("/")) {
    try {
      host = new URL(host.includes("://") ? host : `https://${host}`).hostname;
    } catch {
      return "";
    }
  }
  host = host.replace(/:\d+$/, "").replace(/\.$/, "");
  if (!host || /^[\d.]+$/.test(host) || host.includes(":") || host.startsWith("[")) return "";

  const hosting = HOSTING_SUFFIXES.find((s) => host.endsWith(`.${s}`));
  let label: string | undefined;
  if (hosting) {
    const sub = host.slice(0, -(hosting.length + 1)).split(".").filter((l) => !IGNORED_SUBDOMAIN.test(l));
    label = sub[sub.length - 1];
  } else {
    const labels = host.split(".").filter(Boolean);
    if (labels.length < 2) {
      label = labels[0];
    } else {
      const lastTwo = labels.slice(-2).join(".");
      const idx = SECOND_LEVEL_SUFFIXES.has(lastTwo) && labels.length >= 3 ? labels.length - 3 : labels.length - 2;
      label = labels[idx];
    }
  }
  // Étiquette punycode (« xn--… ») : illisible telle quelle, on préfère le
  // repli de l'appelant à un nom absurde.
  if (!label || IGNORED_SUBDOMAIN.test(label) || label.startsWith("xn--")) return "";
  return humanizeSlug(label);
}
