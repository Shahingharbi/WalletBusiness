import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const gintoNord = localFont({
  src: [{ path: "../../public/fonts/GintoNord-500.woff2", weight: "500", style: "normal" }],
  variable: "--font-ginto-nord",
  display: "swap",
});

const maisonNeueExtended = localFont({
  src: [
    { path: "../../public/fonts/MaisonNeueExtended-400.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/MaisonNeueExtended-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-maison-neue-extended",
  display: "swap",
});

const maisonNeue = localFont({
  src: [
    { path: "../../public/fonts/MaisonNeue-400.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/MaisonNeue-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-maison-neue",
  display: "swap",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://aswallet.fr";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "aswallet - Carte de fidélité digitale pour commerces de proximité",
    template: "%s | aswallet",
  },
  description:
    "Créez votre carte de fidélité digitale dans Apple Wallet et Google Wallet. Notifications push gratuites et illimitées. Sans app à télécharger. Essai gratuit 30 jours.",
  applicationName: "aswallet",
  authors: [{ name: "aswallet" }],
  keywords: [
    "carte de fidélité",
    "fidélisation",
    "Apple Wallet",
    "Google Wallet",
    "commerce de proximité",
    "PWA",
  ],
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: SITE_URL,
    siteName: "aswallet",
    title:
      "aswallet — Carte de fidélité digitale pour commerces de proximité",
    description:
      "Créez votre carte de fidélité digitale dans Apple Wallet et Google Wallet. Sans app à télécharger.",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "aswallet — Carte de fidélité digitale",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title:
      "aswallet — Carte de fidélité digitale pour commerces de proximité",
    description:
      "Créez votre carte de fidélité digitale dans Apple Wallet et Google Wallet. Sans app à télécharger.",
    images: ["/api/og"],
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${inter.variable} ${gintoNord.variable} ${maisonNeueExtended.variable} ${maisonNeue.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background font-sans text-foreground">
        {/* Skip-to-content link — visible on focus, helps keyboard / screen-reader users. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-md focus:bg-black focus:px-4 focus:py-2 focus:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
        >
          Aller au contenu principal
        </a>
        <ToastProvider>{children}</ToastProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
