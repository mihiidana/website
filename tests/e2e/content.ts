import { readdir, readFile } from "node:fs/promises";

/**
 * Post metadata discovered from `src/content/blog` at test time, so the e2e
 * expectations track the real branch content instead of a fixture list.
 */
export const CONTENT_DIR = new URL("../../src/content/blog/", import.meta.url);

export type Post = { id: string; draft: boolean; pubDate: string; title: string };

export async function discoverPosts(): Promise<Post[]> {
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

/** Mirrors `sortByDate()`: newest first, then ID ascending so dates tie. */
export function sortPosts(posts: readonly Post[]): Post[] {
  return [...posts].sort(
    (a, b) =>
      Date.parse(b.pubDate) - Date.parse(a.pubDate) || Number(a.id > b.id) - Number(a.id < b.id),
  );
}
