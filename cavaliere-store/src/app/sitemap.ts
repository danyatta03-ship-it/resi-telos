import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const routes = [
  "",
  "/configuratore",
  "/galleria",
  "/chi-sono",
  "/contatti",
  "/privacy-policy",
  "/cookie-policy",
  "/termini",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://cavaliere.store";
  return routes.map((route) => ({
    url: `${base}${route}`,
    lastModified: new Date(),
  }));
}
