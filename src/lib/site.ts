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
          { label: "Next.js", href: "https://nextjs.org/docs" },
          { label: "Tailwind CSS", href: "https://tailwindcss.com/docs" },
          { label: "Framer Motion", href: "https://motion.dev/docs/react" },
          {
            label: "Web Audio API",
            href: "https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API",
          },
          { label: "GLSL / Shaders", href: "https://thebookofshaders.com/" },
          { label: "Node.js", href: "https://nodejs.org/docs/latest/api" },
          { label: "Figma", href: "https://help.figma.com" },
        ],
      },
    },
  },
} as const satisfies SiteConfig;
