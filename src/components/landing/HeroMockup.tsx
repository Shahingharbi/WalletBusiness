"use client";

import Image from "next/image";

/**
 * Hero mockup — empilement de 2 vraies captures Apple Wallet du user
 * (Safari Burger orange + Kaptainfry rouge), cropées pour virer
 * l'indicateur de pile en bas. Les screenshots iPhone ont déjà la
 * status bar + le fond noir iPhone, donc juste un border-radius + shadow
 * suffit — pas de frame iPhone supplémentaire qui ferait double.
 */

function WalletCard({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-[32px] overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.45)] ring-1 ring-black/20 ${className}`}
    >
      <Image
        src={src}
        alt={alt}
        width={828}
        height={1398}
        className="w-full h-auto"
        priority
      />
    </div>
  );
}

export function HeroMockup() {
  return (
    <div className="relative w-full max-w-[480px] mx-auto py-6">
      {/* Carte ARRIÈRE — Kaptainfry (rouge/noir), décalée + rotation */}
      <div
        className="absolute top-0 left-1/2 w-[55%] sm:w-[58%] origin-center hidden sm:block"
        style={{
          transform: "translate(calc(-50% + 68px), 10px) rotate(7deg)",
          opacity: 0.96,
        }}
      >
        <WalletCard
          src="/landing-mockups/wallet-kaptainfry.png"
          alt="Carte de fidélité Kaptainfry dans Apple Wallet"
        />
      </div>

      {/* Carte AVANT — Safari Burger (orange) */}
      <div
        className="relative w-[60%] sm:w-[58%] mx-auto"
        style={{ transform: "translate(-6%, 0) rotate(-3deg)" }}
      >
        <WalletCard
          src="/landing-mockups/wallet-safariburger.png"
          alt="Carte de fidélité Safari Burger dans Apple Wallet"
        />
      </div>

      {/* Floating chip "+1 tampon" — donne vie à la composition */}
      <div className="hidden sm:flex absolute right-0 lg:right-6 top-24 items-center gap-2 bg-foreground text-white rounded-full pl-2 pr-4 py-2 shadow-xl ring-1 ring-black/10 z-10">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-yellow text-foreground font-bold text-sm">
          +1
        </span>
        <div className="leading-tight">
          <p className="text-[11px] font-semibold">Tampon ajouté</p>
          <p className="text-[10px] text-white/60">à l&apos;instant</p>
        </div>
      </div>

      {/* Floating badge stat */}
      <div className="hidden lg:flex absolute -left-4 bottom-12 flex-col bg-white rounded-2xl px-4 py-3 shadow-xl ring-1 ring-black/5 z-10">
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
