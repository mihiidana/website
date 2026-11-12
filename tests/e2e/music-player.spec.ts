import { expect, test } from "@playwright/test";

test("the music player volume slider and mute button control the audio element", async ({
  page,
}) => {
  await page.goto("/");

  const slider = page.getByRole("slider", { name: /Volume for/ });
  await expect(slider).toBeVisible();

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
