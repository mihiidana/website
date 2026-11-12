import { describe, expect, it } from "vitest";

import { resolveTheme, THEME_COLORS, THEME_STORAGE_KEY } from "@/lib/theme";

describe("resolveTheme", () => {
  it("returns the persisted theme when it is valid", () => {
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
  });

  it("falls back to the dark default for missing or unknown values", () => {
    expect(resolveTheme(null)).toBe("dark");
    expect(resolveTheme(undefined)).toBe("dark");
    expect(resolveTheme("")).toBe("dark");
    expect(resolveTheme("system")).toBe("dark");
  });
});

describe("theme constants", () => {
  it("provides a browser-chrome color for every theme", () => {
    for (const color of Object.values(THEME_COLORS)) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("uses the storage key the bootstrap and the toggle agree on", () => {
    expect(THEME_STORAGE_KEY).toBe("theme");
  });
});
