/**
 * Supabase client for use on the SERVER (Server Components, Route Handlers,
 * server actions).
 *
 * It reads/writes auth cookies so the logged-in user's session is available on
 * the server. In Next.js 16, `cookies()` is async, so this factory is async too
 * — remember to `await` it:
 *
 *   const supabase = await createServerSupabaseClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 */
import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export async function createServerSupabaseClient() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local (Phase 2 in the README).",
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabasePublishableKey,
    {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // This can throw when called from a Server Component (which cannot set
        // cookies). That's expected — session refresh is handled in proxy.ts.
        // Swallowing the error here keeps Server Component reads working.
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // no-op: handled by the proxy (middleware) layer
        }
      },
    },
  });
}
