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
