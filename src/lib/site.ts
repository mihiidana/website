/**
 * Single source of truth for site identity and copy.
 *
 * Change the homepage here: edit `pages.home` or add a section to its
 * `sections` array. Adding another page means adding a key under `pages`
 * and rendering it from the matching route.
 */
export type SiteLink = {
  label: string;
  href: string;
};

export type SiteSection = {
  heading: string;
  body: string;
  links?: readonly SiteLink[];
};

export type SiteTrack = {
  label: string;
  title: string;
  artist: string;
  album: string;
  /** File name of the cover image in `src/assets/`, processed at build time. */
  artwork: string;
  audio: string;
  href: string;
};

export type SiteResource = {
  title: string;
  source: string;
  href: string;
};

export type SiteWidgets = {
  music: SiteTrack;
};

export type SitePage = {
  /** Canonical route, e.g. `/` or `/about/`. Drives the generated OG image path. */
  route: string;
  /** Visible page heading. */
  title: string;
  /**
   * Document title base for `<title>` and Open Graph. Use it when the visible
   * heading is not descriptive enough for search; the site-name suffix is
   * appended centrally by `buildPageSeo()`.
   */
  seoTitle?: string;
  /** Page-specific description used by the meta tags, social card, and listings. */
  description: string;
  /** Small label above the title on the generated social card. */
  eyebrow?: string;
  intro: string;
  sections: readonly SiteSection[];
  widgets?: SiteWidgets;
  resources?: {
    heading: string;
    items: readonly SiteResource[];
  };
  techStack?: {
    heading: string;
    items: readonly SiteLink[];
  };
};

export type SiteWriting = {
  /** Canonical archive route. Drives the generated OG image path. */
  route: string;
  /** Visible archive heading. */
  title: string;
  /** Document title base for the archive; the site-name suffix is appended centrally. */
  seoTitle: string;
  description: string;
  intro: string;
  empty: string;
  feedTitle: string;
  feedDescription: string;
};

/** An editorial exception to the metadata length warnings, with its reason. */
export type SiteSeoMetadataException = {
  route: string;
  field: "title" | "description";
  reason: string;
};

export type SiteSeo = {
  /** `lang` on `<html>` and `inLanguage` in structured data. */
  lang: string;
  /** Open Graph locale, e.g. `en_US`. */
  ogLocale: string;
  /** Card used by every page unless it is explicitly noindex. */
  twitterCard: "summary" | "summary_large_image";
  /**
   * Verified handles only — never invent one. Omitted values emit no
   * `twitter:site` / `twitter:creator` tag at all.
   */
  twitter?: {
    site?: string;
    creator?: string;
  };
  /**
   * The explicit noindex registry. A built page may only emit
   * `robots: noindex` if its route appears here, and routes listed here must
   * actually render noindex. `pnpm check:seo` fails on either mismatch, so a
   * page cannot be silently excluded from search.
   */
  noindexRoutes: readonly string[];
  /**
   * Intentional exceptions to the metadata length warnings. Each entry must
   * name an indexable route, a field, and a reason. Exceptions only silence the
   * editorial warning; missing metadata, duplicates, and broken assets still
   * fail the build.
   */
  metadataExceptions: readonly SiteSeoMetadataException[];
};

export type SiteConfig = {
  name: string;
  wordmark: string;
  description: string;
  url: string;
  socials: Readonly<Record<string, string>>;
  seo: SiteSeo;
  writing: SiteWriting;
  pages: Readonly<Record<string, SitePage>>;
};

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
          // Sourced from the track's YouTube thumbnail, stored in `src/assets/`
          // so Astro's image service processes it like any local image — the
          // site no longer needs a remote allowlist entry to build.
          artwork: "music-artwork.jpg",
          audio: "/audio/One_Trick_Phony.mp3",
          href: "https://music.youtube.com/watch?v=kG9qlxLMa0o",
        },
      },
      sections: [],
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
  // like `sections: []` the declared element type instead of `never[]`.
};
