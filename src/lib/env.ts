/**
 * Centralized, typed access to environment variables.
 *
 * WHY THIS FILE EXISTS:
 *   - One place to see every env var the app uses.
 *   - Clear error messages when a required server secret is missing, instead of
 *     a confusing "undefined" crash deep inside some library.
 *   - Keeps the browser/server split obvious: `publicEnv` is safe to use
 *     anywhere; `requireServerEnv()` must only be called in server code.
 *
 * NOTE: Next.js only inlines `NEXT_PUBLIC_*` variables when they are referenced
 * as static `process.env.NEXT_PUBLIC_FOO` literals — that's why they are written
 * out explicitly below rather than looked up dynamically.
 */

/** Variables that are safe to expose to the browser. */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabasePublishableKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  freeSearchLimit: Number(process.env.NEXT_PUBLIC_FREE_SEARCH_LIMIT ?? "5"),
  defaultCurrency: process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "CAD",
  defaultRegion: process.env.NEXT_PUBLIC_DEFAULT_REGION ?? "ON",
} as const;

/** True once the Supabase public vars are filled in (i.e. Phase 2 is set up). */
export const isSupabaseConfigured =
  publicEnv.supabaseUrl.length > 0 &&
  publicEnv.supabasePublishableKey.length > 0;

/**
 * Read a server-only secret. Throws a clear error if it is missing so problems
 * surface immediately during development rather than as a vague runtime failure.
 *
 * Only call this from server code (Server Components, Route Handlers, server
 * actions, scripts) — never from a "use client" component.
 */
export function requireServerEnv(
  key:
    | "SUPABASE_SECRET_KEY"
    | "INGEST_SECRET"
    | "STRIPE_SECRET_KEY"
    | "STRIPE_PRICE_ID_MONTHLY"
    | "STRIPE_WEBHOOK_SECRET"
    | "GOOGLE_MAPS_API_KEY"
    | "MAPBOX_ACCESS_TOKEN",
): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable "${key}". ` +
        `Add it to your .env.local (see .env.example for what it is and where to get it).`,
    );
  }
  return value;
}

/** Which geocoding provider to use. Defaults to the free built-in mock. */
export function getGeocoderProvider(): "mock" | "google" | "mapbox" {
  const provider = process.env.GEOCODER_PROVIDER ?? "mock";
  if (provider === "google" || provider === "mapbox") return provider;
  return "mock";
}
