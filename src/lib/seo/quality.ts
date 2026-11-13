/**
 * Editorial metadata diagnostics: lengths, not correctness.
 *
 * Search engines do not enforce exact character counts, so these ranges are
 * guidelines rather than build rules. The gate reports a warning when a title or
 * description falls well outside the useful range, with the route, the current
 * length, and the target. Missing metadata, duplicate metadata, broken
 * canonicals, and invalid structured data stay build-blocking errors.
 *
 * An intentional exception is declared in `site.seo.metadataExceptions` with a
 * reason; the gate validates that entry and suppresses only the length warning.
 */

export type MetadataField = "title" | "description";

export type MetadataGuideline = {
  /** Absolute length at which a warning is emitted. */
  min: number;
  max: number;
  /** Editorial target. */
  recommendedMin: number;
  recommendedMax: number;
};

export const METADATA_GUIDELINES: Record<MetadataField, MetadataGuideline> = {
  title: { min: 30, max: 70, recommendedMin: 50, recommendedMax: 60 },
  description: { min: 80, max: 200, recommendedMin: 110, recommendedMax: 160 },
};

export type MetadataPage = {
  /** Canonical route, already normalized (trailing slash). */
  route: string;
  title: string;
  description: string;
};

export type MetadataException = {
  /** Canonical route, already normalized (trailing slash). */
  route: string;
  field: MetadataField;
  reason: string;
};

export type MetadataQualityWarning = {
  route: string;
  field: MetadataField;
  length: number;
  message: string;
};

const LABEL: Record<MetadataField, string> = {
  title: "title",
  description: "meta description",
};

function key(route: string, field: MetadataField): string {
  return `${route}\u0000${field}`;
}

function warning(
  route: string,
  field: MetadataField,
  length: number,
): MetadataQualityWarning | undefined {
  const guideline = METADATA_GUIDELINES[field];
  const label = LABEL[field];
  const target = `${guideline.recommendedMin}–${guideline.recommendedMax} characters`;

  if (length < guideline.min) {
    return {
      route,
      field,
      length,
      message:
        `${label} is ${length} characters; add a descriptive phrase so it has enough context ` +
        `(recommended ${target}, warning below ${guideline.min}).`,
    };
  }

  if (length > guideline.max) {
    return {
      route,
      field,
      length,
      message:
        `${label} is ${length} characters; tighten it so search results do not truncate it ` +
        `(recommended ${target}, warning above ${guideline.max}).`,
    };
  }

  return undefined;
}

/**
 * Length warnings for the pages that will be indexed. Callers pass canonical
 * routes; exceptions match exactly on route and field.
 */
export function metadataQualityWarnings(
  pages: readonly MetadataPage[],
  exceptions: readonly MetadataException[] = [],
): MetadataQualityWarning[] {
  const exempt = new Set(exceptions.map((exception) => key(exception.route, exception.field)));
  const warnings: MetadataQualityWarning[] = [];

  for (const page of pages) {
    for (const field of ["title", "description"] as const) {
      const value = page[field].trim();
      if (!value || exempt.has(key(page.route, field))) continue;
      const result = warning(page.route, field, value.length);
      if (result) warnings.push(result);
    }
  }

  return warnings;
}
