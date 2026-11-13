/**
 * The SEO gate: reads the finished `dist/` and fails if any generated page is
 * missing metadata, points at a missing asset, disagrees with its canonical
 * URL, ships invalid structured data, or is wrongly included in the sitemap.
 *
 * This module deliberately imports its config by relative `.ts` path rather
 * than through the `@/` alias: the same file runs inside `astro build` and as a
 * plain `node scripts/check-seo.mjs` process, where Node's type stripping does
 * not know the alias. Keep this file's imports resolvable by both runtimes.
 *
 * Discovery is filesystem-based. There is no route list to maintain: any HTML
 * file a future route emits is validated automatically.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

import { type DefaultTreeAdapterTypes, parse } from "parse5";
import sharp from "sharp";

import { OG_HEIGHT, OG_WIDTH } from "../og/constants.ts";
import { ogImagePath } from "../og/paths.ts";
import { site } from "../site.ts";
import { type MetadataQualityWarning, metadataQualityWarnings } from "./quality.ts";

type Element = DefaultTreeAdapterTypes.Element;
type Node = DefaultTreeAdapterTypes.Node;

const ORIGIN = new URL(site.url).origin;
const SITE_ROOT = `${ORIGIN}/`;
const SITEMAP_INDEX = "sitemap-index.xml";
const ROBOTS = "robots.txt";

type Problem = { route: string; message: string };

type Link = { rel: string[]; href?: string; type?: string };

type ParsedPage = {
  htmlPath: string;
  relativePath: string;
  route: string;
  lang?: string;
  title: string[];
  metas: Map<string, string[]>;
  links: Link[];
  canonical: string[];
  jsonLd: string[];
};

export type SeoVerifyResult = {
  pages: number;
  images: number;
  sitemapUrls: number;
  /** Editorial length warnings. These do not fail the build. */
  warnings: MetadataQualityWarning[];
};

function walk(nodes: readonly Node[], visit: (element: Element) => void): void {
  for (const node of nodes) {
    if (!("tagName" in node)) continue;
    visit(node);
    walk(node.childNodes, visit);
  }
}

function attr(element: Element, name: string): string | undefined {
  return element.attrs.find((entry) => entry.name === name)?.value;
}

function textOf(node: Node): string {
  if ("value" in node) return node.value;
  if ("childNodes" in node) return node.childNodes.map(textOf).join("");
  return "";
}

function routeFor(relativePath: string): string {
  if (relativePath === "index.html") return "/";
  if (relativePath.endsWith("/index.html")) {
    return `/${relativePath.slice(0, -"index.html".length)}`;
  }
  return `/${relativePath}`;
}

function normalizeRoute(route: string): string {
  let pathname = route;
  if (!pathname.startsWith("/")) pathname = `/${pathname}`;
  if (!pathname.endsWith("/")) pathname = `${pathname}/`;
  return pathname;
}

function canonicalFor(route: string): string {
  return new URL(normalizeRoute(route), SITE_ROOT).href;
}

async function listHtml(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
}

function parsePage(html: string, htmlPath: string, distDir: string): ParsedPage {
  const document = parse(html);
  const relativePath = relative(distDir, htmlPath).replaceAll("\\", "/");
  const page: ParsedPage = {
    htmlPath,
    relativePath,
    route: routeFor(relativePath),
    title: [],
    metas: new Map(),
    links: [],
    canonical: [],
    jsonLd: [],
  };

  walk(document.childNodes, (element) => {
    const tag = element.tagName;

    if (tag === "html") page.lang = attr(element, "lang");

    if (tag === "title") page.title.push(textOf(element).trim());

    if (tag === "meta") {
      const key = attr(element, "property") ?? attr(element, "name");
      if (!key) return;
      const content = attr(element, "content") ?? "";
      page.metas.set(key, [...(page.metas.get(key) ?? []), content]);
    }

    if (tag === "link") {
      const href = attr(element, "href");
      const rel = (attr(element, "rel") ?? "").split(/\s+/).filter(Boolean);
      const link: Link = {
        rel,
        ...(href ? { href } : {}),
        ...(attr(element, "type") ? { type: attr(element, "type") } : {}),
      };
      page.links.push(link);
      if (rel.includes("canonical") && href) page.canonical.push(href);
    }

    if (tag === "script" && attr(element, "type") === "application/ld+json") {
      page.jsonLd.push(textOf(element));
    }
  });

  return page;
}

function first(values: string[] | undefined): string | undefined {
  return values?.[0];
}

/** Mirrors `buildPageSeo()`: append the site suffix once, never twice. */
function documentTitle(base: string): string {
  const suffix = ` — ${site.name}`;
  return base === site.name || base.endsWith(suffix) ? base : `${base}${suffix}`;
}

/** The `@id` of a JSON-LD reference object (`{ "@id": "…" }`). */
function refId(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const id = (value as Record<string, unknown>)["@id"];
  return typeof id === "string" ? id : undefined;
}

function ogTypeIsArticle(page: ParsedPage): boolean {
  return first(page.metas.get("og:type")) === "article";
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function decodeXml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

async function fileExists(distDir: string, pathname: string): Promise<boolean> {
  try {
    const info = await stat(join(distDir, decodeURIComponent(pathname)));
    return info.isFile();
  } catch {
    return false;
  }
}

type Sitemap = { urls: string[]; indexLocs: string[] };

/** Reads the sitemap index and every child sitemap it points at. */
async function readSitemap(distDir: string, problems: Problem[]): Promise<Sitemap> {
  const empty: Sitemap = { urls: [], indexLocs: [] };
  let index: string;
  try {
    index = await readFile(join(distDir, SITEMAP_INDEX), "utf8");
  } catch {
    problems.push({ route: "/sitemap", message: `${SITEMAP_INDEX} was not generated` });
    return empty;
  }

  const indexLocs = [...index.matchAll(/<loc>([\s\S]*?)<\/loc>/g)].map((match) =>
    decodeXml(match[1].trim()),
  );
  if (indexLocs.length === 0) {
    problems.push({ route: "/sitemap", message: `${SITEMAP_INDEX} contains no <loc>` });
    return empty;
  }

  const urls: string[] = [];
  for (const loc of indexLocs) {
    let parsed: URL;
    try {
      parsed = new URL(loc);
    } catch {
      problems.push({ route: "/sitemap", message: `invalid sitemap index loc: ${loc}` });
      continue;
    }
    if (parsed.origin !== ORIGIN) {
      problems.push({
        route: "/sitemap",
        message: `sitemap index loc uses ${parsed.origin}, expected ${ORIGIN}`,
      });
      continue;
    }
    const childPath = decodeURIComponent(parsed.pathname).replace(/^\//, "");
    let child: string;
    try {
      child = await readFile(join(distDir, childPath), "utf8");
    } catch {
      problems.push({
        route: "/sitemap",
        message: `child sitemap ${parsed.pathname} was not emitted`,
      });
      continue;
    }
    for (const match of child.matchAll(/<loc>([\s\S]*?)<\/loc>/g)) {
      urls.push(decodeXml(match[1].trim()));
    }
  }

  return { urls, indexLocs };
}

/** Every PNG the OG endpoint emitted, as root-relative paths. */
async function listOgImages(distDir: string): Promise<string[]> {
  try {
    const entries = await readdir(join(distDir, "og"), { recursive: true, withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".png"))
      .map(
        (entry) =>
          `/${relative(distDir, join(entry.parentPath, entry.name)).replaceAll("\\", "/")}`,
      )
      .sort();
  } catch {
    return [];
  }
}

function collectJsonLd(
  page: ParsedPage,
  add: (message: string) => void,
): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];
  const ids = new Map<string, string>();

  for (const raw of page.jsonLd) {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      add("JSON-LD is not valid JSON");
      continue;
    }
    if (typeof data !== "object" || data === null) {
      add("JSON-LD must be a JSON object");
      continue;
    }
    const record = data as Record<string, unknown>;
    if (record["@context"] !== "https://schema.org") {
      add('JSON-LD @context must be "https://schema.org"');
    }
    const graph = Array.isArray(record["@graph"]) ? record["@graph"] : [record];
    if (graph.length === 0) add("JSON-LD graph is empty");

    for (const node of graph) {
      if (typeof node !== "object" || node === null) {
        add("JSON-LD graph contains a non-object node");
        continue;
      }
      const entity = node as Record<string, unknown>;
      if (typeof entity["@type"] !== "string") add("JSON-LD node is missing @type");
      const id = entity["@id"];
      if (typeof id === "string") {
        const previous = ids.get(id);
        if (previous) {
          add(`duplicate JSON-LD @id ${id}`);
        } else {
          ids.set(id, entity["@type"] as string);
        }
      }
      nodes.push(entity);
    }
  }

  const scan = (value: unknown, key: string): void => {
    if (typeof value === "string") {
      if (key === "sameAs" || key === "@context" || value === "https://schema.org") return;
      if (/^http:\/\//i.test(value) || /localhost|127\.0\.0\.1/i.test(value)) {
        add(`JSON-LD contains a non-production URL: ${value}`);
        return;
      }
      if (value.startsWith("https://") && !value.startsWith(`${ORIGIN}/`) && value !== ORIGIN) {
        add(`JSON-LD URL is not on the production origin: ${value}`);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) scan(item, key);
      return;
    }
    if (value && typeof value === "object") {
      for (const [childKey, childValue] of Object.entries(value)) scan(childValue, childKey);
    }
  };
  scan(nodes, "");

  return nodes;
}

/**
 * Runs every check and throws one error listing all problems, grouped by route.
 */
export async function verifySeo({ distDir }: { distDir: string }): Promise<SeoVerifyResult> {
  const problems: Problem[] = [];
  const add = (route: string, message: string): void => {
    problems.push({ route, message });
  };

  const htmlFiles = await listHtml(distDir);
  if (htmlFiles.length === 0) {
    throw new Error(`SEO check: no HTML files found in ${distDir}. Run "pnpm build" first.`);
  }

  const pages: ParsedPage[] = [];
  for (const htmlPath of htmlFiles) {
    const parsed = parsePage(await readFile(htmlPath, "utf8"), htmlPath, distDir);

    // `404.html` is a technical response, not a public route. It must never be
    // indexable, but it is not a shareable page and has no canonical URL.
    if (parsed.relativePath === "404.html") {
      const robots = (first(parsed.metas.get("robots")) ?? "").toLowerCase();
      if (!robots.includes("noindex")) add("/404.html", "technical 404 must ship noindex");
      continue;
    }

    pages.push(parsed);
  }

  // The registry is a contract in both directions: a listed route must exist
  // and render noindex, and a noindex page must be listed.
  for (const route of site.seo.noindexRoutes) {
    const normalized = normalizeRoute(route);
    if (!pages.some((page) => page.route === normalized)) {
      add("/seo", `site.seo.noindexRoutes lists ${route}, but no page was built at that route`);
    }
  }

  // `site.pages` is the metadata source for static social cards, so each entry
  // must describe a real built page whose rendered metadata matches it. That is
  // what keeps the card and the HTML from drifting apart, and what makes a
  // route without registered metadata a build failure rather than a page with
  // no social card.
  for (const [key, declared] of Object.entries(site.pages)) {
    const route = normalizeRoute(declared.route);
    const built = pages.find((candidate) => candidate.route === route);
    if (!built) {
      add("/seo", `site.pages.${key} declares ${route}, but no page was built there`);
      continue;
    }
    const robots = (first(built.metas.get("robots")) ?? "").toLowerCase();
    if (robots.includes("noindex")) continue;

    if (first(built.title) !== documentTitle(declared.seoTitle ?? declared.title)) {
      add(route, `title does not match site.pages.${key}.seoTitle/title`);
    }
    if (first(built.metas.get("description")) !== declared.description) {
      add(route, `meta description does not match site.pages.${key}.description`);
    }
  }

  const archiveRoute = normalizeRoute(site.writing.route);
  const archive = pages.find((candidate) => candidate.route === archiveRoute);
  if (!archive) {
    add("/seo", `site.writing declares ${site.writing.route}, but no page was built there`);
  } else if (!(first(archive.metas.get("robots")) ?? "").toLowerCase().includes("noindex")) {
    if (first(archive.title) !== documentTitle(site.writing.seoTitle)) {
      add(archiveRoute, "title does not match site.writing.seoTitle");
    }
    if (first(archive.metas.get("description")) !== site.writing.description) {
      add(archiveRoute, "meta description does not match site.writing.description");
    }
  }

  const titles = new Map<string, string[]>();
  const descriptions = new Map<string, string[]>();
  const canonicals = new Map<string, string[]>();
  const images = new Map<string, string[]>();
  const sitemap = await readSitemap(distDir, problems);
  const sitemapSet = new Set(sitemap.urls);
  const emitted = new Set(await listOgImages(distDir));
  const expectedImages = new Set<string>();

  for (const page of pages) {
    const route = page.route;
    const addPage = (message: string): void => add(route, message);

    if (page.lang !== site.seo.lang) {
      addPage(
        `<html lang> is ${page.lang === undefined ? "missing" : `"${page.lang}"`}, expected "${site.seo.lang}"`,
      );
    }

    if (page.title.length !== 1)
      addPage(`expected exactly one <title>, found ${page.title.length}`);
    const title = first(page.title);
    if (!title) addPage("title is empty");

    if (page.metas.get("description")?.length !== 1) {
      addPage(
        `expected exactly one meta description, found ${page.metas.get("description")?.length ?? 0}`,
      );
    }
    const description = first(page.metas.get("description"));
    if (!description?.trim()) addPage("meta description is empty");

    if (page.canonical.length !== 1) {
      addPage(`expected exactly one canonical link, found ${page.canonical.length}`);
    }
    const canonical = first(page.canonical);
    const expectedCanonical = canonicalFor(route);
    if (canonical) {
      let parsed: URL | undefined;
      try {
        parsed = new URL(canonical);
      } catch {
        addPage(`canonical is not an absolute URL: ${canonical}`);
      }
      if (parsed) {
        if (parsed.protocol !== "https:") addPage(`canonical must use https: ${canonical}`);
        if (parsed.origin !== ORIGIN)
          addPage(`canonical origin is ${parsed.origin}, expected ${ORIGIN}`);
        if (parsed.search) addPage("canonical must not contain a query string");
        if (parsed.hash) addPage("canonical must not contain a fragment");
      }
      if (canonical !== expectedCanonical) {
        addPage(`canonical is ${canonical}, expected ${expectedCanonical}`);
      }
    }

    for (const [key, values] of page.metas) {
      if (values.length > 1) addPage(`duplicate <meta> "${key}" (${values.length} tags)`);
    }

    const robots = first(page.metas.get("robots"))?.toLowerCase() ?? "";
    const noindex = robots.includes("noindex");
    const registered = site.seo.noindexRoutes.includes(normalizeRoute(route));

    if (noindex && !registered) {
      addPage("page is noindex but its route is not in site.seo.noindexRoutes");
    }
    if (!noindex && registered) {
      addPage("route is in site.seo.noindexRoutes but the page is indexable");
    }
    if (noindex && !robots.includes("nofollow")) {
      addPage("noindex pages must also ship nofollow");
    }
    if (!noindex && robots) {
      addPage(`indexable page has a robots directive: "${robots}"`);
    }

    if (!noindex) {
      const requiredOg = [
        "og:title",
        "og:description",
        "og:type",
        "og:url",
        "og:site_name",
        "og:locale",
        "og:image",
        "og:image:alt",
        "og:image:width",
        "og:image:height",
        "og:image:type",
      ];
      for (const key of requiredOg) {
        if (!first(page.metas.get(key))) addPage(`missing ${key}`);
      }

      if (title && first(page.metas.get("og:title")) !== title) {
        addPage("og:title does not match <title>");
      }
      if (description && first(page.metas.get("og:description")) !== description) {
        addPage("og:description does not match meta description");
      }
      if (canonical && first(page.metas.get("og:url")) !== canonical) {
        addPage("og:url does not match canonical");
      }
      if (first(page.metas.get("og:site_name")) !== site.name) {
        addPage(`og:site_name is not "${site.name}"`);
      }
      if (first(page.metas.get("og:locale")) !== site.seo.ogLocale) {
        addPage(`og:locale is not "${site.seo.ogLocale}"`);
      }

      const ogType = first(page.metas.get("og:type"));
      if (ogType !== "website" && ogType !== "article") {
        addPage(`og:type is ${ogType ?? "missing"}, expected website or article`);
      }

      if (first(page.metas.get("og:image:width")) !== String(OG_WIDTH)) {
        addPage(`og:image:width is not ${OG_WIDTH}`);
      }
      if (first(page.metas.get("og:image:height")) !== String(OG_HEIGHT)) {
        addPage(`og:image:height is not ${OG_HEIGHT}`);
      }
      if (first(page.metas.get("og:image:type")) !== "image/png") {
        addPage("og:image:type is not image/png");
      }

      const image = first(page.metas.get("og:image"));
      const expectedImage = new URL(ogImagePath(route), SITE_ROOT).href;
      if (image) {
        let parsed: URL | undefined;
        try {
          parsed = new URL(image);
        } catch {
          addPage(`og:image is not an absolute URL: ${image}`);
        }
        if (parsed) {
          if (parsed.protocol !== "https:") addPage("og:image must use https");
          if (parsed.origin !== ORIGIN)
            addPage(`og:image origin is ${parsed.origin}, expected ${ORIGIN}`);
        }
        if (image !== expectedImage) {
          addPage(`og:image is ${image}, expected ${expectedImage} (derived from this route)`);
        }
        if (parsed && parsed.origin === ORIGIN) {
          expectedImages.add(decodeURIComponent(parsed.pathname));
          images.set(image, [...(images.get(image) ?? []), route]);
        }
      }

      const alt = first(page.metas.get("og:image:alt"));
      if (!alt?.trim()) addPage("og:image:alt is empty");

      if (first(page.metas.get("twitter:card")) !== site.seo.twitterCard) {
        addPage(`twitter:card is not "${site.seo.twitterCard}"`);
      }
      if (title && first(page.metas.get("twitter:title")) !== title) {
        addPage("twitter:title does not match <title>");
      }
      if (description && first(page.metas.get("twitter:description")) !== description) {
        addPage("twitter:description does not match meta description");
      }
      if (first(page.metas.get("twitter:image")) !== image) {
        addPage("twitter:image does not match og:image");
      }
      if (first(page.metas.get("twitter:image:alt")) !== alt) {
        addPage("twitter:image:alt does not match og:image:alt");
      }

      if (ogType === "article") {
        const published = first(page.metas.get("article:published_time"));
        if (!published || !isIsoDate(published)) {
          addPage("article page is missing a valid article:published_time");
        }
        const modified = first(page.metas.get("article:modified_time"));
        if (modified && !isIsoDate(modified)) addPage("article:modified_time is not an ISO date");
      } else {
        if (page.metas.has("article:published_time") || page.metas.has("article:modified_time")) {
          addPage("non-article page ships article:* metadata");
        }
      }

      const alternate = page.links.find(
        (link) => link.rel.includes("alternate") && link.type === "application/rss+xml",
      );
      if (!alternate?.href) addPage("missing RSS alternate link");
    } else {
      if (first(page.metas.get("twitter:card")) !== "summary") {
        addPage("noindex pages must use twitter:card=summary");
      }
      if (page.metas.has("og:image") || page.metas.has("twitter:image")) {
        addPage("noindex pages must not advertise a social image");
      }
      if (sitemapSet.has(expectedCanonical)) {
        addPage("noindex page appears in the sitemap");
      }
    }

    // Structured data is required on every page, indexable or not.
    const nodes = collectJsonLd(page, addPage);
    const person = nodes.find((node) => node["@type"] === "Person");
    const website = nodes.find((node) => node["@type"] === "WebSite");
    const personId = person?.["@id"];
    const websiteId = website?.["@id"];

    if (!person) {
      addPage("JSON-LD is missing a Person node");
    } else {
      if (person.url !== SITE_ROOT) addPage("Person.url is not the production root");
      if (person.sameAs !== undefined) {
        const sameAs = person.sameAs;
        if (
          !Array.isArray(sameAs) ||
          sameAs.some((value) => typeof value !== "string" || !/^https:\/\//i.test(value))
        ) {
          addPage("Person.sameAs must contain absolute https profile URLs");
        }
      }
    }

    if (!website) {
      addPage("JSON-LD is missing a WebSite node");
    } else {
      if (website.url !== SITE_ROOT) addPage("WebSite.url is not the production root");
      if (website.description !== site.description) {
        addPage("WebSite.description does not match site.description");
      }
      if (websiteId && refId(website.publisher) !== personId) {
        addPage("WebSite.publisher does not reference the Person node");
      }
    }

    const pageNodes = nodes.filter((node) =>
      ["WebPage", "CollectionPage", "ProfilePage", "AboutPage", "ItemPage"].includes(
        String(node["@type"]),
      ),
    );
    if (pageNodes.length === 0) addPage("JSON-LD is missing a WebPage node");
    const currentPage = pageNodes.find((node) => node.url === canonical);
    if (!currentPage) {
      addPage("JSON-LD has no WebPage whose url matches the canonical");
    } else {
      if (title && currentPage.name !== title) addPage("WebPage.name does not match <title>");
      if (description && currentPage.description !== description) {
        addPage("WebPage.description does not match meta description");
      }
      if (websiteId && refId(currentPage.isPartOf) !== websiteId) {
        addPage("WebPage.isPartOf does not reference the WebSite node");
      }
      if (route === "/" && personId && refId(currentPage.about) !== personId) {
        addPage("homepage WebPage.about does not reference the Person node");
      }
    }

    if (ogTypeIsArticle(page)) {
      const article = nodes.find((node) => node["@type"] === "BlogPosting");
      if (!article) addPage("article page is missing BlogPosting structured data");
      if (article) {
        if (typeof article.headline !== "string" || !article.headline.trim()) {
          addPage("BlogPosting.headline is missing");
        } else if (
          title &&
          article.headline !== title &&
          `${article.headline} — ${site.name}` !== title
        ) {
          addPage("BlogPosting.headline does not match the page title");
        }
        if (article.url !== canonical) addPage("BlogPosting.url does not match canonical");
        if (description && article.description !== description) {
          addPage("BlogPosting.description does not match meta description");
        }
        if (personId && refId(article.author) !== personId) {
          addPage("BlogPosting.author does not reference the Person node");
        }
        if (personId && refId(article.publisher) !== personId) {
          addPage("BlogPosting.publisher does not reference the Person node");
        }
        if (websiteId && refId(article.isPartOf) !== websiteId) {
          addPage("BlogPosting.isPartOf does not reference the WebSite node");
        }
        if (typeof article.datePublished !== "string" || !isIsoDate(article.datePublished)) {
          addPage("BlogPosting.datePublished is missing or invalid");
        }
        const published = first(page.metas.get("article:published_time"));
        if (published && article.datePublished !== published) {
          addPage("BlogPosting.datePublished does not match article:published_time");
        }
        if (article.dateModified !== undefined) {
          if (typeof article.dateModified !== "string" || !isIsoDate(article.dateModified)) {
            addPage("BlogPosting.dateModified is invalid");
          }
          const modified = first(page.metas.get("article:modified_time"));
          if (modified && article.dateModified !== modified) {
            addPage("BlogPosting.dateModified does not match article:modified_time");
          }
        }
        const image = first(page.metas.get("og:image"));
        const articleImages = Array.isArray(article.image) ? article.image : [];
        if (image && !articleImages.includes(image)) {
          addPage("BlogPosting.image does not include og:image");
        }
      }
    }

    if (currentPage?.["@type"] === "CollectionPage") {
      const list = nodes.find((node) => node["@type"] === "ItemList");
      if (!list) {
        addPage("CollectionPage is missing ItemList structured data");
      } else {
        const entries = Array.isArray(list.itemListElement)
          ? (list.itemListElement as Record<string, unknown>[])
          : [];
        if (list.numberOfItems !== entries.length) {
          addPage(
            `ItemList.numberOfItems is ${String(list.numberOfItems)}, but it lists ${entries.length}`,
          );
        }
        entries.forEach((entry, index) => {
          if (entry.position !== index + 1) {
            addPage(`ItemList entry ${index + 1} has position ${String(entry.position)}`);
          }
          const url = entry.url;
          if (typeof url !== "string") {
            addPage("ItemList entry is missing a url");
          } else if (!sitemapSet.has(url)) {
            addPage(`ItemList entry ${url} is not an indexable page in the sitemap`);
          }
        });
        if (refId(currentPage.mainEntity) !== list["@id"]) {
          addPage("CollectionPage.mainEntity does not reference the ItemList");
        }
      }
    }

    if (route !== "/" && !noindex) {
      const breadcrumbs = nodes.find((node) => node["@type"] === "BreadcrumbList");
      if (!breadcrumbs) {
        addPage("sub-page is missing BreadcrumbList structured data");
      } else if (Array.isArray(breadcrumbs.itemListElement)) {
        const items = breadcrumbs.itemListElement as Record<string, unknown>[];
        items.forEach((item, index) => {
          if (item.position !== index + 1) {
            addPage(`BreadcrumbList entry ${index + 1} has position ${String(item.position)}`);
          }
          if (typeof item.item !== "string" || !item.item.startsWith(`${ORIGIN}/`)) {
            addPage("BreadcrumbList item is not a production URL");
          }
        });
        const last = items.at(-1);
        if (last?.item !== canonical) {
          addPage("BreadcrumbList does not end at this page's canonical URL");
        }
      }
    }

    // Brand assets are referenced centrally; missing files break the build.
    const icons = page.links.filter((link) => link.rel.includes("icon"));
    const svgIcon = icons.find((link) => link.type === "image/svg+xml");
    if (!svgIcon?.href) addPage("missing SVG favicon link");
    if (icons.length === 0) addPage("missing favicon links");
    for (const icon of icons) {
      if (!icon.href) continue;
      if (icon.href.startsWith("/") && !(await fileExists(distDir, icon.href))) {
        addPage(`favicon ${icon.href} does not exist in dist/`);
      }
    }
    const apple = page.links.find((link) => link.rel.includes("apple-touch-icon"));
    if (!apple?.href || !(await fileExists(distDir, apple.href))) {
      addPage("apple-touch-icon is missing or does not exist in dist/");
    }
    const manifest = page.links.find((link) => link.rel.includes("manifest"));
    const manifestHref = manifest?.href;
    if (!manifestHref || !(await fileExists(distDir, manifestHref))) {
      addPage("web manifest is missing or does not exist in dist/");
    } else {
      try {
        const data = JSON.parse(
          await readFile(join(distDir, manifestHref.replace(/^\//, "")), "utf8"),
        ) as {
          name?: string;
          icons?: { src?: string }[];
        };
        if (!data.name) addPage("web manifest has no name");
        if (!Array.isArray(data.icons) || data.icons.length === 0) {
          addPage("web manifest has no icons");
        } else {
          for (const icon of data.icons) {
            if (!icon.src?.startsWith("/") || !(await fileExists(distDir, icon.src))) {
              addPage(`web manifest icon ${icon.src ?? "(missing src)"} does not exist in dist/`);
            }
          }
        }
      } catch {
        addPage("web manifest is not valid JSON");
      }
    }

    const routeForTitle = title ?? route;
    titles.set(routeForTitle, [...(titles.get(routeForTitle) ?? []), route]);
    if (description) {
      descriptions.set(description, [...(descriptions.get(description) ?? []), route]);
    }
    if (canonical) canonicals.set(canonical, [...(canonicals.get(canonical) ?? []), route]);
  }

  // Across the whole build.
  for (const [value, routes] of titles) {
    if (routes.length > 1) add(routes.join(", "), `duplicate title "${value}"`);
  }
  for (const [value, routes] of descriptions) {
    if (routes.length > 1) add(routes.join(", "), `duplicate meta description "${value}"`);
  }
  for (const [value, routes] of canonicals) {
    if (routes.length > 1) add(routes.join(", "), `duplicate canonical URL "${value}"`);
  }
  for (const [image, routes] of images) {
    if (routes.length > 1) add(routes.join(", "), `shared og:image ${image}`);
  }

  for (const path of expectedImages) {
    if (!emitted.has(path)) {
      add(path, "og:image was not emitted by the build");
      continue;
    }
    const file = join(distDir, path);
    const info = await stat(file);
    if (info.size === 0) {
      add(path, "og:image is empty");
      continue;
    }
    const meta = await sharp(file).metadata();
    if (meta.format !== "png") add(path, `og:image is ${meta.format ?? "unknown"}, expected png`);
    if (meta.width !== OG_WIDTH || meta.height !== OG_HEIGHT) {
      add(path, `og:image is ${meta.width}×${meta.height}, expected ${OG_WIDTH}×${OG_HEIGHT}`);
    }
  }

  for (const image of emitted) {
    if (!expectedImages.has(image)) add(image, "generated social image is referenced by no page");
  }

  // Sitemap: exactly the indexable pages, on the production origin.
  const indexable = pages.filter((page) => {
    const robots = first(page.metas.get("robots"))?.toLowerCase() ?? "";
    return !robots.includes("noindex");
  });
  const indexableRoutes = new Set(indexable.map((page) => page.route));

  // Editorial length checks are warnings, not failures. An exception must name
  // an indexable route, a real field, and a reason; otherwise it is a config
  // error and fails the build like any other contract violation.
  const metadataExceptions = site.seo.metadataExceptions.map((exception) => ({
    ...exception,
    route: normalizeRoute(exception.route),
  }));
  for (const exception of metadataExceptions) {
    if (!exception.reason.trim()) {
      add("/seo", `metadata exception for ${exception.route} (${exception.field}) has no reason`);
    }
    if (!indexableRoutes.has(exception.route)) {
      add(
        "/seo",
        `metadata exception names ${exception.route}, but no indexable page was built there`,
      );
    }
  }
  const warnings = metadataQualityWarnings(
    indexable.map((page) => ({
      route: page.route,
      title: first(page.title) ?? "",
      description: first(page.metas.get("description")) ?? "",
    })),
    metadataExceptions,
  );

  const expectedSitemap = new Set(indexable.map((page) => canonicalFor(page.route)));

  const sitemapSeen = new Set<string>();
  for (const url of sitemap.urls) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      add("/sitemap", `invalid URL in sitemap: ${url}`);
      continue;
    }
    if (parsed.origin !== ORIGIN) {
      add("/sitemap", `sitemap URL uses ${parsed.origin}, expected ${ORIGIN}`);
      continue;
    }
    if (parsed.search || parsed.hash) add("/sitemap", `sitemap URL has query/hash: ${url}`);
    if (sitemapSeen.has(url)) add("/sitemap", `duplicate sitemap URL: ${url}`);
    sitemapSeen.add(url);
    if (!expectedSitemap.has(url)) {
      add("/sitemap", `sitemap lists a URL with no indexable page: ${url}`);
    }
  }
  for (const url of expectedSitemap) {
    if (!sitemapSeen.has(url))
      add("/sitemap", `indexable page is missing from the sitemap: ${url}`);
  }

  // robots.txt: crawlable and pointing at the generated sitemap index.
  let robotsFile: string;
  try {
    robotsFile = await readFile(join(distDir, ROBOTS), "utf8");
  } catch {
    robotsFile = "";
    add("/robots.txt", "robots.txt was not generated");
  }
  if (robotsFile) {
    const lines = robotsFile.split("\n").map((line) => line.trim());
    if (!lines.some((line) => /^User-agent:\s*\*$/i.test(line))) {
      add("/robots.txt", "missing User-agent: *");
    }
    if (!lines.some((line) => /^Allow:\s*\/$/i.test(line))) {
      add("/robots.txt", "must allow the public site");
    }
    for (const line of lines) {
      const match = line.match(/^Disallow:\s*(\S*)$/i);
      if (
        match &&
        (match[1] === "/" || match[1].startsWith("/og") || match[1].startsWith("/blog"))
      ) {
        add("/robots.txt", `blocks public content: ${line}`);
      }
    }
    const expectedSitemapLine = `Sitemap: ${SITE_ROOT}${SITEMAP_INDEX}`;
    if (!lines.includes(expectedSitemapLine)) {
      add("/robots.txt", `missing "${expectedSitemapLine}"`);
    }
    if (/localhost|127\.0\.0\.1/i.test(robotsFile)) {
      add("/robots.txt", "contains a localhost URL");
    }
  }

  // RSS is advertised on every page; make sure it exists.
  if (!(await fileExists(distDir, "/rss.xml"))) add("/rss.xml", "RSS feed was not generated");

  if (problems.length > 0) {
    const grouped = new Map<string, string[]>();
    for (const problem of problems) {
      grouped.set(problem.route, [...(grouped.get(problem.route) ?? []), problem.message]);
    }
    const report = [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([route, messages]) =>
          `${route}\n${messages.map((message) => `  - ${message}`).join("\n")}`,
      )
      .join("\n\n");
    throw new Error(
      `SEO validation failed with ${problems.length} problem${problems.length === 1 ? "" : "s"}:\n\n${report}\n\n` +
        'Run "pnpm build" first, then inspect the route named above. See AGENTS.md → SEO.',
    );
  }

  return { pages: pages.length, images: emitted.size, sitemapUrls: sitemap.urls.length, warnings };
}
