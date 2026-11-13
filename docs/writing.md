# Writing

Posts are Markdown or MDX files committed to `src/content/blog/`. There is no
CMS, no database, and no preview service: write a file, commit, build, deploy.

## Where writing appears

| Surface                      | What it shows                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Homepage **Writing** section | The four newest published posts (`recentPosts()` in `src/lib/blog.ts`).                                       |
| `/blog/`                     | The full archive, newest first.                                                                               |
| `/rss.xml`                   | Every published post.                                                                                         |
| Sitemap                      | Every published post.                                                                                         |
| Header                       | **Nothing.** There is deliberately no nav link; the homepage section is the entry point.                      |
| Social cards                 | One 1200×630 PNG per post, generated from its `title`, `description`, and `pubDate` at `/og/blog/<slug>.png`. |

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

Keep titles descriptive and descriptions useful on their own. The document
title adds the site name (` — mihidana`), so aim for roughly 50–60 characters
in total, about 40–50 in frontmatter. Descriptions read best around 110–160
characters. `pnpm check:seo` warns — without failing the build — when a title
falls below 30 or above 70 characters, or a description below 80 or above 200.
An intentional exception belongs in `site.seo.metadataExceptions` with a
reason; correctness checks still apply.

Dates are read as UTC. A malformed date, a missing field, or an unknown type
fails the build, which is the point: a broken post never deploys.

## Social images

Every post gets its own Open Graph card during `astro build`. Nothing to do:
the title and description you already wrote become the card, and the image URL
is derived from the post's own path.

- Output: `/og/blog/<slug>.png` (nested slugs stay nested; non-ASCII or spaced
  segments are folded to a safe name), 1200×630, PNG.
- Content: `title`, `description`, and the publication date — read from the
  collection entry, never duplicated by hand.
- Metadata: `og:image`, `og:image:alt`, `twitter:image`, and
  `twitter:card=summary_large_image` are emitted by `src/components/seo/head.astro`.
- Long titles step down in size and are cut at a word boundary; long
  descriptions are trimmed to two or three lines rather than clipped mid-word.

There is no per-post image override: the card is always generated, so it can
always be verified. File names may contain spaces and Unicode (they are folded
to a safe name), but keep slugs to lowercase ASCII kebab-case — the URL is the
file name, and plain slugs stay readable in both. See
AGENTS.md → Open Graph images.

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

## Links

- Internal links are root-relative: `[the archive](/blog/)`, `[a post](/blog/hello-world/)`.
  Trailing slashes match the built output.
- External links are plain absolute URLs; the site does not add `target`
  attributes for you, and it should not.

## Images

Images are optimized at build time by Astro's own image service. Ordinary
Markdown syntax is all you need — no imports, no resizing, no downloading files
by hand. There is no domain allowlist to maintain.

### Where images live

Put images inside `src/` so Astro can process them:

```text
src/
├── assets/
│   └── blog/
│       └── architecture.png        ← shared across posts
└── content/
    └── blog/
        ├── my-article.md
        └── my-article/
            └── diagram.png         ← belongs to one post
```

Two working styles, both fine:

```markdown
![A diagram that belongs to this post](./my-article/diagram.png)

![An architecture diagram shared between posts](../../assets/blog/architecture.png)
```

Relative paths resolve from the file that contains them. A local image is
hashed and emitted under `/_astro/`, so it can be cached forever.

**Do not use `public/` for article images.** Files there are copied verbatim and
served unoptimized: no resizing, no modern formats, no hashed filenames. It is
the right place for the favicons, and the wrong place for anything a post
displays. (`/site.webmanifest` is generated from `site.ts`.)

### Remote images: paste the URL

Any public HTTPS image address works, from any host:

```markdown
![An illustration hosted on ImgBB](https://i.ibb.co/example/illustration.webp)

![An image hosted on Reddit](https://i.redd.it/example-image.jpg)

![An illustration on Imgur](https://i.imgur.com/example.jpg)

![An image from another host](https://images.example.com/example.png)
```

Astro downloads the file once during the build, converts and resizes it, and
ships it from `/_astro/` like a local image. The visitor's browser never
contacts the original host.

This works because `astro.config.mjs` authorizes `https:` in general:

```ts
image: {
  remotePatterns: [{ protocol: "https" }],
}
```

That is deliberate. Do **not** add per-provider entries such as
`hostname: "i.ibb.co"`; a new image host must never require a config change. HTTP
is not authorized.

**Use the image address, not the page that shows it.** This is the one mistake
that bites:

| You want       | Use                                                | Not                                               |
| -------------- | -------------------------------------------------- | ------------------------------------------------- |
| A Reddit image | `https://i.redd.it/abc123.jpg`                     | `https://www.reddit.com/r/x/comments/…` (webpage) |
| An ImgBB image | the _direct_ / _image_ link (`https://i.ibb.co/…`) | the ImgBB gallery page (`https://ibb.co/…`)       |
| An Imgur image | `https://i.imgur.com/abc123.jpg`                   | `https://imgur.com/gallery/abc123` (webpage)      |

A webpage URL is HTML, not an image, so the build fails with an error naming the
URL. That failure is intentional: the alternative is an `<img>` that silently
shows nothing.

Keep query strings on URLs that need them (`?token=…`, `?width=…`). They are
preserved exactly.

### What can go wrong with a remote image

Remote images are fetched by CI, so they must be publicly readable without a
login, cookie, or referer. A host may block automated requests, rate-limit, or
delete the file. When that happens the build fails and names the URL — it never
quietly ships an unoptimized image, because the production security policy only
allows same-origin images (`img-src 'self' data:`), so an unprocessed remote
image would not display at all.

If an image matters to the article, commit it under `src/` instead. A remote URL
is a convenience, not a backup.

### Responsive output

Every processed image gets `width`, `height`, `srcset`, `sizes`, and
`data-astro-image="constrained"`. Dimensions prevent layout shift; `srcset`
lets the browser pick a variant that fits the screen. The configuration is
global (`image.layout: "constrained"`), so Markdown images get it automatically.

`sizes` is set by `src/lib/article-image-sizes.ts` to the article column width,
not the image's intrinsic width. Without that, a 1920px screenshot would claim
`sizes="1920px"` in a 720px column and every visitor would download the largest
variant.

### MDX: `<Image />` and `<Picture />`

Markdown syntax works in `.mdx` too, and is optimized the same way. Reach for
Astro's components when you want explicit control:

```mdx
import { Image, Picture } from "astro:assets";
import diagram from "@/assets/blog/architecture.png";

<Image src={diagram} alt="The build pipeline" width={480} />

<Picture src={diagram} formats={["avif", "webp"]} alt="The build pipeline" />
```

- `<Image />` — one output format and an exact size.
- `<Picture />` — one `<source>` per requested format, with the original as
  fallback. Use it when the format savings matter (large photos, not line art).

Remote URLs work in both; pass the URL directly (`<Image src="https://…" … />`)
and the same HTTPS rule applies. Never write a raw `<img>` tag for an image you
expect to be optimized: raw HTML bypasses the pipeline entirely.

### Alt text

Always write it. It is the only description a screen reader gets, and it is what
displays if an image fails to load.

- Describe the purpose, not the pixels: "Request flow from browser to worker",
  not "diagram.png".
- Decorative image? That is rare in an article. If it truly carries no meaning,
  an empty `alt=""` is correct — not a missing one.
- Do not start with "Image of" or "Screenshot of"; screen readers announce the
  role already.

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
- Prefer short paragraphs and sentences. The article body uses the site's
  shared `max-w-3xl` container — the same width as the header, footer, and
  homepage — so there is no narrower inner column to design around.

## Heading permalinks

Every `##`–`######` heading in a post renders with a small `#` link beside it
that points at the heading's own fragment. The build does this: no JavaScript
runs to make it work, and the link is a normal `<a>` for keyboard and screen
reader users.

The pipeline is Sätteri, Astro 7's Rust-based Markdown and MDX processor:

1. `satteriHeadingIdsPlugin()` (Astro's own pass, registered first in
   `astro.config.mjs`) assigns the `id` and collects the heading metadata.
2. `headingPermalinksPlugin` (`src/lib/heading-permalinks.ts`) visits the H2–H6
   elements that now have an `id` and appends `<a href="#id">` with an
   `aria-label` of `Permalink to <heading text>`.

Both `.md` and `.mdx` go through the same processor, so anchors behave
identically. The `h1` is the frontmatter title and never gets a permalink. Do
not add `rehype-slug` or `rehype-autolink-headings`: this project does not run
a Unified/rehype pipeline.

To link to a section from the same post, use the fragment the anchor itself
uses:

```markdown
## Understanding the architecture

See [Understanding the architecture](#understanding-the-architecture) above.
```

To link from another post or an external site, prefix the article path:

```markdown
See [how tokens are named](/blog/css-design-tokens/#naming-semantic-colors).
```

Slugs come from Astro's own slugger: lowercase, punctuation dropped, spaces
collapsed to hyphens, and repeated headings suffixed (`-1`, `-2`, …). Open the
rendered page and click the `#` if you want the exact fragment.

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
