/**
 * Runs the SEO gate after `astro build` has written `dist/`.
 *
 * Keeping the check out of the page routes means it sees the finished output:
 * every generated HTML file (including dynamic article routes), the social
 * cards the endpoint wrote, the sitemap, and robots.txt. A failure throws inside
 * `astro:build:done`, so `pnpm build` exits non-zero before deploy.
 */
import { fileURLToPath } from "node:url";

import type { AstroIntegration } from "astro";

import { verifySeo } from "@/lib/seo/verify";

export function seoCheck(): AstroIntegration {
  return {
    name: "seo-check",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const { pages, images, sitemapUrls } = await verifySeo({
          distDir: fileURLToPath(dir),
        });
        logger.info(
          `verified SEO for ${pages} pages, ${images} social images, ${sitemapUrls} sitemap URLs`,
        );
      },
    },
  };
}
