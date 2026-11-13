/**
 * Standalone entry point for the SEO gate. `pnpm build` runs the same
 * `verifySeo()` from `src/lib/seo/integration.ts`; this command lets CI or a
 * human re-check an existing `dist/` without rebuilding.
 */
import { fileURLToPath } from "node:url";

import { verifySeo } from "../src/lib/seo/verify.ts";

const distDir = fileURLToPath(new URL("../dist/", import.meta.url));

try {
  const { pages, images, sitemapUrls } = await verifySeo({ distDir });
  console.log(
    `SEO check passed: ${pages} page${pages === 1 ? "" : "s"}, ` +
      `${images} social image${images === 1 ? "" : "s"}, ` +
      `${sitemapUrls} sitemap URL${sitemapUrls === 1 ? "" : "s"}.`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
