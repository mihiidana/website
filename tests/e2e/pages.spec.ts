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
      // Collect violations inside the page (the event fires as a browser task,
      // so read them after interactions instead of polling a Node-side array).
      await page.addInitScript(() => {
        const scope = window as typeof window & { __cspViolations: string[] };
        scope.__cspViolations = [];
        // Seed a persisted theme so the pre-paint bootstrap has work to do.
        try {
          localStorage.setItem("theme", "light");
        } catch {
          // Blocked storage is covered by tests/e2e/theme.spec.ts.
        }
        document.addEventListener("securitypolicyviolation", (event) => {
          scope.__cspViolations.push(
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
      // Fallback policy and form-post restriction.
      expect(csp).toMatch(/default-src 'self'/);
      expect(csp).toMatch(/form-action 'self'/);
      // Explicit directives must still override the default.
      expect(csp).toMatch(/object-src 'none'/);
      expect(csp).toMatch(/base-uri 'self'/);
      expect(csp).toMatch(/img-src 'self' data:/);
      expect(csp).toMatch(/media-src 'self'/);
      expect(csp).toMatch(/connect-src 'self'/);
      expect(csp).toMatch(/frame-src 'none'/);
      // Bits UI renders style="" attributes; the exception is scoped to them.
      expect(csp).toMatch(/style-src-attr 'unsafe-inline'/);
      // The policy is only enforced where the browser supports it; the
      // response-header layer (public/_headers) adds X-Frame-Options.

      // The inline theme bootstrap must run: the server HTML is dark, so a
      // light page proves the bootstrap executed and applied the stored value.
      await expect(page.locator("html")).not.toHaveClass(/dark/);
      await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#ffffff");

      // The bundled theme toggle must run.
      await page.waitForSelector('astro-island[component-url*="mode-toggle"]:not([ssr])');
      await page.getByRole("button", { name: "Dark theme" }).click();
      await expect(page.locator("html")).toHaveClass(/dark/);

      // Exercise the Bits UI slider island under CSP, where the page has one.
      if ((await page.locator('astro-island[component-url*="music-player"]').count()) > 0) {
        await page.waitForSelector('astro-island[component-url*="music-player"]:not([ssr])');
        const slider = page.getByRole("slider", { name: /Volume for/ });
        await expect(slider).toBeVisible();
        await slider.focus();
        await page.keyboard.press("ArrowRight");
        await expect
          .poll(() => page.evaluate(() => document.querySelector("audio")?.volume))
          .toBeGreaterThan(0.5);
      }

      // Violations are recorded in the page; read them after the interactions.
      const violations = await page.evaluate(
        () => (window as typeof window & { __cspViolations: string[] }).__cspViolations,
      );
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
