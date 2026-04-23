import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard/",
        "/settings/",
        "/scanner/",
        "/cards/",
        "/clients/",
      ],
    },
    sitemap: "https://aswallet.fr/sitemap.xml",
  };
}
