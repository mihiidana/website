import { describe, expect, test } from "vitest";

import { collections } from "@/content.config";

const schema = collections.blog.schema as {
  safeParse: (value: unknown) => {
    success: boolean;
    data?: Record<string, unknown>;
    error?: { issues: { path: (string | number)[]; message: string }[] };
  };
};

const valid = {
  title: "A post",
  description: "What it is about.",
  pubDate: "2026-03-01",
};

/** Parses and narrows to the parsed data, failing the test on invalid input. */
function parse(value: unknown): Record<string, unknown> {
  const result = schema.safeParse(value);
  expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  if (!result.success) throw new Error("unreachable: schema rejected valid input");
  return result.data ?? {};
}

describe("blog collection schema", () => {
  test("accepts the required frontmatter and defaults draft to false", () => {
    const data = parse(valid);
    expect(data.draft).toBe(false);
    expect(data.pubDate).toBeInstanceOf(Date);
    expect(data.updatedDate).toBeUndefined();
  });

  test("coerces date-only frontmatter to UTC midnight", () => {
    expect((parse(valid).pubDate as Date).toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  test("accepts an updated date and an explicit draft flag", () => {
    const data = parse({ ...valid, updatedDate: "2026-03-05", draft: true });
    expect((data.updatedDate as Date).toISOString()).toBe("2026-03-05T00:00:00.000Z");
    expect(data.draft).toBe(true);
  });

  for (const field of ["title", "description", "pubDate"] as const) {
    test(`rejects a post without ${field}`, () => {
      const { [field]: _omitted, ...rest } = valid;
      const result = schema.safeParse(rest);
      expect(result.success).toBe(false);
      expect(result.error?.issues.some((issue) => issue.path[0] === field)).toBe(true);
    });
  }

  test("rejects an unparseable publication date", () => {
    const result = schema.safeParse({ ...valid, pubDate: "not-a-date" });
    expect(result.success).toBe(false);
  });

  test("rejects a non-boolean draft flag", () => {
    const result = schema.safeParse({ ...valid, draft: "yes" });
    expect(result.success).toBe(false);
  });
});
