"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Camera, Link2 } from "lucide-react";

/**
 * Formulaire « collez le lien de votre commerce » de la landing (Hero et
 * bloc final). Il ne fait que rediriger : /essai?url=… lance la création
 * d'office, /essai sans lien affiche le générateur. Toute la validation
 * (lien, nom tapé à la place d'un lien, pseudo @instagram…) vit dans /essai,
 * pour qu'il n'y ait qu'un seul comportement à maintenir.
 */

/** Même borne que le générateur : au-delà, ce n'est plus un lien de commerce. */
const MAX_LINK_LENGTH = 2048;

export function EssaiLinkForm({
  variant = "light",
  className = "",
  placeholder = "Collez le lien de votre commerce",
}: {
  /** `light` sur fond beige/blanc, `dark` sur le bloc noir de fin de page. */
  variant?: "light" | "dark";
  className?: string;
  /** À raccourcir là où le champ est étroit à 360 px (texte coupé sinon). */
  placeholder?: string;
}) {
  const router = useRouter();
  const inputId = useId();
  const [value, setValue] = useState("");
  const dark = variant === "dark";

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const link = value.trim().slice(0, MAX_LINK_LENGTH);
    router.push(link ? `/essai?url=${encodeURIComponent(link)}` : "/essai");
  }

  return (
    <form onSubmit={submit} noValidate className={className}>
      <label htmlFor={inputId} className="sr-only">
        Lien de votre commerce (site web, Google Maps ou Instagram)
      </label>
      <div
        className={`flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-1.5 sm:rounded-full sm:p-1.5 sm:shadow-xl ${
          dark
            ? "sm:bg-white/10 sm:ring-1 sm:ring-white/20 sm:focus-within:ring-yellow"
            : "sm:bg-white sm:ring-1 sm:ring-foreground/10 sm:focus-within:ring-2 sm:focus-within:ring-foreground"
        }`}
      >
        {/* Sur mobile, le champ est une pastille autonome (bordure + ombre) ;
            à partir de sm, c'est le conteneur qui porte la pastille. */}
        <div className="relative min-w-0 flex-1">
          <Link2
            size={20}
            className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 ${
              dark ? "text-white/50" : "text-foreground/40"
            }`}
            aria-hidden
          />
          <input
            id={inputId}
            type="text"
            inputMode="url"
            autoComplete="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            maxLength={MAX_LINK_LENGTH}
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={`h-14 w-full rounded-full pl-12 pr-4 text-base outline-none transition-colors focus:ring-2 sm:h-12 sm:bg-transparent sm:shadow-none sm:focus:ring-0 ${
              dark
                ? "border border-white/20 bg-white/10 text-white placeholder:text-white/50 focus:ring-yellow sm:border-0"
                : "border border-foreground/10 bg-white text-foreground shadow-lg placeholder:text-foreground/45 focus:ring-foreground sm:border-0"
            }`}
            style={{ fontFamily: "var(--font-maison-neue)" }}
          />
        </div>
        <button
          type="submit"
          className={`inline-flex h-14 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 text-base font-semibold shadow-lg transition-colors focus-visible:outline-none focus-visible:ring-4 cursor-pointer sm:h-12 sm:shadow-none ${
            dark
              ? "bg-yellow text-foreground hover:bg-yellow-hover focus-visible:ring-white/50"
              : "bg-foreground text-white hover:bg-foreground/90 focus-visible:ring-yellow"
          }`}
          style={{ fontFamily: "var(--font-maison-neue-extended)" }}
        >
          Créer ma carte en 30&nbsp;s
          <ArrowRight size={18} aria-hidden />
        </button>
      </div>

      <Link
        href="/essai?mode=photo"
        className={`mt-2 inline-flex min-h-[44px] items-center gap-2 rounded-md text-sm font-semibold underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 ${
          dark
            ? "text-white/80 hover:text-yellow focus-visible:ring-white/60"
            : "text-foreground/80 hover:text-foreground focus-visible:ring-foreground"
        }`}
        style={{ fontFamily: "var(--font-maison-neue-extended)" }}
      >
        <Camera size={16} aria-hidden />
        ou prenez une photo de votre enseigne
      </Link>
    </form>
  );
}
