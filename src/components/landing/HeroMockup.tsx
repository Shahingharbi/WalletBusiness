"use client";

import { CardPreview } from "@/components/cards/card-preview";

/**
 * Empilement de 2 cartes Apple Wallet rendues via le VRAI composant
 * <CardPreview /> (le même utilisé dans l'éditeur merchant). Garantit
 * que la landing montre exactement ce que les commerçants auront
 * comme résultat, sans mockup CSS de fausse carte qui ne ressemble à
 * rien de réel.
 *
 * Carte arrière : tons sombres + accent or (luxe / restauration).
 * Carte avant   : tons clairs + accent corail (boulangerie / café).
 */
export function HeroMockup() {
  return (
    <div className="relative w-full max-w-[420px] mx-auto py-8">
      {/* Carte ARRIÈRE — décalée, rotation légère, opacité réduite */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[300px] sm:max-w-[320px] origin-center"
        style={{
          transform:
            "translate(calc(-50% + 28px), 24px) rotate(6deg)",
          opacity: 0.92,
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

      {/* Carte AVANT — taille normale, légère contre-rotation */}
      <div
        className="relative w-full max-w-[300px] sm:max-w-[320px] mx-auto"
        style={{
          transform: "translate(-12px, 0) rotate(-3deg)",
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

      {/* Floating chip "+1 tampon" — fait vivre la composition */}
      <div className="hidden sm:flex absolute -right-4 lg:right-2 top-20 items-center gap-2 bg-foreground text-white rounded-full pl-2 pr-4 py-2 shadow-xl ring-1 ring-black/5">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-yellow text-foreground font-bold text-sm">
          +1
        </span>
        <div className="leading-tight">
          <p className="text-[11px] font-semibold">Tampon ajouté</p>
          <p className="text-[10px] text-white/60">à l&apos;instant</p>
        </div>
      </div>

      {/* Floating badge stat */}
      <div className="hidden lg:flex absolute -left-4 bottom-10 flex-col bg-white rounded-2xl px-4 py-3 shadow-xl ring-1 ring-black/5">
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
