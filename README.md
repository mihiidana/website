# mihidana

Personal site of mihidana, published at <https://hey.mihiidana.workers.dev>.
A home for mihidana's writing, projects, and small tools under one domain and one voice.

See [PRODUCT.md](./PRODUCT.md) for the product definition and what is intentionally
not built yet.

## Stack

- [Astro 7](https://docs.astro.build) static output
- Svelte 5 islands via `@astrojs/svelte`
- Tailwind CSS 4 via `@tailwindcss/vite`
- [shadcn-svelte](https://www.shadcn-svelte.com) components on Bits UI (neutral base color)
- [`@lucide/svelte`](https://lucide.dev) icons
- Biome for linting and formatting (including `.svelte` files)
- Cloudflare Workers static assets via Wrangler

Requires Node `>=26.13.0` and pnpm `12.18.0` (`packageManager`).

## Project Structure

```text
/
├── public/               # favicon.svg/ICO/PNG, PWA icons, _headers
├── src
│   ├── components/
│   │   ├── blog/         # post-list.astro: list shared by homepage + archive
│   │   ├── layouts/      # Layout.astro (head, theme bootstrap, chrome),
│   │   │                 # header, footer, container, mode-toggle.svelte
│   │   ├── sections/     # composed page sections driven by site.ts
│   │   ├── widgets/      # Svelte 5 islands (clock, led-matrix, music-player,
│   │   │                 # debounce-playground)
│   │   ├── ui/           # shadcn-svelte primitives (button, card, badge, slider)
│   │   └── seo/          # head.astro (all metadata), json-ld.astro
│   ├── assets/           # source images processed by Astro (music-artwork,
│   │                     # blog/ images shared across posts)
│   ├── content/
│   │   └── blog/         # posts: .md or .mdx, one collection, path = slug
│   ├── lib/              # site.ts, seo.ts, blog.ts, heading-permalinks.ts,
│   │                     # article-image-sizes.ts, remote-images.ts, theme.ts, utils.ts
│   │   ├── seo/          # structured data, build validator, build integration
│   │   └── og/           # social images: specs, paths, Satori template
│   ├── pages/            # routes (index, blog/, rss.xml, robots.txt,
│   │                     # site.webmanifest, og/)
│   └── styles/           # global.css: Tailwind, tokens, fonts; prose.css: articles
├── tests
│   ├── unit/             # vitest: theme, blog helpers/schema, heading permalinks,
│   │                     # images, social image paths
│   └── e2e/              # Playwright: smoke, a11y, CSP, theme, SEO, social images,
│                         # widgets, homepage writing, blog, MDX, links, images
├── components.json       # shadcn-svelte config
├── src/content.config.ts # blog collection schema (glob over .md + .mdx)
├── docs/writing.md       # publishing guide; templates in docs/templates/
├── wrangler.jsonc        # Cloudflare Worker name and dist/ assets
├── astro.config.mjs      # site URL and CSP configuration
├── playwright.config.ts  # E2E runs against the production build
└── vitest.config.ts      # unit tests via Astro's getViteConfig
```

Site identity, description, socials, locale, SEO policy, and page copy are
centralized in [`src/lib/site.ts`](./src/lib/site.ts). Edit `site.pages.home` to
change the homepage; adding a page means adding one entry under `pages` with its
`route`, `title`, `description`, and optional `seoTitle`, then rendering it from
a matching route under `src/pages/` through `Layout.astro` with the same
`title`/`description` props. That entry is also the source of the page's social
card: `src/lib/og/specs.ts` derives every static card from it, so there is no
separate `OgSpec` to add. Use the `@/` import alias rather than relative imports:
Biome enforces this.

## Writing

Posts are Markdown (`.md`) or MDX (`.mdx`) files in `src/content/blog/`. The file
path is the URL slug; frontmatter supplies `title`, `description`, `pubDate`,
optional `updatedDate`, and `draft`. Drafts never build.

The homepage shows the four newest published posts in a **Writing** section;
the heading links to `/blog/`, which lists the
full archive newest first. There is no Blog link in the header by design.
`/rss.xml` is the feed and `sitemap-index.xml` covers every route.

Every public page renders through `Layout.astro` with explicit page metadata.
`src/lib/seo.ts` composes the document title, absolute canonical URL, Open Graph
and Twitter tags, locale, and route-derived social image, while
`src/lib/seo/jsonld.ts` builds a `Person`/`WebSite`/`WebPage`/`BlogPosting`
structured-data graph from the same data. The homepage uses
`site.pages.home.seoTitle` and the site description; the archive uses
`site.writing.seoTitle`, so neither falls back to a bare site name. `robots.txt`
and the web manifest are generated from `site.ts`; `@astrojs/sitemap` emits only
indexable pages. A page marked `noindex` must also be registered in
`site.seo.noindexRoutes`.

`pnpm check:seo` also reports metadata-length warnings (titles outside 30–70
characters, descriptions outside 80–200) with the route and current length.
They are editorial guidance, not build failures; the target is roughly 50–60
characters for titles and 110–160 for descriptions. An intentional exception
lives in `site.seo.metadataExceptions` with a required reason.

Every indexable page also gets a generated 1200×630 social image at build time
(`/og/home.png`, `/og/blog.png`, `/og/blog/<slug>.png`, `/og/<page>.png`),
rendered by Satori from the page's own title and description and rasterized with
sharp. Static cards are derived from the same `site.pages` metadata as the HTML;
there is no per-route image registry. `pnpm build` runs the SEO gate
automatically and fails if any page is missing metadata, has a wrong canonical,
ships invalid JSON-LD, or lacks its card. See
[AGENTS.md](./AGENTS.md#rules) → SEO and Open Graph images.

Four demonstration articles ship in `src/content/blog/` — three Markdown and one
MDX with a hydrated Svelte demo — so the system can be evaluated end to end.
They are ordinary posts and can be edited or deleted. See
[docs/writing.md](./docs/writing.md) for the full authoring contract and
[docs/templates/](./docs/templates/) for starting files.

Agent instructions for working in this repo live in [AGENTS.md](./AGENTS.md).

## Commands

All commands run from the project root:

| Command          | Action                                                      |
| :--------------- | :---------------------------------------------------------- |
| `pnpm install`   | Installs dependencies                                       |
| `pnpm dev`       | Starts dev server at `localhost:4321`                       |
| `pnpm build`     | Builds the production site to `./dist/`                     |
| `pnpm preview`   | Previews the build locally                                  |
| `pnpm check`     | Lint and format check with Biome                            |
| `pnpm check:fix` | Fix lint and format issues with Biome                       |
| `pnpm typecheck` | Type check (`astro check` + `svelte-check`)                 |
| `pnpm test`      | Unit tests (vitest)                                         |
| `pnpm check:seo` | Validate every generated HTML page in `dist/`               |
| `pnpm test:e2e`  | E2E + accessibility tests (Playwright; build first)         |
| `pnpm validate`  | Everything CI runs: check, typecheck, test, build, SEO, e2e |
| `pnpm deploy`    | Build and deploy to Cloudflare Workers                      |
| `pnpm astro ...` | Run Astro CLI commands                                      |

`pnpm build` runs `src/lib/seo/integration.ts`, which validates the finished
`dist/` before exiting. `pnpm check:seo` reruns the same gate on an existing
build without rebuilding.

`pnpm validate` (lint, typecheck, unit tests, build, SEO, E2E) mirrors what CI runs on
every push and pull request to `main`: the workflow executes the same checks as
separate steps (installing the Playwright browser before E2E). The `deploy` job
runs `pnpm deploy` on pushes to `main` and only starts after CI passes; it
requires the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets; see
[`.env.example`](./.env.example) for the variable names.

To deploy locally, run `wrangler login` once, then `pnpm deploy`.

## AI tooling

OMP loads the `astro-docs` and official Svelte MCP servers from
[`.omp/mcp.json`](./.omp/mcp.json). OpenCode loads the `@sveltejs/opencode`
plugin, which provides the Svelte MCP server, skills, and the
`svelte-file-editor` subagent. Project skills live in `.agents/skills/`
(gitignored) and are pinned in [`skills-lock.json`](./skills-lock.json).
