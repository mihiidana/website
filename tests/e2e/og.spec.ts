/**
 * Social images in the **production build**.
 *
 * Runs against `dist/` directly rather than through a browser: the contract is
 * about emitted files and markup, so reading them is both faster and stricter
 * than fetching pages. `pnpm validate` builds before E2E, and `src/lib/og/verify.ts`
 * runs the same checks during `astro build` — this suite pins the specifics
 * (sizes, per-page uniqueness, article titles) and would catch a loosened gate.
 */
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";
import sharp from "sharp";

import { ogImagePath } from "../../src/lib/og/paths";
import { site } from "../../src/lib/site";

const DIST = new URL("../../dist/", import.meta.url);
const CONTENT = new URL("../../src/content/blog/", import.meta.url);
const OG_SIZE = { width: 1200, height: 630 };

type Page = { route: string; html: string };

async function htmlPages(): Promise<Page[]> {
  const entries = await readdir(DIST, { recursive: true, withFileTypes: true });
  const pages: Page[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
    const file = join(entry.parentPath, entry.name);
    const relativePath = relative(DIST.pathname, file).replaceAll("\\", "/");
    if (relativePath === "404.html") continue;
    pages.push({
      route: `/${relativePath}`.replace(/index\.html$/, ""),
      html: await readFile(file, "utf8"),
    });
  }

  return pages.sort((a, b) => a.route.localeCompare(b.route));
}

function meta(html: string, key: string): string | undefined {
  const byProperty = html.match(new RegExp(`<meta property="${key}" content="([^"]*)"`))?.[1];
  return byProperty ?? html.match(new RegExp(`<meta name="${key}" content="([^"]*)"`))?.[1];
}

const pages = await htmlPages();

test("the build contains every public page", async () => {
  const routes = pages.map((page) => page.route);
  expect(routes).toContain("/");
  expect(routes).toContain("/blog/");
  expect(routes.filter((route) => route.startsWith("/blog/")).length).toBeGreaterThan(1);
});

for (const page of pages) {
  test(`${page.route} declares a complete social card`, async () => {
    const image = meta(page.html, "og:image");
    expect(image, "og:image").toBe(`${site.url}${ogImagePath(page.route)}`);
    expect(meta(page.html, "og:image:width")).toBe(String(OG_SIZE.width));
    expect(meta(page.html, "og:image:height")).toBe(String(OG_SIZE.height));
    expect(meta(page.html, "og:image:type")).toBe("image/png");
    expect(meta(page.html, "og:image:alt")).toBeTruthy();
    expect(meta(page.html, "og:title")).toBeTruthy();
    expect(meta(page.html, "og:description")).toBeTruthy();
    expect(meta(page.html, "og:type")).toMatch(/^(website|article)$/);
    expect(meta(page.html, "og:url")).toBe(`${site.url}${page.route}`);

    // Twitter mirrors Open Graph, and the large card needs both images.
    expect(meta(page.html, "twitter:card")).toBe("summary_large_image");
    expect(meta(page.html, "twitter:image")).toBe(image);
    expect(meta(page.html, "twitter:image:alt")).toBe(meta(page.html, "og:image:alt"));
    expect(meta(page.html, "twitter:title")).toBe(meta(page.html, "og:title"));
    expect(meta(page.html, "twitter:description")).toBe(meta(page.html, "og:description"));
  });

  test(`${page.route} points at a real 1200×630 PNG`, async () => {
    const image = new URL(meta(page.html, "og:image") ?? "", "https://invalid.test");
    const file = new URL(`.${image.pathname}`, DIST);
    expect((await stat(file)).size).toBeGreaterThan(0);

    const info = await sharp(fileURLToPath(file)).metadata();
    expect(info.format).toBe("png");
    expect(info.width).toBe(OG_SIZE.width);
    expect(info.height).toBe(OG_SIZE.height);
  });
}

test("every page has a unique image", async () => {
  const images = pages.map((page) => meta(page.html, "og:image"));
  expect(new Set(images).size).toBe(images.length);
});

test("every generated image is referenced by exactly one page", async () => {
  const referenced = new Set(pages.map((page) => meta(page.html, "og:image")));
  const entries = await readdir(new URL("og/", DIST), { recursive: true, withFileTypes: true });
  const emitted = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".png"))
    .map((entry) => {
      const path = relative(DIST.pathname, join(entry.parentPath, entry.name)).replaceAll(
        "\\",
        "/",
      );
      return `${site.url}/${path}`;
    });

  expect(emitted.length).toBe(pages.length);
  for (const image of emitted) expect(referenced.has(image), image).toBe(true);
});

test("article cards carry their own title", async () => {
  const files = (await readdir(CONTENT, { recursive: true })).filter(
    (file) => file.endsWith(".md") || file.endsWith(".mdx"),
  );

  for (const file of files) {
    const source = await readFile(new URL(file, CONTENT), "utf8");
    const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
    if (/^draft:\s*true$/m.test(frontmatter)) continue;
    const title = frontmatter.match(/^title:\s*(.+)$/m)?.[1]?.replace(/^["']|["']$/g, "");
    const id = file.replace(/\.mdx?$/, "").replaceAll("\\", "/");
    const page = pages.find((entry) => entry.route === `/blog/${id}/`);
    expect(page, id).toBeDefined();
    expect(meta(page?.html ?? "", "og:title")).toBe(`${title} — ${site.name}`);
  }
});

test("cards are not byte-identical across pages", async () => {
  // A template that ignores its metadata would still pass every check above.
  const seen = new Set<string>();
  for (const page of pages) {
    const image = new URL(`.${new URL(meta(page.html, "og:image") ?? "").pathname}`, DIST);
    seen.add(
      createHash("sha256")
        .update(await readFile(image))
        .digest("hex"),
    );
  }
  expect(seen.size).toBe(pages.length);
});
