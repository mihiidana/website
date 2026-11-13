// @ts-check

import { satteri, satteriHeadingIdsPlugin } from "@astrojs/markdown-satteri";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import svelte from "@astrojs/svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";

import { articleImageSizesPlugin } from "./src/lib/article-image-sizes";
import { headingPermalinksPlugin } from "./src/lib/heading-permalinks";
import { ogImageCheck } from "./src/lib/og/integration";
import { remoteImages } from "./src/lib/remote-images";
import { site } from "./src/lib/site";

// https://astro.build/config
// Fully static site — no adapter needed.
// For Cloudflare Workers static deploy, see wrangler.jsonc:
// astro build && wrangler deploy
export default defineConfig({
  output: "static",

  // Single source of truth for the public URL (also used for canonical URLs).
  site: site.url,

  image: {
    // Any publicly accessible HTTPS image URL may be optimized at build time.
    // An empty pattern authorizes every host: `matchHostname()` returns true
    // when `hostname` is omitted, so `protocol` is the only constraint and the
    // hostname never has to be listed. That is deliberate — a post may use
    // ImgBB, Reddit, Imgur, a personal CDN, or something that does not exist
    // yet, without editing this file. HTTP stays unauthorized; redirects are
    // validated against the same patterns. See docs/writing.md → Images.
    remotePatterns: [{ protocol: "https" }],

    // The hostname allowlist this replaces (`domains`) is gone: it only ever
    // permitted one provider. Everything the site ships is now processed by
    // Astro's own sharp service, locally or remotely.
    //
    // `constrained` makes every processed image — including plain Markdown
    // `![]()` and remote ones — scale down to its container but never past its
    // intrinsic width, and emits `srcset`, `sizes`, and `data-astro-image`.
    layout: "constrained",

    // Enable Astro's responsive styles. They ship inside `@layer astro.images`,
    // a layer declared after Tailwind's, so `@tailwindcss/typography` rules on
    // `.prose img` still win. src/styles/prose.css only adds what Astro cannot
    // know: prose margin on `<picture>`.
    responsiveStyles: true,

    // Article bodies are never wider than the shared `max-w-3xl` container, so
    // Astro's default ladder (up to 6016px) would emit variants no reader can
    // display. These cover 1x and 2x at mobile through desktop widths.
    breakpoints: [320, 480, 640, 768, 960, 1280],
  },

  devToolbar: {
    enabled: false,
  },

  // `remoteImages()` must run before `mdx()` resolves the Markdown processor
  // at `astro:config:done`, so it is listed first. See src/lib/remote-images.ts.
  integrations: [remoteImages(), svelte(), mdx(), sitemap(), ogImageCheck()],

  markdown: {
    // Astro 7's default Markdown processor is Sätteri; naming it here is what
    // lets the pipeline take HAST plugins. Heading IDs are Astro's job, so
    // `satteriHeadingIdsPlugin()` runs first and the permalink plugin only
    // decorates the IDs it has already assigned. `.md` and `.mdx` share this
    // processor, so both formats get identical anchors.
    processor: satteri({
      hastPlugins: [satteriHeadingIdsPlugin(), headingPermalinksPlugin, articleImageSizesPlugin],
    }),
    // Dual Shiki themes: code blocks follow the light/dark toggle. Light is
    // inlined as the default color; the dark palette is applied by the
    // `.dark .astro-code` rules in src/styles/prose.css.
    shikiConfig: {
      themes: { light: "github-light-high-contrast", dark: "github-dark-high-contrast" },
      defaultColor: "light",
      wrap: true,
    },
  },

  security: {
    // Hash-based CSP emitted as a <meta> tag on every page. Policy intent:
    //
    // - Scripts: 'self' plus per-page hashes. Astro hashes the scripts it
    //   bundles; the inline theme bootstrap registers its hash in Layout.astro.
    //   No 'unsafe-inline', ever.
    // - Styles: 'self' plus hashes for <style> elements, and 'unsafe-inline'
    //   scoped to style ATTRIBUTES only — Bits UI positions elements with
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
      },
      styleDirective: {
        // `resources` replaces Astro's defaults, so 'self' must be re-added
        // for style elements (they stay hash-locked). Bits UI renders
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
    resolve: {
      // Lucide and Bits UI ship uncompiled .svelte modules; Vite must process
      // them during SSR instead of handing them to Node's ESM loader.
      noExternal: ["@lucide/svelte", "bits-ui"],
    },
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
      // Social images render through Satori, which draws a variable font at its
      // default instance only — `fontWeight` would be ignored and every card
      // would use one weight. This family exists so OG images get real 400 and
      // 700 instances; the site itself keeps the variable face above.
      name: "Satoshi",
      cssVariable: "--font-og-satoshi",
      provider: fontProviders.fontshare(),
      weights: ["400", "700"],
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
