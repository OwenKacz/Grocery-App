# Supabase (database, auth, migrations)

> Database schema + migrations are built in **Phase 2**. This is a signpost.

## What will live here

- `migrations/` — SQL migration files (tables, indexes, Row-Level Security
  policies). Created with the Supabase CLI (`supabase migration new <name>`).
- `seed.sql` — sample data so the app has something to show before any real
  store is connected (e.g. 1–2 mock stores via the CSV import adapter).

## Planned tables (Phase 2)

`profiles`, `stores`, `store_branches`, `data_sources`, `products`, `prices`,
`grocery_lists`, `grocery_list_items`, `searches_log`. See the README at the
repo root for the role of each.

## Local setup (later)

1. Install the Supabase CLI: https://supabase.com/docs/guides/cli
2. `supabase login`
3. `supabase link --project-ref <your-project-ref>`
4. `supabase db push` to apply migrations.
