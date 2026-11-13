/**
 * The single metadata builder for every public page.
 *
 * Pages do not assemble tags. They hand `Layout.astro` a title, a description,
 * and optional page facts (type, dates, breadcrumbs, listing items); this module
 * composes the document title, canonical URL, social image path, locale, and
 * Twitter card from `site.ts`. `head.astro` renders the result and
 * `src/lib/seo/jsonld.ts` turns the same object into structured data, so the
 * visible metadata and JSON-LD cannot disagree.
 *
 * `title` and `description` are required by `Layout.astro`: a new route cannot
 * silently inherit the homepage's copy. Canonical URLs are always absolute,
 * query-less, fragment-less, and trailing-slashed, matching the static
 * `directory` build format.
 */
import { OG_HEIGHT, OG_WIDTH } from "@/lib/og/constants";
import { ogImageAlt, ogImagePath } from "@/lib/og/paths";
import { site } from "@/lib/site";

export type SeoPageType = "website" | "article";

/** A node in the visible-to-structured-data breadcrumb trail. */
export type SeoBreadcrumb = {
  name: string;
  path: string;
};

/** One entry in a collection listing (the writing archive today). */
export type SeoListItem = {
  name: string;
  path: string;
};

export type PageSeoInput = {
  /** The page's own route, normally `Astro.url.pathname`. */
  route: string;
  /** Page-specific title, without the site-name suffix. */
  title: string;
  /** Page-specific description. Never a copy of another page's. */
  description: string;
  type?: SeoPageType;
  noindex?: boolean;
  /** ISO date (`YYYY-MM-DD`) for articles. */
  publishedTime?: string;
  /** ISO date (`YYYY-MM-DD`) for articles edited after publication. */
  modifiedTime?: string;
  /** Home → section → page. Sub-pages should always provide one. */
  breadcrumbs?: readonly SeoBreadcrumb[];
  /** The page's actual collection contents, if it is a listing. */
  items?: readonly SeoListItem[];
};

export type SocialImage = {
  url: string;
  alt: string;
  width: number;
  height: number;
  type: "image/png";
};

export type PageSeo = {
  route: string;
  /** Composed document title, including the site-name suffix. */
  title: string;
  /** The page's own title, without the site-name suffix. */
  headline: string;
  description: string;
  canonical: string;
  origin: string;
  type: SeoPageType;
  noindex: boolean;
  locale: string;
  siteName: string;
  /**
   * Present on indexable pages only. Noindex pages ship no social image, so
   * they never advertise a card the OG endpoint did not generate.
   */
  image?: SocialImage;
  twitter: {
    card: "summary" | "summary_large_image";
    site?: string;
    creator?: string;
  };
  publishedTime?: string;
  modifiedTime?: string;
  breadcrumbs: readonly SeoBreadcrumb[];
  items: readonly SeoListItem[];
};

/**
 * Strip query/hash, add the leading and trailing slash, and keep the path
 * encoded exactly as Astro emitted it. The trailing slash is the site's
 * canonical policy (see `trailingSlash` in astro.config.mjs).
 */
export function normalizeRoute(route: string): string {
  const url = new URL(route, site.url);
  let pathname = url.pathname;
  if (!pathname.startsWith("/")) pathname = `/${pathname}`;
  if (!pathname.endsWith("/")) pathname = `${pathname}/`;
  return pathname;
}

/** Absolute URL for a route on the configured production origin. */
export function absoluteUrl(route: string): string {
  return new URL(normalizeRoute(route), site.url).href;
}

export function buildPageSeo(input: PageSeoInput): PageSeo {
  const route = normalizeRoute(input.route);
  const canonical = absoluteUrl(route);
  const siteSuffix = ` — ${site.name}`;
  // `title` is the page's own base title. The site name is appended once; a page
  // that already includes it (or *is* it) cannot produce a doubled suffix.
  const pageTitle =
    input.title === site.name || input.title.endsWith(siteSuffix)
      ? input.title
      : `${input.title}${siteSuffix}`;
  const noindex = input.noindex === true;
  const twitterCard = noindex ? "summary" : site.seo.twitterCard;

  const image: SocialImage | undefined = noindex
    ? undefined
    : {
        url: new URL(ogImagePath(route), site.url).href,
        alt: ogImageAlt({ title: pageTitle, description: input.description }),
        width: OG_WIDTH,
        height: OG_HEIGHT,
        type: "image/png",
      };

  return {
    route,
    title: pageTitle,
    headline: input.title,
    description: input.description,
    canonical,
    origin: new URL(site.url).origin,
    type: input.type ?? "website",
    noindex,
    locale: site.seo.ogLocale,
    siteName: site.name,
    image,
    twitter: {
      card: twitterCard,
      // Only verified handles are configured; empty values are omitted rather
      // than serialized as empty tags.
      ...(site.seo.twitter?.site ? { site: site.seo.twitter.site } : {}),
      ...(site.seo.twitter?.creator ? { creator: site.seo.twitter.creator } : {}),
    },
    ...(input.publishedTime ? { publishedTime: input.publishedTime } : {}),
    ...(input.modifiedTime ? { modifiedTime: input.modifiedTime } : {}),
    breadcrumbs: input.breadcrumbs ?? [],
    items: input.items ?? [],
  };
}
