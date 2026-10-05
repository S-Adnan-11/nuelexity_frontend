// This whitelist is the only bridge from server settings into browser code.
// env="inline" can spill secrets into a bundle. We no dey do that sha 😹.
export function publicEnv(env: Record<string, string | undefined> = process.env) {
  const key = env.BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
  let role = "";
  try {
    role = JSON.parse(Buffer.from(key.split(".")[1] || "", "base64url").toString()).role || "";
  } catch {}
  if (key.startsWith("sb_secret_") || role === "service_role")
    throw new Error("A Supabase secret key cannot be used in the frontend.");
  return {
    BUN_PUBLIC_SUPABASE_URL: env.BUN_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL || "",
    BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
    BUN_PUBLIC_BACKEND_URL: env.BUN_PUBLIC_BACKEND_URL || "http://localhost:3002",
    BUN_PUBLIC_TURNSTILE_SITE_KEY: env.BUN_PUBLIC_TURNSTILE_SITE_KEY || "",
  };
}
