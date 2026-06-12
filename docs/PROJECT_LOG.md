---
title: Cartwise — Project Log
created: 2026-06-02
updated: 2026-06-10
status: in-progress
phase: 6 of 8
tags:
  - project/cartwise
  - nextjs
  - supabase
  - stripe
  - webapp
---

# Cartwise — Project Log

> [!abstract] What this is
> A running log of the **Cartwise** build: a mobile-friendly web app (installable as a PWA) that finds the cheapest groceries near you — "GasBuddy, but for grocery items." First market: **Ontario, Canada (CAD)**. Business model: **$5.99 CAD/month** subscription with a limited free tier.
>
> This note captures every decision and everything built so far so the work is never lost. Updated as we complete each phase.

---

## At a glance

| | |
|---|---|
| **Project folder** | `C:\Users\owenk\grocery-app` (its own git repo, branch `main` — folder name predates the Cartwise rebrand) |
| **Current phase** | Phase 5 (auth) built & browser-tested 2026-06-10 — awaiting sign-off, then Phase 6 (Stripe) |
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

- [x] **Project name** = **Cartwise** (rebranded from the `grocery-app` placeholder on 2026-06-12; local folder + GitHub repo still use the old name).
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
- [x] **Phase 3 — Data layer**: `DataSourceAdapter` interface + 4 example adapters + registry + ingestion job + seed via CSV adapter. *(verified end-to-end 2026-06-10)*
- [x] **Phase 4 — Search UI**: location + item search, cheapest-first results; grocery-list mode (cheapest per item, single-store basket, estimated total). *(signed off 2026-06-10)*
- [/] **Phase 5 — Auth**: email/password, profiles, saved lists, RLS. *(built + browser-tested 2026-06-10; Google OAuth deferred until a Google Cloud account exists; awaiting sign-off)*
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

## Phase 3 — Data layer ✅ (done 2026-06-10)

**The pluggable adapter architecture — the heart of the app.** All code written, the TypeScript blocker fixed, and ingestion verified end-to-end against the live Supabase database.

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

> [!success] Blocker resolved + first ingestion run verified (2026-06-10)
> **The TS bug:** the row shapes in `src/types/database.ts` were declared as `interface`s. TypeScript interfaces don't get an implicit index signature, so they aren't assignable to supabase-js's `Record<string, unknown>` constraint — the whole `Database` schema silently failed its `GenericSchema` check and every `.from()` query collapsed to `never`. **Fix:** declare row shapes as `type` aliases instead (this is also why Supabase's auto-generated types use `type`). A warning comment now sits at the top of the row-shapes section.
> **First run results** (`POST /api/ingest`): the CSV source imported successfully — **3 products created** (Sourdough Bread, Orange Juice, Old Cheddar Cheese), **6 prices upserted** across both branches (No Frills Queen St W + FreshCo College St), source `last_status = "ok"`. The two `manual_entry` sources correctly ran as no-ops. The CSV data-source row was registered via the Supabase REST API (same upsert as `seed_phase3_csv_source.sql`, so no SQL Editor step was needed).

---

## Phase 4 — Search UI 🚧 (built 2026-06-10 — awaiting sign-off)

**The user-facing search experience.** Two pages, both Server Components with plain GET forms — zero client-side JavaScript, so every search is a shareable URL and the back button just works.

**Files created this phase:**
- `src/lib/geocoder.ts` — pluggable geocoding (same philosophy as the data adapters). `geocode(text)` is the one entry point; the provider is picked by `GEOCODER_PROVIDER`. The default **mock** maps postal-code prefixes (FSAs — M5T, M6J, K1A, …) to coordinates and accepts raw `"lat,lng"` too; unknown input falls back to downtown Toronto flagged `approximate`. Google/Mapbox get added later as new cases in one switch.
- `src/lib/geo.ts` — haversine `distanceKm()` + `formatDistance()`. Straight-line distance; no library needed.
- `src/lib/search.ts` — the search engine. `searchItem()` and `searchList()` both share `findHits()`: ① products matching name/brand/category (`ilike`), ② their in-stock prices, ③ the branches + stores, ④ stitched in plain TS → distance-filtered → sorted by `effectivePrice` (sale ?? regular), ties broken by distance. Four flat queries, no SQL joins — easiest to read and sidesteps typed-embed complexity. List mode adds **per-store baskets** (cheapest in-store price per item, sorted most-complete-then-cheapest) and the **mix-and-match floor** (sum of each item's overall cheapest).
- `src/app/search/page.tsx` — single-item search: item + postal code + radius → cheapest-first cards, "Cheapest" badge on the winner, sale strikethroughs, unit prices, "updated X days ago", accuracy disclaimer.
- `src/app/list/page.tsx` — grocery-list mode: textarea (newlines or commas) → Best single store ranking, mix-and-match total, item-by-item top-3 breakdown.
- `src/components/` — `PriceHitCard.tsx`, `LocationFields.tsx`, `ModeTabs.tsx`, `format.ts` (money/unit/updated-ago formatters).
- `src/app/page.tsx` — homepage now funnels to /search and /list; progress list updated.

**Smoke-tested against live data:** `?q=milk` → FreshCo $3.99 beats No Frills $4.49-on-sale ✓; 4-item list → FreshCo basket $12.36 beats No Frills $12.66, mix-and-match floor $11.96 ✓ (totals hand-checked against seed + CSV data).

> [!todo] To try it yourself
> `npm run dev`, then open `http://localhost:3000` → "Search an item". Try `milk` near `M5T 1T3`, and the list `milk, eggs, bananas, sourdough`. Sign off → Phase 5 (auth).

---

## Phase 5 — Auth, profiles & saved lists 🚧 (built 2026-06-10 — awaiting sign-off)

**Accounts are live.** Email/password auth through Supabase, all server-rendered (forms post to server actions; passwords never touch client code). **Google OAuth deferred** until a Google Cloud account exists — the `/auth/callback` route is already built to handle it when we flip it on.

**Files created this phase:**
- `src/proxy.ts` + `src/lib/supabase/proxy.ts` — Next 16's proxy (ex-middleware) running the standard @supabase/ssr **session refresh** on every request. Without this, logins silently expire after ~1 hour (Server Components can't write cookies; the proxy can).
- `src/app/auth/callback/route.ts` — exchanges Supabase's one-time `?code=` for a session. Handles email-confirmation links today, Google OAuth later.
- `src/lib/auth/user.ts` — `getCurrentUser()` / `getCurrentProfile()` server helpers.
- `src/lib/auth/actions.ts` — server actions: `signUp` (with email-confirm redirect handling), `signIn`, `signOut`, `updateProfile`. Errors travel back as `?error=` query params — zero client JS.
- `src/lib/lists/actions.ts` — `saveList` (one `grocery_lists` row + one `grocery_list_items` row per line) and `deleteList` (items cascade). RLS scopes everything to the owner.
- `src/app/login/page.tsx` — log in / create account (`?mode=signup` flips it).
- `src/app/account/page.tsx` — profile: display name + **home postal code** (becomes the default search location), plan badge (Stripe takes over in Phase 6), log out. Redirects to /login when signed out.
- `src/app/lists/page.tsx` — saved lists with **"Price it"** (re-opens /list with items pre-filled) and Delete.
- `src/components/SiteHeader.tsx` (wired into `layout.tsx`) — site-wide nav; shows Log in vs. My lists/Account based on the real session.
- `/list` page now has **"Save this list as…"** when logged in; `/search` + `/list` default the location to the profile's home postal code.
- `database.ts`: `grocery_list_items.product_id` made optional on insert (nullable column — unmatched text lines are fine).

**Browser-tested end-to-end (real clicks via the preview browser, 2026-06-10):** log in → redirected to /account with header flipped ✓ · profile save persists ✓ · /list with blank location used the saved postal code (Trinity-Bellwoods) ✓ · "Save this list" → /lists shows "Weekly staples · 4 items" ✓ · log out → header shows Log in, /account + /lists redirect to /login ✓. Test user deleted afterwards (cascade cleaned profile + lists).

> [!todo] To try it yourself
> Sign up at `/login?mode=signup` with your real email (Supabase will email a confirmation link — click it). Set your home postal code on /account, then save a list from /list. Sign off → Phase 6 (Stripe).
>
> **Supabase setting to know:** if the confirmation email feels like friction during dev, you can turn off **Authentication → Sign In / Up → Email → Confirm email** in the dashboard — then sign-ups log straight in.

---

## Environment variables

Full commented list is in `.env.example`. Local secrets go in `.env.local` (gitignored, never committed).

| Variable | Phase | What it's for | Status |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 2 | Supabase project URL | ✅ set |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 2 | Public, browser-safe key | ✅ set |
| `SUPABASE_SECRET_KEY` | 3 | Server-only admin key (`sb_secret_…`) | ✅ set |
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
- [x] **First git commit + GitHub push** — repo lives at `https://github.com/OwenKacz/Cartwise` (renamed from `Grocery-App` 2026-06-12; old URL redirects). *(done 2026-06-02)*
- [x] **Supabase `secret` key** added to `.env.local`. *(done)*
- [x] **Phase 3 built and verified**: adapters + registry + ingestion job ran end-to-end. *(done 2026-06-10)*
- [ ] Start **Phase 4 — Search UI**: location + item search, cheapest-first results, grocery-list mode.

> [!note] Accounts to create later (not yet)
> - **Google Cloud** account for "Sign in with Google" (Phase 5).
> - **Stripe** account; create a recurring **CAD $5.99/month** price (Phase 6). Use test mode first.
