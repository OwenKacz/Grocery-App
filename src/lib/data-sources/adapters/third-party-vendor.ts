/**
 * ThirdPartyVendorAdapter — for buying price data from a paid data vendor
 * (a company that aggregates grocery prices and sells API access).
 *
 * This is a TEMPLATE. Vendors differ a lot (auth, pagination, response shape),
 * so the actual request/parse code is filled in once you've chosen a vendor and
 * read their API docs. Until then it returns nothing (a harmless no-op).
 *
 * ── config shape (`data_sources.config` jsonb) — example ─────────────────────
 *   {
 *     "vendor": "example-vendor",
 *     "apiKey": "…",            // prefer an env var ref in real use, not raw here
 *     "branchId": "…uuid…"
 *   }
 *
 * Implementation sketch (do this when you onboard a vendor):
 *   1. Read vendor settings from `ctx.source.config`.
 *   2. Call the vendor API (handle auth + pagination per their docs).
 *   3. Map each returned item into a `NormalizedPrice` (see rest-api.ts for the
 *      mapping pattern).
 *   4. Return the list. The ingestion job saves it — don't write to the DB here.
 */

import type { AdapterContext, DataSourceAdapter, NormalizedPrice } from "../types";

interface ThirdPartyVendorConfig {
  vendor?: string;
  branchId?: string;
}

export const thirdPartyVendorAdapter: DataSourceAdapter = {
  type: "third_party_vendor",
  description: "Imports prices from a paid third-party data vendor (template).",

  async fetchPrices(ctx: AdapterContext): Promise<NormalizedPrice[]> {
    const config = (ctx.source.config ?? {}) as ThirdPartyVendorConfig;

    if (!config.vendor) {
      // Not configured yet — nothing to do.
      return [];
    }

    // TODO: implement the chosen vendor's API call + mapping here.
    throw new Error(
      `third_party_vendor: no implementation for vendor "${config.vendor}" yet. ` +
        "Fill in fetchPrices() in third-party-vendor.ts once you've onboarded a vendor.",
    );
  },
};
