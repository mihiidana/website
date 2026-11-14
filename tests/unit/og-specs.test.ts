/**
 * Static social cards are derived from page metadata, not from a separate
 * registry. These tests simulate a new static route by handing
 * `staticOgSpecs()` a page record the app does not otherwise know about.
 */
import { describe, expect, test } from "vitest";

import { assertUniqueOgPaths, ogImagePath } from "../../src/lib/og/paths";
import { type articleOgSpec, ogSpecs, pageOgSpec, staticOgSpecs } from "../../src/lib/og/specs";
import type { SitePage, SiteWriting } from "../../src/lib/site";
import { site } from "../../src/lib/site";

function newPage(overrides: Partial<SitePage> = {}): SitePage {
  return {
    route: "/about/",
    title: "About",
    seoTitle: "About mihidana: Background and Work",
    description: "Background, current work, and the things this site is built with.",
    intro: "Intro",
    ...overrides,
  };
}

const writing: SiteWriting = { ...site.writing };

describe("derived static specs", () => {
  test("a new route needs page metadata and no separate OG spec", () => {
    const specs = staticOgSpecs({ about: newPage() }, writing, []);
    const about = specs.find((spec) => spec.route === "/about/");

    expect(about).toMatchObject({
      kind: "page",
      title: "About mihidana: Background and Work",
      description: "Background, current work, and the things this site is built with.",
      eyebrow: "About",
    });
    expect(ogImagePath(about?.route ?? "")).toBe("/og/about.png");
  });

  test("the card uses the visible title when there is no seoTitle", () => {
    const spec = pageOgSpec(newPage({ seoTitle: undefined, eyebrow: "Notes" }));

    expect(spec.title).toBe("About");
    expect(spec.eyebrow).toBe("Notes");
  });

  test("every page in the site registry gets exactly one derived card", () => {
    const routes = staticOgSpecs().map((spec) => spec.route);
    const expected = [...Object.values(site.pages).map((page) => page.route), site.writing.route];

    expect(new Set(routes).size).toBe(routes.length);
    expect(new Set(routes)).toEqual(new Set(expected));
    expect(() => assertUniqueOgPaths(routes.map((route) => ({ route })))).not.toThrow();
  });

  test("the homepage keeps its identity design but reads the page description", () => {
    const home = pageOgSpec(site.pages.home);

    expect(home.kind).toBe("home");
    expect(home.title).toBe(site.name);
    expect(home.description).toBe(site.pages.home.description);
  });

  test("noindex pages emit no card, so no orphaned image is written", () => {
    const specs = staticOgSpecs({ about: newPage() }, writing, ["/about/"]);

    expect(specs.map((spec) => spec.route)).not.toContain("/about/");
  });

  test("the build registry adds one derived card per published article", () => {
    const post = {
      id: "example",
      data: {
        title: "An Example Post",
        description: "A description from the post's own frontmatter.",
        pubDate: new Date("2026-01-02T00:00:00Z"),
      },
    } as Parameters<typeof articleOgSpec>[0];

    const specs = ogSpecs([post]);
    const article = specs.find((spec) => spec.route === "/blog/example/");

    expect(article).toMatchObject({
      kind: "article",
      title: "An Example Post",
      description: "A description from the post's own frontmatter.",
    });
    expect(ogImagePath(article?.route ?? "")).toBe("/og/blog/example.png");
    expect(() => assertUniqueOgPaths(specs)).not.toThrow();
  });
});
