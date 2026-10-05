// Load the same public config in dev and static builds. No browser process/env shim.
export let BACKEND_URL = "http://localhost:3002";
export let SUPABASE_URL = "";
export let SUPABASE_PUBLISHABLE_KEY = "";
export let TURNSTILE_SITE_KEY = "";

export async function initializeConfig() {
  const response = await fetch("/config.json", {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new Error("Public app configuration couldn't load. Check the frontend server/build.");
  const settings = (await response.json()) as Record<string, unknown>;
  const value = (key: string) => {
    if (typeof settings[key] !== "string") throw new Error("Public app configuration is invalid.");
    return settings[key] as string;
  };
  const backend = value("BUN_PUBLIC_BACKEND_URL");
  if (!["http:", "https:"].includes(new URL(backend).protocol))
    throw new Error("Backend URL must use HTTP or HTTPS.");
  BACKEND_URL = backend.replace(/\/$/, "");
  SUPABASE_URL = value("BUN_PUBLIC_SUPABASE_URL");
  SUPABASE_PUBLISHABLE_KEY = value("BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  TURNSTILE_SITE_KEY = value("BUN_PUBLIC_TURNSTILE_SITE_KEY");
}
