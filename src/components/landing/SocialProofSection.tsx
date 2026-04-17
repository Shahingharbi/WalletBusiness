export function SocialProofSection() {
  const brands = [
    { name: "McDonald's", color: "#DA291C" },
    { name: "Sephora", color: "#000000" },
    { name: "Decathlon", color: "#0082C3" },
    { name: "Carrefour", color: "#004E9A" },
    { name: "Lacoste", color: "#004526" },
    { name: "Yves Rocher", color: "#4A7C2E" },
    { name: "KFC", color: "#E4002B" },
    { name: "Etam", color: "#000000" },
  ];

  return (
    <section className="bg-white py-16 lg:py-20">
      <div className="mx-auto max-w-[1280px] px-6">
        <p
          className="text-center text-sm text-muted-foreground mb-10"
          style={{ fontFamily: "var(--font-maison-neue)" }}
        >
          Le wallet mobile est deja adopte par les plus grandes enseignes francaises.
          Nous rendons cette technologie accessible a votre commerce.
        </p>

        <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-8">
          {brands.map((brand) => (
            <div
              key={brand.name}
              className="flex items-center justify-center opacity-40 hover:opacity-70 transition-opacity"
            >
              <span
                className="text-lg lg:text-xl font-bold tracking-tight"
                style={{
                  fontFamily: "var(--font-maison-neue-extended)",
                  color: brand.color,
                }}
              >
                {brand.name}
              </span>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground/50 mt-8">
          Ces enseignes utilisent le wallet mobile via des plateformes comme Captain Wallet.
          Source : captainwallet.com
        </p>
      </div>
    </section>
  );
}
