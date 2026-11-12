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
    // Hash-based CSP emitted as a <meta> tag on every page. Policy intent:
    //
    // - Scripts: 'self' plus per-page hashes. Astro hashes the scripts it
    //   bundles; the inline theme bootstrap registers its hash in Layout.astro
    //   and Base UI's slider prehydration script is hashed from the package
    //   (see above). No 'unsafe-inline', ever.
    // - Styles: 'self' plus hashes for <style> elements, and 'unsafe-inline'
    //   scoped to style ATTRIBUTES only — Base UI positions elements with
    //   style="" (e.g. the slider thumb).
    // - Everything the site actually loads is same-origin: scripts, styles,
    //   fonts (Astro adds font-src 'self' itself), images, and the audio file.
    // - default-src 'self' is the fallback for any category not listed below
    //   (manifest, worker, prefetch, ...). Every directive below still
    //   overrides it. form-action 'self' blocks cross-origin form posts; the
    //   site has no forms, so it costs nothing.
    // - frame-ancestors is NOT enforced from a meta tag. Clickjacking
    //   protection comes from X-Frame-Options: DENY in public/_headers,
    //   applied by Cloudflare Workers.
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
      directives: [
        "default-src 'self'",
        "form-action 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "img-src 'self' data:",
        "media-src 'self'",
        "connect-src 'self'",
        "frame-src 'none'",
      ],
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
