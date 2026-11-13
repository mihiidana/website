/**
 * The web app manifest is generated from `site.ts` and the theme tokens, so the
 * installed name, description, language, and chrome colors cannot drift from
 * the rest of the site.
 */
import type { APIRoute } from "astro";

import { site } from "@/lib/site";
import { THEME_COLORS } from "@/lib/theme";

export const GET: APIRoute = () => {
  const manifest = {
    name: site.name,
    short_name: site.name,
    description: site.description,
    lang: site.seo.lang,
    start_url: "/",
    scope: "/",
    display: "standalone",
    theme_color: THEME_COLORS.dark,
    background_color: THEME_COLORS.dark,
    icons: [
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  };

  return new Response(`${JSON.stringify(manifest, null, 2)}\n`, {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8" },
  });
};
