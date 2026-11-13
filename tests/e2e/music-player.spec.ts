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

test("a non-cancelable wheel event cannot change the volume", async ({ page }) => {
  await page.goto("/");
  await waitForPlayer(page);

  const volume = () => page.evaluate(() => document.querySelector("audio")?.volume);
  const sliderValue = () =>
    page.getByRole("slider", { name: /Volume for/ }).getAttribute("aria-valuenow");

  await expect.poll(volume).toBeCloseTo(0.5, 2);
  expect(await sliderValue()).toBe("0.5");

  // Some browsers emit a wheel sequence in which only the first event is
  // cancelable. `preventDefault()` cannot stop the page scrolling for the
  // later ones, so the widget must not follow them either.
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  const results = await page.evaluate(() => {
    const player = document.querySelector("[data-music-player]");
    if (!player) return { up: false, down: false };
    const fire = (deltaY: number) => {
      const event = new WheelEvent("wheel", {
        deltaY,
        cancelable: false,
        bubbles: true,
      });
      player.dispatchEvent(event);
      return event.defaultPrevented;
    };
    return { up: fire(-400), down: fire(400) };
  });

  // No error, and no claim that scrolling was suppressed.
  expect(errors).toEqual([]);
  expect(results).toEqual({ up: false, down: false });

  // The volume is untouched in both directions.
  expect(await volume()).toBeCloseTo(0.5, 2);
  expect(await sliderValue()).toBe("0.5");
});

test("a cancelable wheel event does suppress the default action", async ({ page }) => {
  await page.goto("/");
  await waitForPlayer(page);

  const prevented = await page.evaluate(() => {
    const player = document.querySelector("[data-music-player]");
    if (!player) return null;
    const event = new WheelEvent("wheel", { deltaY: -120, cancelable: true, bubbles: true });
    player.dispatchEvent(event);
    return event.defaultPrevented;
  });

  expect(prevented).toBe(true);
});

test("modified keyboard gestures and horizontal trackpad gestures are ignored", async ({
  page,
}) => {
  await page.goto("/");
  await waitForPlayer(page);

  const volume = () => page.evaluate(() => document.querySelector("audio")?.volume);

  await expect.poll(volume).toBeCloseTo(0.5, 2);

  // A synthetic event is the only reliable way to set modifier flags.
  const outcomes = await page.evaluate(() => {
    const el = document.querySelector("[data-music-player]");
    if (!el) return null;
    const fire = (init: WheelEventInit) => {
      const event = new WheelEvent("wheel", { cancelable: true, bubbles: true, ...init });
      el.dispatchEvent(event);
      return event.defaultPrevented;
    };
    return {
      shift: fire({ deltaY: -300, shiftKey: true }),
      meta: fire({ deltaY: -300, metaKey: true }),
      alt: fire({ deltaY: -300, altKey: true }),
      // Predominantly horizontal: a two-finger pan, not a scroll.
      horizontal: fire({ deltaX: 300, deltaY: 40 }),
      // No vertical movement at all.
      zero: fire({ deltaY: 0 }),
    };
  });

  // None of them were claimed, so the page still scrolls normally for these.
  expect(outcomes).toEqual({
    shift: false,
    meta: false,
    alt: false,
    horizontal: false,
    zero: false,
  });
  expect(await volume()).toBeCloseTo(0.5, 2);
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
  // The wheel floors just above silence: wheeling to a true 0 would mute the
  // audio, and a muted player can deliver non-cancelable wheel events, which
  // this handler must refuse — leaving no way back up. The slider still owns 0.
  await expect.poll(volume).toBe(0.01);
  expect(await sliderValue()).toBe("0.01");
  await expect(page.getByRole("button", { name: /Mute/ })).toHaveAttribute("aria-pressed", "false");

  // Scrolling back up is audible again and the slider follows.
  await page.mouse.wheel(0, -120);
  await expect.poll(volume).toBeGreaterThan(0.01);
  expect(await sliderValue()).toBe(
    await page.evaluate(() => document.querySelector("audio")?.volume.toFixed(2)),
  );
});

test("the slider can still reach a true silence and mute", async ({ page }) => {
  await page.goto("/");
  await waitForPlayer(page);

  const volume = () => page.evaluate(() => document.querySelector("audio")?.volume);

  // The wheel refuses 0 so it can always recover; an explicit slider gesture
  // does not have that constraint.
  const slider = page.getByRole("slider", { name: /Volume for/ });
  await slider.focus();
  for (let i = 0; i < 60; i += 1) await page.keyboard.press("ArrowLeft");

  await expect.poll(volume).toBe(0);
  // The slider at 0 is a deliberate mute, same as before.
  await expect(page.getByRole("button", { name: /Unmute/ })).toHaveAttribute(
    "aria-pressed",
    "true",
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

test("no wheel listener is attached to the window or the document", async ({ page }) => {
  await page.addInitScript(() => {
    const scope = window as typeof window & { __globalWheel: number };
    scope.__globalWheel = 0;
    const original = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      if (type === "wheel" && (this === window || this === document)) {
        scope.__globalWheel += 1;
      }
      return original.call(this, type, listener, options);
    };
  });

  await page.goto("/");
  await waitForPlayer(page);
  await page.locator("[data-music-player]").scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);

  // A global wheel handler would intercept scrolling everywhere on the page.
  const globalCount = await page.evaluate(
    () => (window as typeof window & { __globalWheel: number }).__globalWheel,
  );
  expect(globalCount).toBe(0);
});

test("scrolling outside the player is unaffected", async ({ page }) => {
  await page.goto("/");
  await waitForPlayer(page);

  const volume = () => page.evaluate(() => document.querySelector("audio")?.volume);
  const scrollY = () => page.evaluate(() => window.scrollY);

  await expect.poll(volume).toBeCloseTo(0.5, 2);
  const before = await scrollY();

  // Wheel over the document, outside the widget: the page scrolls and the
  // volume does not move.
  await page.mouse.move(5, 400);
  await page.mouse.wheel(0, 300);
  await expect.poll(scrollY).toBeGreaterThan(before);
  expect(await volume()).toBeCloseTo(0.5, 2);
});
