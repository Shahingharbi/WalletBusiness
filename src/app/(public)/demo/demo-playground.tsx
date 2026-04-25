"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { CardPreview } from "@/components/cards/card-preview";
import { CARD_TEMPLATES } from "@/lib/card-templates";
import { DEFAULT_CARD_DESIGN } from "@/lib/constants";

const STAMP_OPTIONS = [5, 8, 10, 12, 15];

const TEMPLATE_OPTIONS = CARD_TEMPLATES.filter((t) => t.id !== "scratch");

export function DemoPlayground() {
  const [businessName, setBusinessName] = useState("Mon Commerce");
  const [templateId, setTemplateId] = useState<string>(
    TEMPLATE_OPTIONS[0]?.id ?? "kebab"
  );
  const [accentColor, setAccentColor] = useState<string>(
    TEMPLATE_OPTIONS[0]?.design.accent_color ?? "#dc2626"
  );
  const [stampCount, setStampCount] = useState<number>(10);
  const [rewardText, setRewardText] = useState<string>(
    TEMPLATE_OPTIONS[0]?.rewardText ?? "Un kebab offert !"
  );

  const template = useMemo(
    () =>
      TEMPLATE_OPTIONS.find((t) => t.id === templateId) ?? TEMPLATE_OPTIONS[0],
    [templateId]
  );

  const design = useMemo(() => {
    return {
      ...DEFAULT_CARD_DESIGN,
      ...template.design,
      accent_color: accentColor,
    };
  }, [template, accentColor]);

  const onTemplateChange = (id: string) => {
    setTemplateId(id);
    const t = TEMPLATE_OPTIONS.find((x) => x.id === id);
    if (t) {
      setAccentColor(t.design.accent_color);
      setStampCount(t.stampCount);
      setRewardText(t.rewardText);
    }
  };

  const registerHref = useMemo(() => {
    const params = new URLSearchParams();
    if (businessName.trim()) params.set("business", businessName.trim());
    if (accentColor) params.set("color", accentColor);
    if (templateId) params.set("industry", templateId);
    return `/register?${params.toString()}`;
  }, [businessName, accentColor, templateId]);

  return (
    <div className="bg-beige min-h-screen">
      {/* Top bar */}
      <header className="border-b border-foreground/10 bg-beige/80 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm font-semibold text-foreground hover:opacity-70 transition-opacity"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            ← aswallet
          </Link>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider bg-yellow text-foreground px-2.5 py-1 rounded-full">
            <Sparkles className="h-3 w-3" />
            Démo en direct
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-4 sm:px-6 py-8 sm:py-12 pb-32 lg:pb-12">
        <div className="text-center max-w-2xl mx-auto">
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl text-foreground"
            style={{
              fontFamily: "var(--font-ginto-nord)",
              fontWeight: 500,
            }}
          >
            Testez votre carte en{" "}
            <span className="bg-yellow px-2 rounded-md">30 secondes</span>
          </h1>
          <p
            className="mt-4 text-sm sm:text-base text-foreground/70"
            style={{ fontFamily: "var(--font-maison-neue)" }}
          >
            Modifiez les couleurs, les tampons, la récompense — l&apos;aperçu se
            met à jour en direct. Aucune inscription nécessaire.
          </p>
        </div>

        <div className="mt-8 sm:mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-start">
          {/* Controls */}
          <section className="space-y-5 order-2 lg:order-1">
            <div className="space-y-1.5">
              <label
                htmlFor="demo-business"
                className="block text-sm font-semibold text-foreground"
              >
                Nom de votre commerce
              </label>
              <input
                id="demo-business"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Ex : Boulangerie du Marché"
                maxLength={40}
                className="flex h-11 w-full rounded-lg border border-foreground/15 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground focus:border-transparent"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="demo-industry"
                className="block text-sm font-semibold text-foreground"
              >
                Type de commerce
              </label>
              <select
                id="demo-industry"
                value={templateId}
                onChange={(e) => onTemplateChange(e.target.value)}
                className="flex h-11 w-full rounded-lg border border-foreground/15 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground focus:border-transparent"
              >
                {TEMPLATE_OPTIONS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.emoji} {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="demo-color"
                className="block text-sm font-semibold text-foreground"
              >
                Couleur d&apos;accent
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="demo-color"
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-11 w-14 rounded-lg border border-foreground/15 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="flex h-11 w-32 rounded-lg border border-foreground/15 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-foreground focus:border-transparent"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="demo-stamps"
                className="block text-sm font-semibold text-foreground"
              >
                Nombre de tampons
              </label>
              <select
                id="demo-stamps"
                value={stampCount}
                onChange={(e) => setStampCount(Number(e.target.value))}
                className="flex h-11 w-full rounded-lg border border-foreground/15 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground focus:border-transparent"
              >
                {STAMP_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} tampons
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="demo-reward"
                className="block text-sm font-semibold text-foreground"
              >
                Récompense
              </label>
              <textarea
                id="demo-reward"
                rows={2}
                maxLength={80}
                value={rewardText}
                onChange={(e) => setRewardText(e.target.value)}
                placeholder="Ex : Un café offert !"
                className="flex w-full rounded-lg border border-foreground/15 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground focus:border-transparent resize-none"
              />
            </div>

            <div className="hidden lg:block pt-4">
              <Link
                href={registerHref}
                className="rounded-full bg-foreground px-6 py-3.5 text-sm font-semibold text-white hover:bg-foreground/90 transition-colors inline-flex items-center justify-center gap-2 shadow-lg w-full"
                style={{ fontFamily: "var(--font-maison-neue-extended)" }}
              >
                Lancer mon vrai compte
                <ArrowRight size={18} />
              </Link>
              <p
                className="mt-3 text-xs text-foreground/60 text-center"
                style={{ fontFamily: "var(--font-maison-neue)" }}
              >
                14 jours d&apos;essai &middot; Sans CB &middot; Sans engagement
              </p>
            </div>
          </section>

          {/* Live preview */}
          <section className="order-1 lg:order-2 lg:sticky lg:top-24">
            <CardPreview
              cardName={template.name}
              stampCount={stampCount}
              rewardText={rewardText}
              collectedStamps={Math.max(1, Math.floor(stampCount * 0.6))}
              design={design}
              cardType={template.type}
              businessName={businessName || "Votre commerce"}
              barcodeType="qr"
            />
          </section>
        </div>
      </main>

      {/* Sticky mobile CTA */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-foreground/10 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.15)]">
        <div className="mx-auto max-w-[1280px] px-4 py-3 flex items-center gap-3">
          <div className="hidden sm:block flex-1">
            <p
              className="text-xs font-semibold text-foreground"
              style={{ fontFamily: "var(--font-maison-neue-extended)" }}
            >
              Inscription gratuite — 14 jours d&apos;essai
            </p>
            <p className="text-[11px] text-foreground/60">
              Sans CB, sans engagement
            </p>
          </div>
          <Link
            href={registerHref}
            className="flex-1 sm:flex-none rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-white hover:bg-foreground/90 transition-colors inline-flex items-center justify-center gap-2 shadow-lg min-h-[48px]"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            Lancer mon compte
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
