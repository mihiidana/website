import { defineHastPlugin } from "satteri";

/**
 * Heading permalinks for rendered Markdown and MDX.
 *
 * Astro's Sätteri processor assigns heading IDs in a HAST pass; this plugin
 * runs after `satteriHeadingIdsPlugin()` (registered in `astro.config.mjs`) and
 * appends a native `<a href="#id">` to every content heading that already has
 * one. The anchor is empty on purpose: the visible `#` is drawn by CSS
 * (`.heading-anchor::after` in `src/styles/prose.css`) so the heading text that
 * Astro collects as metadata stays clean, and `aria-label` is what assistive
 * technology reads. No client-side JavaScript is involved.
 *
 * The frontmatter title renders as the page `<h1>`, so `h1` is deliberately
 * excluded — content headings start at `h2`.
 */
const HEADING_TAGS = ["h2", "h3", "h4", "h5", "h6"] as const;

export const headingPermalinksPlugin = defineHastPlugin({
  name: "heading-permalinks",
  element: {
    filter: [...HEADING_TAGS],
    visit(node, ctx) {
      const id = node.properties?.id;
      if (typeof id !== "string" || id.length === 0) return;

      const text = ctx.textContent(node).trim();
      ctx.appendChild(node, {
        type: "element",
        tagName: "a",
        properties: {
          href: `#${id}`,
          className: ["heading-anchor"],
          ariaLabel: text ? `Permalink to ${text}` : "Permalink to this heading",
        },
        children: [],
      });
    },
  },
});
