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

test("the Writing heading is the only archive link", async ({ page }) => {
  test.skip(recent.length === 0, "No published posts to link to");
  await page.goto("/");

  const writing = section(page);
  const headingLink = writing.locator("#writing-heading").getByRole("link");
  await expect(headingLink).toHaveAttribute("href", "/blog/");

  // Exactly one link to the archive: the heading. No duplicate "View all".
  const archiveLinks = await writing
    .getByRole("link")
    .evaluateAll((nodes) =>
      nodes
        .map((node) => (node as HTMLAnchorElement).getAttribute("href"))
        .filter((href) => href === "/blog/"),
    );
  expect(archiveLinks).toHaveLength(1);
});

test("the Writing section is an editorial list, not stacked dividers", async ({ page }) => {
  test.skip(recent.length === 0, "No Writing section to measure");
  await page.goto("/");

  const writing = section(page);
  const entries = writing.locator("ol > li");
  await expect(entries).toHaveCount(recent.length);

  // No borders between entries and none under the heading.
  const widths = await entries.evaluateAll((nodes) =>
    nodes.map((node) => {
      const style = getComputedStyle(node);
      return `${style.borderTopWidth} ${style.borderBottomWidth}`;
    }),
  );
  for (const value of widths) expect(value).toBe("0px 0px");

  const listBorder = await writing
    .locator("ol")
    .evaluate((node) => getComputedStyle(node).borderTopWidth);
  expect(listBorder).toBe("0px");

  const headingBorder = await writing
    .locator("#writing-heading")
    .evaluate((node) => getComputedStyle(node).borderBottomWidth);
  expect(headingBorder).toBe("0px");

  // Entries still have real vertical breathing room.
  const gaps = await entries.evaluateAll((nodes) =>
    nodes.map((node) => Number.parseFloat(getComputedStyle(node as HTMLElement).marginTop)),
  );
  expect(gaps.every((gap) => gap === 0)).toBe(true);
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

test("homepage headings follow one hierarchy and one scale", async ({ page }) => {
  test.skip(recent.length === 0, "No Writing section to compare");
  await page.goto("/");

  // h1, then h2 section headings, with article titles as h3 beneath Writing.
  expect(await page.locator("main#main h1").count()).toBe(1);
  expect(await page.locator("main#main h1 ~ * h1").count()).toBe(0);

  const sectionHeadings = page.locator("main#main section > h2");
  const headings = await sectionHeadings.evaluateAll((nodes) =>
    nodes.map((node) => ({
      text: (node.textContent ?? "").trim(),
      size: Number.parseFloat(getComputedStyle(node).fontSize),
    })),
  );
  expect(headings.length).toBeGreaterThanOrEqual(3);

  // Writing, Resources, Tech & Craft: one identical scale.
  const sizes = new Set(headings.map((heading) => heading.size));
  expect(sizes.size).toBe(1);
  const sectionSize = headings[0].size;

  const writingHeading = section(page).locator("#writing-heading");
  const writingSize = await writingHeading.evaluate((node) =>
    Number.parseFloat(getComputedStyle(node).fontSize),
  );
  expect(writingSize).toBe(sectionSize);

  // Entry titles are h3 and strictly smaller than their section heading.
  const entries = section(page).locator("ol h3");
  await expect(entries).toHaveCount(recent.length);
  const entrySizes = await entries.evaluateAll((nodes) =>
    nodes.map((node) => Number.parseFloat(getComputedStyle(node).fontSize)),
  );
  for (const size of entrySizes) expect(size).toBeLessThan(sectionSize);

  // The homepage h1 is the strongest element on the page.
  const h1Size = await page
    .locator("main#main h1")
    .evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
  expect(h1Size).toBeGreaterThan(sectionSize);

  // Descriptions are secondary to their entry title.
  const descriptionSize = await section(page)
    .locator("ol p")
    .first()
    .evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
  expect(descriptionSize).toBeLessThan(entrySizes[0]);
});
