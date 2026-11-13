/**
 * Satori template for every social image, rendered to PNG by sharp.
 *
 * Design constraints (see PRODUCT.md → Brand Commitments):
 * - dark-first and monochrome, using the same neutral values as `global.css`;
 * - Satoshi for text, Caveat for the wordmark — the faces the site already
 *   loads;
 * - one 1200×630 frame with fixed chrome (wordmark, eyebrow, hairline footer)
 *   and a body that changes shape by page kind, so cards are recognisable but
 *   never interchangeable.
 *
 * Satori renders a variable font at its default instance only, so the OG
 * families in `astro.config.mjs` use discrete 400/700 weights.
 */
import { experimental_getFontFileURL, fontData } from "astro:assets";
import satori from "satori";
import sharp from "sharp";

import { OG_HEIGHT, OG_WIDTH } from "@/lib/og/constants";
import type { OgSpec } from "@/lib/og/specs";
import { site } from "@/lib/site";

/** Neutral tokens from `global.css`, flattened to hex for satori. */
const COLOR = {
  background: "#0a0a0a",
  foreground: "#fafafa",
  muted: "#a1a1a1",
  faint: "#6b6b6b",
  hairline: "rgba(255,255,255,0.12)",
  surface: "rgba(255,255,255,0.04)",
} as const;

// Typed as the keys Astro generated, so a renamed `cssVariable` in
// `astro.config.mjs` fails typecheck instead of at render time.
type FontFamily = keyof typeof fontData;

const SATOSHI: FontFamily = "--font-og-satoshi";
const CAVEAT: FontFamily = "--font-caveat";

type LoadedFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700;
  style: "normal";
};

/**
 * Fetched once per build: every page's endpoint shares these buffers, so the
 * font files are read three times total, not three times per image.
 */
const fontPromise = (async (): Promise<LoadedFont[]> => {
  const files = [
    { family: SATOSHI, name: "Satoshi", weight: 400 as const },
    { family: SATOSHI, name: "Satoshi", weight: 700 as const },
    { family: CAVEAT, name: "Caveat", weight: 400 as const },
  ];

  return Promise.all(
    files.map(async ({ family, name, weight }) => {
      // Exact weight first; Caveat is a variable family (`"400 700"`), so fall
      // back to its single normal face — Satori draws the default instance.
      const faces = fontData[family]?.filter((font) => font.style === "normal") ?? [];
      const face = faces.find((font) => Number(font.weight) === weight) ?? faces[0];
      const source = face?.src[0]?.url;

      if (!source) {
        throw new Error(
          `OG image fonts: ${family} ${weight} is missing. Check the font family in astro.config.mjs.`,
        );
      }

      const response = await fetch(experimental_getFontFileURL(source));
      if (!response.ok) {
        throw new Error(`OG image fonts: could not read ${source} (${response.status}).`);
      }

      return { name, data: await response.arrayBuffer(), weight, style: "normal" as const };
    }),
  );
})();

type Node = { type: string; props: Record<string, unknown> };

function el(type: string, style: Record<string, unknown>, children?: unknown): Node {
  return { type, props: children === undefined ? { style } : { style, children } };
}

/**
 * Cut at a boundary with an ellipsis. CSS clamping alone can break a word in
 * half (`JavaScrip…`), which reads as a bug on a social card. This prefers a
 * clause boundary (comma, dash, colon) near the limit, then a word boundary,
 * and leaves the clamp below as a safety net only.
 */
function fitText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  const cut = text.slice(0, maxChars);
  const clause = Math.max(
    cut.lastIndexOf(", "),
    cut.lastIndexOf(" — "),
    cut.lastIndexOf(": "),
    cut.lastIndexOf(". "),
  );

  const boundary = clause > maxChars * 0.6 ? clause : cut.lastIndexOf(" ");
  const base = boundary > maxChars * 0.5 ? cut.slice(0, boundary) : cut;
  return `${base.replace(/[,;:.\s]+$/, "")}…`;
}

/** Title size steps down as the string grows; every step keeps 3 lines of room. */
function titleSize(title: string): number {
  if (title.length <= 28) return 104;
  if (title.length <= 52) return 84;
  if (title.length <= 88) return 68;
  return 56;
}

/** Brand chrome shared by every card: wordmark, eyebrow, footer rule. */
function chrome(spec: OgSpec, body: Node): Node {
  return el(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      width: `${OG_WIDTH}px`,
      height: `${OG_HEIGHT}px`,
      // Satori lays out with content-box by default; without this the 630px
      // height excludes the padding and the footer lands off-canvas.
      boxSizing: "border-box",
      backgroundColor: COLOR.background,
      color: COLOR.foreground,
      padding: "64px 80px 56px",
      fontFamily: "Satoshi",
      position: "relative",
    },
    [
      // Top row: identity on the left, page kind on the right.
      el(
        "div",
        {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
        },
        [
          el("div", { display: "flex", alignItems: "baseline", gap: "14px" }, [
            el(
              "div",
              {
                fontFamily: "Caveat",
                fontSize: "52px",
                lineHeight: 1,
                color: COLOR.foreground,
              },
              site.wordmark,
            ),
            el(
              "div",
              {
                fontSize: "22px",
                letterSpacing: "-0.01em",
                color: COLOR.muted,
              },
              site.name,
            ),
          ]),
          el(
            "div",
            {
              display: "flex",
              alignItems: "center",
              gap: "12px",
              fontSize: "15px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: COLOR.muted,
            },
            [
              el("div", {
                width: "28px",
                height: "1px",
                backgroundColor: COLOR.hairline,
              }),
              el("div", {}, spec.eyebrow),
            ],
          ),
        ],
      ),
      // Body fills the space between the chrome rows.
      el("div", { display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }, [
        body,
      ]),
      // Footer: hairline, then the facts this page can actually claim.
      el("div", { display: "flex", flexDirection: "column", gap: "18px", width: "100%" }, [
        el("div", { width: "100%", height: "1px", backgroundColor: COLOR.hairline }),
        el(
          "div",
          {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "17px",
            color: COLOR.faint,
          },
          [
            el("div", {}, site.url.replace(/^https?:\/\//, "")),
            el(
              "div",
              { display: "flex", gap: "18px" },
              spec.meta.map((item) => el("div", {}, item)),
            ),
          ],
        ),
      ]),
    ],
  );
}

/** Home: the identity itself, oversized, with the wordmark as texture. */
function homeBody(spec: OgSpec): Node {
  return el("div", { display: "flex", flexDirection: "column", gap: "28px" }, [
    el(
      "div",
      {
        fontSize: "132px",
        fontWeight: 700,
        lineHeight: 0.98,
        letterSpacing: "-0.045em",
      },
      spec.title,
    ),
    el(
      "div",
      {
        fontSize: "30px",
        lineHeight: 1.45,
        color: COLOR.muted,
        maxWidth: "860px",
        lineClamp: 3,
        textOverflow: "ellipsis",
      },
      fitText(spec.description, 150),
    ),
  ]);
}

/** Blog index: the archive name plus the newest titles as a numbered list. */
function indexBody(spec: OgSpec): Node {
  const entries = spec.index ?? [];

  return el(
    "div",
    {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: "56px",
      width: "100%",
    },
    [
      el("div", { display: "flex", flexDirection: "column", gap: "22px", maxWidth: "620px" }, [
        el(
          "div",
          {
            fontSize: "120px",
            fontWeight: 700,
            lineHeight: 0.95,
            letterSpacing: "-0.045em",
          },
          spec.title,
        ),
        el(
          "div",
          {
            fontSize: "26px",
            lineHeight: 1.45,
            color: COLOR.muted,
            lineClamp: 3,
            textOverflow: "ellipsis",
          },
          fitText(spec.description, 120),
        ),
      ]),
      entries.length > 0
        ? el(
            "div",
            {
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              paddingLeft: "32px",
              borderLeft: `1px solid ${COLOR.hairline}`,
              maxWidth: "420px",
            },
            entries.map((entry, index) =>
              el(
                "div",
                { display: "flex", gap: "14px", alignItems: "baseline", fontSize: "20px" },
                [
                  el(
                    "div",
                    {
                      fontSize: "14px",
                      color: COLOR.faint,
                      fontVariantNumeric: "tabular-nums",
                      minWidth: "20px",
                    },
                    String(index + 1).padStart(2, "0"),
                  ),
                  el(
                    "div",
                    {
                      color: COLOR.muted,
                      lineClamp: 2,
                      textOverflow: "ellipsis",
                      lineHeight: 1.35,
                    },
                    fitText(entry, 66),
                  ),
                ],
              ),
            ),
          )
        : el("div", { display: "none" }, ""),
    ],
  );
}

/** Article: the title is the subject; description sits under it. */
function articleBody(spec: OgSpec): Node {
  return el("div", { display: "flex", flexDirection: "column", gap: "30px", width: "100%" }, [
    el(
      "div",
      {
        fontSize: `${titleSize(spec.title)}px`,
        fontWeight: 700,
        lineHeight: 1.08,
        letterSpacing: "-0.035em",
        maxWidth: "980px",
        lineClamp: 3,
        textOverflow: "ellipsis",
      },
      spec.title,
    ),
    el(
      "div",
      {
        fontSize: "27px",
        lineHeight: 1.45,
        color: COLOR.muted,
        maxWidth: "880px",
        lineClamp: 2,
        textOverflow: "ellipsis",
      },
      fitText(spec.description, 118),
    ),
  ]);
}

function composition(spec: OgSpec): Node {
  const body =
    spec.kind === "home"
      ? homeBody(spec)
      : spec.kind === "index"
        ? indexBody(spec)
        : articleBody(spec);

  return el(
    "div",
    {
      display: "flex",
      width: `${OG_WIDTH}px`,
      height: `${OG_HEIGHT}px`,
      boxSizing: "border-box",
      backgroundColor: COLOR.background,
      position: "relative",
    },
    [
      // Subtle geometry: a faint column of rules at the right edge.
      el(
        "div",
        {
          display: "flex",
          gap: "26px",
          position: "absolute",
          top: 0,
          right: "40px",
          height: `${OG_HEIGHT}px`,
          opacity: 0.5,
        },
        [0, 1, 2].map(() =>
          el("div", { width: "1px", height: "100%", backgroundColor: COLOR.surface }),
        ),
      ),
      chrome(spec, body),
    ],
  );
}

/** Render one page's card as a PNG buffer. */
export async function renderOgImage(spec: OgSpec): Promise<Buffer> {
  const svg = await satori(composition(spec) as Parameters<typeof satori>[0], {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: await fontPromise,
  });

  return sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true }).toBuffer();
}
