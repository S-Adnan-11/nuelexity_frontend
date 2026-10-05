import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../config";

// Keep maadan-dev's shared client. Every screen uses this same session.
export const supabase =
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
    ? createSupabaseClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
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
