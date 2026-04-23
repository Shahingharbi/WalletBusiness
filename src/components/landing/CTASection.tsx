"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck, Globe, Lock, Clock } from "lucide-react";

export function CTASection() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (email) params.set("email", email);
    if (businessName) params.set("business", businessName);
    router.push(`/register?${params.toString()}`);
  };

  return (
    <section className="px-6 py-6" id="contact">
      <div className="relative overflow-hidden mx-auto max-w-[1280px] rounded-[20px] bg-foreground px-8 lg:px-12 py-20 lg:py-28">
        {/* Decorative glow */}
        <div
          aria-hidden
          className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-yellow/30 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-yellow/20 blur-3xl"
        />

        <div className="relative max-w-2xl mx-auto text-center">
          <span
            className="inline-block bg-yellow text-foreground text-xs font-bold px-3 py-1 rounded-full uppercase mb-6"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            C&apos;est parti
          </span>
          <h2
            className="text-4xl lg:text-[56px] lg:leading-[64px] font-semibold text-white"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            Lancez votre carte de fidelite{" "}
            <span className="bg-yellow text-foreground px-3 rounded-lg">
              en 5 minutes
            </span>
          </h2>
          <p
            className="mt-6 text-base lg:text-lg text-white/70"
            style={{ fontFamily: "var(--font-maison-neue)" }}
          >
            Rejoignez les commercants qui ont arrete d&apos;imprimer des cartes
            papier. 14 jours d&apos;essai, sans CB, sans engagement.
          </p>

          <form onSubmit={submit} className="mt-10 max-w-md mx-auto">
            <div className="space-y-3">
              <input
                type="email"
                required
                placeholder="Votre email professionnel"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-full border border-white/20 bg-white/5 backdrop-blur px-6 py-4 text-base text-white placeholder:text-white/40 outline-none focus:border-yellow focus:bg-white focus:text-foreground focus:placeholder:text-foreground/40 transition-colors"
                style={{ fontFamily: "var(--font-maison-neue)" }}
              />
              <input
                type="text"
                placeholder="Nom de votre commerce (optionnel)"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full rounded-full border border-white/20 bg-white/5 backdrop-blur px-6 py-4 text-base text-white placeholder:text-white/40 outline-none focus:border-yellow focus:bg-white focus:text-foreground focus:placeholder:text-foreground/40 transition-colors"
                style={{ fontFamily: "var(--font-maison-neue)" }}
              />
              <button
                type="submit"
                className="w-full rounded-full bg-yellow px-8 py-4 text-base font-semibold text-foreground hover:bg-yellow-hover transition-colors inline-flex items-center justify-center gap-2 cursor-pointer shadow-xl"
                style={{ fontFamily: "var(--font-maison-neue-extended)" }}
              >
                Demarrer mon essai gratuit
                <ArrowRight size={18} />
              </button>
            </div>
            <p className="mt-4 text-xs text-white/50">
              14 jours gratuits &middot; Sans carte bancaire &middot; Sans engagement
            </p>
          </form>

          {/* Trust badges row */}
          <div
            className="mt-12 pt-8 border-t border-white/10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-white/70"
            style={{ fontFamily: "var(--font-maison-neue)" }}
          >
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={14} />
              Conforme RGPD
            </span>
            <span className="h-3 w-px bg-white/20 hidden sm:block" />
            <span className="inline-flex items-center gap-1.5">
              <Globe size={14} />
              Heberge en Europe
            </span>
            <span className="h-3 w-px bg-white/20 hidden sm:block" />
            <span className="inline-flex items-center gap-1.5">
              <Lock size={14} />
              Chiffrement SSL
            </span>
            <span className="h-3 w-px bg-white/20 hidden sm:block" />
            <span className="inline-flex items-center gap-1.5">
              <Clock size={14} />
              14 jours offerts
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
