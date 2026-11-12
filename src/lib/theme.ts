/**
 * Theme constants and helpers — the single source of truth for the light/dark
 * system. The site defaults to dark; a visitor's persisted choice wins.
 *
 * Consumers:
 * - `Layout.astro` interpolates the constants into the pre-paint bootstrap
 *   script (so the theme applies before first render).
 * - `mode-toggle.astro` imports them for the toggle behavior.
 * - `tests/unit/theme.test.ts` covers the pure logic.
 */
export type Theme = "dark" | "light";

/** localStorage key for the persisted theme. */
export const THEME_STORAGE_KEY = "theme";

/** `<meta name="theme-color">` value per theme (browser chrome color). */
export const THEME_COLORS: Record<Theme, string> = {
  dark: "#0a0a0a",
  light: "#ffffff",
};

/**
 * Resolve the effective theme from a persisted value. Anything other than a
 * valid stored choice falls back to the dark default.
 */
export function resolveTheme(stored: string | null | undefined): Theme {
  return stored === "light" || stored === "dark" ? stored : "dark";
}
