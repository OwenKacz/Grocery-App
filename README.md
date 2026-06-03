# grocery-app

Find the cheapest groceries near you — think "GasBuddy, but for grocery items."

Enter your location, search for an item (or paste a whole grocery list), and the
app shows every matching product from stores within your chosen radius, sorted
cheapest → most expensive, with brand, package size, unit price, distance, sale
badges, and a "last updated" timestamp.

- **Market:** Canada (Ontario first), CAD. Built so other regions/currencies can
  be added later.
- **Business model:** $5.99 CAD/month subscription, with a free tier that allows
  a limited number of searches per month.

> **Status:** Built in phases (see [Build phases](#build-phases) below).
> Phase 1 (scaffold) is complete; later phases are in progress.

---

## Tech stack

| Concern            | Choice                                              |
| ------------------ | --------------------------------------------------- |
| Framework          | Next.js (App Router) + TypeScript + React           |
| Styling            | Tailwind CSS (mobile-first)                          |
| Database + Auth    | Supabase (Postgres + Auth + Row-Level Security)     |
| Payments           | Stripe (Checkout + Customer Portal + webhooks)      |
| Maps / geocoding   | Pluggable module (mock by default; Google or Mapbox)|
| Hosting            | Vercel (app) + Supabase (backend)                   |

> **Heads up — Next.js 16:** this project uses Next.js 16, which has breaking
> changes vs. older tutorials. The big ones: request APIs like `cookies()`,
> `params`, and `searchParams` are **async** (you must `await` them), and the
> old `middleware.ts` is now `proxy.ts`. See `AGENTS.md`.

---

## Run it locally

You need **Node.js 20.9+** (Node 18 is no longer supported by Next.js 16).

```bash
# 1. Install dependencies
npm install

# 2. (Optional for Phase 1) Create your local env file
cp .env.example .env.local
#    Phase 1 needs NO keys — the app runs as-is. Fill vars in as you reach
#    later phases (the file explains which var is needed when).

# 3. Start the dev server
npm run dev
```

Open http://localhost:3000.

Other scripts:

```bash
npm run build   # production build
npm run start   # run the production build
npm run lint    # ESLint (Next.js 16 uses the ESLint CLI directly)
```

---

## Environment variables

All secrets come from environment variables — **nothing is hard-coded or
committed**. The full, commented list lives in [`.env.example`](.env.example).
Copy it to `.env.local` and fill in values as you go. Quick reference:

| Variable                            | Phase | What it's for                                  |
| ----------------------------------- | ----- | ---------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`          | 2     | Supabase project URL                           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`     | 2     | Supabase public key (browser-safe; RLS guards) |
| `SUPABASE_SERVICE_ROLE_KEY`         | 2     | Admin key — server only, bypasses RLS          |
| `STRIPE_SECRET_KEY`                 | 6     | Stripe server key (use test mode first)        |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`| 6     | Stripe browser key                             |
| `STRIPE_PRICE_ID_MONTHLY`           | 6     | The $5.99 CAD/month recurring price            |
| `STRIPE_WEBHOOK_SECRET`             | 6     | Verifies Stripe webhook signatures             |
| `GEOCODER_PROVIDER`                 | opt   | `mock` (default) \| `google` \| `mapbox`       |
| `GOOGLE_MAPS_API_KEY` / `MAPBOX_ACCESS_TOKEN` | opt | Real geocoding (only if not using mock)  |
| `NEXT_PUBLIC_FREE_SEARCH_LIMIT`     | —     | Free-tier searches/month (default `5`)         |

Access env vars through `src/lib/env.ts`, which gives typed access and friendly
errors when a required secret is missing.

---

## How the data layer works (the important part)

Different stores expose prices completely differently. So the app **never**
hard-codes a single store. Instead:

1. Every store integration implements one shared `DataSourceAdapter` interface
   and returns data in one **normalized shape**.
2. A scheduled **ingestion job** pulls from each active source on its own
   interval, normalizes the data, and upserts it into our own `products` /
   `prices` tables.
3. User searches read from **our cached database**, not from store sources live
   — faster, cheaper, and resilient if a source goes down. Each record carries a
   `lastUpdated` timestamp shown to users.

Adapter types shipped as working examples: `RestApiAdapter`,
`ThirdPartyVendorAdapter`, `CsvFlyerImportAdapter`, `ManualEntryAdapter`.

See [`src/lib/data-sources/README.md`](src/lib/data-sources/README.md) for the
layout. (Implemented in Phase 3.)

### How to add a new store

> Full step-by-step lands in Phase 3 once the registry exists. The design goal:
> **adding a store means adding ONE entry to the data-source registry** (name,
> adapter type, credentials/URL, refresh interval) — and nothing else.

1. Pick the adapter type that matches how the store gives you data.
2. Add one entry to the registry (`src/lib/data-sources/registry.ts` or the
   `data_sources` table) with its config.
3. Trigger a refresh (or wait for the schedule). Done.

> ⚠️ **Legal note:** many grocery chains prohibit scraping in their terms of
> service and don't offer a public price API. Make sure you have the right to
> use any data source you connect (official API, licensed data vendor, a store
> that provides you a flyer/CSV, or manual entry).

---

## Project structure

```
src/
  app/                  # Next.js App Router routes (pages, layouts, API routes)
  lib/
    env.ts              # typed access to environment variables
    supabase/
      client.ts         # Supabase client for the browser
      server.ts         # Supabase client for the server (async cookies)
    data-sources/       # the pluggable adapter layer  (Phase 3)
  types/                # shared TypeScript types
supabase/
  migrations/           # database migrations  (Phase 2)
```

---

## Build phases

The app is built in confirmable phases:

1. **Scaffold** — Next.js + TS + Tailwind + Supabase client + env + README. ✅
2. **Database** — schema + migrations (Supabase/Postgres) + RLS.
3. **Data layer** — `DataSourceAdapter` interface + 4 example adapters +
   registry + ingestion job + seed data.
4. **Search UI** — location + item search, cheapest-first results; grocery-list
   mode (cheapest per item, single-store basket, estimated total).
5. **Auth** — email/password + Google OAuth, profiles, saved lists, RLS.
6. **Payments** — Stripe subscription, free-tier gating, webhooks.
7. **Admin panel** — manage data sources, trigger refreshes, view stats.
8. **Polish** — error states, empty states, README finalization, deploy.

---

## Deploying

> Detailed in Phase 8. Outline:

- **App:** deploy to [Vercel](https://vercel.com) (import the repo, set the same
  env vars from `.env.example` in the Vercel dashboard).
- **Backend:** [Supabase](https://supabase.com) hosts Postgres + Auth.
- **Stripe webhook:** point it at `https://<your-domain>/api/stripe/webhook` and
  set `STRIPE_WEBHOOK_SECRET` to that endpoint's signing secret.
- **Ingestion job:** runs on a schedule (e.g. Vercel Cron) to refresh prices.
