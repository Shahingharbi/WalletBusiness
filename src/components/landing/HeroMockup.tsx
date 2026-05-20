"use client";

import Image from "next/image";
import { CardPreview } from "@/components/cards/card-preview";

/**
 * Empilement de 2 cartes Apple Wallet pour le Hero de la landing.
 *
 * Par défaut : rend via <CardPreview /> (le composant de l'éditeur merchant).
 * Mode "vraies captures" : si tu poses tes screenshots Apple Wallet dans
 *   `public/landing-mockups/wallet-front.png` et `wallet-back.png`,
 *   passe `USE_REAL_PHOTOS = true` et le hero affichera tes vraies images
 *   dans des frames iPhone. Pratique quand tu as une carte sur ton tel et
 *   tu veux la mettre en vitrine.
 */
const USE_REAL_PHOTOS = false;

function PhoneFrame({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <div className="rounded-[40px] bg-neutral-900 p-[3px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.45)] ring-1 ring-black/30">
        <div className="relative rounded-[37px] overflow-hidden bg-black">
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 w-20 sm:w-24 h-5 sm:h-6 bg-black rounded-full" />
          <Image
            src={src}
            alt={alt}
            width={414}
            height={896}
            className="w-full h-auto"
            priority
          />
        </div>
      </div>
    </div>
  );
}

export function HeroMockup() {
  if (USE_REAL_PHOTOS) {
    // Mode vraies captures iPhone (Safari Burger / Kaptainfry / etc.)
    return (
      <div className="relative w-full max-w-[460px] mx-auto py-6">
        <div
          className="absolute top-0 left-1/2 w-[58%] sm:w-[62%] origin-center hidden sm:block"
          style={{
            transform: "translate(calc(-50% + 70px), 16px) rotate(7deg)",
            opacity: 0.95,
          }}
        >
          <PhoneFrame
            src="/landing-mockups/wallet-back.png"
            alt="Carte de fidélité partenaire dans Apple Wallet"
          />
        </div>
        <div
          className="relative w-[68%] sm:w-[60%] mx-auto"
          style={{ transform: "translate(-6%, 0) rotate(-3deg)" }}
        >
          <PhoneFrame
            src="/landing-mockups/wallet-front.png"
            alt="Carte de fidélité partenaire dans Apple Wallet"
          />
        </div>
      </div>
    );
  }

  // Mode CardPreview — rend deux vraies cartes via le composant de l'éditeur
  return (
    <div className="relative w-full max-w-[460px] mx-auto py-6">
      {/* Carte ARRIÈRE */}
      <div
        className="absolute top-0 left-1/2 w-[300px] sm:w-[320px] origin-center hidden sm:block"
        style={{
          transform: "translate(calc(-50% + 70px), 16px) rotate(7deg)",
          opacity: 0.95,
          filter: "drop-shadow(0 30px 40px rgba(0,0,0,0.15))",
        }}
      >
        <CardPreview
          cardName="Carte fidélité"
          cardType="stamp"
          stampCount={10}
          rewardText="10 cafés = 1 offert"
          businessName="Café Numidia"
          design={{
            background_color: "#1f1410",
            text_color: "#ffffff",
            accent_color: "#d4a574",
            banner_url: null,
            logo_url: null,
            icon_url: null,
            stamp_icon: "coffee",
            stamp_shape: "circle",
            stamp_active_url: null,
            stamp_inactive_url: null,
            label_stamps: "Cafés",
            label_rewards: "Récompenses",
            welcome_reward: "",
          }}
          platform="apple"
        />
      </div>

      {/* Carte AVANT */}
      <div
        className="relative w-[300px] sm:w-[320px] mx-auto"
        style={{
          transform: "translate(-6%, 0) rotate(-3deg)",
          filter: "drop-shadow(0 30px 45px rgba(0,0,0,0.22))",
        }}
      >
        <CardPreview
          cardName="Carte fidélité"
          cardType="stamp"
          stampCount={10}
          rewardText="10 burgers = 1 offert"
          businessName="Safari Burger"
          design={{
            background_color: "#fef6e4",
            text_color: "#1a1410",
            accent_color: "#e8743c",
            banner_url: null,
            logo_url: null,
            icon_url: null,
            stamp_icon: "check",
            stamp_shape: "squircle",
            stamp_active_url: null,
            stamp_inactive_url: null,
            label_stamps: "Tampons",
            label_rewards: "Récompenses",
            welcome_reward: "",
          }}
          platform="apple"
        />
      </div>

      {/* Floating chip */}
      <div className="hidden sm:flex absolute -right-2 lg:right-6 top-24 items-center gap-2 bg-foreground text-white rounded-full pl-2 pr-4 py-2 shadow-xl ring-1 ring-black/10">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-yellow text-foreground font-bold text-sm">
          +1
        </span>
        <div className="leading-tight">
          <p className="text-[11px] font-semibold">Tampon ajouté</p>
          <p className="text-[10px] text-white/60">à l&apos;instant</p>
        </div>
      </div>

      {/* Floating badge */}
      <div className="hidden lg:flex absolute -left-2 bottom-10 flex-col bg-white rounded-2xl px-4 py-3 shadow-xl ring-1 ring-black/5">
        <p
          className="text-2xl text-foreground leading-none"
          style={{ fontFamily: "var(--font-ginto-nord)", fontWeight: 500 }}
        >
          90%
        </p>
        <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
          de lecture<br />des push wallet
        </p>
      </div>
    </div>
  );
}
