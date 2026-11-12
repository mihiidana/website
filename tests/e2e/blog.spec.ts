import { readdir, readFile } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { site } from "../../src/lib/site";
import { PAGES } from "./site";

/**
 * Blog behavior on the production build.
 *
 * Content is discovered from `src/content/blog` at test time, so these checks
 * cover the real posts on the branch: with no posts they pin the empty state,
 * and with posts they verify routes, ordering, metadata, and draft exclusion.
 * No fixture posts are committed — publishing invented writing is forbidden
 * (see PRODUCT.md).
 */
const CONTENT_DIR = new URL("../../src/content/blog/", import.meta.url);
const CONTENT_PREFIX = "/blog/";

type Post = { id: string; draft: boolean; pubDate: string; title: string };

async function discoverPosts(): Promise<Post[]> {
  const files = (await readdir(CONTENT_DIR, { recursive: true })).filter(
    (file) => file.endsWith(".md") || file.endsWith(".mdx"),
  );

  const posts: Post[] = [];
  for (const file of files) {
    const source = await readFile(new URL(file, CONTENT_DIR), "utf8");
    const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
    const field = (name: string) =>
      frontmatter.match(new RegExp(`^${name}:\\s*(.+)$`, "m"))?.[1]?.replace(/^["']|["']$/g, "");
    posts.push({
      id: file.replace(/\.mdx?$/, "").replaceAll("\\", "/"),
      draft: field("draft") === "true",
      pubDate: field("pubDate") ?? "",
      title: field("title") ?? "",
    });
  }
  return posts;
}

const posts = await discoverPosts();
const drafts = posts.filter((post) => post.draft);
const published = posts
  .filter((post) => !post.draft)
  .sort((a, b) => Date.parse(b.pubDate) - Date.parse(a.pubDate));

test("the blog index links every published post, newest first", async ({ page }) => {
  await page.goto(CONTENT_PREFIX);
  await expect(page.locator("h1")).toHaveCount(1);

  if (published.length === 0) {
    await expect(page.locator("main#main")).toContainText(site.blog.empty);
    return;
  }

  const links = await page
    .locator("main#main ol a")
    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLAnchorElement).getAttribute("href")));
  expect(links).toEqual(published.map((post) => `/blog/${post.id}/`));

  const dates = await page
    .locator("main#main ol time")
    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLTimeElement).dateTime));
  expect(dates).toEqual(published.map((post) => new Date(post.pubDate).toISOString().slice(0, 10)));
});

for (const post of published) {
  test(`article ${post.id} renders with article metadata`, async ({ page }) => {
    const response = await page.goto(`${CONTENT_PREFIX}${post.id}/`);
    expect(response?.status()).toBe(200);

    await expect(page.locator("h1")).toHaveText(post.title);
    await expect(page.locator("main#main article")).toHaveCount(1);
    await expect(page.locator("main#main article header time").first()).toBeVisible();
    // A link back to the listing, scoped to the article's breadcrumb.
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: /Blog/ }),
    ).toHaveAttribute("href", "/blog/");

    // Canonical URLs are absolute and built from `site` in astro.config.mjs,
    // not from the preview host (same contract as tests/e2e/seo.spec.ts).
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical).toBe(`${site.url}/blog/${post.id}/`);
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "article");
    await expect(page.locator('meta[property="article:published_time"]')).toHaveAttribute(
      "content",
      new Date(post.pubDate).toISOString().slice(0, 10),
    );

    const jsonLd = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}",
    );
    expect(jsonLd["@type"]).toBe("BlogPosting");
    expect(jsonLd.headline).toBe(post.title);
    expect(jsonLd.datePublished).toBe(new Date(post.pubDate).toISOString().slice(0, 10));
    expect(jsonLd.url).toBe(canonical);
  });

  test(`article ${post.id} raises no CSP violations`, async ({ page }) => {
    // Shiki highlights code with inline `style` attributes. Astro warns that
    // this needs CSP support; the policy allows style attributes only
    // (`style-src-attr 'unsafe-inline'`), so an article with code must stay
    // violation-free.
    await page.addInitScript(() => {
      const scope = window as typeof window & { __cspViolations: string[] };
      scope.__cspViolations = [];
      document.addEventListener("securitypolicyviolation", (event) => {
        scope.__cspViolations.push(
          `${event.violatedDirective} blocked ${event.blockedURI || "inline"}`,
        );
      });
    });

    await page.goto(`${CONTENT_PREFIX}${post.id}/`);
    await page.waitForLoadState("networkidle");

    const violations = await page.evaluate(
      () => (window as typeof window & { __cspViolations: string[] }).__cspViolations,
    );
    expect(violations).toEqual([]);
  });

  test(`article ${post.id} has no serious accessibility violations`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${CONTENT_PREFIX}${post.id}/`);

    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(
      violations
        .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
        .map(
          (violation) =>
            `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`,
        ),
    ).toEqual([]);
  });
}

for (const post of drafts) {
  test(`draft ${post.id} is not published`, async ({ page }) => {
    const response = await page.goto(`${CONTENT_PREFIX}${post.id}/`);
    expect(response?.status()).toBe(404);
  });
}

test("drafts are absent from the feed, sitemap, and index", async ({ page }) => {
  const rss = await (await page.request.get("/rss.xml")).text();
  const sitemap = await (await page.request.get("/sitemap-0.xml")).text();
  const index = await (await page.request.get("/blog/")).text();

  for (const post of drafts) {
    for (const body of [rss, sitemap, index]) {
      expect(body).not.toContain(`/blog/${post.id}/`);
    }
  }
  for (const post of published) {
    expect(rss).toContain(`/blog/${post.id}/`);
    expect(sitemap).toContain(`/blog/${post.id}/`);
    expect(index).toContain(`/blog/${post.id}/`);
  }
});

test("rss.xml is a valid feed with absolute links", async ({ page }) => {
  const response = await page.request.get("/rss.xml");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("xml");

  const body = await response.text();
  expect(body).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?><rss version="2\.0">/);
  expect(body).toContain("<channel>");

  for (const link of body.matchAll(/<link>([^<]+)<\/link>/g)) {
    expect(link[1]).toMatch(/^https:\/\//);
  }
  for (const date of body.matchAll(/<pubDate>([^<]+)<\/pubDate>/g)) {
    expect(Number.isNaN(Date.parse(date[1]))).toBe(false);
  }
});

test("the sitemap includes the blog index", async ({ page }) => {
  const sitemap = await (await page.request.get("/sitemap-0.xml")).text();
  // Sitemap URLs come from `site` in astro.config.mjs, not the preview host.
  expect(sitemap).toContain(`<loc>${site.url}/blog/</loc>`);
});

test("every page advertises the RSS feed", async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveAttribute(
      "href",
      "/rss.xml",
    );
  }
});
