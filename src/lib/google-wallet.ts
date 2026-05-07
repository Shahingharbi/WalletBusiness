import jwt from "jsonwebtoken";
import { GoogleAuth } from "google-auth-library";
import type { CardKind, PassLocation } from "./apple-wallet";
import { googleEffectiveBgColor, shortLabel } from "./wallet-colors";

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
  /**
   * Label custom du compteur ("Tampons" / "Visites" / "Cafés" / ...). Choisi
   * dans le designer côté merchant, persisté dans `design.label_stamps`.
   */
  stampsLabel?: string | null;
  /**
   * Type de carte. Détermine si on rend un compteur (stamp/cashback) ou
   * juste l'offre (discount/membership). Default "stamp" pour rétro-compat.
   */
  cardKind?: CardKind | null;
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
    // Force Google Wallet à pousser une notification push au porteur ET à
    // rafraîchir visuellement la carte ouverte dès qu'on PATCH un object de
    // cette classe. Sans ce flag, le PATCH côté serveur réussit mais le tel
    // ne refetch qu'au prochain ouverture de l'app -> tampons en retard.
    multipleDevicesAndHoldersAllowedStatus: "MULTIPLE_HOLDERS",
    notifyPreference: "NOTIFY_ON_UPDATE",
    rewardsTier: "Standard",
    rewardsTierLabel: "Programme",
    accountIdLabel: "Client",
    accountNameLabel: "Nom",
    // programDetails au verso de la carte Google Wallet : juste le crédit
    // "Propulsé par aswallet". L'offre (`rewardText`) est déjà dans
    // `textModulesData` côté loyaltyObject — la mettre ici aussi la
    // dupliquait visuellement au verso de la carte (info affichée 2 fois).
    programDetails: "Propulsé par aswallet",
    ...(locations ? { locations } : {}),
  };
}

function bannerUri(
  appUrl: string,
  token: string,
  stamps: number,
  kind: CardKind,
): string {
  return `${appUrl}/api/wallet/banner/${token}/${stamps}?kind=${kind}`;
}

function buildLoyaltyObject(p: PassParams) {
  const homepageUri = `${p.appUrl}/c/${p.cardId}/status/${p.customerInstanceToken}`;
  const accountName = (p.customerName ?? "").trim() || "Client";
  const rewardText = (p.rewardText ?? "").trim();
  const kind: CardKind = (p.cardKind as CardKind) ?? "stamp";
  const isCounter = kind === "stamp" || kind === "cashback";

  const stampsBannerUri = bannerUri(
    p.appUrl,
    p.customerInstanceToken,
    p.stampsCollected,
    kind,
  );

  const obj: Record<string, unknown> = {
    id: objectId(p.customerInstanceToken),
    classId: classId(p.cardId),
    state: "ACTIVE",
    accountId: p.customerInstanceToken,
    accountName,
    // Per-user heroImage: dynamic PNG. Pour stamp/cashback c'est la grille
    // de tampons, pour discount/membership c'est juste la bannière+icône
    // (pas de compteur trompeur).
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
              value: isCounter
                ? `Progression: ${p.stampsCollected} sur ${p.stampsTotal} tampons`
                : "Carte de fidélité",
            },
          },
        },
      },
    ],
    // PAS de secondaryLoyaltyPoints — Google les rend comme une rangée de
    // ronds génériques en bas de la carte (catastrophique visuellement vu
    // qu'on a déjà notre grille custom dans heroImage/imageModules).
    barcode: {
      type: p.barcodeType === "pdf417" ? "PDF_417" : "QR_CODE",
      value: p.customerInstanceToken,
      // alternateText apparaît sous le code-barres dans Google Wallet.
      // On remplace le serial number (chaîne aléatoire) par un crédit clair.
      alternateText: "Propulsé par aswallet",
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

  // Compteur "X / Y" UNIQUEMENT pour stamp/cashback. Avant ce check, les
  // cartes Discount/Membership affichaient "Tampons 0/8" sans aucun sens
  // (Membership est sans compteur, Discount est un avantage permanent).
  if (isCounter) {
    obj.loyaltyPoints = {
      balance: { string: `${p.stampsCollected} / ${p.stampsTotal}` },
      label: shortLabel(
        p.stampsLabel,
        kind === "cashback" ? "Visites" : "Tampons",
        14,
      ),
    };
  }

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

/**
 * Upsert la loyaltyClass côté Google Wallet API REST avant le save JWT.
 *
 * Pourquoi : si on embarque la classe dans le JWT et qu'elle existe déjà
 * côté Google avec une config différente (ex: ancien `programDetails` qu'on
 * a depuis modifié), Google refuse silencieusement → l'utilisateur voit
 * "Un problème est survenu, veuillez réessayer". Bug récurrent pour les
 * cartes créées avant un refactor du LoyaltyClass shape.
 *
 * Solution : on tente PATCH (update) en premier ; si 404 (classe pas
 * encore créée côté Google), on tente INSERT. Best-effort : si ça plante
 * on retourne false et on tombe en fallback sur le JWT-embedded classique.
 */
async function upsertLoyaltyClass(p: PassParams): Promise<boolean> {
  try {
    const cls = buildLoyaltyClass(p);
    const auth = new GoogleAuth({
      credentials: {
        client_email: SERVICE_ACCOUNT_EMAIL,
        private_key: PRIVATE_KEY,
      },
      scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
    });
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    if (!accessToken.token) return false;
    const headers = {
      Authorization: `Bearer ${accessToken.token}`,
      "Content-Type": "application/json",
    } as const;
    const classUrl = `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass/${cls.id}`;

    // 1) PATCH (update). Si la classe n'existe pas → 404 → on bascule INSERT.
    const patchRes = await fetch(classUrl, {
      method: "PATCH",
      headers,
      body: JSON.stringify(cls),
    });
    if (patchRes.ok) return true;
    if (patchRes.status === 404) {
      const insertRes = await fetch(
        "https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass",
        { method: "POST", headers, body: JSON.stringify(cls) },
      );
      if (insertRes.ok) return true;
      const errBody = await insertRes.text().catch(() => "");
      console.warn(
        "[google-wallet] INSERT class failed status=%d body=%s",
        insertRes.status,
        errBody.slice(0, 400),
      );
      return false;
    }
    const errBody = await patchRes.text().catch(() => "");
    console.warn(
      "[google-wallet] PATCH class failed status=%d body=%s",
      patchRes.status,
      errBody.slice(0, 400),
    );
    return false;
  } catch (err) {
    console.warn("[google-wallet] upsertLoyaltyClass exception:", err);
    return false;
  }
}

/**
 * Génère l'URL Google Wallet save-to-wallet.
 *
 * Tente d'abord d'upsert la loyaltyClass via API REST (évite les conflits
 * avec une classe pré-existante). Si succès, le JWT n'embarque QUE le
 * loyaltyObject. Si échec, fallback sur le JWT-embedded classique
 * (loyaltyClasses + loyaltyObjects ensemble) — Google se débrouillera.
 */
export async function generateGoogleWalletPassUrl(p: PassParams): Promise<string> {
  if (!isGoogleWalletConfigured()) {
    throw new Error("Google Wallet not configured");
  }

  const classUpserted = await upsertLoyaltyClass(p);

  const payload: Record<string, unknown> = {
    loyaltyObjects: [buildLoyaltyObject(p)],
  };
  // Fallback : si l'upsert REST a échoué, on envoie quand même la classe
  // dans le JWT pour que Google tente sa propre création.
  if (!classUpserted) {
    payload.loyaltyClasses = [buildLoyaltyClass(p)];
  }

  const claims = {
    iss: SERVICE_ACCOUNT_EMAIL,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    origins: [p.appUrl],
    payload,
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
  stampsTotal?: number,
  stampsLabel?: string | null,
  cardKind?: CardKind | null,
): Promise<{ ok: boolean; status?: number }> {
  if (!isGoogleWalletConfigured()) return { ok: false };

  const objId = objectId(instanceToken);
  const url = `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${objId}`;
  const kind: CardKind = (cardKind as CardKind) ?? "stamp";
  const isCounter = kind === "stamp" || kind === "cashback";
  // Mirror the buildLoyaltyObject shape: balance.string "X / Y" so the
  // wallet card stays consistent across initial save and subsequent
  // PATCHes. When stampsTotal is unknown, fall back to a bare number.
  const balanceString =
    typeof stampsTotal === "number"
      ? `${stampsCollected} / ${stampsTotal}`
      : `${stampsCollected}`;
  const stampsBannerUri = bannerUri(
    appUrl,
    instanceToken,
    stampsCollected,
    kind,
  );

  const body: Record<string, unknown> = {
    // Pour discount/membership : on EXPLICITEMENT clear le compteur (au cas
    // où une ancienne version l'aurait set). Pour stamp/cashback : compteur normal.
    loyaltyPoints: isCounter
      ? {
          balance: { string: balanceString, int: null },
          label: shortLabel(
            stampsLabel,
            kind === "cashback" ? "Visites" : "Tampons",
            14,
          ),
        }
      : null,
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
    const res = await client.request({
      url,
      method: "PATCH",
      data: body,
      timeout: 3000,
    });
    console.info(
      "[google-sync] PATCH %s ok status=%s balance=%s",
      objId,
      (res as { status?: number })?.status ?? "n/a",
      balanceString
    );
    return { ok: true };
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    const message = (err as { message?: string })?.message ?? String(err);
    if (status === 404) {
      // 404 = le loyaltyObject n'existe pas côté Google. Normal SI l'utilisateur
      // n'a pas encore appuyé sur "Ajouter à Google Wallet". S'il l'a fait
      // ET que le sync 404e -> bug : objet jamais inséré côté Google. Ce log
      // remonte dans Vercel pour diagnostiquer après une démo.
      console.info(
        "[google-sync] 404 (pass not yet saved by user?) objId=%s",
        objId
      );
      return { ok: false, status: 404 };
    }
    console.warn(
      "[google-sync] PATCH %s failed status=%s message=%s",
      objId,
      status ?? "n/a",
      message
    );
    return { ok: false, status };
  }
}
