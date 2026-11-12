/**
 * Routes under test. Add every new route here so smoke, accessibility, and
 * CSP checks cover it (see AGENTS.md → Validation). Individual blog articles
 * are discovered dynamically in `blog.spec.ts`.
 */
export const PAGES = ["/", "/blog/"];

/** Local base URL the production build is served from (matches playwright.config.ts). */
export const BASE_URL = "http://localhost:4399";
