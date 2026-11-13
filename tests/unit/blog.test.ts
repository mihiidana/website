import { describe, expect, test } from "vitest";

import type { BlogPost } from "@/lib/blog";
import {
  displayDate,
  isoDate,
  postPath,
  publishedPosts,
  recentPosts,
  sortByDate,
} from "@/lib/blog";

function post(id: string, pubDate: string, draft = false): BlogPost {
  return {
    id,
    collection: "blog",
    data: {
      title: id,
      description: `${id} description`,
      pubDate: new Date(pubDate),
      draft,
    },
  } as BlogPost;
}

describe("postPath", () => {
  test("builds a trailing-slashed route from the content id", () => {
    expect(postPath("hello-world")).toBe("/blog/hello-world/");
  });

  test("keeps nested ids verbatim", () => {
    expect(postPath("2026/notes/first")).toBe("/blog/2026/notes/first/");
  });
});

describe("sortByDate", () => {
  test("orders newest first without mutating the input", () => {
    const input = [post("b", "2026-01-01"), post("c", "2026-03-01"), post("a", "2026-02-01")];
    expect(sortByDate(input).map((entry) => entry.id)).toEqual(["c", "a", "b"]);
    expect(input.map((entry) => entry.id)).toEqual(["b", "c", "a"]);
  });
});

describe("sortByDate tie-break", () => {
  test("equal dates fall back to the id so ordering is stable", () => {
    const input = [post("c", "2026-03-01"), post("a", "2026-03-01"), post("b", "2026-03-01")];
    expect(sortByDate(input).map((entry) => entry.id)).toEqual(["a", "b", "c"]);
    expect(sortByDate([...input].reverse()).map((entry) => entry.id)).toEqual(["a", "b", "c"]);
  });
});

describe("publishedPosts", () => {
  test("drops drafts and sorts the rest", () => {
    const input = [
      post("old", "2026-01-01"),
      post("draft", "2026-06-01", true),
      post("new", "2026-05-01"),
    ];
    expect(publishedPosts(input).map((entry) => entry.id)).toEqual(["new", "old"]);
  });

  test("treats a missing draft flag as published", () => {
    const entry = post("plain", "2026-01-01");
    expect(publishedPosts([entry]).map((item) => item.id)).toEqual(["plain"]);
  });

  test("returns an empty list for an empty collection", () => {
    expect(publishedPosts([])).toEqual([]);
  });
});

describe("recentPosts", () => {
  test("takes the newest published posts up to the limit", () => {
    const input = [
      post("oldest", "2026-01-01"),
      post("newest", "2026-06-01"),
      post("draft", "2026-07-01", true),
      post("middle", "2026-03-01"),
      post("second", "2026-05-01"),
      post("fifth", "2026-02-01"),
    ];
    expect(recentPosts(input, 4).map((entry) => entry.id)).toEqual([
      "newest",
      "second",
      "middle",
      "fifth",
    ]);
  });

  test("returns fewer than the limit when fewer posts are published", () => {
    expect(recentPosts([post("only", "2026-01-01")], 4).map((entry) => entry.id)).toEqual(["only"]);
  });

  test("returns nothing for an empty or fully drafted collection", () => {
    expect(recentPosts([], 4)).toEqual([]);
    expect(recentPosts([post("draft", "2026-01-01", true)], 4)).toEqual([]);
  });
});

describe("dates", () => {
  test("isoDate is a stable UTC calendar day", () => {
    expect(isoDate(new Date("2026-03-01T00:00:00Z"))).toBe("2026-03-01");
    expect(isoDate(new Date("2026-03-01T23:59:59Z"))).toBe("2026-03-01");
  });

  test("displayDate is human readable and timezone independent", () => {
    expect(displayDate(new Date("2026-03-01T00:00:00Z"))).toBe("March 1, 2026");
  });
});
