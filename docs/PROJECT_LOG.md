---
title: grocery-app — Project Log
created: 2026-06-02
updated: 2026-06-02
status: in-progress
phase: 3 of 8
tags:
  - project/grocery-app
  - nextjs
  - supabase
  - stripe
  - webapp
---

# grocery-app — Project Log

> [!abstract] What this is
> A running log of the **grocery-app** build: a mobile-friendly web app (installable as a PWA) that finds the cheapest groceries near you — "GasBuddy, but for grocery items." First market: **Ontario, Canada (CAD)**. Business model: **$5.99 CAD/month** subscription with a limited free tier.
>
> This note captures every decision and everything built so far so the work is never lost. Updated as we complete each phase.

---

## At a glance

| | |
|---|---|
| **Project folder** | `C:\Users\owenk\grocery-app` (its own git repo, branch `main`) |
| **Current phase** | Phase 3 (data layer) — Phase 2 applied ✅, adapters next |
| **Live data yet?** | No — runs on mock/seed data by design until a real source is connected |
| **Accounts created** | Supabase project **"Grocery Website"** |
| **Accounts still needed** | Google Cloud (OAuth, Phase 5), Stripe (Phase 6) |

---

## The product (what we're building)

Core user flow:
1. User enters/shares their location (or postal code).
2. User searches for an item (e.g. "rotisserie chicken") or pastes a full grocery list.
3. App looks across all stores within a chosen radius that carry matching items.
4. For each item: a list sorted **cheapest → most expensive**, showing store + distance, brand, product name, package size, unit price (e.g. $/100g), regular price, sale price, and a "last updated" time.
5. For a full list: cheapest option per item, an optional **"cheapest single-store basket"** view, and a running estimated total.

---

## Tech stack (chosen for editability)

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript + React 19 |
| Styling | Tailwind CSS 4 (mobile-first) |
| Database + Auth | Supabase (Postgres + Auth + Row-Level Security) |
| Payments | Stripe (Checkout + Customer Portal + webhooks) — *Phase 6* |
| Maps / geocoding | Pluggable module; **mock by default**, Google or Mapbox later |
| Hosting target | Vercel (app) + Supabase (backend) |

> [!warning] Next.js 16 gotchas (this is NOT older Next.js)
> - Request APIs are **async**: you must `await cookies()`, `params`, `searchParams`.
> - The old `middleware.ts` is now **`proxy.ts`**.
> - `next lint` is gone — ESLint runs directly.
> These are already accounted for in the code.

---

## Key decisions made (and why)

- [x] **Project name** = `grocery-app` (placeholder, can rebrand later).
- [x] **Geocoding defaults to a free mock** — the app runs with **zero paid keys**. A real provider (Google/Mapbox) is added via env var only when wanted.
- [x] **Search reads our own cached database, not store websites live** — faster, cheaper, resilient if a source goes down. A scheduled job refreshes prices.
- [x] **Pluggable data-source adapter layer is the core architecture** — no store is ever hard-coded. Adding a store = adding ONE registry entry.
- [x] **New Supabase key naming** (`sb_publishable_…` / `sb_secret_…`) is used throughout, matching what the dashboard now hands out.
- [x] **Free-tier search limit** is a single config value (`NEXT_PUBLIC_FREE_SEARCH_LIMIT`, default 5).

> [!danger] The real risk to keep in mind
> The hard part of this product is **getting legal, reliable price data**, not the code. Most Canadian grocery chains have **no public price API** and prohibit scraping. The adapter design is the hedge: the whole app can run on mock / CSV / manual data, and a real source is plugged in later if/when you have the rights to it. "Connect Loblaws" is a data-sourcing/legal task, not a coding one.

---

## Build phases (roadmap)

- [x] **Phase 1 — Scaffold**: Next.js + TS + Tailwind + Supabase client + env + README.
- [x] **Phase 2 — Database**: schema + migrations + Row-Level Security. *(applied to Supabase 2026-06-02)*
- [/] **Phase 3 — Data layer**: `DataSourceAdapter` interface + 4 example adapters + registry + ingestion job + seed via CSV adapter. *(code written; fixing a TS typing issue, then run it)*
- [ ] **Phase 4 — Search UI**: location + item search, cheapest-first results; grocery-list mode (cheapest per item, single-store basket, estimated total).
- [ ] **Phase 5 — Auth**: email/password + Google OAuth, profiles, saved lists, RLS.
- [ ] **Phase 6 — Payments**: Stripe subscription, free-tier gating, webhooks.
- [ ] **Phase 7 — Admin panel**: manage data sources, trigger refreshes, view stats.
- [ ] **Phase 8 — Polish**: error/empty states, README finalization, deploy.

---

## Phase 1 — Scaffold ✅ (done)

**What was built:**
- Next.js 16 app (App Router, `src/` dir, `@/*` import alias), Tailwind 4.
- **Supabase clients**: `src/lib/supabase/client.ts` (browser) and `server.ts` (server, async cookies).
- **Typed env access**: `src/lib/env.ts` — one place all env vars are read, with friendly errors for missing secrets.
- **`.env.example`** documents every variable and which phase needs it. `.gitignore` updated so real env files stay secret but the example is committed.
- **Placeholder landing page** showing build progress.
- **README.md** with setup, env table, the data-layer explanation, project structure, and the 8-phase plan.
- Fresh git repo on `main` (not yet committed — see Open items).

**Verified:** production build compiles, TypeScript passes, ESLint clean.

---

## Phase 2 — Database ✅ (done)

> [!success] Applied to Supabase on 2026-06-02
> All three SQL files (`initial_schema.sql`, `rls_policies.sql`, `seed.sql`) ran successfully in the SQL Editor. Tables, RLS, and seed data are live in the **Grocery Website** project.


**What was built (SQL + types):**

Files in `supabase/`:
- `migrations/20260602120000_initial_schema.sql` — all tables, enums, indexes, `updated_at` triggers.
- `migrations/20260602120100_rls_policies.sql` — Row-Level Security policies, `is_admin()` helper, and the signup trigger that auto-creates a profile.
- `seed.sql` — 2 sample Toronto stores (**No Frills**, **FreshCo**) with overlapping products to demo cheapest-per-store.

All three SQL files are **safe to re-run** (idempotent).

**The 9 tables:**

| Table | Purpose |
|---|---|
| `profiles` | Per-user data, 1:1 with Supabase auth users (name, home location, role, subscription status) |
| `stores` | A grocery **chain** (e.g. No Frills) |
| `store_branches` | A physical **location** of a chain (address, lat/lng) |
| `data_sources` | How we get data for a store (adapter type + config). **Holds secrets → admin-only** |
| `products` | A **canonical** product; `normalized_key` groups equivalents across stores |
| `prices` | Price of a product at a branch from a source. **Search reads from here** |
| `grocery_lists` / `grocery_list_items` | Saved lists for logged-in users |
| `searches_log` | One row per search; powers free-tier limits + analytics |

**Security highlights:**
- RLS on **every** table. Catalog (`stores`, `branches`, `products`, `prices`) is publicly readable so search works on the free tier; everything else is locked to its owner or admins.
- `data_sources` is **admin-only** (it will hold API keys).
- **Privilege-escalation guard**: column-level permissions stop a logged-in user from editing their own `role` or faking `subscription_status` via the API — only the server `secret` key (Stripe webhook, admin tools) can change those.

**Product matching strategy (documented in `src/lib/data-sources/README.md`):**
- Phase 2 (now): `normalized_key = lower(category | name | brand)`. Simple, predictable, under-matches rather than wrongly merging.
- Extension points left open: **barcode/UPC** matching (column exists + indexed) and **fuzzy matching** (e.g. Postgres `pg_trgm`) — only the ingestion matching function changes.

**Types:** `src/types/database.ts` mirrors the schema and is wired into both Supabase clients, so `.from("prices")…` queries get autocomplete + type-checking.

> [!todo] How to apply Phase 2 (do this in Supabase)
> 1. Supabase → **SQL Editor → New query**.
> 2. Paste & **Run**, in this order: `initial_schema.sql`, then `rls_policies.sql`, then `seed.sql`.
> 3. Check **Table Editor**: `stores` should show **No Frills** and **FreshCo**.

---

## Phase 3 — Data layer 🚧 (in progress — paused mid-build)

**The pluggable adapter architecture — the heart of the app.** All the code is written; we paused while fixing a TypeScript typing error before the first real run.

**Files created this phase:**
- `src/lib/supabase/admin.ts` — server-only admin client (uses `SUPABASE_SECRET_KEY`, bypasses RLS). **Never import from browser code.**
- `src/lib/data-sources/normalize.ts` — `normalizedKey()`, the single matching-key function (`lower(category|name|brand)`). The one place to change matching later.
- `src/lib/data-sources/types.ts` — the `DataSourceAdapter` interface + `NormalizedPrice` shape + `AdapterContext`.
- `src/lib/data-sources/adapters/` — all 4 adapters:
  - `manual-entry.ts` — returns `[]` (prices entered by hand; nothing to fetch).
  - `csv-flyer-import.ts` — parses a CSV (file path or inline), incl. a small dependency-free CSV parser. **This is the one we'll demo with.**
  - `rest-api.ts` — generic JSON-API adapter driven by a config `mapping` (template; returns `[]` if no `url`).
  - `third-party-vendor.ts` — template for a paid data vendor (returns `[]` until a vendor is onboarded).
- `src/lib/data-sources/registry.ts` — maps `adapter_type` → adapter. **Add a new source kind = one line here; add a new store = a DB row, no code.**
- `src/lib/data-sources/ingest.ts` — the orchestrator: load active sources → adapter `fetchPrices()` → match/create product (barcode, then normalized_key) → upsert price (unique on `product_id+branch_id+source_id`) → record run status on the source.
- `src/app/api/ingest/route.ts` — `POST /api/ingest`, protected by `INGEST_SECRET`. For Vercel Cron + manual testing. `?source=<id>` to run one.
- `data/seed/sample-prices.csv` — 3 products × 2 branches (Sourdough, Orange Juice, Old Cheddar) to demo ingestion creating new products + prices.
- `supabase/seed_phase3_csv_source.sql` — registers a `csv_flyer_import` data source pointing at that CSV (id `3333dddd-…`).

**Env added this phase:** `INGEST_SECRET` (in `.env.example` + `.env.local`). `SUPABASE_SECRET_KEY` is now set in `.env.local`. ✅

> [!bug] RESUME HERE — the one open blocker
> `npx tsc --noEmit` fails in `src/lib/data-sources/ingest.ts` with `Property … does not exist on type 'never'` on every `supabase.from(...)` call (lines ~91, 111, 170, 179, 191, 205–206, 218).
> **Diagnosis in progress:** the `Database` generic isn't threading through the admin client's typed queries, so `.from()` resolves to `never`. The existing browser/server clients use the same `createXClient<Database>` pattern but were never exercised with typed `.from()` queries, so this is the first time it surfaced. Was mid-investigation of the supabase-js v2.107 / postgrest-js `GenericSchema` expected shape in `node_modules/@supabase/postgrest-js/dist/` when we paused.
> **Next steps when resuming:**
> 1. Fix the typing so `ingest.ts` typechecks (likely a tweak to how `src/types/database.ts` is shaped vs. what supabase-js v2.107 expects, or how `admin.ts` types its client). Confirm with `npx tsc --noEmit`.
> 2. In Supabase SQL Editor, run `supabase/seed_phase3_csv_source.sql` (one new file).
> 3. Start the app (`npm run dev`) and trigger ingestion: `POST http://localhost:3000/api/ingest?secret=<INGEST_SECRET>` (the secret is in `.env.local`).
> 4. Verify in Supabase Table Editor: `products` gains Sourdough/Orange Juice/Old Cheddar; `prices` gains rows for both branches. Then mark Phase 3 ✅.

---

## Environment variables

Full commented list is in `.env.example`. Local secrets go in `.env.local` (gitignored, never committed).

| Variable | Phase | What it's for | Status |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 2 | Supabase project URL | ✅ set |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 2 | Public, browser-safe key | ✅ set |
| `SUPABASE_SECRET_KEY` | 3 | Server-only admin key (`sb_secret_…`) | ⬜ needed for Phase 3 |
| `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | 6 | Stripe keys (test mode first) | ⬜ later |
| `STRIPE_PRICE_ID_MONTHLY` | 6 | The $5.99 CAD/month price | ⬜ later |
| `STRIPE_WEBHOOK_SECRET` | 6 | Verifies Stripe webhooks | ⬜ later |
| `GEOCODER_PROVIDER` | opt | `mock` (default) / `google` / `mapbox` | ✅ mock |
| `NEXT_PUBLIC_FREE_SEARCH_LIMIT` | — | Free searches/month (default 5) | ✅ |

---

## Project structure

```
src/
  app/                  # Next.js routes (pages, layouts, API routes)
  lib/
    env.ts              # typed access to environment variables
    supabase/
      client.ts         # Supabase client for the browser
      server.ts         # Supabase client for the server (async cookies)
    data-sources/       # the pluggable adapter layer  (Phase 3)
  types/
    database.ts         # TS types mirroring the DB schema
supabase/
  migrations/           # SQL migrations (schema + RLS)
  seed.sql              # sample data
docs/
  PROJECT_LOG.md        # this file
```

---

## How to run it locally

```bash
cd C:\Users\owenk\grocery-app
npm install        # first time only
npm run dev        # then open http://localhost:3000
```

Other commands: `npm run build` (production build), `npm run lint`.

---

## Open items / next steps

- [x] **Apply the 3 Phase 2 SQL files** in Supabase. *(done 2026-06-02 — all 3 succeeded)*
- [ ] Decide whether to **make the first git commit** (repo is initialized + staged but not yet committed).
- [ ] **Grab the Supabase `secret` key** (`sb_secret_…`) and add it to `.env.local` — required to start **Phase 3** (data ingestion).
- [ ] Then build **Phase 3**: adapter interface + 4 example adapters + registry + ingestion job.

> [!note] Accounts to create later (not yet)
> - **Google Cloud** account for "Sign in with Google" (Phase 5).
> - **Stripe** account; create a recurring **CAD $5.99/month** price (Phase 6). Use test mode first.
