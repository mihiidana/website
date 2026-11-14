import { expect, test } from "@playwright/test";

import { builtPages } from "./dist";
import { BASE_URL } from "./site";

// Every internal link on every built page must resolve — catches typos and
// routes removed without updating an article, not just the two top-level pages.
test("every internal link resolves", async ({ page }) => {
  const pages = await builtPages();
  expect(pages.length).toBeGreaterThan(0);

  const hrefs = new Set<string>();
  for (const entry of pages) {
    await page.goto(entry.route);
    for (const link of await page.locator('a[href^="/"]').all()) {
      const href = await link.getAttribute("href");
      if (href) hrefs.add(href);
    }
  }

  expect(hrefs.size).toBeGreaterThan(0);
  for (const href of hrefs) {
    // A fragment or query never reaches the server; its path is what must exist.
    const url = new URL(href, BASE_URL);
    const response = await page.request.get(`${url.origin}${url.pathname}`);
    expect(response.status(), href).toBeLessThan(400);
  }
});
