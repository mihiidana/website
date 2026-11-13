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
 * Segments are ASCII-folded and hashed when folding changes them, which keeps
 * nested and Unicode slugs valid filenames without collisions.
 */

/** Route that stands in for the site root inside `/og/`. */
const HOME_KEY = "home";

/** FNV-1a, 32-bit. Short, stable, dependency-free. */
function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * One URL-safe path segment. Plain lowercase slugs pass through unchanged;
 * anything else is folded to `[a-z0-9-]` and suffixed with a hash of the
 * original so two different routes can never share a file.
 */
export function ogSegment(raw: string): string {
  const folded = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (folded === raw.toLowerCase() && folded !== "") return folded;
  return `${folded || "page"}-${fnv1a(raw)}`;
}

/** Path of the generated PNG for a route. Always root-relative, always `.png`. */
export function ogImagePath(route: string): string {
  const segments = route.split("/").filter(Boolean).map(ogSegment);
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
