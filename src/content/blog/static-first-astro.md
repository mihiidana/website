---

title: A Practical Mental Model for Static-First Websites with Astro
description: What static rendering actually means in Astro, where the boundary between build time and the browser sits, and how islands keep JavaScript honest.
pubDate: 2026-11-13
---

Most discussions about static sites stall on the word "static." It sounds like
"no JavaScript," which is not quite true, or "not dynamic," which is vague
enough to mean anything. Astro is easier to reason about once you replace the
word with a question: **which code runs when, and on whose machine?**

This piece builds a mental model for that question, then applies it to Astro's
routing, layouts, content collections, and islands.

## Static rendering means the work happens earlier

A static build is a program that runs once, produces HTML files, and exits.
Visitors never execute that program. They receive the output.

That single sentence explains most of the constraints that follow:

- **Data is read at build time.** A content collection, a local JSON file, a
  `fetch` during the build — all of it resolves into HTML before deploy.
- **The output is inspectable.** What you deploy is what you can open in a
  text editor. There is no server rendering step to guess at.
- **Cost is paid in CI, not per request.** A build that takes twenty seconds
  costs the same whether one person or one million people read the result.

Compare that with a server-rendered page, where HTML is produced per request,
and with a client-rendered page, where the browser downloads a program, runs
it, and assembles the page after that. Static output is the only model where
the HTML exists before the request does.

Astro is static by default. `output: "static"` in `astro.config.mjs` is the
default and the only mode this site uses. There is no adapter, no runtime, no
server entry point — the deploy artifact is a directory of files.

### Where the browser still gets involved

Static HTML does not forbid interactivity. It changes where interactivity
lives. A page can ship:

1. HTML, generated at build time, that is complete on arrival;
2. CSS, static;
3. JavaScript, but only for components that genuinely need to respond to a
   person.

The third item is where most sites go wrong, and where Astro's islands model
does its work.

## Pages, layouts, and the component script

An `.astro` file has two parts: a frontmatter block delimited by `---`, and a
template below it. The frontmatter is TypeScript that runs at build time. It is
never sent to the browser.

```astro
---
import { getCollection } from "astro:content";

const posts = (await getCollection("blog")).filter((post) => !post.data.draft);
const newest = posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())[0];
---

<article>
  <h1>{newest.data.title}</h1>
  <p>{newest.data.description}</p>
</article>
```

Everything above the closing `---` disappears after the build. That has a
practical consequence worth internalizing: secrets, database credentials, and
expensive computations are safe there. They cannot leak, because they are not
in the output.

Layouts are ordinary components that wrap a page. The important detail is that
Astro has no implicit layout mechanism — a page imports a layout and passes
content into it.

```astro
---
import BaseLayout from "@/components/layouts/BaseLayout.astro";
---

<BaseLayout title="Writing" description="Notes on software and craft.">
  <h1>Writing</h1>
</BaseLayout>
```

`BaseLayout` owns `<html>`, `<head>`, and site chrome; the page owns its
content. Keeping that split strict means metadata, theme bootstrapping, and
navigation live in one place instead of being copied into every route.

## File-based routing is the build manifest

Files under `src/pages` become routes. `src/pages/index.astro` is `/`,
`src/pages/blog/index.astro` is `/blog/`, and `src/pages/blog/[...slug].astro`
matches any depth under `/blog/`.

Dynamic routes export `getStaticPaths`, which returns the list of pages to
generate. This is the clearest expression of the static model: the set of URLs
is computed at build time, not discovered at request time.

```astro
---
import { getCollection } from "astro:content";

export async function getStaticPaths() {
  const posts = await getCollection("blog");
  return posts
    .filter((post) => !post.data.draft)
    .map((post) => ({ params: { slug: post.id }, props: { post } }));
}
---

const {post} = Astro.props;
<h1>{post.data.title}</h1>
```

Two properties follow. First, a URL that is not in `getStaticPaths` does not
exist — drafts produce a 404 automatically, with no runtime check. Second, the
route file receives exactly the props it declared, so the page never has to
fetch anything again.

> A static site's route list is a build artifact. If a page should not be
> public, it should not be in the list.

## Content collections: structure before markup

Astro's content collections put a schema in front of Markdown and MDX. The
configuration is a single file:

```ts
// src/content.config.ts
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
```

The payoff is not validation for its own sake. It is that every consumer —
listing pages, feeds, sitemaps, tests — can rely on the same shape. A missing
title fails the build instead of rendering `undefined` in a heading.

`glob()` also derives each entry's ID from its file path, which is why the
filename is the slug. That is a deliberate trade: renaming a file changes a
URL, and frontmatter cannot silently disagree with the route.

## Islands: hydration is opt-in

Here is the rule that matters most. In Astro, a framework component renders on
the server by default and ships **no component JavaScript**. Adding a `client:*`
directive is what turns it into an island.

```astro
---
import Counter from "@/components/Counter.svelte";
import StaticBadge from "@/components/StaticBadge.svelte";
---

<StaticBadge label="Build time" />
<Counter client:visible />
```

`StaticBadge` becomes HTML. `Counter` becomes HTML _plus_ a script that
hydrates it when it scrolls into view. The distinction is per component, not
per page, which is what allows an article to contain one interactive demo
without turning the article into an application.

### Choosing a directive

| Directive        | Fires when                                | Use for                                        |
| ---------------- | ----------------------------------------- | ---------------------------------------------- |
| _(none)_         | Never                                     | Static markup, layout, decorative UI           |
| `client:visible` | The element enters the viewport           | Below-fold demos, heavy widgets                |
| `client:idle`    | The page finishes loading, then idle time | Secondary controls needed soon                 |
| `client:load`    | Immediately                               | Theme toggle, controls required on first paint |
| `client:only`    | Client only, no server HTML               | Almost never; costs a blank frame              |

The ordering is a cost ladder. Each step adds JavaScript and a hydration
boundary. Reach for the cheapest one that makes the feature work, and default
to none.

## Where Svelte fits

Svelte is a good fit for the small number of places where state actually
changes: a clock, a media player, a form with live validation. It is a poor fit
for anything that is really a document.

The dividing line is simple. If the component's output depends only on props
that are known at build time, it does not need to be interactive. If it depends
on typing, clicking, or timers, it does.

```svelte
<script lang="ts">
  interface Props {
    initial: number;
  }

  let { initial }: Props = $props();
  let count = $state(initial);
</script>

<button onclick={() => count++} aria-label="Increment">
  {count}
</button>
```

Rendered without a directive, this ships the button with its initial label and
nothing else. Rendered with `client:visible`, it becomes usable once visible.
Same component, different cost, chosen at the call site.

## Structure that keeps the boundary visible

A layout that makes the static/dynamic split obvious:

```text
src/
├── components/
│   ├── layouts/     # chrome: head, header, footer
│   ├── sections/    # static page sections
│   └── widgets/     # interactive islands (client:* at the call site)
├── content/blog/    # Markdown and MDX entries
├── lib/             # pure helpers: paths, sorting, formatting
└── pages/           # routes; thin, no business logic
```

Two rules do most of the work. Pages compose; they do not compute. And
interactivity is declared where a component is used, not where it is defined,
so the cost of a page is visible by reading that page.

## Mistakes worth avoiding

**Hydrating a layout.** Putting `client:load` on something that wraps the page
drags an entire subtree into the client bundle. Hydrate leaves, not containers.

**Duplicating data access per surface.** If the homepage, the archive, and the
feed each filter and sort independently, they will eventually disagree. Extract
one helper and call it everywhere.

**Reaching for a client-side fetch for build-time data.** A blog post list does
not change between requests. Fetching it in the browser adds a loading state,
an error state, and a round trip in exchange for nothing.

**Treating `getStaticPaths` as optional.** Without it, a dynamic route has no
pages to generate and the build produces nothing for that URL.

**Assuming "static" means "cannot be personalized."** It means personalization
happens in the browser or behind a separate service. That is a design decision,
not a limitation of the build.

## Images are build-time work too

The same rule applies to images, and it is where a static site most often
regresses: a Markdown image is easy to write, so it is easy to ship the wrong
one.

![A wide strip of the pipeline, from a local source file to generated variants](../../assets/blog/static-build-strip.png)

That image is one file in `src/assets/blog/`. Nothing downloaded it, resized
it, or inlined it: `![]()` pointed at an importable path, and the build produced
the variants, dimensions, and `srcset` itself. A different post keeps its image
next to the post instead, with a path relative to the article:

![The same pipeline diagram, resolved relative to this article](./static-first-astro/pipeline.png)

Both forms go through Astro's image service. Local images are hashed and
emitted under `/_astro/`, so they can be cached immutably, and remote ones are
fetched once during the build — never at request time, and never from
`public/`, which is copied verbatim and stays unoptimized.

## The model in one paragraph

Astro runs your frontmatter at build time, writes HTML, and stops. Components
render to markup. Framework components stay inert unless a `client:*` directive
says otherwise, and the directive is chosen per component at its call site.
Routes are enumerated ahead of time, so what is not generated does not exist.
Everything else — content schemas, feeds, sitemaps — is derived from the same
build-time data.

Once that model is in place, most architectural questions answer themselves:
does this need to run in a browser? If not, it belongs in the build.

## References

- [Astro: Why Astro](https://docs.astro.build/en/concepts/why-astro/)
- [Astro: Islands architecture](https://docs.astro.build/en/concepts/islands/)
- [Astro: Client directives](https://docs.astro.build/en/reference/directives-reference/#client-directives)
- [Astro: Content collections](https://docs.astro.build/en/guides/content-collections/)
- [Astro: Routing](https://docs.astro.build/en/guides/routing/)

Related: [Design Tokens That Stay Small, Consistent, and Useful](/blog/css-design-tokens/)
and [Debouncing in Practice](/blog/debounce-in-practice/).
