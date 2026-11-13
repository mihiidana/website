/**
 * Structured data generated from the same object that renders the page head.
 *
 * Every page gets one `@graph`: the site (`WebSite`), its person
 * (`Person`), and the page node (`WebPage`, `CollectionPage`, or a `WebPage`
 * pointing at a `BlogPosting`). Optional nodes are only added when the page
 * actually has the data — no ratings, reviews, awards, authors, or dates are
 * invented.
 *
 * `@id`s are absolute and page-scoped, so entities reference one another
 * instead of repeating themselves, and the build checker can prove there are
 * no duplicate entities in a document.
 */

import type { PageSeo } from "@/lib/seo";
import { absoluteUrl } from "@/lib/seo";
import { site } from "@/lib/site";

type JsonLdNode = Record<string, unknown> & {
  "@type": string;
  "@id"?: string;
};

export type JsonLdGraph = {
  "@context": "https://schema.org";
  "@graph": JsonLdNode[];
};

export function buildStructuredData(seo: PageSeo): JsonLdGraph {
  const origin = seo.origin;
  const websiteId = `${origin}/#website`;
  const personId = `${origin}/#person`;
  const pageId = `${seo.canonical}#webpage`;
  const articleId = `${seo.canonical}#article`;
  const breadcrumbId = `${seo.canonical}#breadcrumb`;
  const itemListId = `${seo.canonical}#items`;
  const imageId = `${seo.canonical}#primaryimage`;

  const sameAs = Object.values(site.socials).filter((value) => value.length > 0);

  const person: JsonLdNode = {
    "@type": "Person",
    "@id": personId,
    name: seo.siteName,
    url: `${origin}/`,
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };

  const website: JsonLdNode = {
    "@type": "WebSite",
    "@id": websiteId,
    url: `${origin}/`,
    name: seo.siteName,
    description: site.description,
    inLanguage: site.seo.lang,
    publisher: { "@id": personId },
  };

  const isCollection = seo.type === "website" && seo.items.length > 0;
  const isArticle = seo.type === "article";
  const isHome = seo.route === "/";

  const page: JsonLdNode = {
    "@type": isCollection ? "CollectionPage" : "WebPage",
    "@id": pageId,
    url: seo.canonical,
    name: seo.title,
    description: seo.description,
    isPartOf: { "@id": websiteId },
    inLanguage: site.seo.lang,
    ...(seo.image ? { primaryImageOfPage: { "@id": imageId } } : {}),
    ...(seo.breadcrumbs.length > 0 ? { breadcrumb: { "@id": breadcrumbId } } : {}),
    ...(isHome ? { about: { "@id": personId } } : {}),
    ...(isCollection ? { mainEntity: { "@id": itemListId } } : {}),
    ...(isArticle ? { mainEntity: { "@id": articleId } } : {}),
  };

  const graph: JsonLdNode[] = [person, website, page];

  if (seo.image) {
    graph.push({
      "@type": "ImageObject",
      "@id": imageId,
      url: seo.image.url,
      width: seo.image.width,
      height: seo.image.height,
      caption: seo.image.alt,
    });
  }

  if (isArticle && seo.publishedTime) {
    graph.push({
      "@type": "BlogPosting",
      "@id": articleId,
      headline: seo.headline,
      description: seo.description,
      url: seo.canonical,
      mainEntityOfPage: { "@id": pageId },
      datePublished: seo.publishedTime,
      ...(seo.modifiedTime ? { dateModified: seo.modifiedTime } : {}),
      ...(seo.image ? { image: [seo.image.url] } : {}),
      author: { "@id": personId },
      publisher: { "@id": personId },
      isPartOf: { "@id": websiteId },
      inLanguage: site.seo.lang,
    });
  }

  if (isCollection) {
    graph.push({
      "@type": "ItemList",
      "@id": itemListId,
      name: seo.headline,
      numberOfItems: seo.items.length,
      itemListElement: seo.items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        url: absoluteUrl(item.path),
      })),
    });
  }

  if (seo.breadcrumbs.length > 0) {
    graph.push({
      "@type": "BreadcrumbList",
      "@id": breadcrumbId,
      itemListElement: seo.breadcrumbs.map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: crumb.name,
        item: absoluteUrl(crumb.path),
      })),
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

/**
 * JSON-LD is injected into a `<script>` element, so `<` must be escaped to
 * prevent a value containing `</script>` from closing the tag. U+2028/U+2029
 * are escaped because they are line terminators in JavaScript contexts.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}
