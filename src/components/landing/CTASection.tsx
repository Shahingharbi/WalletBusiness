"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

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
      <div className="mx-auto max-w-[1280px] rounded-[20px] bg-yellow px-8 lg:px-12 py-16 lg:py-20">
        <div className="max-w-2xl mx-auto text-center">
          <h2
            className="text-3xl lg:text-[48px] lg:leading-[56px] font-semibold"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            Pret a fideliser vos clients autrement ?
          </h2>
          <p className="mt-4 text-base text-foreground/70" style={{ fontFamily: "var(--font-maison-neue)" }}>
            Rejoignez les commercants qui passent a la fidelisation digitale.
            14 jours d&apos;essai gratuit, sans engagement.
          </p>

          <form onSubmit={submit} className="mt-10 max-w-md mx-auto">
            <div className="space-y-3">
              <input
                type="email"
                required
                placeholder="Votre email professionnel"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-full border border-foreground/20 bg-white px-6 py-3.5 text-base outline-none focus:border-foreground transition-colors"
                style={{ fontFamily: "var(--font-maison-neue)" }}
              />
              <input
                type="text"
                placeholder="Nom de votre commerce"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full rounded-full border border-foreground/20 bg-white px-6 py-3.5 text-base outline-none focus:border-foreground transition-colors"
                style={{ fontFamily: "var(--font-maison-neue)" }}
              />
              <button
                type="submit"
                className="w-full rounded-full bg-foreground px-8 py-3.5 text-base font-semibold text-white hover:bg-foreground/90 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                style={{ fontFamily: "var(--font-maison-neue-extended)" }}
              >
                Demarrer mon essai gratuit
                <ArrowRight size={18} />
              </button>
            </div>
            <p className="mt-3 text-xs text-foreground/50">
              14 jours gratuits. Sans carte bancaire. Sans engagement.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
