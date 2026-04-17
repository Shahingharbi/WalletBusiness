"use client";

import { useState } from "react";
import { TopBanner } from "@/components/landing/TopBanner";
import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { SocialProofSection } from "@/components/landing/SocialProofSection";
import { WhyWalletSection } from "@/components/landing/WhyWalletSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { WalletStatsSection } from "@/components/landing/WalletStatsSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { CTASection } from "@/components/landing/CTASection";
import { Footer } from "@/components/landing/Footer";

export function LandingShell() {
  const [bannerVisible, setBannerVisible] = useState(true);

  return (
    <>
      <TopBanner onDismiss={() => setBannerVisible(false)} />
      <div style={{ paddingTop: bannerVisible ? 52 : 0 }}>
        <Navbar bannerVisible={bannerVisible} />
        <main>
          <HeroSection />
          <SocialProofSection />
          <WhyWalletSection />
          <HowItWorksSection />
          <FeaturesSection />
          <WalletStatsSection />
          <PricingSection />
          <CTASection />
        </main>
        <Footer />
      </div>
    </>
  );
}
