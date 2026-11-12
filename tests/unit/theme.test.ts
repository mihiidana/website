import { describe, expect, it } from "vitest";

import { THEME_COLORS, THEME_STORAGE_KEY } from "@/lib/theme";

// These constants are interpolated into the pre-paint bootstrap in
// Layout.astro. The bootstrap's runtime behavior (valid, invalid, missing,
// and blocked storage) is covered end-to-end in tests/e2e/theme.spec.ts.
describe("theme constants", () => {
  it("provides a browser-chrome color for every theme", () => {
    expect(Object.keys(THEME_COLORS).sort()).toEqual(["dark", "light"]);
    for (const color of Object.values(THEME_COLORS)) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("uses the storage key the bootstrap and the toggle agree on", () => {
    expect(THEME_STORAGE_KEY).toBe("theme");
  });
});
