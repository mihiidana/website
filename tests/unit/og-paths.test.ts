/**
 * Social image path mapping, as a unit test.
 *
 * The property that matters is bijective: two different routes must never map
 * to the same file, and every produced segment must be a valid static file name.
 * A collision here means one page silently overwrites another's card.
 */
import { describe, expect, test } from "vitest";

import {
  assertUniqueOgPaths,
  ogImageAlt,
  ogImagePath,
  ogRouteKey,
  ogSegment,
} from "../../src/lib/og/paths";

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

describe("route encoding", () => {
  /**
   * The SEO head sees `Astro.url.pathname` (percent-encoded) while the registry
   * and the endpoint see raw collection IDs. Both must produce one file.
   */
  test("raw and percent-encoded routes map to the same image", () => {
    const pairs: [raw: string, encoded: string][] = [
      ["/blog/über-café/", "/blog/%C3%BCber-caf%C3%A9/"],
      ["/blog/hello world/", "/blog/hello%20world/"],
      ["/blog/日本語/", "/blog/%E6%97%A5%E6%9C%AC%E8%AA%9E/"],
      ["/blog/naïve résumé/", "/blog/na%C3%AFve%20r%C3%A9sum%C3%A9/"],
    ];

    for (const [raw, encoded] of pairs) {
      expect(ogImagePath(encoded), encoded).toBe(ogImagePath(raw));
    }
  });

  test("decodes a segment before folding, not the whole path", () => {
    // A literal `%` survives as a folded character rather than throwing.
    expect(ogImagePath("/blog/100% real/")).toMatch(/^\/og\/blog\/100-real-[a-z0-9]+\.png$/);
    // An encoded separator must not create an extra directory level.
    expect(ogImagePath("/blog/a%2Fb/")).toBe(ogImagePath("/blog/a%2fb/"));
    expect(ogImagePath("/blog/a%2Fb/").split("/").filter(Boolean)).toHaveLength(3);
  });

  test("every encoded form stays a valid file name", () => {
    for (const route of ["/blog/%C3%BCber/", "/blog/a%20b/", "/blog/%E6%97%A5/", "/blog/100%/"]) {
      expect(ogImagePath(route)).toMatch(/^\/og\/[a-z0-9\-/]+\.png$/);
    }
  });
});

describe("uniqueness invariant", () => {
  test("accepts a registry of distinct routes", () => {
    expect(() =>
      assertUniqueOgPaths([
        { route: "/" },
        { route: "/blog/" },
        { route: "/blog/one/" },
        { route: "/blog/two/" },
      ]),
    ).not.toThrow();
  });

  test("rejects a route declared twice", () => {
    expect(() => assertUniqueOgPaths([{ route: "/blog/" }, { route: "/blog/" }])).toThrow(
      /declared more than once/,
    );
  });

  test("rejects two routes that fold to the same file, naming both", () => {
    // `caf%C3%A9` and `café` are different route strings that decode to the
    // same segment, so both fold to one file. The assertion is what catches it.
    const routes = [{ route: "/blog/caf%C3%A9/" }, { route: "/blog/café/" }];
    expect(() => assertUniqueOgPaths(routes)).toThrow(/both map to/);
    try {
      assertUniqueOgPaths(routes);
    } catch (error) {
      expect((error as Error).message).toContain("/blog/caf%C3%A9/");
      expect((error as Error).message).toContain("/blog/café/");
    }
  });

  test("encoded and raw spellings of one route collide by design", () => {
    // Same page, two spellings: the assertion is what stops the build from
    // generating the card twice.
    expect(() => assertUniqueOgPaths([{ route: "/blog/a%20b/" }, { route: "/blog/a b/" }])).toThrow(
      /both map to/,
    );
  });
});
