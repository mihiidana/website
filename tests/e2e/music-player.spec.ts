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
  const raised = (await volume()) ?? 0;

  await player.dispatchEvent("wheel", { deltaY: 400 });
  await expect.poll(volume).toBeLessThan(raised);
});

test("a real wheel gesture over the player changes volume without scrolling", async ({ page }) => {
  await page.goto("/");
  await waitForPlayer(page);

  const player = page.locator("[data-music-player]");
  const volume = () => page.evaluate(() => document.querySelector("audio")?.volume);
  const scrollY = () => page.evaluate(() => window.scrollY);

  // Put the player under the pointer and the page in a scrollable position.
  await player.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, 120));
  const box = await player.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const beforeScroll = await scrollY();
  await expect.poll(volume).toBeCloseTo(0.5, 2);

  await page.mouse.wheel(0, -120);
  await expect.poll(volume).toBeGreaterThan(0.5);
  expect(await scrollY()).toBe(beforeScroll);

  const louder = (await volume()) ?? 0;
  await page.mouse.wheel(0, 240);
  await expect.poll(volume).toBeLessThan(louder);
  expect(await scrollY()).toBe(beforeScroll);

  // Outside the widget the document scrolls normally.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height + 120);
  await page.mouse.wheel(0, 200);
  await expect.poll(scrollY).toBeGreaterThan(beforeScroll);
});

test("wheel volume stays within 0 and 1 and keeps the slider in sync", async ({ page }) => {
  await page.goto("/");
  await waitForPlayer(page);

  const player = page.locator("[data-music-player]");
  const box = await player.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  const volume = () => page.evaluate(() => document.querySelector("audio")?.volume);
  const sliderValue = () =>
    page.getByRole("slider", { name: /Volume for/ }).getAttribute("aria-valuenow");

  for (let i = 0; i < 12; i += 1) await page.mouse.wheel(0, -120);
  await expect.poll(volume).toBe(1);
  expect(await sliderValue()).toBe("1");

  for (let i = 0; i < 20; i += 1) await page.mouse.wheel(0, 120);
  await expect.poll(volume).toBe(0);
  expect(await sliderValue()).toBe("0");

  // The floor mutes rather than leaving a silent-but-unmuted player.
  await expect(page.getByRole("button", { name: /Unmute/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Scrolling back up restores sound and the slider follows.
  await page.mouse.wheel(0, -120);
  await expect.poll(volume).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: /Mute/ })).toHaveAttribute("aria-pressed", "false");
  expect(await sliderValue()).toBe(
    await page.evaluate(() => document.querySelector("audio")?.volume.toFixed(2)),
  );
});

test("the wheel handler is registered once per mount", async ({ page }) => {
  await page.addInitScript(() => {
    const scope = window as typeof window & { __wheelListeners: number };
    scope.__wheelListeners = 0;
    const original = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      if (type === "wheel" && options && typeof options === "object" && options.passive === false) {
        scope.__wheelListeners += 1;
      }
      return original.call(this, type, listener, options);
    };
  });

  await page.goto("/");
  await waitForPlayer(page);
  await page.locator("[data-music-player]").scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);

  const count = await page.evaluate(
    () => (window as typeof window & { __wheelListeners: number }).__wheelListeners,
  );
  expect(count).toBe(1);

  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.evaluate(() =>
    document
      .querySelector("[data-music-player]")
      ?.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, cancelable: true, bubbles: true })),
  );
  expect(errors).toEqual([]);
});
