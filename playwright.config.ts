import { defineConfig, devices } from "@playwright/test";

import { BASE_URL } from "./tests/e2e/site";

/**
 * E2E tests run against the production build in dist/, served by
 * `astro preview`. Build first: `pnpm build && pnpm test:e2e`
 * (`pnpm validate` does this).
 *
 * The port is dedicated to E2E: a dev server on 4321 must never be reused,
 * since dev mode does not emit the built page's CSP meta tag.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm exec astro preview --port 4399",
    port: 4399,
    // Astro auto-backgrounds servers when it detects an agent, which makes
    // the command exit before the port opens. Force foreground here.
    env: { ASTRO_PREVIEW_BACKGROUND: "1" },
    // Never reuse a server from an earlier run: it may be serving a stale
    // dist/ after a rebuild, which turns the suite into a false green.
    reuseExistingServer: false,
  },
});
