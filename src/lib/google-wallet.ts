import jwt from "jsonwebtoken";
import { GoogleAuth } from "google-auth-library";
import type { PassLocation } from "./apple-wallet";
import { googleEffectiveBgColor } from "./wallet-colors";

// Re-export pour rester compatible avec les call-sites qui importent depuis
// "@/lib/google-wallet" (l'aperçu côté client utilise plutôt l'import direct
// depuis "@/lib/wallet-colors" pour ne pas tirer jsonwebtoken dans le bundle).
export { googleEffectiveBgColor };

interface PassParams {
  cardId: string;
  cardName: string;
  businessName: string;
  /**
   * Override optionnel du nom affiché en haut du pass (issuerName).
   * Si fourni et non vide, remplace `businessName` pour le branding du wallet.
   */
  walletBusinessName?: string | null;
  customerName: string;
  customerInstanceToken: string;
  stampsCollected: number;
  stampsTotal: number;
  rewardsAvailable: number;
  rewardText: string;
  /** Couleur de FOND du pass (hex). */
  bgColor: string;
  /** Couleur d'accent du merchant — sert au fallback auto-flip si bg trop clair. */
  accentColor?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  appUrl: string;
  barcodeType?: "qr" | "pdf417";
  /**
   * Points de vente — Google Wallet stocke les locations au niveau de la
   * `LoyaltyClass` (partagées par tous les porteurs). Max 10 par classe.
   */
  locations?: PassLocation[];
}

const ISSUER_ID = process.env.GOOGLE_WALLET_ISSUER_ID!;
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL!;
const PRIVATE_KEY = (process.env.GOOGLE_WALLET_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

// Google Wallet refuses a LoyaltyClass without a programLogo.
// Fallback to the aswallet icon when a merchant has not uploaded one.
const FALLBACK_LOGO_URL = "https://aswallet.fr/icon.svg";

export function isGoogleWalletConfigured(): boolean {
  return Boolean(ISSUER_ID && SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY);
}

function classId(cardId: string): string {
  return `${ISSUER_ID}.card-${cardId}`;
}

function objectId(instanceToken: string): string {
  return `${ISSUER_ID}.user-${instanceToken}`;
}

function buildLoyaltyClass(p: PassParams) {
  const logoUri = p.logoUrl ?? FALLBACK_LOGO_URL;
  // Display name au top du pass : on prend le nom de la carte par défaut
  // (Suprême Tacos, Carte café…) car c'est la marque produit que les merchants
  // veulent afficher. Le nom du business interne ("Demo aswallet") ne fuite
  // plus que si l'utilisateur le force via wallet_business_name.
  const displayName =
    (p.walletBusinessName && p.walletBusinessName.trim()) ||
    p.cardName ||
    p.businessName;
  // No class-level heroImage: the per-object heroImage (dynamic stamp grid)
  // is always set, so a class fallback would only add noise.
  // Google Wallet `locations` : array d'objets {latitude, longitude}.
  // L'OS Android affiche une notif quand le porteur s'approche du commerce.
  const locations =
    p.locations && p.locations.length > 0
      ? p.locations.slice(0, 10).map((l) => ({
          latitude: l.latitude,
          longitude: l.longitude,
        }))
      : undefined;

  // Google n'autorise QUE le réglage du fond — la couleur de texte est
  // décidée par leur renderer. Pour éviter un fond blanc + texte blanc
  // (illisible), on force un fond sombre quand le merchant a choisi clair.
  const effectiveBg = googleEffectiveBgColor(p.bgColor, p.accentColor);

  return {
    id: classId(p.cardId),
    issuerName: displayName,
    programName: p.cardName,
    programLogo: {
      sourceUri: { uri: logoUri },
      contentDescription: {
        defaultValue: { language: "fr", value: displayName },
      },
    },
    hexBackgroundColor: effectiveBg,
    countryCode: "FR",
    reviewStatus: "UNDER_REVIEW",
    rewardsTier: "Standard",
    rewardsTierLabel: "Programme",
    accountIdLabel: "Client",
    accountNameLabel: "Nom",
    // programDetails apparaît au verso de la carte Google Wallet — on y met
    // la récompense + le footer "Signé par aswallet".
    programDetails: `${p.rewardText}\n\nSigné par aswallet`,
    ...(locations ? { locations } : {}),
  };
}

function bannerUri(appUrl: string, token: string, stamps: number): string {
  return `${appUrl}/api/wallet/banner/${token}/${stamps}`;
}

function buildLoyaltyObject(p: PassParams) {
  const homepageUri = `${p.appUrl}/c/${p.cardId}/status/${p.customerInstanceToken}`;
  const accountName = (p.customerName ?? "").trim() || "Client";
  const rewardText = (p.rewardText ?? "").trim();

  const stampsBannerUri = bannerUri(
    p.appUrl,
    p.customerInstanceToken,
    p.stampsCollected,
  );

  const obj: Record<string, unknown> = {
    id: objectId(p.customerInstanceToken),
    classId: classId(p.cardId),
    state: "ACTIVE",
    accountId: p.customerInstanceToken,
    accountName,
    // Per-user heroImage: dynamic PNG with the visual stamp grid only.
    // Visible quand la carte est ouverte plein écran sur Android.
    heroImage: {
      sourceUri: { uri: stampsBannerUri },
      contentDescription: {
        defaultValue: { language: "fr", value: "Progression" },
      },
    },
    // Même image dans imageModulesData -> visible aussi sur la preview web,
    // dans la liste des cartes Wallet et sur les vues détail. Google rend les
    // image modules au-dessus / en plus du barcode et du heroImage. C'est la
    // technique utilisée par Boomerangme/CaptainWallet pour que la grille de
    // tampons soit toujours visible peu importe la vue.
    imageModulesData: [
      {
        id: "stamps-grid",
        mainImage: {
          sourceUri: { uri: stampsBannerUri },
          contentDescription: {
            defaultValue: {
              language: "fr",
              value: `Progression: ${p.stampsCollected} sur ${p.stampsTotal} tampons`,
            },
          },
        },
      },
    ],
    // "X / Y" string instead of a raw count: clearer than a single big
    // number, and matches the Apple headerFields value.
    loyaltyPoints: {
      balance: { string: `${p.stampsCollected} / ${p.stampsTotal}` },
      label: "Tampons",
    },
    // PAS de secondaryLoyaltyPoints — Google les rend comme une rangée de
    // ronds génériques en bas de la carte (catastrophique visuellement vu
    // qu'on a déjà notre grille custom dans heroImage/imageModules).
    barcode: {
      type: p.barcodeType === "pdf417" ? "PDF_417" : "QR_CODE",
      value: p.customerInstanceToken,
      // alternateText apparaît sous le code-barres dans Google Wallet.
      // On remplace le serial number (chaîne aléatoire) par un crédit clair.
      alternateText: "Signé par aswallet",
    },
    linksModuleData: {
      uris: [
        {
          uri: homepageUri,
          description: "Voir ma carte",
          id: "open-card",
        },
      ],
    },
  };

  // textModulesData : un SEUL module — "Notre offre" — pour rester focalisé
  // sur l'info clé (ce que le client gagne). Le compte de tampons est déjà
  // dans loyaltyPoints, et Google calcule lui-même la progression côté UI.
  const modules: Array<{ id: string; header: string; body: string }> = [];
  if (rewardText) {
    modules.push({ id: "offer", header: "Notre offre", body: rewardText });
  }
  if (modules.length > 0) {
    obj.textModulesData = modules;
  }

  return obj;
}

export function generateGoogleWalletPassUrl(p: PassParams): string {
  if (!isGoogleWalletConfigured()) {
    throw new Error("Google Wallet not configured");
  }

  const claims = {
    iss: SERVICE_ACCOUNT_EMAIL,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    origins: [p.appUrl],
    payload: {
      loyaltyClasses: [buildLoyaltyClass(p)],
      loyaltyObjects: [buildLoyaltyObject(p)],
    },
  };

  const token = jwt.sign(claims, PRIVATE_KEY, { algorithm: "RS256" });
  return `https://pay.google.com/gp/v/save/${token}`;
}

// Google Wallet: push updated stamps/rewards to an existing loyaltyObject.
// Called after /api/scan so users who added the card to Wallet see fresh counts.
// Silently no-ops on 404 (user never added to Wallet yet) or on timeout.
//
// `message` (optionnel) — quand fourni, ajoute un objet `messages[]` au pass
// et Google envoie une notification push silencieuse au téléphone du porteur.
// Utilisé par les campagnes (broadcasts) côté `/api/campaigns`.
export async function syncLoyaltyObject(
  instanceToken: string,
  stampsCollected: number,
  rewardsAvailable: number,
  appUrl: string,
  message?: string,
  stampsTotal?: number
): Promise<{ ok: boolean; status?: number }> {
  if (!isGoogleWalletConfigured()) return { ok: false };

  const objId = objectId(instanceToken);
  const url = `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${objId}`;
  // Mirror the buildLoyaltyObject shape: balance.string "X / Y" so the
  // wallet card stays consistent across initial save and subsequent
  // PATCHes. When stampsTotal is unknown, fall back to a bare number.
  const balanceString =
    typeof stampsTotal === "number"
      ? `${stampsCollected} / ${stampsTotal}`
      : `${stampsCollected}`;
  const stampsBannerUri = bannerUri(appUrl, instanceToken, stampsCollected);

  const body: Record<string, unknown> = {
    // balance.int explicitement null -> on clear l'ancien format si l'objet
    // existant l'avait, sinon Google refuse "More than one type of loyalty
    // point balances cannot be set".
    loyaltyPoints: {
      balance: { string: balanceString, int: null },
      label: "Tampons",
    },
    // Clear l'ancien secondaryLoyaltyPoints si l'objet existant en avait.
    secondaryLoyaltyPoints: null,
    // Aucun textModulesData côté sync -> on ne tente plus de pousser un
    // module "progress"/"rewards-available" obsolète. Le module "Notre offre"
    // est figé côté loyaltyClass au moment de la création du pass.
    heroImage: {
      sourceUri: { uri: stampsBannerUri },
      contentDescription: {
        defaultValue: { language: "fr", value: "Progression" },
      },
    },
    imageModulesData: [
      {
        id: "stamps-grid",
        mainImage: {
          sourceUri: { uri: stampsBannerUri },
          contentDescription: {
            defaultValue: {
              language: "fr",
              value: `Progression: ${balanceString}`,
            },
          },
        },
      },
    ],
  };

  // rewardsAvailable n'est plus rendu visuellement (suppression du module
  // dédié), mais on garde la signature pour compat campagnes / appels existants.
  void rewardsAvailable;

  if (message && message.trim()) {
    // Google envoie une notification push silencieuse au porteur quand
    // un nouveau message est ajouté. Le messageId doit être unique pour
    // déclencher la notif sur le device.
    body.messages = [
      {
        id: `campaign-${Date.now()}`,
        header: "Nouveauté",
        body: message.trim().slice(0, 200),
        messageType: "TEXT",
      },
    ];
  }

  const auth = new GoogleAuth({
    credentials: {
      client_email: SERVICE_ACCOUNT_EMAIL,
      private_key: PRIVATE_KEY,
    },
    scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
  });

  try {
    const client = await auth.getClient();
    await client.request({ url, method: "PATCH", data: body, timeout: 3000 });
    return { ok: true };
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) return { ok: false, status: 404 }; // pass jamais ajouté, normal
    console.warn(
      `[wallet-sync] PATCH ${objId} failed:`,
      (err as { message?: string })?.message ?? err
    );
    return { ok: false, status };
  }
}
