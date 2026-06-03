/**
 * The pluggable data-source layer — THE core architecture of this app.
 *
 * Every grocery store gives us data differently (a REST API, a weekly flyer CSV,
 * a paid data vendor, or hand entry). To keep the rest of the app simple, EVERY
 * integration implements the same `DataSourceAdapter` interface and returns data
 * in one normalized shape (`NormalizedPrice`). The ingestion job (ingest.ts)
 * then handles matching + saving — the adapters never touch the database.
 *
 * THE GOLDEN RULE: never hard-code one store's logic anywhere else in the app.
 * A new store = a new row in the `data_sources` table pointing at one of these
 * adapter types. Nothing else changes.
 */

import type { AdapterType, DataSource } from "@/types/database";

/**
 * One price for one product at one physical branch, in a store-agnostic shape.
 * This is what every adapter returns; the ingestion job converts these into
 * `products` + `prices` rows.
 *
 * Only `name`, `branchId`, and `regularPrice` are required — everything else is
 * optional because not every source provides it.
 */
export interface NormalizedPrice {
  // --- What the product IS (used to match it across stores) ---
  /** Display name, e.g. "Rotisserie Chicken". Required. */
  name: string;
  /** Brand, e.g. "PC". Often unknown — leave undefined. */
  brand?: string | null;
  /** Category, e.g. "deli", "dairy", "produce". Helps matching + filtering. */
  category?: string | null;
  /** Human-readable size, e.g. "2 L", "12 ct", "~900 g". */
  packageSize?: string | null;
  /** Barcode / UPC if known — the most reliable matching key when present. */
  barcode?: string | null;

  // --- WHERE this price applies ---
  /**
   * The `store_branches.id` (UUID) this price is for. The adapter is responsible
   * for knowing which branch each price belongs to (usually via its config).
   */
  branchId: string;

  // --- The PRICE itself ---
  /** Normal shelf price. Required. */
  regularPrice: number;
  /** Sale price if currently on sale, else null/undefined. */
  salePrice?: number | null;
  /** Unit price value, e.g. 1.05 (for "$1.05 / 100 g"). */
  unitPriceValue?: number | null;
  /** Unit price unit label, e.g. "per_100g", "per_litre", "each", "per_lb". */
  unitPriceUnit?: string | null;
  /** Whether it is in stock. Defaults to true if omitted. */
  inStock?: boolean;
  /** ISO currency code. Defaults to the store's currency if omitted. */
  currency?: string | null;
}

/**
 * Everything an adapter needs to do its job, handed to it by the ingestion job.
 */
export interface AdapterContext {
  /**
   * The `data_sources` row that triggered this run. Its `config` (jsonb) holds
   * source-specific settings — an API URL, a CSV path, the branch mapping, etc.
   * Each adapter documents the `config` shape it expects.
   */
  source: DataSource;
}

/**
 * The one interface every store integration implements.
 *
 * `fetchPrices` does the source-specific work (call an API, parse a CSV, …) and
 * returns normalized prices. It must NOT write to the database — that is the
 * ingestion job's responsibility, so all the matching/saving logic lives in one
 * place.
 */
export interface DataSourceAdapter {
  /** Which `adapter_type` this handles. Must be unique across the registry. */
  readonly type: AdapterType;
  /** Short human description (shown in the admin panel later). */
  readonly description: string;
  /** Fetch + normalize the latest prices for the given source. */
  fetchPrices(ctx: AdapterContext): Promise<NormalizedPrice[]>;
}
