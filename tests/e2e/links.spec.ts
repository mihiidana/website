import { expect, test } from "@playwright/test";

import { BASE_URL, PAGES } from "./site";

// Every internal link must resolve on the built site — catches typos and
// routes removed without updating navigation.
test("every internal link resolves", async ({ page }) => {
  const hrefs = new Set<string>();

  for (const path of PAGES) {
    await page.goto(path);
    for (const link of await page.locator('a[href^="/"]').all()) {
      const href = await link.getAttribute("href");
      if (href) hrefs.add(href);
    }
  }

  expect(hrefs.size).toBeGreaterThan(0);
  for (const href of hrefs) {
    const response = await page.request.get(new URL(href, BASE_URL).href);
    expect(response.status(), href).toBeLessThan(400);
  }
});
