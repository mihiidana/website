// @ts-check

import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";

// https://astro.build/config
// Fully static site — no adapter needed.
// For Cloudflare Workers static deploy, see wrangler.jsonc:
// astro build && wrangler deploy
export default defineConfig({
  output: "static",

  image: {
    // Only these hosts may be downloaded and optimized at build time.
    domains: ["img.youtube.com"],
  },

  devToolbar: {
    enabled: false,
  },

  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
  },

  fonts: [
    {
      name: "Satoshi",
      cssVariable: "--font-satoshi",
      provider: fontProviders.fontshare(),
      weights: ["300 900"],
      styles: ["normal", "italic"],
      subsets: ["latin"],
      fallbacks: ["sans-serif"],
    },
    {
      name: "Caveat",
      cssVariable: "--font-caveat",
      provider: fontProviders.fontsource(),
      weights: ["400 700"],
      styles: ["normal"],
      subsets: ["latin"],
      fallbacks: ["cursive"],
    },
  ],
});
