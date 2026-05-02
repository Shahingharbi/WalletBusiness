import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LandingShell } from "./landing-shell";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://aswallet.fr";

// JSON-LD structured data — helps Google build rich result cards for the
// brand, the product offering and the site's search box.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}#organization`,
      name: "aswallet",
      url: SITE_URL,
      logo: `${SITE_URL}/icon-512.png`,
      sameAs: [],
      contactPoint: [
        {
          "@type": "ContactPoint",
          email: "contact@aswallet.fr",
          contactType: "customer support",
          areaServed: "FR",
          availableLanguage: ["French"],
        },
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}#website`,
      url: SITE_URL,
      name: "aswallet",
      inLanguage: "fr-FR",
      publisher: { "@id": `${SITE_URL}#organization` },
    },
    {
      "@type": "Product",
      name: "aswallet",
      description:
        "Carte de fidélité digitale pour commerces de proximité, compatible Apple Wallet et Google Wallet.",
      brand: { "@id": `${SITE_URL}#organization` },
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "EUR",
        lowPrice: "49",
        highPrice: "199",
        offerCount: 3,
        url: `${SITE_URL}/#pricing`,
      },
    },
  ],
};

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingShell />
    </>
  );
}
