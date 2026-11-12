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
