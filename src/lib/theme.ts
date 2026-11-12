/**
 * Theme constants — the single source of truth for the light/dark system.
 * The site defaults to dark; a visitor's persisted choice wins.
 *
 * Consumers:
 * - `Layout.astro` interpolates the constants into the pre-paint bootstrap
 *   script (so the theme applies before first render).
 * - `mode-toggle.astro` imports them for the toggle behavior.
 * - `tests/unit/theme.test.ts` covers the constant contract.
 *
 * The bootstrap's fallback rule ("anything but a valid stored choice is
 * dark") is intentionally kept inline in Layout.astro — it must run before
 * paint and cannot import modules — and is covered by Playwright in
 * `tests/e2e/theme.spec.ts`.
 */
export type Theme = "dark" | "light";

/** localStorage key for the persisted theme. */
export const THEME_STORAGE_KEY = "theme";

/** `<meta name="theme-color">` value per theme (browser chrome color). */
export const THEME_COLORS: Record<Theme, string> = {
  dark: "#0a0a0a",
  light: "#ffffff",
};
