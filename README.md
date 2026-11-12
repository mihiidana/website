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
├── public/               # favicons, PWA icons, site.webmanifest, _headers
├── src
│   ├── components/
│   │   ├── blog/         # post-list.astro: list shared by homepage + archive
│   │   ├── layouts/      # Layout.astro (head, theme bootstrap, chrome),
│   │   │                 # header, footer, container, mode-toggle.svelte
│   │   ├── sections/     # composed page sections driven by site.ts
│   │   ├── widgets/      # Svelte 5 islands (clock, led-matrix, music-player,
│   │   │                 # debounce-playground)
│   │   ├── ui/           # shadcn-svelte primitives (button, card, badge, slider)
│   │   └── seo/          # head.astro (title, canonical, OG, Twitter),
│   │                     # article-json-ld.astro (BlogPosting)
│   ├── content/
│   │   └── blog/         # posts: .md or .mdx, one collection, path = slug
│   ├── lib/              # site.ts, blog.ts, heading-permalinks.ts, theme.ts, utils.ts
│   ├── pages/            # file-based routes (index.astro, blog/, rss.xml)
│   └── styles/           # global.css: Tailwind, tokens, fonts; prose.css: articles
├── tests
│   ├── unit/             # vitest: theme, blog helpers/schema, heading permalinks
│   └── e2e/              # Playwright: smoke, a11y, CSP, theme, SEO, widgets,
│                         # homepage writing, blog, MDX, links
├── components.json       # shadcn-svelte config
├── src/content.config.ts # blog collection schema (glob over .md + .mdx)
├── docs/writing.md       # publishing guide; templates in docs/templates/
├── wrangler.jsonc        # Cloudflare Worker name and dist/ assets
├── astro.config.mjs      # site URL and CSP configuration
├── playwright.config.ts  # E2E runs against the production build
└── vitest.config.ts      # unit tests via Astro's getViteConfig
```

Site identity, description, socials, and page copy are centralized in
[`src/lib/site.ts`](./src/lib/site.ts). Edit `site.pages.home` to change the
homepage; adding a page means adding a key under `pages` and rendering it from a
matching route under `src/pages/`. Use the `@/` import alias rather than relative
imports: Biome enforces this.

## Writing

Posts are Markdown (`.md`) or MDX (`.mdx`) files in `src/content/blog/`. The file
path is the URL slug; frontmatter supplies `title`, `description`, `pubDate`,
optional `updatedDate`, and `draft`. Drafts never build.

The homepage shows the four newest published posts in a **Writing** section;
the heading links to `/blog/`, which lists the
full archive newest first. There is no Blog link in the header by design.
`/rss.xml` is the feed and `sitemap-index.xml` covers every route.

Four demonstration articles ship in `src/content/blog/` — three Markdown and one
MDX with a hydrated Svelte demo — so the system can be evaluated end to end.
They are ordinary posts and can be edited or deleted. See
[docs/writing.md](./docs/writing.md) for the full authoring contract and
[docs/templates/](./docs/templates/) for starting files.

Agent instructions for working in this repo live in [AGENTS.md](./AGENTS.md).

## Commands

All commands run from the project root:

| Command          | Action                                                 |
| :--------------- | :----------------------------------------------------- |
| `pnpm install`   | Installs dependencies                                  |
| `pnpm dev`       | Starts dev server at `localhost:4321`                  |
| `pnpm build`     | Builds the production site to `./dist/`                |
| `pnpm preview`   | Previews the build locally                             |
| `pnpm check`     | Lint and format check with Biome                       |
| `pnpm check:fix` | Fix lint and format issues with Biome                  |
| `pnpm typecheck` | Type check (`astro check` + `svelte-check`)            |
| `pnpm test`      | Unit tests (vitest)                                    |
| `pnpm test:e2e`  | E2E + accessibility tests (Playwright; build first)    |
| `pnpm validate`  | Everything CI runs: check, typecheck, test, build, e2e |
| `pnpm deploy`    | Build and deploy to Cloudflare Workers                 |
| `pnpm astro ...` | Run Astro CLI commands                                 |

`pnpm validate` (lint, typecheck, unit tests, build, E2E) mirrors what CI runs on
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
