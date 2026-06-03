/**
 * ManualEntryAdapter — for prices typed in by hand (via the admin panel, Phase 7).
 *
 * There is nothing to "fetch" for a manual source: an admin enters prices
 * directly, and they already live in the `prices` table. So this adapter simply
 * returns an empty list, which means the ingestion job leaves existing manual
 * prices untouched.
 *
 * It exists so that manual stores still fit the same pluggable model as every
 * other source (no special-casing anywhere).
 */

import type { AdapterContext, DataSourceAdapter, NormalizedPrice } from "../types";

export const manualEntryAdapter: DataSourceAdapter = {
  type: "manual_entry",
  description: "Prices entered by hand in the admin panel; nothing to fetch.",

  async fetchPrices(_ctx: AdapterContext): Promise<NormalizedPrice[]> {
    return [];
  },
};
