/**
 * The ingestion job — the one place that turns adapter output into saved data.
 *
 * For each active data source it:
 *   1. Finds the right adapter (by `adapter_type`) in the registry.
 *   2. Asks the adapter for normalized prices (`fetchPrices`).
 *   3. For each price: finds or creates the matching `products` row, then
 *      upserts the `prices` row (unique per product + branch + source).
 *   4. Records the run outcome back on the `data_sources` row.
 *
 * ALL the matching + saving logic lives here, so adapters stay simple and the
 * app's search can just read the cached `products`/`prices` tables.
 *
 * Runs with the admin (secret-key) client, which bypasses Row-Level Security.
 * Server-only — never import from browser code.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { DataSource } from "@/types/database";

import { normalizedKey } from "./normalize";
import { getAdapter } from "./registry";
import type { NormalizedPrice } from "./types";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Outcome of ingesting one data source. */
export interface SourceResult {
  sourceId: string;
  adapterType: string;
  status: "ok" | "error";
  pricesUpserted: number;
  productsCreated: number;
  error?: string;
}

/** Outcome of a whole ingestion run (one or more sources). */
export interface IngestResult {
  ranAt: string;
  sources: SourceResult[];
}

/**
 * Run ingestion. With no argument, processes every ACTIVE source. Pass a
 * `sourceId` to run just one (handy for testing or an admin "refresh now").
 */
export async function runIngestion(options?: {
  sourceId?: string;
}): Promise<IngestResult> {
  const supabase = createAdminClient();

  // Load the source(s) to process.
  let query = supabase.from("data_sources").select("*");
  query = options?.sourceId
    ? query.eq("id", options.sourceId)
    : query.eq("is_active", true);

  const { data: sources, error } = await query;
  if (error) {
    throw new Error(`Could not load data_sources: ${error.message}`);
  }

  const results: SourceResult[] = [];
  for (const source of sources ?? []) {
    results.push(await ingestOneSource(supabase, source));
  }

  return { ranAt: new Date().toISOString(), sources: results };
}

/** Process a single data source end to end, recording the outcome on its row. */
async function ingestOneSource(
  supabase: AdminClient,
  source: DataSource,
): Promise<SourceResult> {
  const result: SourceResult = {
    sourceId: source.id,
    adapterType: source.adapter_type,
    status: "ok",
    pricesUpserted: 0,
    productsCreated: 0,
  };

  try {
    // The store's currency is the default for any price that doesn't specify one.
    const { data: store } = await supabase
      .from("stores")
      .select("default_currency")
      .eq("id", source.store_id)
      .single();
    const defaultCurrency = store?.default_currency ?? "CAD";

    // 1) Ask the adapter for normalized prices.
    const adapter = getAdapter(source.adapter_type);
    const prices = await adapter.fetchPrices({ source });

    // 2) Resolve products + upsert prices. A per-run cache avoids re-looking-up
    //    the same product many times within one batch.
    const productCache = new Map<string, string>();

    for (const price of prices) {
      const { productId, created } = await resolveProductId(
        supabase,
        price,
        productCache,
      );
      if (created) result.productsCreated++;

      const { error: priceError } = await supabase.from("prices").upsert(
        {
          product_id: productId,
          branch_id: price.branchId,
          source_id: source.id,
          regular_price: price.regularPrice,
          sale_price: price.salePrice ?? null,
          unit_price_value: price.unitPriceValue ?? null,
          unit_price_unit: price.unitPriceUnit ?? null,
          in_stock: price.inStock ?? true,
          currency: price.currency ?? defaultCurrency,
          last_updated: new Date().toISOString(),
        },
        { onConflict: "product_id,branch_id,source_id" },
      );
      if (priceError) {
        throw new Error(`upsert price failed: ${priceError.message}`);
      }
      result.pricesUpserted++;
    }

    await recordRun(supabase, source.id, "ok", null);
  } catch (err) {
    result.status = "error";
    result.error = err instanceof Error ? err.message : String(err);
    await recordRun(supabase, source.id, "error", result.error);
  }

  return result;
}

/**
 * Find the canonical `products` row for a normalized price, creating it if none
 * exists. Matching strategy (see normalize.ts for the extension points):
 *   1. by barcode, if the price has one;
 *   2. else by normalized_key (category|name|brand).
 */
async function resolveProductId(
  supabase: AdminClient,
  price: NormalizedPrice,
  cache: Map<string, string>,
): Promise<{ productId: string; created: boolean }> {
  const key = normalizedKey({
    category: price.category,
    name: price.name,
    brand: price.brand,
  });
  const cacheKey = price.barcode ? `upc:${price.barcode}` : `key:${key}`;

  const cached = cache.get(cacheKey);
  if (cached) return { productId: cached, created: false };

  // 1) Try to find an existing product.
  let existingId: string | null = null;
  if (price.barcode) {
    const { data } = await supabase
      .from("products")
      .select("id")
      .eq("barcode", price.barcode)
      .limit(1)
      .maybeSingle();
    existingId = data?.id ?? null;
  }
  if (!existingId) {
    const { data } = await supabase
      .from("products")
      .select("id")
      .eq("normalized_key", key)
      .limit(1)
      .maybeSingle();
    existingId = data?.id ?? null;
  }

  if (existingId) {
    cache.set(cacheKey, existingId);
    return { productId: existingId, created: false };
  }

  // 2) None found — create it.
  const { data: inserted, error } = await supabase
    .from("products")
    .insert({
      name: price.name,
      brand: price.brand ?? null,
      category: price.category ?? null,
      package_size: price.packageSize ?? null,
      barcode: price.barcode ?? null,
      normalized_key: key,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    throw new Error(`insert product failed: ${error?.message ?? "unknown"}`);
  }

  cache.set(cacheKey, inserted.id);
  return { productId: inserted.id, created: true };
}

/** Write the run outcome back onto the data_sources row (for the admin panel). */
async function recordRun(
  supabase: AdminClient,
  sourceId: string,
  status: "ok" | "error",
  error: string | null,
): Promise<void> {
  await supabase
    .from("data_sources")
    .update({
      last_run: new Date().toISOString(),
      last_status: status,
      last_error: error,
    })
    .eq("id", sourceId);
}
