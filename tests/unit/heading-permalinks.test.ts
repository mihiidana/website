import { type SatteriAstroData, satteriHeadingIdsPlugin } from "@astrojs/markdown-satteri";
import { markdownToHtml, mdxToJs } from "satteri";
import { describe, expect, it } from "vitest";

import { headingPermalinksPlugin } from "@/lib/heading-permalinks";

/**
 * The permalink plugin is a HAST visitor, so it is tested against Sätteri
 * directly: the same processor Astro 7 runs, with Astro's own heading-ID pass
 * registered first. Rendering through `astro build` would cover only the
 * headings the demo posts happen to contain.
 */
async function renderMarkdown(source: string) {
  const astro: SatteriAstroData = {
    frontmatter: {},
    headings: [],
    localImagePaths: new Set<string>(),
    remoteImagePaths: new Set<string>(),
  };
  const { html, data } = await markdownToHtml(source, {
    hastPlugins: [satteriHeadingIdsPlugin(), headingPermalinksPlugin],
    data: { astro },
  });
  return {
    html,
    headings: (data.astro as SatteriAstroData).headings,
  };
}

async function renderMdx(source: string) {
  const astro: SatteriAstroData = {
    frontmatter: {},
    headings: [],
    localImagePaths: new Set<string>(),
    remoteImagePaths: new Set<string>(),
  };
  const result = await mdxToJs(source, {
    hastPlugins: [satteriHeadingIdsPlugin(), headingPermalinksPlugin],
    data: { astro },
    jsxImportSource: "astro",
    elementAttributeNameCase: "html",
  });
  return {
    code: result.code,
    headings: (result.data.astro as SatteriAstroData).headings,
  };
}

/** Every `href` the plugin emitted, in document order. */
function anchors(html: string) {
  return [...html.matchAll(/<a href="(#[^"]+)" class="heading-anchor" aria-label="([^"]*)">/g)].map(
    (match) => ({ href: match[1], label: match[2] }),
  );
}

describe("heading permalinks", () => {
  it("links every content heading level from h2 to h6", async () => {
    const { html, headings } = await renderMarkdown(
      ["## Two", "### Three", "#### Four", "##### Five", "###### Six", "## Trailing ##"].join(
        "\n\n",
      ),
    );

    expect(headings.map((heading) => heading.depth)).toEqual([2, 3, 4, 5, 6, 2]);
    expect(anchors(html)).toEqual([
      { href: "#two", label: "Permalink to Two" },
      { href: "#three", label: "Permalink to Three" },
      { href: "#four", label: "Permalink to Four" },
      { href: "#five", label: "Permalink to Five" },
      { href: "#six", label: "Permalink to Six" },
      { href: "#trailing", label: "Permalink to Trailing" },
    ]);
  });

  it("never adds an anchor to an h1", async () => {
    const { html, headings } = await renderMarkdown("# Title\n\n## Section");
    expect(headings.map((heading) => heading.depth)).toEqual([1, 2]);
    expect(anchors(html)).toEqual([{ href: "#section", label: "Permalink to Section" }]);
  });

  it("keeps duplicate headings distinct", async () => {
    const { html, headings } = await renderMarkdown("## Repeat\n\n## Repeat\n\n## Repeat");
    expect(headings.map((heading) => heading.slug)).toEqual(["repeat", "repeat-1", "repeat-2"]);
    expect(anchors(html).map((anchor) => anchor.href)).toEqual([
      "#repeat",
      "#repeat-1",
      "#repeat-2",
    ]);
  });

  it("reuses Astro's slug for punctuation and symbols", async () => {
    const { html, headings } = await renderMarkdown("## C# & F# — what's `next`?");
    const slug = headings[0].slug;
    expect(slug).toBe("c--f--whats-next");
    expect(anchors(html)).toEqual([
      { href: `#${slug}`, label: "Permalink to C# &amp; F# — what&#x27;s next?" },
    ]);
  });

  it("labels headings that contain inline code", async () => {
    const { html, headings } = await renderMarkdown("### Constraints with `extends`");
    expect(headings[0].slug).toBe("constraints-with-extends");
    expect(anchors(html)).toEqual([
      { href: "#constraints-with-extends", label: "Permalink to Constraints with extends" },
    ]);
  });

  it("keeps the heading metadata text free of the permalink glyph", async () => {
    const { headings } = await renderMarkdown("## Primitives versus semantics");
    expect(headings[0].text).toBe("Primitives versus semantics");
  });

  it("produces the same anchors in MDX as in Markdown", async () => {
    const source = "## Repeat\n\n## Repeat\n\n### With `code`\n\n#### Deep";
    const markdown = await renderMarkdown(source);
    const mdx = await renderMdx(source);

    expect(mdx.headings).toEqual(markdown.headings);
    // MDX emits JSX rather than HTML; assert the same hrefs and labels appear.
    for (const { href, label } of anchors(markdown.html)) {
      expect(mdx.code).toContain(`href: "${href}"`);
      expect(mdx.code).toContain(JSON.stringify(label.replace(/&amp;/g, "&")));
    }
  });

  it("does not emit an anchor for a heading without an id", async () => {
    // Defensive: if the ID pass is ever removed from the pipeline, headings
    // must render bare rather than gaining a dead `href="#"` link.
    const { html } = await markdownToHtml("## Bare", { hastPlugins: [headingPermalinksPlugin] });
    expect(html).toContain("<h2>Bare</h2>");
    expect(html).not.toContain("heading-anchor");
  });
});
