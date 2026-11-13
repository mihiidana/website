/**
 * Deterministic mapping from a public route to its generated social image.
 *
 * Both the SEO head and the `/og/[...path].png` endpoint call these helpers, so
 * a page can never advertise an image the build did not produce.
 *
 * Routes map by path, not by a hardcoded list:
 *   `/`              → `/og/home.png`
 *   `/blog/`         → `/og/blog.png`
 *   `/blog/<slug>/`  → `/og/blog/<slug>.png`
 *   `/about/`        → `/og/about.png`
 *
 * **Encoding.** A route reaches these helpers in two shapes: raw
 * (`CollectionEntry.id`, filesystem paths) and percent-encoded
 * (`Astro.url.pathname`). Both must yield the same file, so each segment is
 * decoded individually *after* splitting on `/` — decoding a whole path first
 * would turn an encoded separator (`%2F`) into a real one and change the
 * segment count.
 *
 * **Folding is lossy, so it is not the guarantee.** Segments that are already
 * lowercase `[a-z0-9-]` pass through unchanged; anything else is ASCII-folded
 * and suffixed with a hash of the decoded segment. The hash is a 64-bit
 * disambiguator, not a proof: `assertUniqueOgPaths()` runs over the whole
 * registry before generation and fails the build if two routes ever land on
 * the same file.
 */

/** Route that stands in for the site root inside `/og/`. */
const HOME_KEY = "home";

/**
 * Two independent 32-bit FNV-1a lanes (~64 bits together), base36. Short,
 * stable, dependency-free, and wide enough that accidental collisions are not
 * a practical concern — with the registry assertion as the actual invariant.
 */
function disambiguate(value: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }

  return (first >>> 0).toString(36) + (second >>> 0).toString(36);
}

/** One decoded path segment. */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    // A stray `%` is a literal character in a file name; leave it alone.
    return segment;
  }
}

/**
 * One URL-safe path segment. Accepts raw or percent-encoded input: plain
 * lowercase slugs pass through unchanged; anything else is folded to
 * `[a-z0-9-]` and suffixed with a hash of the decoded segment, so two different
 * segments are overwhelmingly unlikely to share a name.
 * `assertUniqueOgPaths()` proves the property across the whole registry.
 */
export function ogSegment(raw: string): string {
  const segment = decodeSegment(raw);
  const folded = segment
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (folded === segment.toLowerCase() && folded !== "") return folded;
  return `${folded || "page"}-${disambiguate(segment)}`;
}

/** Path of the generated PNG for a route. Always root-relative, always `.png`. */
export function ogImagePath(route: string): string {
  const segments = route
    .split("/")
    .filter((segment) => segment !== "")
    .map(ogSegment);
  return segments.length === 0 ? `/og/${HOME_KEY}.png` : `/og/${segments.join("/")}.png`;
}

/**
 * Endpoint key for a route: the `/og/` path without its leading slash and
 * `.png` extension, i.e. exactly the `[...path]` param.
 */
export function ogRouteKey(route: string): string {
  return ogImagePath(route)
    .replace(/^\/og\//, "")
    .replace(/\.png$/, "");
}

/**
 * Alt text for a page's social image: the page title and description, which is
 * what the card itself shows. Trimmed at a word boundary — screen readers and
 * search engines do not benefit from a severed word.
 */
export function ogImageAlt({ title, description }: { title: string; description: string }): string {
  const alt = `${title}. ${description}`.replace(/\s+/g, " ").trim();
  if (alt.length <= 200) return alt;
  const cut = alt.slice(0, 200);
  const boundary = cut.lastIndexOf(" ");
  return `${(boundary > 120 ? cut.slice(0, boundary) : cut).replace(/[,;:.\s]+$/, "")}…`;
}

/**
 * Build-time invariant: the registry must be a bijection onto distinct files.
 *
 * Checks, in order, that no two specs declare the same route, that no two
 * routes produce the same endpoint key, and therefore that no generated image
 * can overwrite another. Throws naming both offending routes.
 *
 * Runs in `getStaticPaths()`, before a single PNG is rendered — a collision
 * fails the build instead of silently shipping one page's card for another.
 */
export function assertUniqueOgPaths(specs: readonly { route: string }[]): void {
  const byRoute = new Map<string, string>();
  const byKey = new Map<string, string>();

  for (const { route } of specs) {
    const key = ogRouteKey(route);
    const path = ogImagePath(route);

    const sameRoute = byRoute.get(route);
    if (sameRoute !== undefined) {
      throw new Error(
        `OG image registry: route ${route} is declared more than once; it would render to ${path} twice.`,
      );
    }
    byRoute.set(route, key);

    const sameKey = byKey.get(key);
    if (sameKey !== undefined) {
      throw new Error(
        `OG image path collision: ${sameKey} and ${route} both map to ${path}. ` +
          "Rename one route, or widen the folding rule in src/lib/og/paths.ts.",
      );
    }
    byKey.set(key, route);
  }
}
