import { readFile } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { site } from "../../src/lib/site";
import { meta } from "./dist";

/**
 * The technical 404 page. `astro preview` serves `dist/404.html` with a real
 * 404 status only for trailing-slash paths, matching `trailingSlash: "always"`,
 * so the missing route must end with `/`.
 */
const COPY = site.notFound;
const MISSING = "/this-page-does-not-exist/";

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
};

test("an unknown URL serves the custom 404 page with a 404 status", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // The browser reports the main document's 404 response as a console error;
    // that status is the point of this page.
    if (message.text().includes("status of 404")) return;
    errors.push(message.text());
  });

  const response = await page.goto(MISSING);
  expect(response?.status()).toBe(404);

  // The shared chrome still renders, so this is part of the site, not a bare
  // error response.
  await expect(page.locator("main#main")).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expect(page.getByRole("link", { name: `${site.name} home` })).toHaveAttribute("href", "/");
  await expect(page.locator('meta[http-equiv="content-security-policy"]')).toHaveCount(1);

  await expect(page.getByText(COPY.label, { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(COPY.heading);
  await expect(page.getByText(COPY.body)).toBeVisible();
  for (const link of [COPY.home, COPY.writing]) {
    await expect(page.getByRole("link", { name: link.label, exact: true })).toHaveAttribute(
      "href",
      link.href,
    );
  }

  expect(errors).toEqual([]);
});

test("both navigation links work from the keyboard", async ({ page }) => {
  const destinations = [
    { link: COPY.home, heading: site.pages.home.title },
    { link: COPY.writing, heading: site.writing.title },
  ];

  for (const { link, heading } of destinations) {
    await page.goto(MISSING);
    const target = page.getByRole("link", { name: link.label, exact: true });

    await target.focus();
    await expect(target).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(link.href);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
  }
});

test("the 404 response keeps noindex but suppresses canonical and structured data", async ({
  page,
}) => {
  const response = await page.goto(MISSING);
  expect(response?.status()).toBe(404);

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary");
  expect(await page.locator('link[rel="canonical"]').count()).toBe(0);
  expect(await page.locator('script[type="application/ld+json"]').count()).toBe(0);
  expect(await page.locator('meta[property="og:url"]').count()).toBe(0);
  expect(await page.locator('meta[property="og:image"]').count()).toBe(0);
  expect(await page.locator('meta[name="twitter:image"]').count()).toBe(0);
});

test("404.html is emitted, unindexed, and absent from the sitemap", async ({ page }) => {
  const html = await readFile(new URL("../../dist/404.html", import.meta.url), "utf8");

  expect(meta(html, "description")).toBe(COPY.description);
  expect(meta(html, "robots")).toBe("noindex, nofollow");
  expect(meta(html, "og:url")).toBeUndefined();
  expect(meta(html, "og:image")).toBeUndefined();
  expect(meta(html, "twitter:image")).toBeUndefined();
  expect(html).not.toContain('rel="canonical"');
  expect(html).not.toContain('type="application/ld+json"');

  const sitemap = await (await page.request.get("/sitemap-0.xml")).text();
  expect(sitemap).not.toContain(`${site.url}/404/`);
});

for (const [device, viewport] of Object.entries(VIEWPORTS)) {
  test(`the 404 page has no serious accessibility violations on ${device}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    // Measure final colors, not mid-fade ones.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(MISSING);

    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(
      serious.map(
        (violation) =>
          `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`,
      ),
    ).toEqual([]);

    if (device === "mobile") {
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    }
  });
}
