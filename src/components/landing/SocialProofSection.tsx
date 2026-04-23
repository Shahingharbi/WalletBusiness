const BRANDS: { slug: string; name: string }[] = [
  { slug: "starbucks", name: "Starbucks" },
  { slug: "mcdonalds", name: "McDonald's" },
  { slug: "nike", name: "Nike" },
  { slug: "adidas", name: "Adidas" },
  { slug: "airfrance", name: "Air France" },
  { slug: "sncf", name: "SNCF" },
  { slug: "fnac", name: "Fnac" },
  { slug: "ikea", name: "IKEA" },
  { slug: "carrefour", name: "Carrefour" },
  { slug: "zara", name: "Zara" },
  { slug: "uniqlo", name: "Uniqlo" },
];

export function SocialProofSection() {
  // Duplicate the list so the -50% translate loops seamlessly.
  const loop = [...BRANDS, ...BRANDS];

  return (
    <section className="bg-white py-10 sm:py-16 lg:py-20 overflow-hidden">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <p
          className="text-center text-xs sm:text-sm text-muted-foreground mb-6 sm:mb-10"
          style={{ fontFamily: "var(--font-maison-neue)" }}
        >
          La technologie wallet qui équipe déjà les plus grandes marques mondiales
        </p>

        <div
          className="relative overflow-hidden"
          style={{
            maskImage:
              "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
          }}
        >
          <div className="flex w-max animate-marquee gap-10 sm:gap-16 lg:gap-20">
            {loop.map((brand, i) => (
              <div
                key={`${brand.slug}-${i}`}
                className="flex shrink-0 items-center justify-center"
                aria-hidden={i >= BRANDS.length ? true : undefined}
              >
                <img
                  src={`https://cdn.simpleicons.org/${brand.slug}`}
                  alt={i < BRANDS.length ? brand.name : ""}
                  loading="lazy"
                  decoding="async"
                  className="h-7 sm:h-9 lg:h-11 w-auto max-w-full opacity-90 hover:opacity-100 transition-opacity duration-300"
                />
              </div>
            ))}
          </div>
        </div>

        <p
          className="text-center text-xs sm:text-sm text-muted-foreground mt-6 sm:mt-10"
          style={{ fontFamily: "var(--font-maison-neue)" }}
        >
          Rendez cette expérience accessible à votre commerce.
        </p>
      </div>
    </section>
  );
}
