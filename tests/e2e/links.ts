/**
 * Resolves anchor `href` values against the site URL and keeps the internal
 * targets. Protocol-relative URLs such as `//cdn.example.com/x` resolve to
 * another origin and are dropped, so link checks never call external hosts.
 */
export function internalTargets(hrefs: readonly string[], baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const targets = new Set<string>();

  for (const href of hrefs) {
    let resolved: URL;
    try {
      resolved = new URL(href, base);
    } catch {
      continue;
    }
    if (resolved.origin !== base.origin) continue;
    targets.add(`${resolved.origin}${resolved.pathname}`);
  }

  return [...targets].sort();
}
