/**
 * The single source of truth for how we match "the same product" across stores.
 *
 * Stores name things differently ("PC Rotisserie Chicken" vs "Selection Roast
 * Chicken"), so to compare prices we reduce each product to a NORMALIZED KEY.
 * Products that produce the same key are treated as the same item.
 *
 * Phase 2/3 strategy (simple + predictable):
 *
 *     normalized_key = lower( category | name | brand )
 *
 * i.e. category, name and brand joined by "|", lowercased and whitespace-tidied.
 * This MUST match how the SQL seed builds keys (e.g. "deli|rotisserie chicken|").
 *
 * Why so simple? It is easy to reason about and debug, and it will UNDER-match
 * (miss some true equivalents) rather than OVER-match (wrongly merge different
 * items) — the safer failure direction.
 *
 * EXTENSION POINT: when better matching is wanted (barcode/UPC, or fuzzy/trigram
 * matching), change it HERE and in the ingestion lookup — nowhere else.
 */

/** Lowercase, trim, and collapse runs of whitespace to a single space. */
function tidy(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Build the normalized matching key for a product.
 * Brand is often missing — that's fine; it just produces a trailing "|".
 */
export function normalizedKey(input: {
  category?: string | null;
  name: string;
  brand?: string | null;
}): string {
  return [tidy(input.category), tidy(input.name), tidy(input.brand)].join("|");
}
