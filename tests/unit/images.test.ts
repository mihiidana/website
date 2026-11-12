/**
 * Image authorization, as a unit test.
 *
 * These read the **real** `astro.config.mjs` and run Astro's own matcher over
 * it (`isRemoteAllowed`, the exact function the Markdown collector and the
 * remote fetcher call), so a config regression fails here in milliseconds
 * instead of after a full build. The important property is negative: arbitrary
 * hosts must pass without appearing in the config anywhere.
 */
import { isRemoteAllowed, matchPattern } from "astro/assets/utils";
import { describe, expect, test } from "vitest";

import astroConfig from "../../astro.config.mjs";

const imageConfig = {
  domains: [] as string[],
  remotePatterns:
    (
      astroConfig.image as {
        remotePatterns?: {
          protocol?: string;
          hostname?: string;
          port?: string;
          pathname?: string;
        }[];
      }
    ).remotePatterns ?? [],
};

const allowed = (src: string) => isRemoteAllowed(src, imageConfig);

describe("image configuration", () => {
  test("authorizes arbitrary HTTPS hosts, not a provider list", () => {
    // None of these hostnames appear in the config. That is the requirement:
    // a post must be able to use a host nobody configured in advance.
    const arbitrary = [
      "https://i.ibb.co/fVx2WyFx/accessories.png",
      "https://i.redd.it/299vzb1ufbyh1.png",
      "https://preview.redd.it/example-image.jpg",
      "https://i.imgur.com/6Z4ZQ4M.jpg",
      "https://images.example.com/architecture.png",
      "https://some-bucket.s3.eu-west-1.amazonaws.com/photo.webp",
      "https://cdn.somewhere-else.dev/a/b/c/deep.png?w=1200&sig=abc",
    ];

    for (const src of arbitrary) expect(allowed(src), src).toBe(true);
  });

  test("keeps the allowlist provider-agnostic", () => {
    // Guards against reintroducing `domains: ["img.youtube.com"]`-style lists,
    // which is exactly what this replaced.
    expect(imageConfig.domains ?? []).toEqual([]);
    for (const pattern of imageConfig.remotePatterns ?? []) {
      expect(pattern.hostname).toBeUndefined();
      expect(pattern.pathname).toBeUndefined();
    }
  });

  test("authorizes HTTPS only", () => {
    expect(allowed("http://i.ibb.co/example/image.png")).toBe(false);
    expect(allowed("ftp://example.com/image.png")).toBe(false);
    expect(allowed("file:///etc/passwd")).toBe(false);
  });

  test("still authorizes redirect destinations on any HTTPS host", () => {
    // Astro validates every hop of a redirect chain with the same matcher, so
    // a host that redirects to a CDN must not need a second entry.
    const origin = "https://i.ibb.co/example/image.png";
    const redirectTarget = "https://simgbb.com/images/logo.png";
    expect(matchPattern(new URL(origin), imageConfig.remotePatterns?.[0] ?? {})).toBe(true);
    expect(matchPattern(new URL(redirectTarget), imageConfig.remotePatterns?.[0] ?? {})).toBe(true);
  });

  test("a hostname allowlist would have rejected the arbitrary hosts", () => {
    // Documents why `remotePatterns: [{ protocol: "https" }]` is used instead of
    // the previous `domains` entry: the old shape cannot express "any host".
    const previous = { domains: ["img.youtube.com"], remotePatterns: [] };
    expect(isRemoteAllowed("https://img.youtube.com/vi/x/maxresdefault.jpg", previous)).toBe(true);
    expect(isRemoteAllowed("https://i.ibb.co/example/image.webp", previous)).toBe(false);
    expect(isRemoteAllowed("https://i.redd.it/example.jpg", previous)).toBe(false);
  });
});

describe("responsive image configuration", () => {
  test("uses the constrained layout globally so Markdown gets it too", () => {
    expect((astroConfig.image as { layout?: string }).layout).toBe("constrained");
  });

  test("enables Astro's responsive styles", () => {
    expect((astroConfig.image as { responsiveStyles?: boolean }).responsiveStyles).toBe(true);
  });

  test("caps breakpoints at the article column width", () => {
    const breakpoints = (astroConfig.image as { breakpoints?: number[] }).breakpoints ?? [];
    expect(breakpoints.length).toBeGreaterThan(0);
    // No reader can display more than the shared `max-w-3xl` column, so the
    // default ladder's 2048–6016px variants would be dead weight.
    expect(Math.max(...breakpoints)).toBeLessThanOrEqual(1280);
    expect(breakpoints).toEqual([...breakpoints].sort((a, b) => a - b));
  });
});
