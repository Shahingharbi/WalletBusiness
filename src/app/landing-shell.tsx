"use client";

import { useState } from "react";
import { TopBanner } from "@/components/landing/TopBanner";
import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { TrustBar } from "@/components/landing/TrustBar";
import { SocialProofSection } from "@/components/landing/SocialProofSection";
import { WhyWalletSection } from "@/components/landing/WhyWalletSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { UseCasesSection } from "@/components/landing/UseCasesSection";
import { WalletStatsSection } from "@/components/landing/WalletStatsSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { CTASection } from "@/components/landing/CTASection";
import { Footer } from "@/components/landing/Footer";
import { StickyMobileCTA } from "@/components/landing/StickyMobileCTA";

export function LandingShell() {
  const [bannerVisible, setBannerVisible] = useState(true);

  return (
    <>
      <TopBanner onDismiss={() => setBannerVisible(false)} />
      <div style={{ paddingTop: bannerVisible ? 52 : 0 }}>
        <Navbar bannerVisible={bannerVisible} />
        <main>
          <HeroSection />
          <TrustBar />
          <SocialProofSection />
          <WhyWalletSection />
          <HowItWorksSection />
          <FeaturesSection />
          <UseCasesSection />
          <WalletStatsSection />
          <PricingSection />
          <FAQSection />
          <CTASection />
        </main>
        <Footer />
      </div>
      <StickyMobileCTA />
    </>
  );
}
