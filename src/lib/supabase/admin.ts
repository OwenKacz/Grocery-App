/**
 * Server-only "admin" Supabase client.
 *
 * This client authenticates with the SECRET key (`sb_secret_…`), which has FULL
 * access and BYPASSES Row-Level Security. It is what the data-ingestion job and
 * admin server actions use to write into the catalog tables (products, prices…).
 *
 * ──────────────────────────────────────────────────────────────────────────
 *  NEVER import this file from a "use client" component or any browser code.
 *  Doing so would leak the secret key to the public. It must only be used from
 *  server code: Route Handlers, Server Components, server actions, or scripts.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Unlike the browser/server clients in this folder, this one does not deal with
 * cookies or user sessions — it always acts as the system, not as a logged-in
 * user.
 */

import { createClient } from "@supabase/supabase-js";

import { publicEnv, requireServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Build the admin client. Created lazily (inside a function) so that importing
 * this module never throws — the secret key is only required at the moment you
 * actually use the client.
 */
export function createAdminClient() {
  const secretKey = requireServerEnv("SUPABASE_SECRET_KEY");

  return createClient<Database>(publicEnv.supabaseUrl, secretKey, {
    auth: {
      // This client is not a user session: don't persist or refresh tokens.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
