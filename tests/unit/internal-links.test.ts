import { describe, expect, test } from "vitest";

import { internalTargets } from "../e2e/links";

const BASE = "http://localhost:4399";

describe("internal link collection", () => {
  test("keeps root-relative and relative links on the site origin", () => {
    expect(
      internalTargets(["/blog/", "about/", "../rss.xml", "#top"], `${BASE}/blog/post/`),
    ).toEqual([
      `${BASE}/blog/`,
      `${BASE}/blog/post/`,
      `${BASE}/blog/post/about/`,
      `${BASE}/blog/rss.xml`,
    ]);
  });

  test("drops absolute, protocol-relative, and non-http external links", () => {
    expect(
      internalTargets(
        ["https://example.com/x", "//cdn.example.com/x", "mailto:hello@example.com", "http://["],
        BASE,
      ),
    ).toEqual([]);
  });
});
