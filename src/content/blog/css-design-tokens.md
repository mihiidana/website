---

title: Design Tokens That Stay Small, Consistent, and Useful
description: Primitive and semantic tokens, theme architecture with CSS custom properties, and how to wire tokens into Tailwind CSS 4 without building a second design system.
pubDate: 2026-11-13
---

A design token is a name for a decision. `--color-blue-500` is a value.
`--color-accent` is a decision about how that value is used. Most token systems
fail because they never separate the two, and the vocabulary grows until it is
a second, worse stylesheet.

This piece covers a token set that stays small: what belongs in it, how light
and dark themes fit, and how to expose tokens to Tailwind CSS 4.

## Primitives versus semantics

There are two layers, and they should not be confused.

**Primitive tokens** hold raw values. They are not used directly in components.

```css
:root {
  --gray-50: oklch(0.985 0 0);
  --gray-500: oklch(0.556 0 0);
  --gray-900: oklch(0.205 0 0);
}
```

**Semantic tokens** describe intent and point at primitives.

```css
:root {
  --background: var(--gray-50);
  --foreground: var(--gray-900);
  --muted-foreground: var(--gray-500);
}
```

Components only ever use the second layer. That rule is what makes theming
possible: swap the mapping, and every component follows without being touched.

> A component that references `--gray-500` has hardcoded a decision. A
> component that references `--muted-foreground` has expressed an intent.

## Why CSS custom properties

CSS custom properties are not a build step; they are part of the cascade. That
gives three properties worth having:

1. **Inheritance.** A token set on `:root` is available everywhere.
2. **Runtime switching.** Changing a class on `<html>` re-resolves every
   reference, with no JavaScript and no re-render.
3. **Scoping.** A subtree can redefine tokens for itself without new classes on
   every descendant.

That third point is underused. A dark block inside a light page, or a denser
article layout, can override tokens locally:

```css
.article {
  --prose-width: 65ch;
  --spacing-block: 1.25rem;
}
```

## Light and dark without duplication

The naive approach is two complete rule sets. The maintenance cost doubles
immediately. The alternative is to define semantic tokens once per theme and
let components stay theme-agnostic.

```css
:root {
  color-scheme: light;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --border: oklch(0.922 0 0);
}

.dark {
  color-scheme: dark;
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --border: oklch(1 0 0 / 10%);
}
```

Two details matter more than they look.

**`color-scheme`.** It tells the browser to render form controls, scrollbars,
and the canvas in the matching mode. Without it, a dark page can still show a
white `<select>` popup.

**Not every token needs two values.** Spacing, radii, and typography do not
change between themes. Keep them in one place and change only what is
perceptual.

### The pre-paint problem

If the theme is stored in `localStorage`, reading it in a component runs too
late — the page paints in the default theme first, then flips. The fix is a
tiny inline script in `<head>` that runs before the first paint:

```html
<script>
  (() => {
    const root = document.documentElement;
    let theme = "dark";
    try {
      const stored = localStorage.getItem("theme");
      if (stored === "light" || stored === "dark") theme = stored;
    } catch {
      // Storage can be blocked; the default applies.
    }
    root.classList.toggle("dark", theme === "dark");
  })();
</script>
```

This is one of the few legitimate inline scripts. It must run before the
browser paints, so it cannot wait for a module. Under a strict CSP it needs its
hash registered at build time.

## Naming semantic colors

Good semantic names describe a role, not an appearance. Compare:

| Avoid         | Prefer               | Why                                    |
| ------------- | -------------------- | -------------------------------------- |
| `--light-bg`  | `--background`       | A "light" name lies in dark mode.      |
| `--gray-text` | `--muted-foreground` | Role survives palette changes.         |
| `--red`       | `--destructive`      | Semantic names outlive hue decisions.  |
| `--card-bg2`  | `--card`             | Numbered variants mean unclear intent. |

A small, stable set is easier to memorize than a large, precise one. Most
interfaces need roughly: `background`, `foreground`, `muted`,
`muted-foreground`, `border`, `accent`, `accent-foreground`, `destructive`. If
a new name is needed, check first whether an existing role covers it.

## Typography and spacing tokens

Type and space tokens are worth having, but they should encode a scale rather
than every value in the design.

```css
:root {
  --font-sans: "Satoshi", system-ui, sans-serif;
  --font-mono: ui-monospace, "SFMono-Regular", monospace;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-xl: 1.25rem;
  --radius: 0;
}
```

Two rules keep this layer honest:

- **Tokens define the scale, not each usage.** `--text-xl` is a step. A
  heading choosing that step is the component's decision.
- **Spacing should come from one multiplier.** If spacing tokens are arbitrary
  numbers, layouts drift. A single base unit — 4px or 0.25rem — with a few
  multiples keeps rhythm.

## Wiring tokens into Tailwind CSS 4

Tailwind CSS 4 reads theme values from CSS rather than a JavaScript config. The
`@theme` block is where tokens become utilities.

```css
@import "tailwindcss";

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --font-sans: var(--font-sans);
  --radius-md: calc(var(--radius) * 0.8);
}
```

The `inline` keyword matters. It tells Tailwind to emit `var(--background)`
rather than resolving the value at build time. That is precisely what allows
`.dark` to override `--background` at runtime and have every `bg-background`
utility follow.

With that mapping in place, markup uses only semantic utilities:

```html
<div class="border-border bg-background text-foreground">
  <p class="text-muted-foreground">Muted supporting text.</p>
</div>
```

No raw hex, no `oklch()` in components. When a component needs a value that
does not exist as a token, that is a signal to reconsider the design rather
than to inline a color.

## Keeping the set small

Token systems rot through additions that are never removed. A few practices
that hold up:

- **Add a token when a role repeats three times**, not the first time it is
  needed.
- **Delete aggressively.** An unused token is a decision nobody made.
- **One source of truth per value.** If two tokens hold the same color for
  different reasons, keep both only if the reasons are genuinely distinct.
- **Do not tokenize one-offs.** A single decorative border does not need a
  name.
- **Review tokens like an API.** Renames are cheap early and expensive later.

A useful audit: grep for raw color values in component markup. Every hit is
either a missing token or a token that should not exist.

## Trade-offs

Tokens cost indirection. Reading `--muted-foreground` requires a lookup that
reading `#6b7280` does not. That cost is worth paying when a value is used in
more than one place and can change per theme. It is not worth paying for a
single border radius in a single component.

The other real trade-off is tooling. A token layer is only as good as its
enforcement. If nothing prevents a hardcoded color, one will appear, then
another, and the system slowly stops describing the design.

## External images are build input too

Tokens are about consistency, and images are where consistency quietly breaks:
a screenshot pasted from an image host ships at whatever size the host serves.

![A palette reference hosted on ImgBB](https://i.ibb.co/fVx2WyFx/accessories.png)

That URL is an ordinary remote image on an ordinary third-party host. Nothing
in the repository names ImgBB, and nothing had to change for it: an
`https:` image address in Markdown is authorized to be downloaded and
re-encoded during the build, then served from the site's own immutable asset
path. The same is true of a Reddit-hosted image:

![A screenshot uploaded to Reddit](https://i.redd.it/299vzb1ufbyh1.png)

Two habits keep this honest. Use the image address, not the page that displays
it — `https://i.redd.it/…` is an image; `https://www.reddit.com/r/…/comments/…`
is a webpage and will fail the build, loudly, because it is not an image. And
keep the asset in the repository when it is the source of truth: a remote image
is fetched at build time, so it is only as reliable as the host.

## Conclusion

Keep two layers, primitives and semantics. Let components see only the second.
Put light and dark values in one place and switch them with a class on the root
element. Expose the semantic layer to Tailwind through `@theme inline` so
utilities stay theme-aware. Then treat the token list as a small, reviewed API
rather than a growing catalogue.

## References

- [MDN: Using CSS custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [MDN: `color-scheme`](https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme)
- [Tailwind CSS: Theme variables](https://tailwindcss.com/docs/theme)
- [Tailwind CSS: Functions and directives](https://tailwindcss.com/docs/functions-and-directives)
- [MDN: `oklch()`](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/oklch)

Related: [A Practical Mental Model for Static-First Websites with Astro](/blog/static-first-astro/)
and [Debouncing in Practice](/blog/debounce-in-practice/).
