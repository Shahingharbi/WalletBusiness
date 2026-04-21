import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-foreground text-white pt-16 pb-8">
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          <div>
            <Link href="/" className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: "var(--font-ginto-nord)" }}>
              aswallet
            </Link>
            <p className="mt-4 text-sm text-white/60 leading-relaxed" style={{ fontFamily: "var(--font-maison-neue)" }}>
              La carte de fidelite digitale pour les commerces de proximite.
              Apple Wallet & Google Wallet.
            </p>
            <p className="mt-6 text-sm text-white/60" style={{ fontFamily: "var(--font-maison-neue)" }}>
              Fait avec <span className="text-red-400">&#10084;</span> en France
            </p>
          </div>

          <div>
            <h4 className="text-base font-semibold mb-4" style={{ fontFamily: "var(--font-maison-neue-extended)" }}>
              Produit
            </h4>
            <ul className="space-y-2">
              <li><a href="#features" className="text-sm text-white/70 hover:text-white transition-colors" style={{ fontFamily: "var(--font-maison-neue)" }}>Fonctionnalites</a></li>
              <li><a href="#how-it-works" className="text-sm text-white/70 hover:text-white transition-colors" style={{ fontFamily: "var(--font-maison-neue)" }}>Comment ca marche</a></li>
              <li><a href="#pricing" className="text-sm text-white/70 hover:text-white transition-colors" style={{ fontFamily: "var(--font-maison-neue)" }}>Tarifs</a></li>
              <li><a href="#stats" className="text-sm text-white/70 hover:text-white transition-colors" style={{ fontFamily: "var(--font-maison-neue)" }}>Le wallet en chiffres</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-base font-semibold mb-4" style={{ fontFamily: "var(--font-maison-neue-extended)" }}>
              Compte
            </h4>
            <ul className="space-y-2">
              <li><Link href="/login" className="text-sm text-white/70 hover:text-white transition-colors" style={{ fontFamily: "var(--font-maison-neue)" }}>Se connecter</Link></li>
              <li><Link href="/register" className="text-sm text-white/70 hover:text-white transition-colors" style={{ fontFamily: "var(--font-maison-neue)" }}>S&apos;inscrire</Link></li>
              <li><Link href="/forgot-password" className="text-sm text-white/70 hover:text-white transition-colors" style={{ fontFamily: "var(--font-maison-neue)" }}>Mot de passe oublie</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-base font-semibold mb-4" style={{ fontFamily: "var(--font-maison-neue-extended)" }}>
              Contact & legal
            </h4>
            <ul className="space-y-2">
              <li><Link href="/contact" className="text-sm text-white/70 hover:text-white transition-colors" style={{ fontFamily: "var(--font-maison-neue)" }}>Contact</Link></li>
              <li><Link href="/privacy" className="text-sm text-white/70 hover:text-white transition-colors" style={{ fontFamily: "var(--font-maison-neue)" }}>Confidentialite</Link></li>
              <li><Link href="/terms" className="text-sm text-white/70 hover:text-white transition-colors" style={{ fontFamily: "var(--font-maison-neue)" }}>CGU</Link></li>
              <li>
                <a href="mailto:contact@aswallet.fr" className="text-sm text-white/70 hover:text-white transition-colors" style={{ fontFamily: "var(--font-maison-neue)" }}>
                  contact@aswallet.fr
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs text-white/40">&copy; 2026 aswallet &middot; SIRET 903 950 210 00026 &middot; Edite par Shahin Gharbi</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/contact" className="text-xs text-white/40 hover:text-white/70 transition-colors">Contact</Link>
            <Link href="/terms" className="text-xs text-white/40 hover:text-white/70 transition-colors">CGU</Link>
            <Link href="/privacy" className="text-xs text-white/40 hover:text-white/70 transition-colors">Confidentialite</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
