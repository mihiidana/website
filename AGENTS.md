# Agent Guide

Instructions for AI coding agents (Claude Code, Codex, Cursor, OpenCode, …) working in this repo.

## Stack

Astro 7 (static output) · React 19 islands · Tailwind CSS 4 · shadcn/ui on Base UI · Biome (lint + format) · Cloudflare Workers static assets · Node ≥26.13, pnpm 12.18 (`packageManager`).

## Commands

| Task                    | Command                                                         |
| ----------------------- | --------------------------------------------------------------- |
| Dev server (background) | `pnpm dev`, then `pnpm astro dev status/logs/stop`              |
| Lint + format check     | `pnpm check` (fix: `pnpm check:fix`)                            |
| Astro type check        | `pnpm typecheck`                                                |
| Unit tests              | `pnpm test`                                                     |
| E2E + a11y              | `pnpm build && pnpm test:e2e`                                   |
| Full validation         | `pnpm validate` (check → typecheck → test → build → e2e)        |
| Deploy                  | `pnpm deploy` (build + wrangler deploy; CI does this on `main`) |

Run `pnpm validate` — or at minimum `pnpm check` and `pnpm typecheck` — before considering work done, and report honestly what ran and what passed. `pnpm test:e2e` serves `dist/` via `astro preview`; it needs a fresh build after any markup or script change.

## Where things live

- `src/lib/site.ts` — single source of truth for identity, description, socials, and page copy. Pages render from it; never hardcode user-facing copy in components. Adding a page means a key under `pages`, a route under `src/pages/`, and an entry in `tests/e2e/site.ts`.
- `src/pages/` — routes. Keep them thin: source config, render components, no business logic.
- `src/components/layouts/` — `Layout.astro` (head, theme bootstrap, page chrome) plus header, footer, container, and mode toggle.
- `src/components/sections/` — composed page sections driven by `site.ts` data.
- `src/components/widgets/` — React islands with real interactivity.
- `src/components/ui/` — shadcn-generated primitives (Base UI). Keep them recognizable; extend via props/variants instead of restyling ad hoc.
- `src/components/seo/head.astro` — title, canonical URL, Open Graph, Twitter Card for every page.
- `src/lib/` — shared constants and pure helpers: `site.ts` (config), `theme.ts` (light/dark system), `utils.ts` (`cn`).
- `src/styles/global.css` — Tailwind, shadcn semantic tokens, and theme variables.
- `tests/unit/` — vitest tests of pure logic. `tests/e2e/` — Playwright smoke, accessibility, CSP, theme, and link checks.

## Rules

- **Astro vs React.** Default to `.astro` components — they ship zero JavaScript. A React island is justified only by interaction static markup can't provide (music player, clock, LED matrix). For small behaviors prefer a `<script>` block in an Astro component.
- **Imports.** Always the `@/` alias; Biome rejects relative imports.
- **Styling.** Tailwind utilities with semantic tokens (`bg-background`, `text-muted-foreground`) — never raw hex or oklch values in markup. Token definitions change only in `global.css`. Any animation or transform must respect `prefers-reduced-motion` (use `motion-safe:`).
- **Theme.** Dark is the default. All theme constants and pure logic live in `src/lib/theme.ts`; the pre-paint bootstrap is inlined by `Layout.astro` and the toggle is `mode-toggle.astro`. Don't introduce another storage key, color map, or bootstrap.
- **CSP is on.** Never add `'unsafe-inline'` to `script-src` and never use inline event handlers (`onclick=`). Astro hashes bundled scripts automatically; an `is:inline` script must register its hash via `Astro.csp.insertScriptHash` (see `Layout.astro` for the pattern). `pnpm test:e2e` fails on CSP violations.
- **Content.** Copy comes from `site.ts`. Never invent content — no posts, projects, tools, metrics, or testimonials that don't exist. Publishing is Markdown committed to git; when the first post lands, add a content collection in `src/content.config.ts` with a minimal Zod schema (`title`, `description`, `publishedAt`, `draft`) — not before.
- **SEO.** Page metadata routes through `src/components/seo/head.astro`. Titles compose as `${title} — ${site.name}`; descriptions must describe real content.
- **Accessibility.** `Layout.astro` owns the single `<main id="main">` and skip link; one `<h1>` per page; visible `focus-visible:ring-3` states on interactive elements; `aria-label` on icon-only controls. E2E enforces WCAG 2 A/AA — serious or critical violations fail the build.
- **Dependencies.** Minimal. Every new dependency needs a justification in the change description; prefer native Astro capabilities and official integrations.
- **Secrets.** `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` live in CI secrets; local env vars in `.env` (names in `.env.example`). Never commit secrets.
- **Docs.** Keep `README.md` and `PRODUCT.md` describing actual behavior, updated in the same change as the code.
- **Validation.** CI runs check, typecheck, unit tests, build, and E2E, and deploy only happens after all of them pass. Don't weaken the workflow to make a change land.

## Conventions

- Biome is the only formatter/linter (2-space indent, 100 columns, LF). Don't add ESLint or Prettier.
- Commit history follows Conventional Commits (`feat(scope):`, `docs(site):`, …).
- Prefer focused edits to existing files over rewrites; don't reformat untouched code.
- The `astro-docs` MCP server (`search_astro_docs`) is the reference for Astro APIs — consult it before using newer or recently changed features.
