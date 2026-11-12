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
 * The breakpoint mirrors `src/components/layouts/container.astro`: `max-w-3xl`
 * (768px) with `px-5` (40px) below `sm` and `px-6` (48px) above, leaving 728px
 * and 720px of usable width respectively.
 */
import { defineHastPlugin } from "satteri";

/** Usable width of the article body at its widest. */
const ARTICLE_IMAGE_SIZES = "(min-width: 768px) 720px, calc(100vw - 2.5rem)";

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
