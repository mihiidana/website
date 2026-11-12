import { expect, type Page, test } from "@playwright/test";

async function waitForPlayer(page: Page) {
  await page.waitForSelector('astro-island[component-url*="music-player"]:not([ssr])');
}

test("the music player volume slider and mute button control the audio element", async ({
  page,
}) => {
  await page.goto("/");
  await waitForPlayer(page);

  const slider = page.getByRole("slider", { name: /Volume for/ });
  await expect(slider).toBeVisible();
  // The track has a non-zero height only when the orientation variants
  // resolve, so this catches an invisible slider.
  await expect(page.locator('[data-slot="slider-track"]')).toBeVisible();

  // Default level is 50%.
  await expect
    .poll(() => page.evaluate(() => document.querySelector("audio")?.volume))
    .toBeCloseTo(0.5, 2);

  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => page.evaluate(() => document.querySelector("audio")?.volume))
    .toBeGreaterThan(0.5);

  // The button's label changes to "Unmute …" after the click, so use a
  // stable locator for the post-click assertions.
  const mute = page.locator("button[aria-pressed]");
  await page.getByRole("button", { name: /Mute/ }).click();
  await expect(mute).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /Unmute/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.querySelector("audio")?.muted)).toBe(true);
});

test("wheel over the music player adjusts the volume", async ({ page }) => {
  await page.goto("/");
  await waitForPlayer(page);

  const player = page.locator("[data-music-player]");
  const volume = () => page.evaluate(() => document.querySelector("audio")?.volume);

  await expect.poll(volume).toBeCloseTo(0.5, 2);

  // Dispatch on the widget so the assertion tests the wheel handler rather
  // than where smooth page scrolling happens to leave the pointer.
  await player.dispatchEvent("wheel", { deltaY: -200 });
  await expect.poll(volume).toBeGreaterThan(0.5);

  await player.dispatchEvent("wheel", { deltaY: 400 });
  await expect.poll(volume).toBeLessThan(0.5);
});
