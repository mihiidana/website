import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { verifySeo } from "../../src/lib/seo/verify";
import { site } from "../../src/lib/site";

const ORIGIN = new URL(site.url).origin;
const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

type FixturePage = {
  route: string;
  title: string;
  description?: string;
  /** Full JSON-LD payload; defaults to a minimal valid graph. */
  jsonLd?: Record<string, unknown>;
};

function graph(webPage: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Person", "@id": `${ORIGIN}/#person`, url: `${ORIGIN}/` },
      {
        "@type": "WebSite",
        "@id": `${ORIGIN}/#website`,
        url: `${ORIGIN}/`,
        description: site.description,
      },
      { "@type": "WebPage", "@id": `${ORIGIN}/#webpage`, ...webPage },
    ],
  };
}

function pageHtml(page: FixturePage): string {
  const description = page.description ?? `Description for ${page.route}`;
  return `<!doctype html><html lang="${site.seo.lang}"><head><title>${page.title}</title><meta name="description" content="${description}"><link rel="canonical" href="${ORIGIN}${page.route}"><script type="application/ld+json">${JSON.stringify(page.jsonLd ?? graph())}</script></head><body></body></html>`;
}

async function fixture(pages: FixturePage[]): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "seo-verify-"));
  dirs.push(dir);

  for (const page of pages) {
    const relative = page.route === "/" ? "index.html" : join(page.route.slice(1), "index.html");
    const file = join(dir, relative);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, pageHtml(page));
  }

  return dir;
}

/** Runs the gate and returns its full problem report. */
async function report(pages: FixturePage[]): Promise<string> {
  try {
    await verifySeo({ distDir: await fixture(pages) });
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

describe("JSON-LD URL scanning", () => {
  test("prose that mentions localhost is not treated as a URL", async () => {
    const message = await report([
      {
        route: "/",
        title: site.name,
        jsonLd: graph({ note: "Debugging on localhost is normal" }),
      },
    ]);

    expect(message).not.toContain("non-production URL");
    expect(message).not.toContain("not on the production origin");
  });

  test("a real http URL is still rejected", async () => {
    const message = await report([
      {
        route: "/",
        title: site.name,
        jsonLd: graph({ license: "http://localhost:4321/license" }),
      },
    ]);

    expect(message).toContain("non-production URL: http://localhost:4321/license");
  });
});

describe("cross-page checks", () => {
  test("two pages sharing a title fail the build", async () => {
    const message = await report([
      { route: "/", title: "Same title" },
      { route: "/blog/", title: "Same title", description: "A different description." },
    ]);

    expect(message).toContain('duplicate title "Same title"');
  });
});
