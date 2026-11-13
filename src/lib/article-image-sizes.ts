/**
 * `sizes` for article images.
 *
 * Astro derives `sizes` from an image's intrinsic width (`constrained` layout:
 * `(min-width: 936px) 936px, 100vw`). For a Markdown image the intrinsic width
 * is the source file's, so a 1920px screenshot claims `sizes="1920px"` inside a
 * column that is never wider than `max-w-3xl` (768px) minus `px-5`/`px-6`. The
 * browser then picks the largest variant and downloads megabytes its layout
 * never uses.
 *
 * Markdown has no syntax for `sizes`, so the fix belongs in the pipeline. User
 * HAST plugins run before Astro's `createImageMarkerPlugin()`, which spreads
 * the surviving `<img>` properties into the marker that `getImage()` receives
 * (`sizes` is not stripped). Setting it here is therefore the same as passing
 * it in MDX, and `getImage({ sizes })` wins over the computed default.
 *
 * The breakpoint mirrors `src/components/layouts/container.astro`:
 * `mx-auto w-full max-w-3xl px-5 sm:px-6`. Tailwind's `sm` is 640px, so the
 * horizontal gutter is 20px per side below that and 24px from 640px up, and
 * `max-w-3xl` caps the box at 768px — leaving 720px of content at 768px and
 * above. Widths below are measured from the real container, not assumed.
 */
import { defineHastPlugin } from "satteri";

/**
 * Rendered width of the article body at each breakpoint:
 *
 * - `>= 768px`  → `max-w-3xl` (768px) − `px-6` (48px) = 720px
 * - `>= 640px`  → viewport − `px-6` (48px)             e.g. 640 → 592px
 * - below 640px → viewport − `px-5` (40px)             e.g. 390 → 350px
 *
 * The middle step is what an earlier `calc(100vw - 2.5rem)` alone got wrong:
 * between 640px and 767px the gutter is 24px per side, so the image would
 * advertise 10px more than the column is wide.
 */
const ARTICLE_IMAGE_SIZES =
  "(min-width: 768px) 720px, (min-width: 640px) calc(100vw - 3rem), calc(100vw - 2.5rem)";

export const articleImageSizesPlugin = defineHastPlugin({
  name: "article-image-sizes",
  element: {
    filter: ["img"],
    visit(node, ctx) {
      // Every `<img>` in content is a candidate; the image marker later
      // decides which ones are actually processed. Setting `sizes` on a
      // non-processed image is harmless, and skipping the check here avoids
      // duplicating the local/remote classification logic.
      ctx.setProperty(node, "sizes", ARTICLE_IMAGE_SIZES);
    },
  },
});
