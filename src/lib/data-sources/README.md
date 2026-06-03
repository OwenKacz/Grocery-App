# Data source layer (the heart of the app)

> Built in **Phase 3**. This folder is a signpost so you know where things go.

Every grocery store gets data to us differently — some have a REST API, some
only a weekly flyer CSV, some only via a paid data vendor, and some we enter by
hand. To keep the rest of the app simple, **every** store integration will
implement one shared TypeScript interface, `DataSourceAdapter`, and return data
in one normalized shape.

## What will live here

- `types.ts` — the `DataSourceAdapter` interface + the normalized product shape.
- `registry.ts` (or a `data_sources` DB table) — the single list of active
  sources. **Adding a store = adding one entry here. Nothing else.**
- `adapters/`
  - `rest-api.ts` — `RestApiAdapter` for stores with a real REST API.
  - `third-party-vendor.ts` — `ThirdPartyVendorAdapter` for paid data vendors.
  - `csv-flyer-import.ts` — `CsvFlyerImportAdapter` for spreadsheet/flyer uploads.
  - `manual-entry.ts` — `ManualEntryAdapter` for hand-entered prices (admin panel).
- `ingest.ts` — the scheduled job that pulls from each active source, normalizes
  the results, and upserts them into the `products` / `prices` tables. The app's
  search reads from those cached tables, **not** from store sources live.

## Product matching strategy (how we compare the "same" item across stores)

The whole point of the app is comparing the same item across stores, but stores
name things differently ("PC Rotisserie Chicken" vs "Selection Roast Chicken").
We group equivalent items using a **normalized matching key** stored on each
`products` row (`products.normalized_key`).

**Phase 2 (simple, shipping now):**

```
normalized_key = lower( category | name | brand )
```

i.e. category, name, and brand joined by `|`, lowercased and whitespace-trimmed.
When the ingestion job imports a product, it computes this key and reuses an
existing `products` row with the same key instead of creating a duplicate. Two
prices on one product row = a comparison.

**Why so simple?** It is predictable and easy for a non-expert to reason about
and debug. It will under-match (miss true equivalents whose names differ) rather
than over-match (wrongly merge different items) — the safer failure direction.

**Extension points (left deliberately open):**

- `products.barcode` (UPC) exists and is indexed. Barcode is the most reliable
  key — prefer it when available: match on barcode first, fall back to the
  normalized key.
- Swap the exact-key match for **fuzzy matching** (e.g. trigram similarity via
  Postgres `pg_trgm`, or embeddings) without touching the rest of the app — only
  the matching function in the ingestion job changes.

The matching logic will live in one place (the ingestion job, Phase 3) so it is
the single thing you change to improve matching.

## The golden rule

Never hard-code a single store's integration anywhere else in the app. If you
find yourself writing `if (store === "SomeStore")` outside an adapter, stop —
it belongs in an adapter behind the shared interface.
