/**
 * Integration that runs the social-image gate at the end of `astro build`.
 *
 * Keeping it out of the page routes means the check sees the finished `dist/`:
 * the HTML each page actually shipped and the PNGs the endpoint actually wrote.
 * A failure throws inside `astro:build:done`, so `pnpm build` exits non-zero
 * before anything could be deployed.
 */
import { fileURLToPath } from "node:url";

import type { AstroIntegration } from "astro";
import { verifyOgImages } from "@/lib/og/verify";
import { site } from "@/lib/site";

export function ogImageCheck(): AstroIntegration {
  return {
    name: "og-image-check",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const { pages, images } = await verifyOgImages({
          distDir: fileURLToPath(dir),
          siteUrl: site.url,
        });
        logger.info(`verified ${images} social images across ${pages} pages`);
      },
    },
  };
}
