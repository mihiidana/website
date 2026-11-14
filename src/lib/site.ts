/**
 * Single source of truth for the runtime site configuration and copy.
 *
 * Change the homepage here: edit `pages.home`. Adding another page means
 * adding a key under `pages` and rendering it from the matching route.
 *
 * Type definitions live in `site.types.ts` and are re-exported here, so
 * `@/lib/site` remains the single import path for both the config and its types.
 */
import type { SiteConfig } from "@/lib/site.types";

export type {
  SiteConfig,
  SiteLink,
  SiteNotFound,
  SitePage,
  SiteResource,
  SiteSeo,
  SiteSeoMetadataException,
  SiteTrack,
  SiteWidgets,
  SiteWriting,
} from "@/lib/site.types";

const siteDescription =
  "Personal website of mihidana, featuring writing, useful resources, music, and notes on software, technology, and the web.";

export const site: SiteConfig = {
  name: "mihidana",
  wordmark: "m",
  description: siteDescription,
  url: "https://hey.mihiidana.workers.dev",
  socials: {
    github: "https://github.com/mihiidana",
  },
  seo: {
    lang: "en",
    ogLocale: "en_US",
    twitterCard: "summary_large_image",
    // No verified X/Twitter handle exists for this site, so no twitter:site or
    // twitter:creator tag is emitted. Add the handle here only once it is real.
    noindexRoutes: [],
    metadataExceptions: [],
  },
  writing: {
    route: "/blog/",
    title: "Writing",
    seoTitle: "Writing: Essays on Software, Craft & the Web",
    description:
      "Essays and notes by mihidana on software engineering, design, and the craft of building for the web — practical ideas, not hot takes.",
    intro: "Longer pieces on software, craft, and the things I keep coming back to.",
    empty: "Nothing published yet. The first piece is on its way.",
    feedTitle: "mihidana",
    feedDescription: "Writing by mihidana.",
  },
  notFound: {
    label: "404",
    title: "404",
    description: "This page doesn't exist. The link may be broken, or the page may have moved.",
    heading: "This page wandered off.",
    body: "The link may be broken, or the page moved. Nothing is wrong on your end — the rest of the site is still where you left it.",
    home: { label: "Home", href: "/" },
    writing: { label: "Browse writing", href: "/blog/" },
  },
  pages: {
    home: {
      route: "/",
      title: "Hello!",
      seoTitle: "Personal Website, Writing & Experiments",
      description: siteDescription,
      eyebrow: "Personal site",
      intro:
        "Welcome to my corner of the internet. There's a bit of everything here, from projects and personal interests to ideas, experiments, and everything in between.",
      widgets: {
        music: {
          label: "Recently played",
          title: "One Trick Phony",
          artist: "Sasha Alex Sloan",
          album: "I Blame The World",
          audio: "/audio/One_Trick_Phony.mp3",
          href: "https://music.youtube.com/watch?v=kG9qlxLMa0o",
        },
      },
      resources: {
        heading: "Resources that shaped how I think",
        items: [
          {
            title: "Taste for Makers",
            source: "paulgraham.com",
            href: "https://paulgraham.com/taste.html",
          },
          {
            title: "Developing Taste",
            source: "emilkowal.ski",
            href: "https://emilkowal.ski/ui/developing-taste",
          },
          {
            title: "Taste is Eating SV",
            source: "workingtheorys.com",
            href: "https://www.workingtheorys.com/p/taste-is-eating-silicon-valley",
          },
        ],
      },
      techStack: {
        heading: "Tech & Craft",
        items: [
          { label: "TypeScript", href: "https://www.typescriptlang.org/docs/" },
          { label: "React", href: "https://react.dev/" },
          { label: "Astro", href: "https://docs.astro.build/en/getting-started" },
          { label: "Tailwind CSS", href: "https://tailwindcss.com/docs" },
          { label: "SvelteKit", href: "https://svelte.dev/docs/kit/introduction" },
          { label: "Oh My Pi", href: "https://omp.sh/docs" },
          { label: "herdr", href: "https://herdr.dev/docs" },
          { label: "OpenCode", href: "https://opencode.ai/docs" },
          { label: "Hermes", href: "https://hermes-agent.nousresearch.com/docs" },
          { label: "Mise", href: "https://mise.jdx.dev" },
          { label: "Playwright", href: "https://playwright.dev/docs/writing-tests" },
          { label: "Node.js", href: "https://nodejs.org/docs/latest/api/" },
          { label: "Python", href: "https://docs.python.org/3/" },
          { label: "UV", href: "https://docs.astral.sh/uv/" },
        ],
      },
    },
  },
  // Typed as SiteConfig (not `as const`): the annotation gives empty arrays
  // like `noindexRoutes: []` the declared element type instead of `never[]`.
};
