import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
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

export const metadata: Metadata = {
  title: {
    default: "aswallet - Carte de fidélité digitale pour commerces de proximité",
    template: "%s | aswallet",
  },
  description:
    "Créez votre carte de fidélité digitale dans Apple Wallet et Google Wallet. Notifications push gratuites et illimitées. Sans app à télécharger. Essai gratuit 14 jours.",
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
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
