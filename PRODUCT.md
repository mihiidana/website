# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Readers who arrive from a link, search result, or social post and want to know who mihidana is and what they make. Their jobs on the site: read writing, browse projects, try small browser tools, contact mihidana, and learn who is behind the work. Technically inclined peers are the likely audience, but the site is not a hiring funnel and has no confirmed client or employer audience.

## Product Purpose

mihidana's personal site — "my corner of the internet" — publishing at https://hey.mihiidana.workers.dev. It exists so mihidana can publish writing, show projects, host small tools, and be reachable in one place they own. Success means a visitor reads something worth their time, tries a tool, or gets in touch, without the site inventing work that does not exist.

## Positioning

A single-person publication and workshop rather than a company site: writing, projects, and tools share one owner, one voice, and one domain. Its value is the accumulated body of mihidana's own work, which a neighboring product site cannot truthfully copy.

## Operating Context

Writing lives as Markdown files committed to this repository and is built by Astro; there is no CMS and no external content source. Deployment targets Cloudflare Workers via wrangler from the static build in `dist/`. The site is maintained by one person, so authoring and publishing must stay a plain git commit plus build.

## Capabilities and Constraints

- Astro 7 with Svelte 5 islands, Tailwind CSS 4, shadcn-svelte components (Bits UI, neutral base color), `@lucide/svelte` icons, Satoshi Variable (Fontshare) as the loaded sans face, and Caveat Variable for the `font-signature` wordmark.
- Static-first output served as Cloudflare Worker assets; no confirmed server-side runtime features beyond wrangler asset hosting.
- Confirmed visitor capabilities, all currently unimplemented: read posts, browse projects, use small browser tools, contact mihidana, and learn who mihidana is (about).
- Publishing mechanism is Markdown in the repo; post structure (taxonomy, drafts, feeds) is not yet decided.
- Undecided and not to be invented: project list, tool lineup, contact channels, post topics, analytics, RSS/sitemap behavior. The only linked social profile is GitHub (`site.socials.github`).
- Content is currently limited to a single homepage that renders its intro copy from `src/lib/site.ts`, plus site header, footer, and a light/dark theme toggle. No posts, projects, or tools exist yet.

## Brand Commitments

- Public identity: `mihidana`; domain `https://hey.mihiidana.workers.dev`.
- An existing favicon and PWA icon set plus `site.webmanifest` under `public/` use the name mihidana and must not be replaced with a different identity without an explicit rebrand.
- Visual identity in code: the `md` wordmark in Caveat Variable (`font-signature`), a neutral monochrome shadcn token palette, and a dark theme by default with a persisted light/dark toggle. No logo mark or broader voice guideline has been established.

## Evidence on Hand

- `public/`: favicon.ico (16/32), favicon-16x16.png, favicon-32x32.png, apple-touch-icon.png (180), android-chrome-192x192.png, android-chrome-512x512.png, site.webmanifest.
- No posts, project write-ups, bio copy, testimonials, customer names, metrics, or benchmarks exist. None may be fabricated; all such content must come from mihidana.

## Product Principles

1. Publish only real work — no invented projects, posts, tools, metrics, or testimonials.
2. The writing and the work are the product; site chrome stays subordinate to them.
3. One owner, one voice: everything on the site should sound like mihidana, not like a company.
4. Static-first and fast: pages and tools should load and respond instantly on the Cloudflare edge.
5. Keep publishing boring: Markdown in git, one build, one deploy — no CMS or service to maintain.
