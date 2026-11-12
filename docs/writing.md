# Writing

Posts are Markdown or MDX files committed to `src/content/blog/`. There is no
CMS, no database, and no preview service: write a file, commit, build, deploy.

## Where writing appears

| Surface                      | What it shows                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| Homepage **Writing** section | The four newest published posts (`recentPosts()` in `src/lib/blog.ts`).                  |
| `/blog/`                     | The full archive, newest first.                                                          |
| `/rss.xml`                   | Every published post.                                                                    |
| Sitemap                      | Every published post.                                                                    |
| Header                       | **Nothing.** There is deliberately no nav link; the homepage section is the entry point. |

The homepage slices the same filtered, sorted list the archive uses, so a draft
can never appear there and the order can never disagree. With no published
posts the section is not rendered at all — no empty heading.

Publication dates decide the order: newest first, and equal dates fall back to
the post ID so builds are deterministic.

## Where posts go

```text
src/content/blog/
├── hello-world.md        → /blog/hello-world/
└── notes/
    └── first.mdx         → /blog/notes/first/
```

The file path is the slug. Use lowercase, hyphen-separated words; the file name
becomes the URL verbatim, so renaming a file changes a published URL. Nested
directories become nested URLs (`notes/first.mdx` → `/blog/notes/first/`) and
are fine for series or date-based grouping; the article route is
`src/pages/blog/[...slug].astro`, which handles both cases.

## Frontmatter

Every post needs all of this, validated at build time by
`src/content.config.ts`:

```yaml
---
title: A short, specific title
description: One sentence a reader would understand without opening the post.
pubDate: 2026-03-01
updatedDate: 2026-03-05 # optional
draft: false # optional, defaults to false
---
```

| Field         | Required | Type   | Notes                                             |
| ------------- | -------- | ------ | ------------------------------------------------- |
| `title`       | yes      | string | Rendered as the `<h1>`; do not repeat it in body. |
| `description` | yes      | string | Used for meta description, OG, RSS, the listing.  |
| `pubDate`     | yes      | date   | `YYYY-MM-DD`. Drives ordering.                    |
| `updatedDate` | no       | date   | Shown in the header and in structured data.       |
| `draft`       | no       | bool   | `true` keeps the post out of every surface.       |

Dates are read as UTC. A malformed date, a missing field, or an unknown type
fails the build, which is the point: a broken post never deploys.

## Markdown or MDX?

Default to `.md`. It covers everything most posts need: prose, lists, tables,
blockquotes, images, links, and fenced code blocks with syntax highlighting.

Reach for `.mdx` only when the post needs something Markdown cannot express: an
embedded Astro or Svelte component, an interactive demo, or a custom layout.
Both formats share one collection, one route template, one set of styles, and
the same feed and sitemap entries.

## Publishing

1. Write the post with `draft: true` if it is not ready.
2. Set `draft: false` (or remove the field) when it is.
3. `pnpm check && pnpm typecheck && pnpm build` — the build validates the
   schema and renders every page.
4. Commit and push. CI builds, tests, and deploys `main`.

Drafts are filtered in `src/lib/blog.ts` (`publishedPosts`). A draft produces no
page, no listing entry, no RSS item, and no sitemap URL. Because the filter is
not dev-only, a draft cannot leak into a preview build either; to read one,
temporarily remove the flag locally and do not commit it.

## Dates

`pubDate` is the publication date you choose, not the file's git date. Use the
day the post first becomes public. Update `updatedDate` when you make a
substantive change; leave it out for typo fixes. Both dates feed the article
header, `<meta property="article:*">`, and `BlogPosting` JSON-LD.

## Links and images

- Internal links are root-relative: `[the archive](/blog/)`, `[a post](/blog/hello-world/)`.
  Trailing slashes match the built output.
- External links are plain absolute URLs; the site does not add `target`
  attributes for you, and it should not.
- Post-local images go beside the post and are referenced relatively:
  `src/content/blog/hello-world/diagram.png` → `![A diagram](./diagram.png)`.
  Astro optimizes and hashes them at build time.
- Images used across posts live in `src/assets/` and are imported in MDX, or
  copied to `public/` if they must keep a stable, unprocessed URL.

Always write alt text. It is the only description a screen reader gets.

## Markdown conventions

- One `#` heading is supplied by the template; start body headings at `##`.
  Never write an `<h1>` in the body.
- Use `-` for unordered lists and `1.` for ordered lists.
- Fence code with a language so it is highlighted:

  ````markdown
  ```ts
  const answer = 42;
  ```
  ````

- Tables, blockquotes (`>`), horizontal rules (`---`), and inline `code` are
  styled by the `prose` typography utility (tokens mapped in `src/styles/prose.css`).
- Fenced code blocks are highlighted at build time by Shiki using
  `github-light-high-contrast` and `github-dark-high-contrast`
  (`astro.config.mjs`). The high-contrast palettes are required: the stock
  GitHub themes fail WCAG AA on comments and constants. Both themes render on
  the same `--muted` surface; only token colors switch with the theme.
- Prefer short paragraphs and sentences. The reading column is about 65
  characters wide.

## Using components in MDX

Astro components and Svelte components can both be imported directly into
`.mdx` files. Use the `@/` alias, as everywhere else in this repo.

```mdx
import Container from "@/components/layouts/container.astro";
import Clock from "@/components/widgets/clock.svelte";

<Container>Any Astro component renders to static HTML here.</Container>

<Clock />
```

See [`docs/templates/post.mdx`](./templates/post.mdx) for a working example
using this repo's components.

### Hydration

A Svelte component without a `client:*` directive renders on the server and
ships no JavaScript — that is the default and the right choice for anything
that does not need browser interaction. Add the cheapest directive that makes
the component work:

| Directive        | Use for                                                  |
| ---------------- | -------------------------------------------------------- |
| _(none)_         | Static rendering: text, layout, diagrams, decorative UI. |
| `client:visible` | Interaction only matters once the reader scrolls to it.  |
| `client:idle`    | Needed soon, but not during initial load.                |
| `client:load`    | Controls required immediately, above the fold.           |

Never hydrate a whole article because one component is interactive, and never
use `client:only` in a post: it costs a blank frame and defeats static
rendering.

## Starter content

The four posts currently in `src/content/blog/` are demonstration articles that
exercise the publishing system end to end: plain Markdown, tables, code blocks,
and one MDX article with a hydrated Svelte demo. They are ordinary posts — edit
them, repurpose them, or delete them. Removing all of them is safe: the archive
shows its empty state and the homepage simply drops the Writing section.

## Templates

Start from a copy of one of these and delete what you do not need:

- [`docs/templates/post.md`](./templates/post.md) — plain Markdown.
- [`docs/templates/post.mdx`](./templates/post.mdx) — MDX with an Astro
  component and a Svelte island.
