/**
 * Social image path mapping, as a unit test.
 *
 * The property that matters is bijective: two different routes must never map
 * to the same file, and every produced segment must be a valid static file name.
 * A collision here means one page silently overwrites another's card.
 */
import { describe, expect, test } from "vitest";

import { ogImageAlt, ogImagePath, ogRouteKey, ogSegment } from "../../src/lib/og/paths";

describe("og image paths", () => {
  test("maps the root and simple pages by path", () => {
    expect(ogImagePath("/")).toBe("/og/home.png");
    expect(ogImagePath("/blog/")).toBe("/og/blog.png");
    expect(ogImagePath("/about/")).toBe("/og/about.png");
  });

  test("keeps nested article slugs nested", () => {
    expect(ogImagePath("/blog/static-first-astro/")).toBe("/og/blog/static-first-astro.png");
    expect(ogImagePath("/blog/2026/notes/one/")).toBe("/og/blog/2026/notes/one.png");
  });

  test("tolerates missing trailing slashes", () => {
    expect(ogImagePath("/blog")).toBe(ogImagePath("/blog/"));
    expect(ogImagePath("/blog/x")).toBe(ogImagePath("/blog/x/"));
  });

  test("folds unsafe and Unicode segments to valid, distinct file names", () => {
    const routes = [
      "/blog/Über-Straße/",
      "/blog/über-straße/",
      "/blog/hello world/",
      "/blog/hello-world/",
      "/blog/日本語/",
      "/blog/日本語2/",
      "/blog/a%20b/",
    ];

    const paths = routes.map(ogImagePath);
    expect(new Set(paths).size).toBe(routes.length);
    for (const path of paths) {
      expect(path).toMatch(/^\/og\/[a-z0-9\-/]+\.png$/);
    }
  });

  test("is deterministic", () => {
    expect(ogImagePath("/blog/日本語/")).toBe(ogImagePath("/blog/日本語/"));
  });

  test("route keys are the endpoint's catch-all param", () => {
    expect(ogRouteKey("/")).toBe("home");
    expect(ogRouteKey("/blog/")).toBe("blog");
    expect(ogRouteKey("/blog/x/")).toBe("blog/x");
    expect(`/og/${ogRouteKey("/blog/x/")}.png`).toBe(ogImagePath("/blog/x/"));
  });

  test("plain slugs pass through unchanged", () => {
    expect(ogSegment("css-design-tokens")).toBe("css-design-tokens");
    expect(ogSegment("Blog")).toBe("blog");
  });

  test("alt text stays whole-word and bounded", () => {
    const long = "word ".repeat(80);
    const alt = ogImageAlt({ title: "Title", description: long });
    expect(alt.length).toBeLessThanOrEqual(201);
    expect(alt.endsWith("…")).toBe(true);
    expect(alt).not.toMatch(/wor…$/);

    expect(ogImageAlt({ title: "T", description: "Short." })).toBe("T. Short.");
  });
});
