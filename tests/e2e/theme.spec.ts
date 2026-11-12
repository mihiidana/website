import { expect, test } from "@playwright/test";

test("the theme toggle switches, persists, and survives a reload", async ({ page }) => {
  await page.goto("/");

  // Dark is the default.
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#0a0a0a");

  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#ffffff");
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("light");

  await page.reload();
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#0a0a0a");
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("dark");
});

test("a persisted light theme is applied on load", async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("theme", "light");
    } catch {
      // Storage blocked: the default applies, covered by the test below.
    }
  });

  await page.goto("/");
  // The server-rendered markup is dark, and nothing else runs on load, so a
  // light page proves the inline bootstrap applied the stored value. This
  // checks the resulting state, not the paint timeline.
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#ffffff");
});

test("an invalid persisted theme falls back to dark", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("theme", "solarized");
  });

  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#0a0a0a");
});

test("blocked storage keeps the dark default and the toggle still works", async ({ page }) => {
  await page.addInitScript(() => {
    // Simulate a browser that denies storage access (private mode, policy).
    Storage.prototype.getItem = () => {
      throw new Error("storage blocked");
    };
    Storage.prototype.setItem = () => {
      throw new Error("storage blocked");
    };
  });

  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);

  // The toggle must still change the theme for this page view.
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#ffffff");
});
