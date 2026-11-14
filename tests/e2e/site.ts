/**
 * Routes under test. Add every new route here so smoke, accessibility, and
 * CSP checks cover it (see AGENTS.md → Validation). Individual blog articles
 * are discovered dynamically in `blog.spec.ts`; the technical 404 page is
 * covered by `not-found.spec.ts` because it must respond with status 404.
 */
export const PAGES = ["/", "/blog/"];

/** Local base URL the production build is served from (matches playwright.config.ts). */
export const BASE_URL = "http://localhost:4399";
