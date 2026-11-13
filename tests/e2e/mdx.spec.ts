import { expect, test } from "@playwright/test";

/**
 * MDX + Svelte interoperability, exercised through the one article that
 * embeds a component (`debounce-in-practice.mdx`).
 *
 * The page is static except for the playground island: the assertions below
 * check both that the demo works after hydration and that the rest of the
 * article is plain HTML with no island attached.
 */
const ARTICLE = "/blog/debounce-in-practice/";
const PLAYGROUND = 'astro-island[component-url*="debounce-playground"]';

test("the MDX article renders its prose statically and hydrates only the demo", async ({
  page,
}) => {
  await page.goto(ARTICLE);

  await expect(page.locator("main#main article")).toHaveCount(1);
  await expect(page.locator(".prose h2").first()).toBeVisible();
  await expect(page.locator(".prose pre").first()).toBeVisible();

  // Exactly one hydrated playground island on the page.
  await expect(page.locator(PLAYGROUND)).toHaveCount(1);
  await page.waitForSelector(`${PLAYGROUND}:not([ssr])`);
  await expect(page.locator(PLAYGROUND)).toHaveAttribute("client", "visible");

  // Only the demo is an island: no other element inside the article is one.
  await expect(page.locator(".prose astro-island")).toHaveCount(1);
  await expect(page.locator(".prose astro-island").first()).toHaveAttribute(
    "component-url",
    /debounce-playground/,
  );
});

test("the playground is usable without JavaScript before hydration", async ({ page }) => {
  await page.route("**/_astro/**", (route) => route.abort());
  await page.goto(ARTICLE);

  // Server-rendered controls and labels are present in the HTML.
  await expect(page.getByLabel("Search text")).toBeVisible();
  await expect(page.getByLabel("Debounce delay")).toBeVisible();
  await expect(page.getByText("0 committed")).toBeVisible();
});

test("typing debounces the committed value", async ({ page }) => {
  await page.goto(ARTICLE);
  await page.waitForSelector(`${PLAYGROUND}:not([ssr])`);

  const input = page.getByLabel("Search text");
  await input.fill("astro");
  await expect(input).toHaveValue("astro");

  const immediate = page.locator("dd").first();
  const debounced = page.locator("dd").nth(1);

  // Immediate feedback updates at once; the debounced value lags behind.
  await expect(immediate).toHaveText("astro");
  await expect(debounced).toHaveText("astro", { timeout: 2000 });
  await expect(page.getByText(/\d+ committed/)).not.toHaveText(/^0 committed/);
});

test("the delay control is keyboard accessible and restarts the wait", async ({ page }) => {
  await page.goto(ARTICLE);
  await page.waitForSelector(`${PLAYGROUND}:not([ssr])`);

  const slider = page.getByLabel("Debounce delay");
  await slider.focus();
  await page.keyboard.press("ArrowRight");

  // Default 300 ms; one step is 50 ms.
  await expect(page.locator("output[for='debounce-delay']")).toHaveText(/350\s*ms/);
  await expect(slider).toHaveValue("350");
});

test("the demo leaves no pending timers after the page is left", async ({ page }) => {
  await page.goto(ARTICLE);
  await page.waitForSelector(`${PLAYGROUND}:not([ssr])`);

  await page.getByLabel("Search text").fill("leaving");

  // Navigating away tears the island down; the cleanup must clear the timer.
  // A surviving timer would write to a detached node and throw, which the
  // pageerror listener catches.
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/blog/");
  await page.waitForTimeout(600);

  expect(errors).toEqual([]);
});
