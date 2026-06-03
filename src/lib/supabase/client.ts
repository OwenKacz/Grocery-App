/**
 * Supabase client for use in the BROWSER ("use client" components).
 *
 * Uses the public anon key, so it is safe to ship to the browser. Your data is
 * protected by Row-Level Security (RLS) policies in the database, not by hiding
 * this key.
 *
 * Usage (inside a client component):
 *   const supabase = createBrowserSupabaseClient();
 *   const { data } = await supabase.from("stores").select("*");
 */
import { createBrowserClient } from "@supabase/ssr";

import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export function createBrowserSupabaseClient() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local (Phase 2 in the README).",
    );
  }
  return createBrowserClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabasePublishableKey,
  );
}
