import { readdir, readFile } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { site } from "../../src/lib/site";

/**
 * Homepage Writing section and header behavior.
 *
 * Posts are discovered from `src/content/blog` so the expectations track the
 * real branch content: the section shows the newest four published posts and
 * disappears entirely when the collection is empty.
 */
const CONTENT_DIR = new URL("../../src/content/blog/", import.meta.url);
const RECENT_LIMIT = 4;

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
const published = posts
  .filter((post) => !post.draft)
  .sort((a, b) => Date.parse(b.pubDate) - Date.parse(a.pubDate) || a.id.localeCompare(b.id));
const recent = published.slice(0, RECENT_LIMIT);

const WRITING_SECTION = "section[aria-labelledby='writing-heading']";

function section(page: Page) {
  return page.locator(WRITING_SECTION);
}

test("the header has no Blog or Writing navigation item", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link")).toHaveCount(1);
  await expect(nav.getByRole("link")).toHaveAttribute("href", "/");
  await expect(nav.getByRole("link", { name: /blog|writing/i })).toHaveCount(0);
});

test("the wordmark still links home and the theme toggle still works", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: `${site.name} home` })).toHaveAttribute("href", "/");

  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("the homepage Writing section lists the newest published posts", async ({ page }) => {
  await page.goto("/");

  if (recent.length === 0) {
    // No posts: the section must not render a bare heading.
    await expect(page.locator("#writing-heading")).toHaveCount(0);
    await expect(page.locator(WRITING_SECTION)).toHaveCount(0);
    return;
  }

  const writing = section(page);
  await expect(writing).toBeVisible();
  await expect(writing.locator("#writing-heading")).toHaveText(site.writing.title);

  // Exactly the newest four, in order, each linked to its article.
  const links = await writing
    .locator("ol a")
    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLAnchorElement).getAttribute("href")));
  expect(links).toEqual(recent.map((post) => `/blog/${post.id}/`));
  expect(links.length).toBeLessThanOrEqual(RECENT_LIMIT);

  const dates = await writing
    .locator("ol time")
    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLTimeElement).dateTime));
  expect(dates).toEqual(recent.map((post) => new Date(post.pubDate).toISOString().slice(0, 10)));

  // Drafts are never on the homepage.
  for (const post of posts.filter((entry) => entry.draft)) {
    expect(links).not.toContain(`/blog/${post.id}/`);
  }
});

test("the Writing heading and the archive link both open /blog/", async ({ page }) => {
  test.skip(recent.length === 0, "No published posts to link to");
  await page.goto("/");

  const writing = section(page);
  await expect(writing.locator("#writing-heading").getByRole("link")).toHaveAttribute(
    "href",
    "/blog/",
  );
  await expect(
    writing.getByRole("link", { name: new RegExp(site.writing.archiveLink) }),
  ).toHaveAttribute("href", "/blog/");
});

test("the homepage still renders its widgets and existing sections", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(site.pages.home.title);
  await expect(page.getByRole("slider", { name: /Volume for/ })).toBeVisible();
  await expect(page.getByRole("img", { name: "Dot matrix monogram" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: site.pages.home.resources?.heading }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: site.pages.home.techStack?.heading }),
  ).toBeVisible();
});

test("the homepage Writing section has no serious accessibility violations", async ({ page }) => {
  test.skip(recent.length === 0, "No Writing section to audit");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const { violations } = await new AxeBuilder({ page })
    .include(WRITING_SECTION)
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    violations
      .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
      .map((violation) => violation.id),
  ).toEqual([]);
});
