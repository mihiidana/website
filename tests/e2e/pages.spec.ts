import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { PAGES } from "./site";

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
};

for (const path of PAGES) {
  test.describe(`page ${path}`, () => {
    test("renders without console or page errors", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });

      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("main#main")).toBeVisible();
      expect(errors).toEqual([]);
    });

    test("has a single <h1>", async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("h1")).toHaveCount(1);
    });

    test("ships a hash-based CSP with no violations", async ({ page }) => {
      const violations: string[] = [];
      await page.exposeFunction("reportCspViolation", (violation: string) => {
        violations.push(violation);
      });
      await page.addInitScript(() => {
        document.addEventListener("securitypolicyviolation", (event) => {
          (window as unknown as { reportCspViolation: (v: string) => void }).reportCspViolation(
            `${event.violatedDirective} blocked ${event.blockedURI || "inline"}`,
          );
        });
      });

      await page.goto(path);
      const csp = await page
        .locator('meta[http-equiv="content-security-policy"]')
        .getAttribute("content");
      expect(csp).toMatch(/script-src 'self'/);
      expect(csp).toMatch(/'sha256-/);
      expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);

      // Exercise the theme toggle so runtime violations surface too.
      await page.getByRole("button", { name: "Toggle color theme" }).click();
      expect(violations).toEqual([]);
    });

    for (const [device, viewport] of Object.entries(VIEWPORTS)) {
      test(`has no serious accessibility violations on ${device}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        // Measure final colors, not mid-fade ones.
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(path);
        const { violations } = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa"])
          .analyze();
        const serious = violations.filter(
          (violation) => violation.impact === "serious" || violation.impact === "critical",
        );
        expect(
          serious.map(
            (violation) =>
              `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`,
          ),
        ).toEqual([]);
      });
    }
  });
}
