import { expect, test } from "@playwright/test";

import { site } from "../../src/lib/site";

// The homepage renders without explicit SEO props, so these assertions pin
// the defaults Layout/head produce from site.ts.
test("the homepage exposes canonical and social metadata", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(site.name);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    site.description,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${site.url}/`);

  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", site.name);
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    "content",
    site.description,
  );
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "website");
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", `${site.url}/`);
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute("content", site.name);

  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary");
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute("content", site.name);
  await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute(
    "content",
    site.description,
  );
});
