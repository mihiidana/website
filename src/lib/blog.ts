/**
 * Blog helpers shared by the index, article pages, RSS, and tests.
 *
 * Content IDs come from the `glob()` loader, which slugs file paths (so
 * `hello-world.md` becomes `hello-world`). Routes use the ID verbatim, which
 * keeps slugs stable when frontmatter changes.
 */
import type { CollectionEntry } from "astro:content";

export type BlogPost = CollectionEntry<"blog">;

/** Blog path for a post ID. Always trailing-slashed to match build output. */
export function postPath(id: string): string {
  return `/blog/${id}/`;
}

/** Newest first. `getCollection()` order is not deterministic. */
export function sortByDate(posts: readonly BlogPost[]): BlogPost[] {
  return [...posts].sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/**
 * Drafts never render — not in the listing, not as routes, not in the feed.
 * A draft is only a staging state in git, so there is no dev-only exception
 * that could leak one into `dist/`.
 */
export function isPublished(post: BlogPost): boolean {
  return post.data.draft !== true;
}

/** Filters drafts and sorts newest first — the order every surface uses. */
export function publishedPosts(posts: readonly BlogPost[]): BlogPost[] {
  return sortByDate(posts.filter(isPublished));
}

/** Machine-readable date for `<time datetime>` and feeds. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Human date shown in listings and article headers. */
export function displayDate(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}
