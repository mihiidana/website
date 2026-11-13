/**
 * The OG image registry: every public route's image content, derived from the
 * same data the pages render.
 *
 * There is no second copy of any title or description here:
 * - static pages come from `site.ts` (`site.pages`, `site.writing`),
 * - articles come from the `blog` collection entry itself.
 *
 * A new public route must add an entry to `staticOgSpecs` (see AGENTS.md →
 * Open Graph images); the build fails otherwise because the page would render
 * without an `og:image`.
 */
import type { CollectionEntry } from "astro:content";

import { displayDate } from "@/lib/blog";
import { site } from "@/lib/site";

export type OgKind = "home" | "index" | "article";

export type OgSpec = {
  /** Public route this image belongs to. Drives the output path. */
  route: string;
  kind: OgKind;
  /** Small label above the title, e.g. "Writing". */
  eyebrow: string;
  title: string;
  description: string;
  /** Short footer facts: date, count, domain. */
  meta: readonly string[];
  /** Optional numbered list (the blog index shows its newest posts). */
  index?: readonly string[];
};

export type BlogPost = CollectionEntry<"blog">;

const HOME_ROUTE = "/";
const BLOG_ROUTE = "/blog/";

/**
 * Static, non-article pages. Kept in one place so route, metadata, and image
 * content cannot drift apart.
 */
export function staticOgSpecs(): OgSpec[] {
  return [
    {
      route: HOME_ROUTE,
      kind: "home",
      eyebrow: "Personal site",
      // The homepage h1 is "Hello!" and its document title is descriptive. The
      // card leads with the identity instead, which reads better at display
      // size; the description matches the page's actual meta description.
      title: site.name,
      description: site.description,
      meta: [site.socials.github.replace(/^https?:\/\//, "")],
    },
    {
      route: BLOG_ROUTE,
      kind: "index",
      eyebrow: "Archive",
      title: site.writing.title,
      description: site.writing.description,
      meta: [],
    },
  ];
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
  const index = specs.find((spec) => spec.route === BLOG_ROUTE);
  if (index) {
    index.meta = [`${posts.length} ${posts.length === 1 ? "post" : "posts"}`];
    index.index = posts.slice(0, 4).map((post) => post.data.title);
  }
  return [...specs, ...posts.map(articleOgSpec)];
}
