import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { expect } from "@playwright/test";

/**
 * The built site, read from disk. These assertions are about emitted files and
 * markup, so reading `dist/` is both faster and stricter than fetching pages.
 */
export const DIST = new URL("../../dist/", import.meta.url);

export type BuiltPage = { route: string; html: string };

export async function builtPages(): Promise<BuiltPage[]> {
  const entries = await readdir(DIST, { recursive: true, withFileTypes: true });
  const pages: BuiltPage[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
    const file = join(entry.parentPath, entry.name);
    const path = relative(DIST.pathname, file).replaceAll("\\", "/");
    if (path === "404.html") continue;
    pages.push({
      route: `/${path}`.replace(/index\.html$/, ""),
      html: await readFile(file, "utf8"),
    });
  }

  return pages.sort((a, b) => a.route.localeCompare(b.route));
}

export function meta(html: string, key: string): string | undefined {
  const byProperty = html.match(new RegExp(`<meta property="${key}" content="([^"]*)"`))?.[1];
  return byProperty ?? html.match(new RegExp(`<meta name="${key}" content="([^"]*)"`))?.[1];
}

export function decodeHtml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

export function jsonLd(html: string): { "@graph": Record<string, unknown>[] } {
  const payload = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  expect(payload, "JSON-LD script").toBeTruthy();
  return JSON.parse(payload ?? "");
}
