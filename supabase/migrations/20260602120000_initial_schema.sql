-- =============================================================================
-- grocery-app — Phase 2: Initial database schema
-- -----------------------------------------------------------------------------
-- This migration creates every table the app needs. Security rules (Row-Level
-- Security) live in the NEXT migration file (20260602120100_rls_policies.sql) so
-- the two concerns stay easy to read separately.
--
-- HOW TO APPLY (simplest, no command line):
--   1. Open your Supabase project > "SQL Editor" > "New query".
--   2. Paste this whole file and click "Run".
--   3. Then do the same with the RLS migration, then seed.sql.
--
-- This script is SAFE TO RE-RUN: if a run half-fails, just run it again.
--
-- Conventions used here:
--   - Every table has a UUID primary key and a created_at timestamp.
--   - Tables that change over time also have updated_at (auto-maintained by a
--     trigger defined at the bottom).
--   - Money is stored in NUMERIC(10,2) (never floats — floats lose cents).
-- =============================================================================

-- Needed for gen_random_uuid(). Safe to run if already enabled.
create extension if not exists "pgcrypto";


-- -----------------------------------------------------------------------------
-- ENUMS (fixed sets of allowed values)
-- Wrapped in guards so re-running this file does not error with "already exists".
-- -----------------------------------------------------------------------------

-- Who a user is to the app. Admins can access the /admin panel and manage data.
do $$ begin
  create type user_role as enum ('user', 'admin');
exception when duplicate_object then null; end $$;

-- A user's subscription state. 'free' is the default; the rest mirror Stripe's
-- subscription statuses so the webhook (Phase 6) can store them directly.
do $$ begin
  create type subscription_status as enum (
    'free', 'trialing', 'active', 'past_due', 'canceled',
    'incomplete', 'incomplete_expired', 'unpaid', 'paused'
  );
exception when duplicate_object then null; end $$;

-- The four kinds of data source adapter the app ships with. Adding a store means
-- picking one of these for it (see src/lib/data-sources/README.md).
do $$ begin
  create type adapter_type as enum (
    'rest_api',           -- store has a real REST API
    'third_party_vendor', -- paid data vendor (e.g. Apify/Actowiz-style)
    'csv_flyer_import',   -- a CSV/spreadsheet of products + prices is uploaded
    'manual_entry'        -- prices entered/edited by hand in the admin panel
  );
exception when duplicate_object then null; end $$;


-- -----------------------------------------------------------------------------
-- profiles — one row per user, linked 1:1 to Supabase's auth.users table.
-- A trigger (in the RLS migration) auto-creates a row whenever someone signs up.
-- -----------------------------------------------------------------------------
create table if not exists profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  display_name         text,
  -- The user's "home" location, used to default their search origin.
  home_postal_code     text,
  home_lat             double precision,
  home_lng             double precision,
  role                 user_role not null default 'user',
  subscription_status  subscription_status not null default 'free',
  -- Stripe linkage (filled in during Phase 6). Kept here so the webhook can map
  -- a Stripe customer/subscription back to our user.
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  -- When the current paid period ends (from Stripe). Null on the free tier.
  current_period_end   timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table profiles is 'Per-user app data, 1:1 with auth.users.';


-- -----------------------------------------------------------------------------
-- stores — a grocery CHAIN (e.g. "No Frills"), not a physical location.
-- -----------------------------------------------------------------------------
create table if not exists stores (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  -- URL-friendly unique handle, e.g. "no-frills". Handy for links and lookups.
  slug             text not null unique,
  logo_url         text,
  default_currency text not null default 'CAD',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table stores is 'Chain-level store (brand). Physical locations live in store_branches.';


-- -----------------------------------------------------------------------------
-- store_branches — a physical store location belonging to a chain.
-- -----------------------------------------------------------------------------
create table if not exists store_branches (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references stores (id) on delete cascade,
  -- Optional label to tell branches apart, e.g. "Dundas St W".
  name         text,
  address      text,
  city         text,
  province     text default 'ON',
  postal_code  text,
  lat          double precision,
  lng          double precision,
  -- Opening hours are free-form for now (e.g. {"mon": "8-22", ...}).
  hours        jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table store_branches is 'A physical store location (branch) of a chain.';

-- We search "branches near a point", so we filter by a lat/lng bounding box and
-- then compute exact distance in the app. These indexes make the box filter fast.
-- (We avoid PostGIS here to keep the setup simple; revisit if data grows large.)
create index if not exists store_branches_store_id_idx on store_branches (store_id);
create index if not exists store_branches_lat_idx on store_branches (lat);
create index if not exists store_branches_lng_idx on store_branches (lng);


-- -----------------------------------------------------------------------------
-- data_sources — how we get data for a store. ONE row = one configured source.
-- Adding a store to the app = adding a row here (plus the store/branch rows).
-- The `config` JSON holds adapter-specific settings (API base URL, vendor id,
-- column mappings, etc.). It may contain SECRETS, so this table is admin-only
-- in the RLS migration — never expose it to the browser.
-- -----------------------------------------------------------------------------
create table if not exists data_sources (
  id                       uuid primary key default gen_random_uuid(),
  store_id                 uuid not null references stores (id) on delete cascade,
  adapter_type             adapter_type not null,
  -- Adapter-specific configuration. Shape depends on adapter_type (Phase 3).
  config                   jsonb not null default '{}'::jsonb,
  -- How often the ingestion job should refresh this source.
  refresh_interval_minutes integer not null default 1440, -- default: once a day
  is_active                boolean not null default true,
  -- Bookkeeping updated by the ingestion job so the admin panel can show health.
  last_run                 timestamptz,
  last_status              text not null default 'never_run', -- 'never_run' | 'ok' | 'error'
  last_error               text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

comment on table data_sources is 'A configured data source for a store. config may hold secrets — admin-only.';

create index if not exists data_sources_store_id_idx on data_sources (store_id);
create index if not exists data_sources_active_idx on data_sources (is_active);


-- -----------------------------------------------------------------------------
-- products — a CANONICAL product, deduplicated across stores where possible.
-- The same real-world item sold at different stores (e.g. "PC rotisserie
-- chicken" vs "Selection roast chicken") should map to ONE products row so we
-- can compare prices. See the matching strategy notes below.
-- -----------------------------------------------------------------------------
create table if not exists products (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  brand          text,
  category       text,
  -- Package size as displayed, e.g. "900 g", "12 x 355 mL".
  package_size   text,
  -- Barcode / UPC if we ever have it. The most reliable matching key — null for
  -- now, but indexed so barcode matching can be added later (see notes).
  barcode        text,
  -- PRODUCT MATCHING KEY (Phase 2 simple strategy):
  --   A normalized string built from category + name + brand, e.g.
  --   "poultry|rotisserie chicken|presidents choice". The ingestion job sets
  --   this so two equivalent items from different stores collide on the same
  --   key and get grouped. See the matching documentation in
  --   src/lib/data-sources/README.md (extended in Phase 3).
  -- EXTENSION POINT: replace/augment with fuzzy matching or barcode (UPC)
  -- matching later — that's why barcode + a dedicated key column both exist.
  normalized_key text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table products is 'Canonical product. normalized_key groups equivalent items across stores.';
comment on column products.normalized_key is 'category|name|brand normalized; the simple cross-store matching key (Phase 2).';

-- Many products can share a normalized_key (the whole point — that is how we
-- group equivalents), so this is a NON-unique index for fast grouping/lookup.
create index if not exists products_normalized_key_idx on products (normalized_key);
create index if not exists products_barcode_idx on products (barcode);
-- Speeds up text search on product names (used by the search feature).
create index if not exists products_name_lower_idx on products (lower(name));


-- -----------------------------------------------------------------------------
-- prices — the price of a product at a specific branch, from a specific source.
-- This is the table user searches actually read from. The ingestion job upserts
-- rows here; the app never queries store websites live.
-- -----------------------------------------------------------------------------
create table if not exists prices (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references products (id) on delete cascade,
  branch_id        uuid not null references store_branches (id) on delete cascade,
  source_id        uuid not null references data_sources (id) on delete cascade,
  regular_price    numeric(10, 2) not null,
  sale_price       numeric(10, 2),            -- null when not on sale
  -- Unit price for fair comparison, e.g. value 0.55 with unit 'per_100g'.
  unit_price_value numeric(12, 4),
  unit_price_unit  text,                       -- e.g. 'per_100g', 'per_kg', 'each'
  in_stock         boolean not null default true,
  currency         text not null default 'CAD',
  -- When this price became effective vs. when we last refreshed it (shown to
  -- users as "last updated").
  valid_from       timestamptz not null default now(),
  last_updated     timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

comment on table prices is 'Price of a product at a branch from a source. Search reads from here (cached).';

-- One price row per (product, branch, source). The ingestion job upserts on this
-- key so re-running a source updates rather than duplicates rows.
create unique index if not exists prices_product_branch_source_uidx
  on prices (product_id, branch_id, source_id);
create index if not exists prices_product_id_idx on prices (product_id);
create index if not exists prices_branch_id_idx on prices (branch_id);
create index if not exists prices_last_updated_idx on prices (last_updated);


-- -----------------------------------------------------------------------------
-- grocery_lists / grocery_list_items — saved lists for logged-in users.
-- -----------------------------------------------------------------------------
create table if not exists grocery_lists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null default 'My list',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table grocery_lists is 'A saved grocery list belonging to a user.';

create index if not exists grocery_lists_user_id_idx on grocery_lists (user_id);

create table if not exists grocery_list_items (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references grocery_lists (id) on delete cascade,
  -- The text the user typed, e.g. "rotisserie chicken". Always kept so the item
  -- is meaningful even before/if it is matched to a canonical product.
  raw_text   text not null,
  -- Optional link to a canonical product once matched.
  product_id uuid references products (id) on delete set null,
  quantity   integer not null default 1,
  created_at timestamptz not null default now()
);

comment on table grocery_list_items is 'An item within a grocery list (raw text, optionally matched to a product).';

create index if not exists grocery_list_items_list_id_idx on grocery_list_items (list_id);


-- -----------------------------------------------------------------------------
-- searches_log — every search, for free-tier rate limiting + analytics.
-- user_id is nullable so we can also record anonymous searches if needed.
-- -----------------------------------------------------------------------------
create table if not exists searches_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users (id) on delete set null,
  query        text not null,
  result_count integer,
  searched_at  timestamptz not null default now()
);

comment on table searches_log is 'One row per search; used for free-tier limits and analytics.';

-- Fast "how many searches has this user made since <date>" for rate limiting.
create index if not exists searches_log_user_time_idx on searches_log (user_id, searched_at);


-- -----------------------------------------------------------------------------
-- updated_at automation — keep updated_at fresh on every UPDATE.
-- -----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- drop-then-create so re-running this file does not error on existing triggers.
drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

drop trigger if exists stores_set_updated_at on stores;
create trigger stores_set_updated_at
  before update on stores
  for each row execute function set_updated_at();

drop trigger if exists store_branches_set_updated_at on store_branches;
create trigger store_branches_set_updated_at
  before update on store_branches
  for each row execute function set_updated_at();

drop trigger if exists data_sources_set_updated_at on data_sources;
create trigger data_sources_set_updated_at
  before update on data_sources
  for each row execute function set_updated_at();

drop trigger if exists products_set_updated_at on products;
create trigger products_set_updated_at
  before update on products
  for each row execute function set_updated_at();

drop trigger if exists grocery_lists_set_updated_at on grocery_lists;
create trigger grocery_lists_set_updated_at
  before update on grocery_lists
  for each row execute function set_updated_at();
