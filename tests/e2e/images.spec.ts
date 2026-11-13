import { readdir, readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

/**
 * Image optimization in the **production build**.
 *
 * `pnpm validate` builds before running E2E, so these inspect real artifacts in
 * `dist/`: the rendered markup, the emitted files, and the absence of the
 * original source URL. Configuration strings are covered in
 * `tests/unit/images.test.ts`; this file exists to prove the pipeline actually
 * ran.
 *
 * Articles are discovered from the content directory rather than hardcoded, so
 * adding a post with images extends coverage automatically.
 */
const CONTENT_DIR = new URL("../../src/content/blog/", import.meta.url);
const DIST_DIR = new URL("../../dist/", import.meta.url);

/** Every image Markdown/MDX file, with whether it is expected to be optimized. */
async function imageUsages(): Promise<{ id: string; srcs: string[] }[]> {
  const files = (await readdir(CONTENT_DIR, { recursive: true })).filter(
    (file) => file.endsWith(".md") || file.endsWith(".mdx"),
  );

  const usages: { id: string; srcs: string[] }[] = [];
  for (const file of files) {
    const source = await readFile(new URL(file, CONTENT_DIR), "utf8");
    // Markdown images only, and only ones with a real target (not MDX
    // expressions like `src={diagram}`, covered separately below).
    const srcs = [...source.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)]
      .map((match) => match[1])
      .filter((src) => !src.startsWith("{") && !src.startsWith("data:"));
    if (srcs.length > 0) {
      usages.push({ id: file.replace(/\.mdx?$/, "").replaceAll("\\", "/"), srcs });
    }
  }
  return usages;
}

const usages = await imageUsages();

test("there is at least one article image to verify", async () => {
  expect(usages.length).toBeGreaterThan(0);
});

for (const { id, srcs } of usages) {
  test(`article ${id} serves optimized images`, async ({ page }) => {
    await page.goto(`/blog/${id}/`);

    // Every rendered image must be optimized, including any added through MDX
    // components, so assert on "all of them" rather than on a count derived
    // from Markdown syntax alone.
    const images = page.locator("main#main .prose img");
    expect(await images.count()).toBeGreaterThanOrEqual(srcs.length);

    const rendered = await images.evaluateAll((nodes) =>
      nodes.map((node) => {
        const img = node as HTMLImageElement;
        return {
          src: img.getAttribute("src") ?? "",
          srcset: img.getAttribute("srcset") ?? "",
          sizes: img.getAttribute("sizes") ?? "",
          alt: img.getAttribute("alt"),
          width: img.getAttribute("width"),
          height: img.getAttribute("height"),
          loading: img.getAttribute("loading"),
          decoding: img.getAttribute("decoding"),
          layout: img.getAttribute("data-astro-image"),
        };
      }),
    );

    for (const [index, image] of rendered.entries()) {
      // Served from the build's hashed asset directory, not the origin URL.
      expect(image.src, `${id} #${index}`).toMatch(/^\/_astro\/.+\.[a-z]+$/);
      // The Markdown source URL must not survive anywhere in the markup.
      expect(srcs).not.toContain(image.src);

      // Intrinsic dimensions prevent layout shift.
      expect(Number(image.width)).toBeGreaterThan(0);
      expect(Number(image.height)).toBeGreaterThan(0);

      // Responsive output from `layout: "constrained"` + `responsiveStyles`.
      expect(image.srcset).toMatch(/\d+w(,|$)/);
      expect(image.sizes).not.toBe("");
      expect(image.layout).toBe("constrained");

      // Loading behaviour.
      expect(image.loading).toBe("lazy");
      expect(image.decoding).toBe("async");

      // Alt text is preserved verbatim.
      expect(image.alt).not.toBeNull();
      expect(image.alt?.length ?? 0).toBeGreaterThan(0);
    }
  });
}

test("sizes reflects the article column, not the source image width", async ({ page }) => {
  await page.goto(`/blog/${usages[0].id}/`);

  const sizes = await page.locator("main#main .prose img").first().getAttribute("sizes");

  // The body is `max-w-3xl` minus horizontal padding; a 1920px screenshot must
  // not claim 1920px, or the browser downloads the largest variant.
  expect(sizes).toContain("720px");
  expect(sizes).toContain("calc(100vw");
});

test("sizes matches the measured article width at every breakpoint", async ({ page }) => {
  await page.goto(`/blog/${usages[0].id}/`);

  // The source of truth is the layout, not the string in the plugin: measure
  // the real container, then check the `sizes` declaration against it. 640px
  // is Tailwind's `sm`, where the gutter changes from 20px to 24px per side;
  // 767/768 straddle the `max-w-3xl` cap.
  const expected = [
    // viewport, rendered article content width
    { width: 390, content: 350 }, // 390 - 2*20
    { width: 640, content: 592 }, // 640 - 2*24
    { width: 767, content: 719 }, // 767 - 2*24
    { width: 768, content: 720 }, // max-w-3xl - 2*24
    { width: 1280, content: 720 },
  ];

  for (const { width, content } of expected) {
    await page.setViewportSize({ width, height: 900 });

    const measured = await page.evaluate(() => {
      const article = document.querySelector("main#main article");
      if (!article) return null;
      const style = getComputedStyle(article);
      return Math.round(
        article.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
      );
    });

    // The image renders at exactly the column width — no overflow, no gap.
    expect(measured, `${width}px container`).toBe(content);

    const img = page.locator("main#main .prose img").first();
    await expect(img).toHaveCSS("width", `${content}px`);

    // And the `sizes` declaration tells the browser the same number. Parse the
    // media-conditioned list the way a browser does: first matching entry wins.
    const resolved = await page.evaluate(() => {
      const img = document.querySelector("main#main .prose img");
      const sizes = img?.getAttribute("sizes") ?? "";
      const probe = document.createElement("div");
      probe.style.cssText =
        "position:absolute;top:0;left:0;margin:0;padding:0;border:0;box-sizing:border-box;visibility:hidden";
      document.body.appendChild(probe);
      let value: number | null = null;
      for (const entry of sizes.split(",").map((part) => part.trim())) {
        // An entry is either a bare length or `(media condition) <length>`.
        // The condition itself contains parentheses, so split on the first
        // `) ` rather than trying to regex the whole thing.
        const conditioned = entry.match(/^(\(.+?\))\s+(.+)$/);
        const condition = conditioned?.[1];
        const length = conditioned ? conditioned[2] : entry;
        if (condition && !window.matchMedia(condition).matches) continue;
        probe.style.width = length;
        value = Math.round(probe.getBoundingClientRect().width);
        break;
      }
      probe.remove();
      return value;
    });

    expect(resolved, `${width}px sizes`).toBe(content);
  }
});

test("the selected variant is never larger than the rendered image needs", async ({ page }) => {
  // `sizes` only matters if the browser obeys it: check the variant it actually
  // picks against the source-set widths, so an understated `sizes` (which would
  // download a variant wider than the column) fails here.
  for (const width of [390, 640, 767, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/blog/${usages[0].id}/`);

    const img = page.locator("main#main .prose img").first();
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);

    const chosen = await img.evaluate((el) => {
      const image = el as HTMLImageElement;
      const srcset = image.getAttribute("srcset") ?? "";
      const widths = srcset
        .split(",")
        .map((part) => part.trim().split(/\s+/))
        .filter(([, descriptor]) => descriptor?.endsWith("w"))
        .map(([url, descriptor]) => ({ url, width: Number.parseInt(descriptor, 10) }));
      const match = widths.find(({ url }) =>
        image.currentSrc.endsWith(url.replace("/_astro/", "")),
      );
      return {
        variantWidth: match?.width ?? image.naturalWidth,
        rendered: Math.round(image.getBoundingClientRect().width),
      };
    });

    // The browser is allowed a modest overshoot for future resizing, but it
    // must never fetch a variant narrower than the slot (visible blur) and must
    // not systematically grab the biggest one.
    expect(chosen.variantWidth, `${width}px`).toBeGreaterThanOrEqual(chosen.rendered);
    expect(chosen.variantWidth, `${width}px`).toBeLessThanOrEqual(chosen.rendered * 2);
  }
});

test("every referenced image file exists in the build output", async ({ page }) => {
  const referenced = new Set<string>();

  for (const { id } of usages) {
    await page.goto(`/blog/${id}/`);
    const urls = await page.locator("main#main .prose img").evaluateAll((nodes) =>
      nodes.flatMap((node) => {
        const img = node as HTMLImageElement;
        const srcset = img.getAttribute("srcset") ?? "";
        const variants = srcset
          .split(",")
          .map((part) => part.trim().split(/\s+/)[0])
          .filter(Boolean);
        return [img.getAttribute("src") ?? "", ...variants].filter((url) =>
          url.startsWith("/_astro/"),
        );
      }),
    );
    for (const url of urls) referenced.add(url);
  }

  expect(referenced.size).toBeGreaterThan(0);

  const emitted = new Set(await readdir(new URL("_astro/", DIST_DIR)));
  for (const url of referenced) {
    expect(emitted.has(url.replace("/_astro/", "")), url).toBe(true);
  }
});

test("no article page leaves a remote image URL in the markup", async ({ page }) => {
  // The CSP is `img-src 'self' data:`, so a missed remote image would be
  // blocked at runtime. Catch it at build inspection time instead.
  for (const { id } of usages) {
    const response = await page.goto(`/blog/${id}/`);
    expect(response?.status()).toBe(200);

    const external = await page
      .locator("main#main .prose img")
      .evaluateAll((nodes) =>
        nodes
          .map((node) => (node as HTMLImageElement).getAttribute("src") ?? "")
          .filter((src) => src.startsWith("http")),
      );
    expect(external, id).toEqual([]);
  }
});

test("images do not overflow the article at desktop and mobile widths", async ({ page }) => {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`/blog/${usages[0].id}/`);

    const overflowing = await page.locator("main#main .prose img").evaluateAll((nodes) =>
      nodes
        .map((node) => {
          const img = node as HTMLImageElement;
          return { w: img.getBoundingClientRect().width, avail: img.parentElement?.clientWidth };
        })
        .filter((box) => box.avail != null && box.w > box.avail + 1),
    );
    expect(overflowing, `${viewport.width}px`).toEqual([]);

    // And no horizontal page scroll as a consequence.
    const scrolled = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(scrolled, `${viewport.width}px`).toBe(false);
  }
});
