import { describe, expect, test } from "vitest";

import { absoluteUrl, buildPageSeo, normalizeRoute } from "../../src/lib/seo";
import { buildStructuredData, serializeJsonLd } from "../../src/lib/seo/jsonld";
import { metadataQualityWarnings } from "../../src/lib/seo/quality";
import { site } from "../../src/lib/site";

describe("canonical routes", () => {
  test("normalizes to one trailing-slashed path", () => {
    expect(normalizeRoute("/")).toBe("/");
    expect(normalizeRoute("/blog")).toBe("/blog/");
    expect(normalizeRoute("/blog/")).toBe("/blog/");
  });

  test("drops query strings and fragments", () => {
    expect(normalizeRoute("/blog/x?utm_source=test#top")).toBe("/blog/x/");
  });

  test("builds absolute URLs on the configured production origin", () => {
    expect(absoluteUrl("/blog/")).toBe(`${site.url}/blog/`);
  });
});

describe("page metadata", () => {
  test("composes title, canonical, locale, and a route-derived card", () => {
    const seo = buildPageSeo({
      route: "/blog/example/",
      title: "Example",
      description: "An example post.",
    });

    expect(seo.title).toBe(`Example — ${site.name}`);
    expect(seo.headline).toBe("Example");
    expect(seo.canonical).toBe(`${site.url}/blog/example/`);
    expect(seo.locale).toBe(site.seo.ogLocale);
    expect(seo.type).toBe("website");
    expect(seo.noindex).toBe(false);
    expect(seo.image).toMatchObject({
      url: `${site.url}/og/blog/example.png`,
      width: 1200,
      height: 630,
      type: "image/png",
    });
    expect(seo.twitter.card).toBe(site.seo.twitterCard);
  });

  test("does not repeat the site name in its own title", () => {
    const seo = buildPageSeo({ route: "/", title: site.name, description: site.description });
    expect(seo.title).toBe(site.name);
  });

  test("appends the site name exactly once to a page-specific title", () => {
    const seo = buildPageSeo({
      route: "/",
      title: site.pages.home.seoTitle ?? "",
      description: site.description,
    });

    expect(seo.title).toBe(`${site.pages.home.seoTitle} — ${site.name}`);
    expect(seo.title.match(/mihidana/g)).toHaveLength(1);
  });

  test("does not append the site name twice when a title already carries it", () => {
    const seo = buildPageSeo({
      route: "/blog/",
      title: `Writing — ${site.name}`,
      description: site.writing.description,
    });

    expect(seo.title).toBe(`Writing — ${site.name}`);
    expect(seo.title.match(/mihidana/g)).toHaveLength(1);
  });

  test("noindex pages omit social images and use a summary card", () => {
    const seo = buildPageSeo({
      route: "/internal/",
      title: "Internal",
      description: "Not for search.",
      noindex: true,
    });

    expect(seo.noindex).toBe(true);
    expect(seo.image).toBeUndefined();
    expect(seo.twitter.card).toBe("summary");
  });

  test("technical 404s keep noindex but drop the canonical and structured-data inputs", () => {
    const seo = buildPageSeo({
      route: "/404/",
      title: "404",
      description: "This page doesn't exist.",
      isNotFound: true,
    });

    expect(seo.isNotFound).toBe(true);
    expect(seo.noindex).toBe(true);
    expect(seo.canonical).toBeUndefined();
    expect(seo.image).toBeUndefined();
    expect(seo.twitter.card).toBe("summary");
    expect(() => buildStructuredData(seo)).toThrow(/canonical/);
  });

  test("never invents a twitter:site when the config has no handle", () => {
    const seo = buildPageSeo({ route: "/", title: "Home", description: "Home." });
    expect(seo.twitter.site).toBeUndefined();
    expect(seo.twitter.creator).toBeUndefined();
  });
});

describe("structured data", () => {
  test("every page connects Person, WebSite, and a page entity", () => {
    const seo = buildPageSeo({
      route: "/blog/",
      title: "Writing",
      description: "Writing by mihidana.",
      items: [{ name: "One", path: "/blog/one/" }],
    });
    const graph = buildStructuredData(seo);
    const types = graph["@graph"].map((node) => node["@type"]);

    expect(graph["@context"]).toBe("https://schema.org");
    expect(types).toContain("Person");
    expect(types).toContain("WebSite");
    expect(types).toContain("CollectionPage");
    expect(types).toContain("ItemList");

    const ids = graph["@graph"].map((node) => node["@id"]).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("articles include BlogPosting dates, author, publisher, and image", () => {
    const seo = buildPageSeo({
      route: "/blog/example/",
      title: "Example",
      description: "An example post.",
      type: "article",
      publishedTime: "2026-01-02",
      modifiedTime: "2026-02-03",
      breadcrumbs: [
        { name: site.name, path: "/" },
        { name: "Writing", path: "/blog/" },
        { name: "Example", path: "/blog/example/" },
      ],
    });
    const graph = buildStructuredData(seo);
    const article = graph["@graph"].find((node) => node["@type"] === "BlogPosting");

    expect(article).toMatchObject({
      headline: "Example",
      url: `${site.url}/blog/example/`,
      datePublished: "2026-01-02",
      dateModified: "2026-02-03",
    });
    expect(article?.author).toEqual({ "@id": `${site.url}/#person` });
    expect(article?.publisher).toEqual({ "@id": `${site.url}/#person` });
    expect(article?.image).toEqual([`${site.url}/og/blog/example.png`]);
    expect(
      graph["@graph"].find((node) => node["@type"] === "BreadcrumbList")?.itemListElement,
    ).toHaveLength(3);
  });

  test("JSON-LD serialization cannot close the script element", () => {
    const payload = serializeJsonLd({ value: "</script><script>alert(1)</script>" });
    expect(payload).not.toContain("</script>");
    expect(payload).toContain("\\u003c");
    expect(JSON.parse(payload).value).toBe("</script><script>alert(1)</script>");
  });
});

describe("metadata quality", () => {
  const titled = (title: string) => ({ route: "/page/", title, description: "x".repeat(120) });
  const described = (description: string) => ({
    route: "/page/",
    title: "A descriptive page title that is long enough",
    description,
  });

  test("flags titles and descriptions below the useful range", () => {
    expect(metadataQualityWarnings([titled("Too short")])[0]).toMatchObject({
      route: "/page/",
      field: "title",
      length: 9,
    });
    expect(metadataQualityWarnings([described("Too short.")])[0]).toMatchObject({
      route: "/page/",
      field: "description",
      length: 10,
    });
  });

  test("flags titles and descriptions that will be truncated", () => {
    expect(metadataQualityWarnings([titled("t".repeat(71))])[0]).toMatchObject({
      field: "title",
      length: 71,
    });
    expect(metadataQualityWarnings([described("d".repeat(201))])[0]).toMatchObject({
      field: "description",
      length: 201,
    });
  });

  test("accepts copy near the editorial target without warning", () => {
    expect(
      metadataQualityWarnings([
        {
          route: "/page/",
          title: "A descriptive page title for testing",
          description:
            "A description with enough context to explain what this page contains and why a reader should continue.",
        },
      ]),
    ).toEqual([]);
  });

  test("an exception with a reason suppresses only its field", () => {
    const warnings = metadataQualityWarnings(
      [{ route: "/page/", title: "Short", description: "Also short." }],
      [{ route: "/page/", field: "title", reason: "Brand name is deliberately terse." }],
    );

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ field: "description" });
  });
});
