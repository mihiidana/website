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
    items: readonly string[];
  };
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
      widgets: {
        music: {
          label: "Recently played",
          title: "Inside of Love",
          artist: "Nada Surf",
          artwork: "/audio/inside-of-love.jpg",
          audio: "/audio/inside-of-love.mp3",
          href: "https://www.youtube.com/watch?v=fDjwUNaKL_g",
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
          "TypeScript",
          "React",
          "Next.js",
          "Tailwind CSS",
          "Framer Motion",
          "Web Audio API",
          "GLSL / Shaders",
          "Node.js",
          "Figma",
        ],
      },
    },
  },
} as const satisfies SiteConfig;
