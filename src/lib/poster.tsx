import QRCode from "qrcode";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

/**
 * Affiche comptoir A4 (PDF) : « Scannez pour recevoir votre carte de
 * fidélité » + QR code + récompense, aux couleurs de la carte.
 *
 * Partagée entre :
 *  - /api/onboarding/poster/[cardId] (commerçant connecté, sa carte) ;
 *  - /api/essai/[token]/poster (démo « Votre carte en 30 secondes »).
 *
 * Rendu côté serveur uniquement (@react-pdf/renderer, polices PDF standard).
 */

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#f9f7f0",
    padding: 48,
    fontFamily: "Helvetica",
  },
  topAccent: {
    height: 8,
    width: "100%",
    marginBottom: 32,
    borderRadius: 4,
  },
  badge: {
    alignSelf: "center",
    backgroundColor: "#fbbf24",
    color: "#1a1a1a",
    paddingHorizontal: 14,
    paddingVertical: 6,
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    borderRadius: 999,
    marginBottom: 24,
    letterSpacing: 1.2,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 8,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 12,
    objectFit: "cover",
  },
  brandName: {
    fontSize: 28,
    fontWeight: 700,
    color: "#1a1a1a",
  },
  title: {
    fontSize: 38,
    fontWeight: 700,
    textAlign: "center",
    color: "#1a1a1a",
    marginTop: 24,
    lineHeight: 1.15,
    paddingHorizontal: 24,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    color: "#555555",
    marginTop: 14,
    lineHeight: 1.4,
    paddingHorizontal: 32,
  },
  qrWrap: {
    alignItems: "center",
    marginTop: 36,
    marginBottom: 32,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 28,
    alignSelf: "center",
  },
  qrImage: {
    width: 260,
    height: 260,
  },
  qrCaption: {
    marginTop: 14,
    fontSize: 11,
    color: "#888888",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  steps: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 18,
    marginTop: 12,
  },
  step: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    maxWidth: 150,
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#1a1a1a",
    color: "#fbbf24",
    textAlign: "center",
    fontSize: 13,
    fontWeight: 700,
    paddingTop: 5,
    marginBottom: 8,
  },
  stepText: {
    fontSize: 10,
    color: "#1a1a1a",
    textAlign: "center",
    lineHeight: 1.3,
  },
  rewardBox: {
    marginTop: 28,
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
  },
  rewardLabel: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontWeight: 700,
    marginBottom: 6,
  },
  rewardText: {
    fontSize: 20,
    fontWeight: 700,
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 9,
    color: "#888888",
  },
});

export interface PosterProps {
  businessName: string;
  cardName: string;
  rewardText: string;
  /** QR code en data URL (cf. {@link posterQrDataUrl}). */
  qrDataUrl: string;
  /** Couleur d'accent #rrggbb (bandeau, encadré récompense). */
  accentColor: string;
  logoUrl?: string | null;
}

const STEPS = ["Scannez le QR", "Ajoutez la carte au Wallet", "Cumulez vos tampons"];

/**
 * Document PDF de l'affiche. Appelé comme une fonction (et non en JSX) par
 * {@link renderPosterPdf} : `renderToBuffer` attend un élément `<Document>`
 * à la racine.
 */
export function PosterDocument({
  businessName,
  cardName,
  rewardText,
  qrDataUrl,
  accentColor,
  logoUrl,
}: PosterProps) {
  // Accent à 10 % d'opacité (#rrggbb + alpha hex) pour le fond de l'encadré.
  const accentTint = `${accentColor}1A`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={[styles.topAccent, { backgroundColor: accentColor }]} />
        <Text style={styles.badge}>Carte de fidélité</Text>
        <View style={styles.brandRow}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image react-pdf (PDF), pas un <img> HTML */}
          {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
          <Text style={styles.brandName}>{businessName}</Text>
        </View>
        <Text style={styles.title}>{"Scannez pour recevoir\nvotre carte de fidélité"}</Text>
        <Text style={styles.subtitle}>
          {`Ajoutez ${cardName || "votre carte"} à Apple Wallet ou Google Wallet en 2 clics. Aucune appli à télécharger.`}
        </Text>
        <View style={styles.qrWrap}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image react-pdf (PDF), pas un <img> HTML */}
          <Image src={qrDataUrl} style={styles.qrImage} />
          <Text style={styles.qrCaption}>Pointez l&apos;appareil photo de votre téléphone ici</Text>
        </View>
        <View
          style={[
            styles.rewardBox,
            { backgroundColor: accentTint, borderColor: accentColor, borderWidth: 1 },
          ]}
        >
          <Text style={[styles.rewardLabel, { color: accentColor }]}>Votre récompense</Text>
          <Text style={[styles.rewardText, { color: accentColor }]}>
            {rewardText || "À définir"}
          </Text>
        </View>
        <View style={styles.steps}>
          {STEPS.map((label, i) => (
            <View key={i} style={styles.step}>
              <Text style={styles.stepNumber}>{String(i + 1)}</Text>
              <Text style={styles.stepText}>{label}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.footer}>{`Propulsé par aswallet · ${businessName}`}</Text>
      </Page>
    </Document>
  );
}

/** Génère le PDF de l'affiche. */
export async function renderPosterPdf(props: PosterProps): Promise<Buffer> {
  return renderToBuffer(PosterDocument(props));
}

/** QR code de l'affiche (grand, correction d'erreur élevée : imprimable). */
export function posterQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    width: 600,
    margin: 1,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#ffffff" },
  });
}

/**
 * Les polices PDF standard (Helvetica, encodage WinAnsi) ne savent pas
 * dessiner les emoji ni certains signes typographiques : on les remplace
 * par leur équivalent sûr plutôt que d'imprimer des glyphes cassés.
 */
export function pdfSafeText(input: string): string {
  return input
    .replace(/[\u2212\u2010\u2011]/g, "-") // signe moins, traits d'union insécables
    .replace(/[\u202F\u2009\u2007\u200A]/g, " ") // espaces fines / insécables étroites
    .replace(/[\u200B-\u200D\uFE0F]/g, "") // caractères invisibles (ZWJ, sélecteurs emoji)
    .replace(
      /[^\u0009\u000A\u000D\u0020-~\u00A0-\u00FF\u0152\u0153\u0160\u0161\u0178\u017D\u017E\u0192\u02C6\u02DC\u2013\u2014\u2018\u2019\u201A\u201C\u201D\u201E\u2020\u2021\u2022\u2026\u2030\u2039\u203A\u20AC\u2122]/gu,
      ""
    )
    .replace(/[ \u00A0]{2,}/g, " ")
    .trim();
}
