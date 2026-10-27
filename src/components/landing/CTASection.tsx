import { ShieldCheck, Globe, Lock } from "lucide-react";
import { EssaiLinkForm } from "./EssaiLinkForm";

/**
 * Bloc final de la landing. Même formulaire « lien du commerce » que le Hero :
 * le visiteur repart avec sa vraie carte en 30 s (/essai), sans créer de
 * compte d'abord — l'inscription se fait ensuite via « Je garde ma carte ».
 */
export function CTASection() {
  return (
    <section className="px-4 sm:px-6 py-6" id="contact">
      <div className="relative overflow-hidden mx-auto max-w-[1280px] rounded-[20px] bg-foreground px-5 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-28">
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
            className="text-[28px] leading-[1.2] sm:text-4xl lg:text-[56px] lg:leading-[64px] font-semibold text-white"
            style={{ fontFamily: "var(--font-maison-neue-extended)" }}
          >
            Votre carte de fidélité{" "}
            <span className="bg-yellow text-foreground px-3 rounded-lg [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
              en 30&nbsp;secondes
            </span>
          </h2>
          <p
            className="mt-6 text-base lg:text-lg text-white/70"
            style={{ fontFamily: "var(--font-maison-neue)" }}
          >
            Collez le lien de votre commerce&nbsp;: on récupère votre logo et
            vos couleurs, et votre vraie carte s&apos;ajoute à votre téléphone.
            Testez-la, puis gardez-la si elle vous plaît.
          </p>

          <EssaiLinkForm
            variant="dark"
            placeholder="Le lien de votre commerce"
            className="mt-10 max-w-xl mx-auto"
          />
          <p className="mt-2 text-xs text-white/50">
            Site web, Google Maps ou Instagram &middot; Sans inscription
          </p>

          {/* Trust badges row */}
          <div
            className="mt-12 pt-8 border-t border-white/10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-white/70"
            style={{ fontFamily: "var(--font-maison-neue)" }}
          >
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={14} aria-hidden />
              Conforme RGPD
            </span>
            <span className="h-3 w-px bg-white/20 hidden sm:block" />
            <span className="inline-flex items-center gap-1.5">
              <Globe size={14} aria-hidden />
              Hébergé en Europe
            </span>
            <span className="h-3 w-px bg-white/20 hidden sm:block" />
            <span className="inline-flex items-center gap-1.5">
              <Lock size={14} aria-hidden />
              Chiffrement SSL
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
