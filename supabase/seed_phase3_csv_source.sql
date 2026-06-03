-- =============================================================================
-- grocery-app — Phase 3: register a CSV data source (demo of the adapter layer)
-- -----------------------------------------------------------------------------
-- This adds ONE row to `data_sources` so the ingestion job has a CSV source to
-- pull from. It points at `data/seed/sample-prices.csv` in the project.
--
-- This is the whole point of the architecture: adding a store/source is just a
-- row here — no code changes. Run it once in the Supabase SQL Editor (it is
-- safe to re-run). Then trigger ingestion (see PROJECT_LOG.md / README).
--
-- We attach it to the existing "No Frills" store purely so it has a home + a
-- default currency; the CSV itself specifies the branch for every row, so it can
-- carry prices for multiple branches/stores.
-- =============================================================================

insert into data_sources (id, store_id, adapter_type, config, refresh_interval_minutes, is_active, last_status)
values (
  '3333dddd-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',          -- No Frills store
  'csv_flyer_import',
  '{"filePath": "data/seed/sample-prices.csv"}'::jsonb,
  1440,
  true,
  'pending'
)
on conflict (id) do update
  set config = excluded.config,
      adapter_type = excluded.adapter_type,
      is_active = excluded.is_active;
