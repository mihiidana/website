# Agent Guide

Instructions for AI coding agents (Claude Code, Codex, Cursor, OpenCode, …) working in this repo.

## Stack

Astro 7 (static output) · Svelte 5 islands · Tailwind CSS 4 · shadcn-svelte on Bits UI · Biome (lint + format) · Cloudflare Workers static assets · Node ≥26.13, pnpm 12.18 (`packageManager`).

## Commands

| Task                    | Command                                                         |
| ----------------------- | --------------------------------------------------------------- |
| Dev server (background) | `pnpm dev`, then `pnpm astro dev status/logs/stop`              |
| Lint + format check     | `pnpm check` (fix: `pnpm check:fix`)                            |
| Type check              | `pnpm typecheck` (`astro check` + `svelte-check`)               |
| Unit tests              | `pnpm test`                                                     |
| E2E + a11y              | `pnpm build && pnpm test:e2e`                                   |
| Full validation         | `pnpm validate` (check → typecheck → test → build → e2e)        |
| Deploy                  | `pnpm deploy` (build + wrangler deploy; CI does this on `main`) |

Run `pnpm validate` — or at minimum `pnpm check` and `pnpm typecheck` — before considering work done, and report honestly what ran and what passed. `pnpm test:e2e` serves `dist/` via `astro preview`; it needs a fresh build after any markup or script change.

## Where things live

- `src/lib/site.ts` — single source of truth for identity, description, socials, and page copy. Pages render from it; never hardcode user-facing copy in components. Adding a page means a key under `pages`, a route under `src/pages/`, and an entry in `tests/e2e/site.ts`.
- `src/pages/` — routes. Keep them thin: source config, render components, no business logic.
- `src/components/layouts/` — `Layout.astro` (head, theme bootstrap, page chrome) plus header, footer, container, and `mode-toggle.svelte`.
- `src/components/sections/` — composed page sections driven by `site.ts` data. Astro components that render server-side.
- `src/components/widgets/` — Svelte 5 islands with real interactivity.
- `src/components/ui/` — shadcn-svelte primitives on Bits UI. Keep them recognizable; extend via props/variants instead of restyling ad hoc.
- `src/components/seo/head.astro` — title, canonical URL, Open Graph, Twitter Card for every page.
- `src/lib/` — shared constants and pure helpers: `site.ts` (config), `theme.ts` (light/dark system), `utils.ts` (`cn` and shadcn-svelte prop helper types).
- `src/styles/global.css` — Tailwind, shadcn semantic tokens, and theme variables.
- `tests/unit/` — vitest tests of shared constants. `tests/e2e/` — Playwright smoke, accessibility, CSP, theme, SEO, widget, music-player, and link checks.

## Astro vs Svelte

- Astro owns static rendering: pages, layouts, content sections, SEO markup, header/footer, and future blog/article rendering.
- Svelte owns client interaction: theme toggling, the clock, the LED matrix, the music player, and future stateful tools.
- Do not hydrate static markup. A Svelte component rendered without a `client:*` directive runs on the server and ships no component JavaScript — use that for presentational shadcn-svelte primitives in `.astro` files.
- Choose the cheapest hydration directive that works: `client:load` for controls needed immediately (theme toggle), `client:idle` for non-critical widgets, `client:visible` for below-fold or heavy widgets.
- Pass props directly from Astro. The default slot maps to the Svelte `children` snippet. Astro cannot pass Svelte snippets, so keep component APIs prop-based.

## Svelte 5 conventions

- Use runes only. `$state` for reactive state, `$derived` for computed values, `$effect` for external side effects and synchronization, `$props` for props, and `$bindable` for two-way component props.
- Do not use `$effect` to calculate values that should be `$derived`.
- Props: declare an `interface Props`, destructure with `$props()`, and expose a `class` prop when the component is styled by its parent. Merge classes with `cn`.
- Events: use event attributes (`onclick`, `onplay`, `onpause`), not `createEventDispatcher` or `on:click`.
- Callbacks: pass functions as props (`onValueChange`, `onToggle`). Do not invent event buses or stores for parent/child communication.
- Lifecycle: return a cleanup function from `$effect`. Use `onMount` only when a value must be read after mount; otherwise an effect is enough.
- State stays local to the island. Astro islands do not share client state; use `site.ts` for build-time data and avoid global stores unless two islands genuinely need shared runtime state.
- Refs: use `bind:this` for DOM elements. shadcn-svelte components expose a bindable `ref` prop — use `bind:ref`.
- Keep components small and cohesive. Extract a child component only when it removes real duplication or clarifies a boundary.
- Accessibility: label icon-only controls with `aria-label`, mark decorative icons `aria-hidden="true"`, use `aria-pressed` for toggles, keep visible `focus-visible:ring-3` states, and respect `prefers-reduced-motion` with `motion-safe:` or explicit media queries.
- Styling: Tailwind utilities with semantic tokens (`bg-background`, `text-muted-foreground`) — never raw hex or oklch values in markup. Token definitions change only in `global.css`.
- Icons: import named icons from `@lucide/svelte`. Pass `class` for sizing and `aria-hidden="true"` when decorative.
- Imports: always the `@/` alias; Biome rejects relative imports.
- shadcn-svelte: add components with `pnpm dlx shadcn-svelte@latest add <name>`, not by copying examples. Components live under `src/components/ui/<name>/` with an `index.ts`. Keep the project's neutral tokens and zero-radius geometry; do not apply a default shadcn theme. Remove unused subcomponents and variants.
- Testing: update or add a case in `tests/e2e/widgets.spec.ts` when an interaction changes. Wait for hydration with `astro-island[component-url*="<name>"]:not([ssr])` before clicking an island control.

## Rules

- **Theme.** Dark is the default. All theme constants live in `src/lib/theme.ts`; the pre-paint bootstrap is inlined by `Layout.astro` and the toggle is `mode-toggle.svelte` hydrated with `client:load`. The bootstrap's fallback rule is inline by necessity (it runs before modules) and is covered by `tests/e2e/theme.spec.ts`, including invalid, missing, and blocked storage. Don't introduce another storage key, color map, or bootstrap.
- **CSP is on.** Never add `'unsafe-inline'` to `script-src`, never write raw inline HTML event handler attributes (`onclick="..."`), and never use inline scripts. Svelte 5 event attributes such as `onclick={handler}` are valid and encouraged — Svelte compiles them to `addEventListener`, so they ship no inline script. Astro hashes bundled scripts automatically; an `is:inline` script must register its hash via `Astro.csp.insertScriptHash` (see `Layout.astro` for the pattern). Style attributes are allowed (`style-src-attr 'unsafe-inline'`) because Bits UI positions elements with them; `<style>` elements stay hash-locked. `frame-ancestors` cannot be enforced from a meta tag, so clickjacking protection is `X-Frame-Options: DENY` in `public/_headers` (applied by Cloudflare). `pnpm test:e2e` fails on CSP violations.
- **Content.** Copy comes from `site.ts`. Never invent content — no posts, projects, tools, metrics, or testimonials that don't exist. Publishing is Markdown committed to git; when the first post lands, add a content collection in `src/content.config.ts` with a minimal Zod schema (`title`, `description`, `publishedAt`, `draft`) — not before.
- **SEO.** Page metadata routes through `src/components/seo/head.astro`. Titles compose as `${title} — ${site.name}`; descriptions must describe real content.
- **Accessibility.** `Layout.astro` owns the single `<main id="main">` and skip link; one `<h1>` per page; visible `focus-visible:ring-3` states on interactive elements; `aria-label` on icon-only controls. E2E enforces WCAG 2 A/AA — serious or critical violations fail the build.
- **Dependencies.** Minimal. Every new dependency needs a justification in the change description; prefer native Astro capabilities and official integrations. `bits-ui`, `tailwind-variants`, and `@internationalized/date` are shadcn-svelte component dependencies; keep them in sync with the generated components.
- **Secrets.** `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` live in CI secrets; local env vars in `.env` (names in `.env.example`). Never commit secrets.
- **Docs.** Keep `README.md` and `PRODUCT.md` describing actual behavior, updated in the same change as the code.
- **Validation.** CI runs check, typecheck, unit tests, build, and E2E, and deploy only happens after all of them pass. Don't weaken the workflow to make a change land.

## AI tooling

- **OMP:** `.omp/mcp.json` keeps the `astro-docs` HTTP server and adds the official Svelte stdio server (`npx -y @sveltejs/mcp`). Preserve both.
- **OpenCode:** `opencode.jsonc` loads the official `@sveltejs/opencode` plugin. `.opencode/svelte.json` enables its MCP server, skills, instructions, and `svelte-file-editor` subagent. Do not register a second Svelte MCP server in `opencode.jsonc`.
- **Skills:** project skills install to `.agents/skills/` (gitignored); `skills-lock.json` is tracked. The active shadcn skill is `huntabyte/shadcn-svelte` — install with `pnpm dlx skills add huntabyte/shadcn-svelte`.
- **Docs:** use the `astro-docs` MCP server (`search_astro_docs`) for Astro APIs and the Svelte MCP tools for Svelte documentation, examples, and code validation.

## Conventions

- Biome is the only formatter/linter and formats `.svelte` files too (2-space indent, 100 columns, LF). Don't add ESLint, Prettier, or a Svelte formatter plugin.
- Commit history follows Conventional Commits (`feat(scope):`, `docs(site):`, …).
- Prefer focused edits to existing files over rewrites; don't reformat untouched code.
- Keep comments only when they explain a non-obvious architectural decision, a browser compatibility workaround, a security or CSP constraint, an accessibility requirement, a difficult edge case, or a licensing obligation. Remove comments that narrate obvious code or repeat names.
