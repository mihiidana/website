/**
 * Remote image collection for `.mdx` files.
 *
 * Astro's Markdown path passes `image` (i.e. `image.remotePatterns`) into
 * `createCollectImagesPlugin()`, so `![](...)` in a `.md` file is optimized
 * whether the URL is local or remote. The MDX path does not: in this release
 * of `@astrojs/markdown-satteri`, `dist/mdx/create-processor.js` builds its
 * collect plugin with no arguments (`createCollectImagesPlugin()`), leaving
 * both allowlists empty. Every remote URL is then classified as "not an
 * image", and Markdown images inside `.mdx` silently ship as an unoptimized
 * `<img src="https://…">`.
 *
 * That silent fallback is the one thing this repository must not have: the
 * production CSP is `img-src 'self' data:`, so a remote URL left unprocessed is
 * blocked at runtime rather than quietly degrading. This integration re-runs
 * Astro's own collector — the same exported plugin, the same allowlist
 * matching — so `.md` and `.mdx` classify images identically.
 *
 * The collector is pushed onto `markdown.processor.options.mdastPlugins`, the
 * single list `satteri()` hands to both renderers. It is added last to match
 * the upstream order ("collect last so image-URL rewrites by user plugins are
 * captured"). If upstream starts passing its own config, the only effect is a
 * duplicate visit that adds the same URL to a Set.
 */
import { satteriCollectImagesPlugin } from "@astrojs/markdown-satteri";

import type { AstroIntegration } from "astro";

interface SatteriOptions {
  mdastPlugins: unknown[];
  /** Set by this integration so the guard below survives repeated setup. */
  remoteImagesInstalled?: boolean;
}

export function remoteImages(): AstroIntegration {
  return {
    name: "remote-images",
    hooks: {
      "astro:config:setup": ({ config }) => {
        const options = config.markdown.processor.options as SatteriOptions;

        // Setup can run more than once (`astro check`, rebuilds). The flag
        // lives on the processor options themselves, so a second pass sees it.
        if (options.remoteImagesInstalled) return;
        options.remoteImagesInstalled = true;

        // `config.image` is the resolved block from astro.config.mjs. Passing
        // it through keeps the allowlist in one place — `remotePatterns` — so
        // this file never restates which hosts are permitted.
        options.mdastPlugins.push(satteriCollectImagesPlugin(config.image));
      },
    },
  };
}
