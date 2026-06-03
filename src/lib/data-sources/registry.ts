/**
 * The adapter registry — the single list of known data-source adapters.
 *
 * The ingestion job looks up the right adapter here by a source's `adapter_type`.
 * To support a brand-new KIND of source, you add an adapter and register it here
 * (one line). To add a new STORE that uses an existing kind, you don't touch
 * code at all — you add a row to the `data_sources` table.
 */

import type { AdapterType } from "@/types/database";

import { csvFlyerImportAdapter } from "./adapters/csv-flyer-import";
import { manualEntryAdapter } from "./adapters/manual-entry";
import { restApiAdapter } from "./adapters/rest-api";
import { thirdPartyVendorAdapter } from "./adapters/third-party-vendor";
import type { DataSourceAdapter } from "./types";

/** Every adapter, keyed by the `adapter_type` it handles. */
const adapters: Record<AdapterType, DataSourceAdapter> = {
  manual_entry: manualEntryAdapter,
  csv_flyer_import: csvFlyerImportAdapter,
  rest_api: restApiAdapter,
  third_party_vendor: thirdPartyVendorAdapter,
};

/** Look up the adapter for a given type, or throw if somehow unknown. */
export function getAdapter(type: AdapterType): DataSourceAdapter {
  const adapter = adapters[type];
  if (!adapter) {
    throw new Error(`No data-source adapter registered for type "${type}".`);
  }
  return adapter;
}

/** All registered adapters (handy for an admin "what's supported" view). */
export function listAdapters(): DataSourceAdapter[] {
  return Object.values(adapters);
}
