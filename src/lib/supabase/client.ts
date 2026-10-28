import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../config";

// Keep maadan-dev's shared client. Every screen uses this same session.
export const supabase =
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
    ? createSupabaseClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        global: {
          // Bound auth network waits too, including sign-out on a stalled connection.
          fetch: (input, options) => fetch(input, { ...options,
            signal: AbortSignal.any([...(options?.signal ? [options.signal] : []), AbortSignal.timeout(15000)]),
          }),
        },
        auth: {
          flowType: "pkce",
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null;

export function createClient() {
  return supabase;
}
