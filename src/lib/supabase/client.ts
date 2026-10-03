import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const getEnv = (key: string, fallback: string): string => {
  if (typeof process !== "undefined" && process.env && process.env[key]) {
    return process.env[key]!;
  }
  if (
    typeof import.meta !== "undefined" &&
    (import.meta as any).env &&
    (import.meta as any).env[key]
  ) {
    return (import.meta as any).env[key];
  }
  return fallback;
};

const supabaseUrl =
  process.env.VITE_SUPABASE_URL ||
  getEnv("VITE_SUPABASE_URL", "https://placeholder.supabase.co");

const supabaseAnonKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  getEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "placeholder-anon-key");

export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);

export function createClient() {
  return supabase;
}
