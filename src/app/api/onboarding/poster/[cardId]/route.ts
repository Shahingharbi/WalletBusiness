import { NextResponse } from "next/server";
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
import React from "react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface CardDesign {
  accent_color?: string | null;
  background_color?: string | null;
  text_color?: string | null;
  logo_url?: string | null;
}

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

interface PosterProps {
  businessName: string;
  cardName: string;
  rewardText: string;
  qrDataUrl: string;
  accentColor: string;
  logoUrl?: string | null;
}

function PosterDocument({
  businessName,
  cardName,
  rewardText,
  qrDataUrl,
  accentColor,
  logoUrl,
}: PosterProps) {
  const accentTint = `${accentColor}1A`;

  return React.createElement(
    Document,
    {},
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(View, {
        style: [styles.topAccent, { backgroundColor: accentColor }],
      }),
      React.createElement(
        Text,
        { style: styles.badge },
        "Carte de fidelite"
      ),
      React.createElement(
        View,
        { style: styles.brandRow },
        logoUrl
          ? React.createElement(Image, { src: logoUrl, style: styles.logo })
          : null,
        React.createElement(Text, { style: styles.brandName }, businessName)
      ),
      React.createElement(
        Text,
        { style: styles.title },
        "Scannez pour recevoir\nvotre carte de fidelite"
      ),
      React.createElement(
        Text,
        { style: styles.subtitle },
        `Ajoutez ${cardName || "votre carte"} a Apple Wallet ou Google Wallet en 2 clics. Aucune appli a telecharger.`
      ),
      React.createElement(
        View,
        { style: styles.qrWrap },
        React.createElement(Image, { src: qrDataUrl, style: styles.qrImage }),
        React.createElement(
          Text,
          { style: styles.qrCaption },
          "Pointez l'appareil photo de votre telephone ici"
        )
      ),
      React.createElement(
        View,
        {
          style: [
            styles.rewardBox,
            { backgroundColor: accentTint, borderColor: accentColor, borderWidth: 1 },
          ],
        },
        React.createElement(
          Text,
          { style: [styles.rewardLabel, { color: accentColor }] },
          "Votre recompense"
        ),
        React.createElement(
          Text,
          { style: [styles.rewardText, { color: accentColor }] },
          rewardText || "A definir"
        )
      ),
      React.createElement(
        View,
        { style: styles.steps },
        ...["Scannez le QR", "Ajoutez la carte au Wallet", "Cumulez vos tampons"].map(
          (label, i) =>
            React.createElement(
              View,
              { key: i, style: styles.step },
              React.createElement(Text, { style: styles.stepNumber }, String(i + 1)),
              React.createElement(Text, { style: styles.stepText }, label)
            )
        )
      ),
      React.createElement(
        Text,
        { style: styles.footer },
        `Propulse par aswallet · ${businessName}`
      )
    )
  );
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ cardId: string }> }
) {
  try {
    const { cardId } = await ctx.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("business_id")
      .eq("id", user.id)
      .single();
    if (!profile?.business_id) {
      return NextResponse.json(
        { error: "Commerce introuvable" },
        { status: 400 }
      );
    }

    const { data: card } = await supabase
      .from("cards")
      .select(
        "id, name, reward_text, design, business_id, businesses(name, logo_url)"
      )
      .eq("id", cardId)
      .eq("business_id", profile.business_id)
      .maybeSingle();

    if (!card) {
      return NextResponse.json(
        { error: "Carte introuvable" },
        { status: 404 }
      );
    }

    const business = card.businesses as unknown as {
      name: string;
      logo_url: string | null;
    } | null;
    const design = (card.design || {}) as CardDesign;

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      _req.headers.get("origin") ??
      `https://${_req.headers.get("host") ?? "aswallet.app"}`;
    const installUrl = `${origin.replace(/\/$/, "")}/c/${card.id}`;

    const qrDataUrl = await QRCode.toDataURL(installUrl, {
      width: 600,
      margin: 1,
      errorCorrectionLevel: "H",
      color: { dark: "#000000", light: "#ffffff" },
    });

    const accentColor = design.accent_color || "#fbbf24";
    const logoUrl = design.logo_url || business?.logo_url || null;

    const buffer = await renderToBuffer(
      PosterDocument({
        businessName: business?.name ?? "Votre commerce",
        cardName: card.name,
        rewardText: card.reward_text ?? "",
        qrDataUrl,
        accentColor,
        logoUrl,
      })
    );

    const safeName = (card.name || "carte").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const body = new Uint8Array(buffer);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="affiche-${safeName}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("poster error", err);
    return NextResponse.json(
      { error: "Erreur lors de la generation du PDF" },
      { status: 500 }
    );
  }
}
