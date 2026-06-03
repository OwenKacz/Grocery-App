/**
 * RestApiAdapter — for stores that expose a real REST/JSON API.
 *
 * This is a GENERIC adapter: instead of hard-coding one store's API, it reads
 * the endpoint and a field "mapping" from config, fetches the JSON, and maps
 * each item into our normalized shape. Most simple JSON price feeds can be
 * supported with config alone — no new code.
 *
 * ── config shape (`data_sources.config` jsonb) ───────────────────────────────
 *   {
 *     "url": "https://api.example.com/prices",
 *     "headers": { "Authorization": "Bearer …" },   // optional
 *     "itemsPath": "data.items",                      // optional: where the array lives
 *     "branchId": "…uuid…",                           // branch all rows belong to
 *     "mapping": {                                     // our field <- their field
 *       "name": "product_name",
 *       "brand": "brand",
 *       "category": "dept",
 *       "packageSize": "size",
 *       "barcode": "upc",
 *       "regularPrice": "price",
 *       "salePrice": "sale_price",
 *       "unitPriceValue": "unit_price",
 *       "unitPriceUnit": "unit"
 *     }
 *   }
 *
 * If no `url` is configured, it returns nothing (so an unconfigured source is a
 * harmless no-op rather than an error).
 *
 * NOTE: only call store APIs you are permitted to use. See the data-sourcing
 * note in PROJECT_LOG.md — most Canadian chains have no public price API.
 */

import type { AdapterContext, DataSourceAdapter, NormalizedPrice } from "../types";

interface RestApiConfig {
  url?: string;
  headers?: Record<string, string>;
  itemsPath?: string;
  branchId?: string;
  mapping?: Partial<Record<keyof NormalizedPrice, string>>;
}

export const restApiAdapter: DataSourceAdapter = {
  type: "rest_api",
  description: "Fetches prices from a store's JSON REST API using a field mapping.",

  async fetchPrices(ctx: AdapterContext): Promise<NormalizedPrice[]> {
    const config = (ctx.source.config ?? {}) as RestApiConfig;
    if (!config.url) return [];

    const mapping = config.mapping ?? {};
    if (!config.branchId) {
      throw new Error('rest_api: config.branchId is required.');
    }

    const response = await fetch(config.url, { headers: config.headers });
    if (!response.ok) {
      throw new Error(
        `rest_api: request failed (${response.status} ${response.statusText}).`,
      );
    }

    const json: unknown = await response.json();
    const items = extractArray(json, config.itemsPath);

    const prices: NormalizedPrice[] = [];
    for (const item of items) {
      const name = readString(item, mapping.name);
      const regularPrice = readNumber(item, mapping.regularPrice);
      if (!name || regularPrice === null) continue; // required fields missing

      prices.push({
        name,
        brand: readString(item, mapping.brand),
        category: readString(item, mapping.category),
        packageSize: readString(item, mapping.packageSize),
        barcode: readString(item, mapping.barcode),
        branchId: config.branchId,
        regularPrice,
        salePrice: readNumber(item, mapping.salePrice),
        unitPriceValue: readNumber(item, mapping.unitPriceValue),
        unitPriceUnit: readString(item, mapping.unitPriceUnit),
        inStock: true,
      });
    }

    return prices;
  },
};

// ── helpers ───────────────────────────────────────────────────────────────────

/** Read a (possibly nested, dot-separated) path off an object. */
function getPath(obj: unknown, dotted: string | undefined): unknown {
  if (!dotted) return undefined;
  return dotted.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/** Pull the array of items out of the response (top-level or at itemsPath). */
function extractArray(json: unknown, itemsPath?: string): unknown[] {
  const target = itemsPath ? getPath(json, itemsPath) : json;
  return Array.isArray(target) ? target : [];
}

function readString(item: unknown, field: string | undefined): string | null {
  const value = getPath(item, field);
  if (value === null || value === undefined) return null;
  return String(value);
}

function readNumber(item: unknown, field: string | undefined): number | null {
  const value = getPath(item, field);
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
