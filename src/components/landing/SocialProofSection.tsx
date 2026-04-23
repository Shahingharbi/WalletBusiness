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
    <section className="bg-white py-16 lg:py-20">
      <div className="mx-auto max-w-[1280px] px-6">
        <p
          className="text-center text-sm text-muted-foreground mb-10"
          style={{ fontFamily: "var(--font-maison-neue)" }}
        >
          La technologie wallet qui equipe deja les plus grandes marques mondiales
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
          <div className="flex w-max animate-marquee gap-16 lg:gap-20">
            {loop.map((brand, i) => (
              <div
                key={`${brand.slug}-${i}`}
                className="flex shrink-0 items-center justify-center"
                aria-hidden={i >= BRANDS.length ? true : undefined}
              >
                <img
                  src={`https://cdn.simpleicons.org/${brand.slug}/666666`}
                  alt={i < BRANDS.length ? brand.name : ""}
                  loading="lazy"
                  decoding="async"
                  className="h-8 lg:h-10 w-auto opacity-50 hover:opacity-90 transition-opacity duration-300"
                />
              </div>
            ))}
          </div>
        </div>

        <p
          className="text-center text-sm text-muted-foreground mt-10"
          style={{ fontFamily: "var(--font-maison-neue)" }}
        >
          Rendez cette experience accessible a votre commerce.
        </p>
      </div>
    </section>
  );
}
