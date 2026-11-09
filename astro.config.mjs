// @ts-check

import { defineConfig } from "astro/config";

// https://astro.build/config
// Fully static site — no adapter needed.
// For Cloudflare Workers static deploy, see wrangler.jsonc:
// astro build && wrangler deploy
export default defineConfig({
  output: "static",
  devToolbar: {
    enabled: false,
  },
});
