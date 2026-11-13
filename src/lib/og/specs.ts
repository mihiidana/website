/**
 * The OG image registry: every public route's image content, derived from the
 * same metadata the pages render.
 *
 * There is no separate OG specification to maintain for static pages:
 * - every `site.pages` entry becomes a card from its `route`, `seoTitle`/`title`,
 *   and `description` (`pageOgSpec()`); the homepage keeps its dedicated design,
 *   every other static page gets the generic page template,
 * - the writing archive comes from `site.writing`,
 * - articles come from the `blog` collection entry itself.
 *
 * Adding a public route therefore means adding its metadata under `site.pages`
 * (which the page already needs) and nothing here.
 */
import type { CollectionEntry } from "astro:content";

import { displayDate } from "@/lib/blog";
import { normalizeRoute } from "@/lib/seo";
import type { SitePage, SiteWriting } from "@/lib/site";
import { site } from "@/lib/site";

export type OgKind = "home" | "index" | "page" | "article";

export type OgSpec = {
  /** Public route this image belongs to. Drives the output path. */
  route: string;
  kind: OgKind;
  /** Small label above the title, e.g. "Writing". */
  eyebrow: string;
  title: string;
  description: string;
  /** Short footer facts: date, count, route. */
  meta: readonly string[];
  /** Optional numbered list (the blog index shows its newest posts). */
  index?: readonly string[];
};

export type BlogPost = CollectionEntry<"blog">;

/** `/projects/` → "Projects"; used when a page does not set `eyebrow`. */
function defaultEyebrow(route: string): string {
  const segment = normalizeRoute(route).split("/").filter(Boolean)[0];
  if (!segment) return site.name;
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Derive one static page's card from the metadata that page already renders. */
export function pageOgSpec(page: SitePage): OgSpec {
  const route = normalizeRoute(page.route);
  const isHome = route === "/";

  return {
    route,
    kind: isHome ? "home" : "page",
    eyebrow: page.eyebrow ?? (isHome ? "Personal site" : defaultEyebrow(route)),
    // The homepage card leads with the identity; other pages use their own
    // descriptive title, without the site-name suffix the HTML adds.
    title: isHome ? site.name : (page.seoTitle ?? page.title),
    description: page.description,
    meta: isHome ? [site.socials.github.replace(/^https?:\/\//, "")] : [],
  };
}

/**
 * Static, non-article pages. Derived from `site.pages` and `site.writing`; there
 * is no route list to maintain here. Noindex pages are excluded so they never
 * emit an orphaned card.
 */
export function staticOgSpecs(
  pages: Readonly<Record<string, SitePage>> = site.pages,
  writing: SiteWriting = site.writing,
  noindexRoutes: readonly string[] = site.seo.noindexRoutes,
): OgSpec[] {
  const noindex = new Set(noindexRoutes.map(normalizeRoute));
  const specs = Object.values(pages)
    .filter((page) => !noindex.has(normalizeRoute(page.route)))
    .map(pageOgSpec);

  if (!noindex.has(normalizeRoute(writing.route))) {
    specs.push({
      route: writing.route,
      kind: "index",
      eyebrow: "Archive",
      title: writing.title,
      description: writing.description,
      meta: [],
    });
  }

  return specs;
}

/** Newest-first, matching every other surface (`publishedPosts()` does the filtering). */
export function articleOgSpec(post: BlogPost): OgSpec {
  return {
    route: `/blog/${post.id}/`,
    kind: "article",
    eyebrow: "Writing",
    title: post.data.title,
    description: post.data.description,
    meta: [displayDate(post.data.pubDate)],
  };
}

/**
 * The complete registry for a build: static pages plus one image per published
 * post. `posts` must already be filtered and sorted by `publishedPosts()`.
 */
export function ogSpecs(posts: readonly BlogPost[]): OgSpec[] {
  const specs = staticOgSpecs();
  const index = specs.find((spec) => spec.route === normalizeRoute(site.writing.route));
  if (index) {
    index.meta = [`${posts.length} ${posts.length === 1 ? "post" : "posts"}`];
    index.index = posts.slice(0, 4).map((post) => post.data.title);
  }
  return [...specs, ...posts.map(articleOgSpec)];
}
