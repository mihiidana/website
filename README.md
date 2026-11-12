# mihidana

Personal site of mihidana, published at <https://hey.mihiidana.workers.dev>.
A home for mihidana's writing, projects, and small tools under one domain and one voice.

See [PRODUCT.md](./PRODUCT.md) for the product definition and what is intentionally
not built yet.

## Stack

- [Astro 7](https://docs.astro.build) static output
- React 19 islands via `@astrojs/react`
- Tailwind CSS 4 via `@tailwindcss/vite`
- [shadcn/ui](https://ui.shadcn.com) components on Base UI (`base-nova`, neutral base color)
- Biome for linting and formatting
- Cloudflare Workers static assets via Wrangler

Requires Node `>=26.13.0` and pnpm `12.18.0` (`packageManager`).

## Project Structure

```text
/
├── public/               # favicons, PWA icons, site.webmanifest, _headers
├── src
│   ├── components/       # astro components; ui/ holds shadcn primitives,
│   │                     # widgets/ the React islands, seo/ the head metadata
│   ├── lib/              # site.ts (identity + copy), theme.ts, utils.ts (cn)
│   ├── pages/            # file-based routes
│   ├── styles/           # global.css: Tailwind, shadcn tokens, fonts
│   └── tests → tests/    # tests/unit (vitest), tests/e2e (playwright)
├── components.json       # shadcn config
├── wrangler.jsonc        # Cloudflare Worker name and dist/ assets
└── astro.config.mjs      # includes site URL and the CSP configuration
```

Site identity, description, socials, and page copy are centralized in
[`src/lib/site.ts`](./src/lib/site.ts). Edit `site.pages.home` to change the
homepage; adding a page means adding a key under `pages` and rendering it from a
matching route under `src/pages/`. Use the `@/` import alias rather than relative
imports: Biome enforces this.

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
| `pnpm typecheck` | Astro type check (`astro check`)                       |
| `pnpm test`      | Unit tests (vitest)                                    |
| `pnpm test:e2e`  | E2E + accessibility tests (Playwright; build first)    |
| `pnpm validate`  | Everything CI runs: check, typecheck, test, build, e2e |
| `pnpm deploy`    | Build and deploy to Cloudflare Workers                 |
| `pnpm astro ...` | Run Astro CLI commands                                 |

`pnpm validate` (lint, typecheck, unit tests, build, E2E) runs on every push and
pull request to `main`. The `deploy` job runs `pnpm deploy` on pushes to `main`
and only starts after CI passes; it requires the `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` secrets; see [`.env.example`](./.env.example) for the
variable names.

To deploy locally, run `wrangler login` once, then `pnpm deploy`.
