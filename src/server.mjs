import express from "express";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { loadEnvironment } from "../scripts/load-env.mjs";
import { publicEnv } from "../public-env.mjs";
import { publicationBlockers } from "../scripts/publication.mjs";

process.env.NODE_ENV = "production";
if (process.env.NUELEXITY_ENV_FILE !== "none") loadEnvironment("production");
const localPreview = process.argv.includes('--local-preview');
const blockers = await publicationBlockers();
if (blockers.length && !localPreview) throw new Error('Publication held. Run npm run release:check; use npm run preview:local for loopback-only review.');
const settings = publicEnv();
const root = path.resolve("dist");
const hashes = JSON.parse(await readFile(path.join(root, 'csp-hashes.json'), 'utf8'));
const endpoints = [settings.BUN_PUBLIC_BACKEND_URL, settings.BUN_PUBLIC_SUPABASE_URL].filter(Boolean).map(value => new URL(value).origin);
const csp = `default-src 'none'; script-src 'self' https://challenges.cloudflare.com ${hashes.join(' ')}; style-src 'self' 'unsafe-inline'; img-src 'self' https:; font-src 'self'; connect-src 'self' ${endpoints.join(' ')} https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; base-uri 'none'; object-src 'none'; form-action 'self'; frame-ancestors 'none'; manifest-src 'self'`;
const app = express();
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()', 'Content-Security-Policy': csp, 'Cache-Control': 'no-store' });
  if (localPreview) res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
});
app.use((req, res, next) => {
  const canonical = req.path.toLowerCase().replace(/\/+$/, '') || '/';
  if (['/', '/about', '/legal'].includes(canonical) && req.path !== canonical) return res.redirect(308, canonical);
  next();
});
app.get("/config.json", (_req, res) => res.set("X-Robots-Tag", "noindex, nofollow").json(settings));
// Route HTML is selected before static serving, including initial noindex metadata.
for (const route of ['/', '/about', '/legal', '/account', '/auth', '/auth/callback', '/dashboard']) {
  app.get(route, (_req, res) => {
    if (!['/', '/about', '/legal'].includes(route)) res.set('X-Robots-Tag', 'noindex, nofollow');
    res.sendFile(path.join(root, route === '/' ? 'index.html' : `${route}/index.html`));
  });
}
app.get('/dashboard/:conversationId', (_req, res) => res.set('X-Robots-Tag', 'noindex, nofollow').sendFile(path.join(root, 'private.html')));
app.use(express.static(root, { index: false, dotfiles: 'deny' }));
app.use((_req, res) => res.status(404).set('X-Robots-Tag', 'noindex, nofollow').sendFile(path.join(root, '404.html')));
const server = app.listen(Number(process.env.PORT || 3000), localPreview ? '127.0.0.1' : undefined, () => {
  console.log(`Nuelexity frontend running on port ${server.address().port}${localPreview ? ' (local preview)' : ''}`);
});
server.headersTimeout = 10000;
server.requestTimeout = 15000;
const stop = () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
