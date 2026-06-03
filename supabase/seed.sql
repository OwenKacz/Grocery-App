-- =============================================================================
-- grocery-app — Phase 2: Seed data (sample stores so the app has something to
-- show before any real data source is connected).
-- -----------------------------------------------------------------------------
-- Run this AFTER both migration files. It is re-runnable (safe to run twice):
-- it uses ON CONFLICT so re-running updates rather than duplicates.
--
-- NOTE: In Phase 3 this same kind of data will be produced by the
-- CsvFlyerImportAdapter instead of being hand-written here. For now it exists so
-- you can verify the schema and (later) see real-looking search results.
--
-- It sets up two Toronto stores that both sell a few of the same items, so you
-- can see the "cheapest store wins per item" behaviour:
--   - Rotisserie chicken: No Frills is cheaper
--   - 2 L whole milk:      FreshCo is cheaper
-- =============================================================================

-- --- Stores (chains) ---------------------------------------------------------
insert into stores (id, name, slug, default_currency) values
  ('11111111-1111-1111-1111-111111111111', 'No Frills', 'no-frills', 'CAD'),
  ('22222222-2222-2222-2222-222222222222', 'FreshCo',   'freshco',   'CAD')
on conflict (id) do update
  set name = excluded.name, slug = excluded.slug;

-- --- Branches (physical locations) -------------------------------------------
insert into store_branches (id, store_id, name, address, city, province, postal_code, lat, lng) values
  ('1111aaaa-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'Queen St W', '650 Queen St W', 'Toronto', 'ON', 'M6J 1E5', 43.6468, -79.4070),
  ('2222aaaa-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   'College St', '434 College St', 'Toronto', 'ON', 'M5T 1T3', 43.6571, -79.4046)
on conflict (id) do update
  set address = excluded.address, lat = excluded.lat, lng = excluded.lng;

-- --- Data sources (here: manual entry, one per store) ------------------------
insert into data_sources (id, store_id, adapter_type, config, refresh_interval_minutes, is_active, last_status) values
  ('1111dddd-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'manual_entry', '{}'::jsonb, 1440, true, 'ok'),
  ('2222dddd-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   'manual_entry', '{}'::jsonb, 1440, true, 'ok')
on conflict (id) do nothing;

-- --- Canonical products ------------------------------------------------------
-- normalized_key = category|name|brand (lowercased). Items with the same key are
-- treated as "the same product" across stores.
insert into products (id, name, brand, category, package_size, normalized_key) values
  ('aaaa0000-0000-0000-0000-000000000001', 'Rotisserie Chicken', null, 'deli',   '~900 g', 'deli|rotisserie chicken|'),
  ('aaaa0000-0000-0000-0000-000000000002', 'Large Eggs',         null, 'dairy',  '12 ct',  'dairy|large eggs|'),
  ('aaaa0000-0000-0000-0000-000000000003', 'Whole Milk',         null, 'dairy',  '2 L',    'dairy|whole milk|'),
  ('aaaa0000-0000-0000-0000-000000000004', 'Bananas',            null, 'produce','per lb', 'produce|bananas|')
on conflict (id) do update
  set name = excluded.name, normalized_key = excluded.normalized_key;

-- --- Prices (one per product per branch) -------------------------------------
-- Upsert key is (product_id, branch_id, source_id) so re-running refreshes them.
insert into prices
  (product_id, branch_id, source_id, regular_price, sale_price, unit_price_value, unit_price_unit, in_stock, currency)
values
  -- Rotisserie chicken  (No Frills $8.99 cheaper than FreshCo $9.49)
  ('aaaa0000-0000-0000-0000-000000000001', '1111aaaa-1111-1111-1111-111111111111', '1111dddd-1111-1111-1111-111111111111', 8.99, null, 1.00, 'per_100g', true, 'CAD'),
  ('aaaa0000-0000-0000-0000-000000000001', '2222aaaa-2222-2222-2222-222222222222', '2222dddd-2222-2222-2222-222222222222', 9.49, null, 1.05, 'per_100g', true, 'CAD'),
  -- Large eggs (dozen)  (No Frills $3.99 vs FreshCo $4.29)
  ('aaaa0000-0000-0000-0000-000000000002', '1111aaaa-1111-1111-1111-111111111111', '1111dddd-1111-1111-1111-111111111111', 3.99, null, 0.3325, 'each', true, 'CAD'),
  ('aaaa0000-0000-0000-0000-000000000002', '2222aaaa-2222-2222-2222-222222222222', '2222dddd-2222-2222-2222-222222222222', 4.29, null, 0.3575, 'each', true, 'CAD'),
  -- Whole milk 2 L  (FreshCo $3.99 cheaper than No Frills $4.49; No Frills on sale)
  ('aaaa0000-0000-0000-0000-000000000003', '1111aaaa-1111-1111-1111-111111111111', '1111dddd-1111-1111-1111-111111111111', 4.99, 4.49, 2.245, 'per_litre', true, 'CAD'),
  ('aaaa0000-0000-0000-0000-000000000003', '2222aaaa-2222-2222-2222-222222222222', '2222dddd-2222-2222-2222-222222222222', 3.99, null, 1.995, 'per_litre', true, 'CAD'),
  -- Bananas per lb  (No Frills $0.69 vs FreshCo $0.79)
  ('aaaa0000-0000-0000-0000-000000000004', '1111aaaa-1111-1111-1111-111111111111', '1111dddd-1111-1111-1111-111111111111', 0.69, null, 0.69, 'per_lb', true, 'CAD'),
  ('aaaa0000-0000-0000-0000-000000000004', '2222aaaa-2222-2222-2222-222222222222', '2222dddd-2222-2222-2222-222222222222', 0.79, null, 0.79, 'per_lb', true, 'CAD')
on conflict (product_id, branch_id, source_id) do update
  set regular_price = excluded.regular_price,
      sale_price    = excluded.sale_price,
      unit_price_value = excluded.unit_price_value,
      unit_price_unit  = excluded.unit_price_unit,
      in_stock      = excluded.in_stock,
      last_updated  = now();
