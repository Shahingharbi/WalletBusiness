import type { MetadataRoute } from "next";

const BASE_URL = "https://aswallet.fr";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const publicPaths = ["", "/login", "/register", "/contact", "/privacy", "/terms"];

  return publicPaths.map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified,
  }));
}
