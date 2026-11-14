/**
 * Type definitions for the runtime site configuration in `site.ts`.
 *
 * This module contains types only: configuration values stay in `site.ts`,
 * which re-exports these definitions so `@/lib/site` remains the single import
 * path for both.
 */

export type SiteLink = {
  label: string;
  href: string;
};

export type SiteTrack = {
  label: string;
  title: string;
  artist: string;
  album: string;
  audio: string;
  href: string;
};

export type SiteResource = {
  title: string;
  source: string;
  href: string;
};

export type SiteWidgets = {
  music: SiteTrack;
};

export type SitePage = {
  /** Canonical route, e.g. `/` or `/about/`. Drives the generated OG image path. */
  route: string;
  /** Visible page heading. */
  title: string;
  /**
   * Document title base for `<title>` and Open Graph. Use it when the visible
   * heading is not descriptive enough for search; the site-name suffix is
   * appended centrally by `buildPageSeo()`.
   */
  seoTitle?: string;
  /** Page-specific description used by the meta tags, social card, and listings. */
  description: string;
  /** Small label above the title on the generated social card. */
  eyebrow?: string;
  intro: string;
  widgets?: SiteWidgets;
  resources?: {
    heading: string;
    items: readonly SiteResource[];
  };
  techStack?: {
    heading: string;
    items: readonly SiteLink[];
  };
};

/**
 * Copy for the technical 404 response. It is not a public route: it never
 * enters `site.pages`, the sitemap, or the social-image registry.
 */
export type SiteNotFound = {
  /** Visible status marker above the heading. */
  label: string;
  /** Document title base; the site-name suffix is appended centrally. */
  title: string;
  /** Meta description for the error response. */
  description: string;
  /** Visible page heading. */
  heading: string;
  /** One sentence explaining what happened, in the site's voice. */
  body: string;
  /** The primary way back into the site. */
  home: SiteLink;
  /** A secondary path into the writing archive. */
  writing: SiteLink;
};

export type SiteWriting = {
  /** Canonical archive route. Drives the generated OG image path. */
  route: string;
  /** Visible archive heading. */
  title: string;
  /** Document title base for the archive; the site-name suffix is appended centrally. */
  seoTitle: string;
  description: string;
  intro: string;
  empty: string;
  feedTitle: string;
  feedDescription: string;
};

/** An editorial exception to the metadata length warnings, with its reason. */
export type SiteSeoMetadataException = {
  route: string;
  field: "title" | "description";
  reason: string;
};

export type SiteSeo = {
  /** `lang` on `<html>` and `inLanguage` in structured data. */
  lang: string;
  /** Open Graph locale, e.g. `en_US`. */
  ogLocale: string;
  /** Card used by every page unless it is explicitly noindex. */
  twitterCard: "summary" | "summary_large_image";
  /**
   * Verified handles only — never invent one. Omitted values emit no
   * `twitter:site` / `twitter:creator` tag at all.
   */
  twitter?: {
    site?: string;
    creator?: string;
  };
  /**
   * The explicit noindex registry. A built page may only emit
   * `robots: noindex` if its route appears here, and routes listed here must
   * actually render noindex. `pnpm check:seo` fails on either mismatch, so a
   * page cannot be silently excluded from search.
   */
  noindexRoutes: readonly string[];
  /**
   * Intentional exceptions to the metadata length warnings. Each entry must
   * name an indexable route, a field, and a reason. Exceptions only silence the
   * editorial warning; missing metadata, duplicates, and broken assets still
   * fail the build.
   */
  metadataExceptions: readonly SiteSeoMetadataException[];
};

export type SiteConfig = {
  name: string;
  wordmark: string;
  description: string;
  url: string;
  socials: Readonly<Record<string, string>>;
  seo: SiteSeo;
  writing: SiteWriting;
  notFound: SiteNotFound;
  pages: Readonly<Record<string, SitePage>>;
};
