/**
 * Build-time completeness gate for social images.
 *
 * Runs after `astro build` writes `dist/`, reads every generated HTML file, and
 * fails the build if any indexable page is missing a complete social metadata
 * block, points at an image that was not emitted, or points at a PNG that is not
 * 1200×630. It also fails on orphaned images (generated but referenced by no
 * page) and on two pages sharing one image.
 *
 * This is what makes the convention enforced rather than documented: a new
 * route that renders through `Layout.astro` gets an `og:image` path derived
 * from its own URL, and if `/og/[...path].png` did not emit that file, the
 * build stops here with the route named.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

import sharp from "sharp";

import { OG_HEIGHT, OG_WIDTH } from "@/lib/og/constants";
import { ogImagePath } from "@/lib/og/paths";

/**
 * Non-indexable technical pages that legitimately ship without social images.
 * They are never shared, never crawled, and carry no `og:image` on purpose.
 */
const EXEMPT_HTML: Record<string, true> = { "404.html": true };

type PageSocial = {
  htmlPath: string;
  route: string;
  image?: string;
  alt?: string;
  twitterImage?: string;
  card?: string;
  title?: string;
  description?: string;
  ogType?: string;
  ogUrl?: string;
};

async function listHtml(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
}

function attr(html: string, pattern: RegExp): string | undefined {
  return html.match(pattern)?.[1];
}

/** `/blog/post/index.html` → `/blog/post/`; `/index.html` → `/`. */
function routeFor(htmlPath: string, distDir: string): string {
  const relativePath = relative(distDir, htmlPath).replaceAll("\\", "/");
  const route = `/${relativePath}`.replace(/index\.html$/, "");
  return route;
}

function readSocial(html: string, htmlPath: string, distDir: string): PageSocial {
  return {
    htmlPath,
    route: routeFor(htmlPath, distDir),
    title: attr(html, /<meta property="og:title" content="([^"]*)"/),
    description: attr(html, /<meta property="og:description" content="([^"]*)"/),
    ogType: attr(html, /<meta property="og:type" content="([^"]*)"/),
    ogUrl: attr(html, /<meta property="og:url" content="([^"]*)"/),
    image: attr(html, /<meta property="og:image" content="([^"]*)"/),
    alt: attr(html, /<meta property="og:image:alt" content="([^"]*)"/),
    twitterImage: attr(html, /<meta name="twitter:image" content="([^"]*)"/),
    card: attr(html, /<meta name="twitter:card" content="([^"]*)"/),
  };
}

/** Every `dist/og/**\/*.png`, relative to `dist/`. */
async function listOgImages(distDir: string): Promise<string[]> {
  const ogDir = join(distDir, "og");
  try {
    const entries = await readdir(ogDir, { recursive: true, withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".png"))
      .map(
        (entry) =>
          `/${relative(distDir, join(entry.parentPath, entry.name)).replaceAll("\\", "/")}`,
      )
      .sort();
  } catch {
    return [];
  }
}

export type VerifyOptions = { distDir: string; siteUrl: string };

export type VerifyResult = {
  pages: number;
  images: number;
};

/**
 * Throws with every problem found, not just the first, so one build reports
 * all missing or invalid images at once.
 */
export async function verifyOgImages({ distDir, siteUrl }: VerifyOptions): Promise<VerifyResult> {
  const problems: string[] = [];
  const origin = new URL(siteUrl).origin;
  const htmlFiles = await listHtml(distDir);

  const pages: PageSocial[] = [];
  for (const htmlPath of htmlFiles) {
    const name = relative(distDir, htmlPath).replaceAll("\\", "/");
    if (EXEMPT_HTML[name]) continue;
    pages.push(readSocial(await readFile(htmlPath, "utf8"), htmlPath, distDir));
  }

  if (pages.length === 0) problems.push("No HTML files found in dist/ — did the build run?");

  const emitted = new Set(await listOgImages(distDir));
  const referenced = new Map<string, string[]>();

  for (const page of pages) {
    const label = page.route;
    for (const [field, value] of [
      ["og:title", page.title],
      ["og:description", page.description],
      ["og:type", page.ogType],
      ["og:url", page.ogUrl],
      ["og:image", page.image],
      ["og:image:alt", page.alt],
      ["twitter:image", page.twitterImage],
    ] as const) {
      if (!value) problems.push(`${label}: missing ${field}`);
    }

    if (page.card !== "summary_large_image") {
      problems.push(
        `${label}: twitter:card is ${page.card ?? "missing"}, expected summary_large_image`,
      );
    }

    if (!page.image) continue;

    // Absolute, on the canonical origin, and the path the registry predicts.
    const expected = new URL(ogImagePath(page.route), origin);
    if (page.image !== expected.href) {
      problems.push(
        `${label}: og:image is ${page.image}, expected ${expected.href} (route-derived; see src/lib/og/paths.ts)`,
      );
    }
    if (page.twitterImage !== page.image) {
      problems.push(`${label}: twitter:image does not match og:image`);
    }

    const url = new URL(page.image);
    if (url.origin !== origin) {
      problems.push(`${label}: og:image origin ${url.origin} is not the canonical ${origin}`);
      continue;
    }

    const imagePath = decodeURIComponent(url.pathname);
    if (!emitted.has(imagePath)) {
      problems.push(`${label}: og:image ${imagePath} was not emitted by the build`);
      continue;
    }

    referenced.set(imagePath, [...(referenced.get(imagePath) ?? []), label]);
  }

  // Unique per page: two pages sharing a card means one of them is wrong.
  for (const [image, routes] of referenced) {
    if (routes.length > 1) {
      problems.push(`${image} is shared by ${routes.join(", ")} — every page needs its own image`);
    }
  }

  // No orphans: a generated file nobody references is dead weight.
  for (const image of emitted) {
    if (!referenced.has(image)) problems.push(`${image} was generated but no page references it`);
  }

  // Real PNGs at the declared size.
  for (const image of emitted) {
    const file = join(distDir, image);
    const info = await stat(file);
    if (info.size === 0) {
      problems.push(`${image} is empty`);
      continue;
    }
    const meta = await sharp(file).metadata();
    if (meta.format !== "png")
      problems.push(`${image} is ${meta.format ?? "unknown"}, expected png`);
    if (meta.width !== OG_WIDTH || meta.height !== OG_HEIGHT) {
      problems.push(`${image} is ${meta.width}×${meta.height}, expected ${OG_WIDTH}×${OG_HEIGHT}`);
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Social image verification failed (${problems.length} problem${problems.length === 1 ? "" : "s"}):\n` +
        problems.map((problem) => `  - ${problem}`).join("\n") +
        "\n\nEvery public page needs a generated card. See AGENTS.md → Open Graph images.",
    );
  }

  return { pages: pages.length, images: emitted.size };
}
