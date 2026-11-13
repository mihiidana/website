/**
 * robots.txt is generated from `site.ts` so the sitemap URL can never point at
 * a stale origin. Noindex pages are deliberately not disallowed here: crawlers
 * must be able to fetch them and see the `noindex` directive. The build checker
 * separately proves they are absent from the sitemap.
 */
import type { APIRoute } from "astro";

import { site } from "@/lib/site";

export const GET: APIRoute = ({ site: astroSite }) => {
  const origin = (astroSite ?? new URL(site.url)).origin;
  const body = ["User-agent: *", "Allow: /", "", `Sitemap: ${origin}/sitemap-index.xml`, ""].join(
    "\n",
  );

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
