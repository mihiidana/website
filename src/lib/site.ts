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

export type SitePage = {
  title: string;
  intro: string;
  sections: readonly SiteSection[];
};

export type SiteConfig = {
  name: string;
  wordmark: string;
  description: string;
  url: string;
  socials: Readonly<Record<string, string>>;
  pages: Readonly<Record<string, SitePage>>;
};

export const site = {
  name: "mihidana",
  wordmark: "m",
  description: "Personal website of mihidana.",
  url: "https://hey.mihiidana.workers.dev",
  socials: {
    github: "https://github.com/mihiidana",
  },
  pages: {
    home: {
      title: "Hello!",
      intro:
        "Welcome to my corner of the internet. There's a bit of everything here, from projects and personal interests to ideas, experiments, and everything in between.",
      sections: [],
    },
  },
} as const satisfies SiteConfig;
