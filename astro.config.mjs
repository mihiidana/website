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

  devToolbar: {
    enabled: false,
  },

  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
  },

  fonts: [
    {
      name: "Inter",
      cssVariable: "--font-inter",
      provider: fontProviders.fontsource(),
      weights: ["100 900"],
      styles: ["normal"],
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
