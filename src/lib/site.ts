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
  title: string;
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

export type SiteBlog = {
  title: string;
  description: string;
  intro: string;
  empty: string;
  feedTitle: string;
  feedDescription: string;
};

export type SiteConfig = {
  name: string;
  wordmark: string;
  description: string;
  url: string;
  socials: Readonly<Record<string, string>>;
  blog: SiteBlog;
  pages: Readonly<Record<string, SitePage>>;
};

export const site: SiteConfig = {
  name: "mihidana",
  wordmark: "m",
  description: "Personal website of mihidana.",
  url: "https://hey.mihiidana.workers.dev",
  socials: {
    github: "https://github.com/mihiidana",
  },
  blog: {
    title: "Blog",
    description: "Writing by mihidana on software, craft, and whatever else is worth the words.",
    intro: "Notes and longer pieces on software, craft, and the things I keep coming back to.",
    empty: "Nothing published yet. The first post is on its way.",
    feedTitle: "mihidana",
    feedDescription: "Writing by mihidana.",
  },
  pages: {
    home: {
      title: "Hello!",
      intro:
        "Welcome to my corner of the internet. There's a bit of everything here, from projects and personal interests to ideas, experiments, and everything in between.",
      widgets: {
        music: {
          label: "Recently played",
          title: "One Trick Phony",
          artist: "Sasha Alex Sloan",
          album: "I Blame The World",
          artwork: "https://img.youtube.com/vi/kG9qlxLMa0o/maxresdefault.jpg",
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
