import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { publicEnv } from "../public-env.mjs";

export const productionBackend = "https://nuelexity-backend.onrender.com";
export const productionFrontend = "https://nuelexity.devs.surf";
export const pagesDocuments = {
  "index.html": "index.html", "about/index.html": "about.html", "legal/index.html": "legal.html",
  "account/index.html": "account.html", "auth/index.html": "auth.html",
  "auth/callback/index.html": "auth/callback.html", "dashboard/index.html": "dashboard.html",
  "private.html": "private.html", "404.html": "404.html",
};
export function validatePagesConfig(settings) {
  const keys = Object.keys(publicEnv({})).sort();
  if (JSON.stringify(Object.keys(settings).sort()) !== JSON.stringify(keys)) throw new Error("Pages config must contain exactly the four public settings.");
  if (Object.values(settings).some(value => typeof value !== "string")) throw new Error("Public settings must be strings.");
  publicEnv(settings); // Reject service-role/secret Supabase keys too.
  if (settings.BUN_PUBLIC_BACKEND_URL !== productionBackend) throw new Error("Pages requires the approved production backend URL.");
  let supabase;
  try { supabase = new URL(settings.BUN_PUBLIC_SUPABASE_URL); } catch { throw new Error("A public Supabase HTTPS URL is required."); }
  if (supabase.protocol !== "https:" || supabase.username || supabase.password || !supabase.hostname.endsWith(".supabase.co") || !["", "/"].includes(supabase.pathname) || supabase.search || supabase.hash) throw new Error("Use the existing Supabase project HTTPS origin.");
  const key = settings.BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let anon = false;
  try { anon = JSON.parse(Buffer.from(key.split(".")[1] || "", "base64url").toString()).role === "anon"; } catch {}
  if (!key.startsWith("sb_publishable_") && !anon) throw new Error("A public Supabase publishable/anon key is required.");
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(settings.BUN_PUBLIC_TURNSTILE_SITE_KEY) || /^[123]x0{10}/.test(settings.BUN_PUBLIC_TURNSTILE_SITE_KEY)) throw new Error("A non-test production Turnstile site key is required; widget hostname/secret pairing still needs real acceptance.");
  return supabase.origin;
}
export function pagesHeaders(settings, hashes) {
  const supabase = validatePagesConfig(settings);
  if (!Array.isArray(hashes) || !hashes.length || hashes.some(hash => !/^'sha256-[A-Za-z0-9+/]{43}='$/.test(hash))) throw new Error("Invalid structured-data CSP hashes.");
  const csp = `default-src 'none'; script-src 'self' https://challenges.cloudflare.com ${hashes.join(" ")}; style-src 'self' 'unsafe-inline'; img-src 'self' https:; font-src 'self'; connect-src 'self' ${productionBackend} ${supabase} https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; base-uri 'none'; object-src 'none'; form-action 'self'; frame-ancestors 'none'; manifest-src 'self'`;
  const lines = ["/*", "  X-Content-Type-Options: nosniff", "  Referrer-Policy: no-referrer", "  X-Frame-Options: DENY", "  Permissions-Policy: camera=(), microphone=(), geolocation=()", "  Content-Security-Policy: " + csp, "", "/assets/*", "  Cache-Control: public, max-age=31536000, immutable", ""];
  // Both incoming private URLs and the rewrite destination get explicit controls.
  for (const route of ["/account", "/account.html", "/auth", "/auth.html", "/auth/*", "/dashboard", "/dashboard.html", "/dashboard/*", "/private", "/private.html"]) lines.push(route, "  Cache-Control: private, no-store", "  X-Robots-Tag: noindex, nofollow", "");
  lines.push("/config.json", "  Cache-Control: no-store", "  X-Robots-Tag: noindex, nofollow", "", "/404.html", "  X-Robots-Tag: noindex, nofollow", "", "https://:project.pages.dev/*", "  X-Robots-Tag: noindex", "", "https://:version.:project.pages.dev/*", "  X-Robots-Tag: noindex", "");
  if (lines.some(line => line.length > 2000)) throw new Error("Pages header exceeds the platform line limit.");
  return lines.join("\n");
}
export const pagesRedirects = [
  "/about/ /about 301", "/legal/ /legal 301", "/account/ /account 301", "/auth/ /auth 301",
  "/auth/callback/ /auth/callback 301", "/dashboard/ /dashboard 301",
  // Use the extensionless target: Pages redirects .html URLs, even in a proxy.
  "/dashboard/* /private 200", "",
].join("\n");
async function rejectSymlinks(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error("Symlinks are not allowed in Pages assets.");
    if (entry.isDirectory()) await rejectSymlinks(path.join(dir, entry.name));
  }
}
export async function preparePages(source, destination) {
  if (!["pages-review", "pages-dist"].includes(path.basename(destination))) throw new Error("Unexpected Pages output directory.");
  const settings = JSON.parse(await readFile(path.join(source, "config.json"), "utf8"));
  const hashes = JSON.parse(await readFile(path.join(source, "csp-hashes.json"), "utf8"));
  const headers = pagesHeaders(settings, hashes);
  await rejectSymlinks(source);
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  // Explicit deployment allowlist: never copy reports, Node code or build metadata.
  for (const [from, to] of Object.entries(pagesDocuments)) {
    await mkdir(path.dirname(path.join(destination, to)), { recursive: true });
    await cp(path.join(source, from), path.join(destination, to));
  }
  for (const file of ["config.json", "robots.txt", "sitemap.xml", "assets", "brand"]) await cp(path.join(source, file), path.join(destination, file), { recursive: true });
  await writeFile(path.join(destination, "_headers"), headers);
  await writeFile(path.join(destination, "_redirects"), pagesRedirects);
}
