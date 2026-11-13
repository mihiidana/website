import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { expect, test } from "@playwright/test";

import { site } from "../../src/lib/site";

const DIST = new URL("../../dist/", import.meta.url);
const ORIGIN = new URL(site.url).origin;

type BuiltPage = { route: string; html: string };

async function builtPages(): Promise<BuiltPage[]> {
  const entries = await readdir(DIST, { recursive: true, withFileTypes: true });
  const pages: BuiltPage[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
    const file = join(entry.parentPath, entry.name);
    const path = relative(DIST.pathname, file).replaceAll("\\", "/");
    if (path === "404.html") continue;
    pages.push({
      route: `/${path}`.replace(/index\.html$/, ""),
      html: await readFile(file, "utf8"),
    });
  }

  return pages.sort((a, b) => a.route.localeCompare(b.route));
}

function meta(html: string, key: string): string | undefined {
  const byProperty = html.match(new RegExp(`<meta property="${key}" content="([^"]*)"`))?.[1];
  return byProperty ?? html.match(new RegExp(`<meta name="${key}" content="([^"]*)"`))?.[1];
}

function jsonLd(html: string): { "@graph": Record<string, unknown>[] } {
  const payload = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  expect(payload, "JSON-LD script").toBeTruthy();
  return JSON.parse(payload ?? "");
}

const pages = await builtPages();

test("every built page has exactly one absolute canonical on the production origin", async () => {
  expect(pages.length).toBeGreaterThan(1);

  const canonicals = new Set<string>();
  for (const page of pages) {
    const tags = [...page.html.matchAll(/<link rel="canonical" href="([^"]*)"/g)];
    expect(tags, `${page.route} canonical count`).toHaveLength(1);

    const canonical = tags[0][1];
    const url = new URL(canonical);
    expect(url.origin, page.route).toBe(ORIGIN);
    expect(url.protocol, page.route).toBe("https:");
    expect(url.search, page.route).toBe("");
    expect(url.hash, page.route).toBe("");
    expect(url.pathname, page.route).toBe(page.route);
    expect(canonicals.has(canonical), `${page.route} duplicates a canonical`).toBe(false);
    canonicals.add(canonical);
  }
});

test("every page declares complete, consistent social metadata", async () => {
  for (const page of pages) {
    const title = page.html.match(/<title>([^<]*)<\/title>/)?.[1];
    const description = meta(page.html, "description");
    const canonical = page.html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
    const image = meta(page.html, "og:image");

    expect(title, `${page.route} title`).toBeTruthy();
    expect(description, `${page.route} description`).toBeTruthy();
    expect(meta(page.html, "og:title"), page.route).toBe(title);
    expect(meta(page.html, "og:description"), page.route).toBe(description);
    expect(meta(page.html, "og:url"), page.route).toBe(canonical);
    expect(meta(page.html, "og:site_name"), page.route).toBe(site.name);
    expect(meta(page.html, "og:locale"), page.route).toBe(site.seo.ogLocale);
    expect(meta(page.html, "og:image:width"), page.route).toBe("1200");
    expect(meta(page.html, "og:image:height"), page.route).toBe("630");
    expect(meta(page.html, "og:image:type"), page.route).toBe("image/png");
    expect(meta(page.html, "og:image:alt"), page.route).toBeTruthy();
    expect(image, page.route).toMatch(new RegExp(`^${site.url}/og/.+\\.png$`));
    expect(meta(page.html, "twitter:card"), page.route).toBe(site.seo.twitterCard);
    expect(meta(page.html, "twitter:title"), page.route).toBe(title);
    expect(meta(page.html, "twitter:description"), page.route).toBe(description);
    expect(meta(page.html, "twitter:image"), page.route).toBe(image);
    expect(meta(page.html, "twitter:image:alt"), page.route).toBe(meta(page.html, "og:image:alt"));
  }
});

test("every page ships one valid, uniquely-identified JSON-LD graph", async () => {
  for (const page of pages) {
    const graph = jsonLd(page.html)["@graph"];
    expect(graph.length, page.route).toBeGreaterThan(2);

    const types = graph.map((node) => node["@type"]);
    expect(types, page.route).toContain("Person");
    expect(types, page.route).toContain("WebSite");
    expect(
      types.some((type) => ["WebPage", "CollectionPage", "BlogPosting"].includes(String(type))),
      page.route,
    ).toBe(true);

    const ids = graph.map((node) => node["@id"]).filter((id): id is string => Boolean(id));
    expect(new Set(ids).size, `${page.route} duplicate @id`).toBe(ids.length);
  }
});

test("the writing archive describes itself as a collection with a breadcrumb trail", async () => {
  const page = pages.find((entry) => entry.route === "/blog/");
  expect(page).toBeDefined();
  const graph = jsonLd(page?.html ?? "")["@graph"];
  const types = graph.map((node) => node["@type"]);

  expect(types).toContain("CollectionPage");
  expect(types).toContain("ItemList");
  expect(types).toContain("BreadcrumbList");
});

test("article pages carry BlogPosting data with real dates and a breadcrumb trail", async () => {
  const articles = pages.filter((page) => meta(page.html, "og:type") === "article");
  expect(articles.length).toBeGreaterThan(0);

  for (const page of articles) {
    const graph = jsonLd(page.html)["@graph"];
    const article = graph.find((node) => node["@type"] === "BlogPosting");
    expect(article, page.route).toBeDefined();
    expect(article?.datePublished, page.route).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(article?.url, page.route).toContain(page.route);
    expect(
      graph.some((node) => node["@type"] === "BreadcrumbList"),
      page.route,
    ).toBe(true);
  }
});
