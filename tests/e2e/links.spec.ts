import { expect, test } from "@playwright/test";

import { builtPages } from "./dist";
import { internalTargets } from "./links";
import { BASE_URL } from "./site";

// Every internal link on every built page must resolve — catches typos and
// routes removed without updating an article, not just the two top-level pages.
test("every internal link resolves", async ({ page }) => {
  const pages = await builtPages();
  expect(pages.length).toBeGreaterThan(0);

  const hrefs: string[] = [];
  for (const entry of pages) {
    await page.goto(entry.route);
    hrefs.push(
      ...(await page
        .locator("a[href]")
        .evaluateAll((nodes) =>
          nodes.map((node) => (node as HTMLAnchorElement).getAttribute("href") ?? ""),
        )),
    );
  }

  const targets = internalTargets(hrefs, BASE_URL);
  expect(targets.length).toBeGreaterThan(0);
  for (const target of targets) {
    const response = await page.request.get(target);
    expect(response.status(), target).toBeLessThan(400);
  }
});
