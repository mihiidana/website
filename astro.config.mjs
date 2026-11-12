// @ts-check

import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";

import { site } from "./src/lib/site";

// Base UI's slider renders a prehydration <script> inline from the React
// island's SSR output, so Astro can't hash it automatically. Its content is
// static per dependency version — hash it here so the CSP allows exactly
// that script. Resolved with createRequire because the prehydration module
// is not exported under "import" conditions.
const requireFromProject = createRequire(join(process.cwd(), "package.json"));
const baseUiDir = dirname(requireFromProject.resolve("@base-ui/react/package.json"));
const { script: sliderPrehydrationScript } = requireFromProject(
  join(baseUiDir, "slider/thumb/prehydrationScript.min.js"),
);
const sliderPrehydrationHash = /** @type {`sha256-${string}`} */ (
  `sha256-${createHash("sha256").update(sliderPrehydrationScript).digest("base64")}`
);

// https://astro.build/config
// Fully static site — no adapter needed.
// For Cloudflare Workers static deploy, see wrangler.jsonc:
// astro build && wrangler deploy
export default defineConfig({
  output: "static",

  // Single source of truth for the public URL (also used for canonical URLs).
  site: site.url,

  image: {
    // Only these hosts may be downloaded and optimized at build time.
    domains: ["img.youtube.com"],
  },

  devToolbar: {
    enabled: false,
  },

  integrations: [react()],

  security: {
    // Hash-based CSP emitted as a <meta> tag on every page. Bundled scripts
    // and styles are hashed automatically; the one is:inline script (the
    // theme bootstrap in Layout.astro) registers its hash at render time.
    // Never add 'unsafe-inline' to script-src.
    csp: {
      scriptDirective: {
        resources: ["'self'"],
        hashes: [sliderPrehydrationHash],
      },
      styleDirective: {
        // `resources` replaces Astro's defaults, so 'self' must be re-added
        // for style elements (they stay hash-locked). Base UI renders
        // positioned elements with style="" attributes (e.g. the slider
        // thumb), so 'unsafe-inline' is scoped to attributes only.
        resources: [
          { resource: "'self'", kind: "element" },
          { resource: "'unsafe-inline'", kind: "attribute" },
        ],
      },
      directives: ["object-src 'none'", "base-uri 'self'"],
    },
  },

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
