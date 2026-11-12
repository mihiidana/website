import { expect, type Page, test } from "@playwright/test";

async function waitForIsland(page: Page, name: string) {
  await page.waitForSelector(`astro-island[component-url*="${name}"]:not([ssr])`);
}

test("the clock switches between analog and digital labels", async ({ page }) => {
  await page.goto("/");
  await waitForIsland(page, "clock");

  const analog = page.getByRole("button", { name: /Analog clock for Dhaka/ });
  await expect(analog).toBeVisible();

  await analog.click();
  await expect(page.getByRole("button", { name: /Digital clock for Dhaka/ })).toBeVisible();
});

test("the dot matrix exposes an accessible image name", async ({ page }) => {
  await page.goto("/");
  await waitForIsland(page, "led-matrix");

  await expect(page.getByRole("img", { name: "Dot matrix monogram" })).toBeVisible();
});

test("the play button starts and pauses the audio", async ({ page }) => {
  await page.goto("/");
  await waitForIsland(page, "music-player");

  await page.getByRole("button", { name: /Play One Trick Phony/ }).click();
  await expect.poll(() => page.evaluate(() => document.querySelector("audio")?.paused)).toBe(false);

  await page.getByRole("button", { name: /Pause One Trick Phony/ }).click();
  await expect.poll(() => page.evaluate(() => document.querySelector("audio")?.paused)).toBe(true);
});
