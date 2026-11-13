/**
 * Static PNG endpoint: `/og/**\/*.png`.
 *
 * One file per public page, emitted by `astro build` (no adapter, no runtime
 * rendering). `getStaticPaths()` reads the same registry the pages read, so the
 * set of images is always exactly the set of routes.
 *
 * The file name is a pure function of the route (see `src/lib/og/paths.ts`), so
 * a given URL always serves the same page's image; content changes only when
 * the page's own metadata changes.
 */
import { getCollection } from "astro:content";
import type { APIRoute, GetStaticPaths } from "astro";

import { publishedPosts } from "@/lib/blog";
import { ogRouteKey } from "@/lib/og/paths";
import { renderOgImage } from "@/lib/og/render";
import { ogSpecs } from "@/lib/og/specs";

export const getStaticPaths = (async () => {
  const specs = ogSpecs(publishedPosts(await getCollection("blog")));

  return specs.map((spec) => ({
    params: { path: ogRouteKey(spec.route) },
    props: { spec },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const png = await renderOgImage(props.spec);

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      // The URL is page-stable, not content-hashed: a re-publish can change the
      // bytes behind the same path, so caches must revalidate.
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
};
