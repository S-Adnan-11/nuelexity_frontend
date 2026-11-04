import { strict as assert } from "node:assert";

import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";

// Smoke the production Node server with no local environment or real services.
const probe = createServer();
probe.listen(0, "127.0.0.1");
await once(probe, "listening");
const port = String(probe.address().port);
await new Promise(resolve => probe.close(resolve));
const child = spawn(process.execPath, ["src/server.mjs", "--local-preview"], {
  env: { ...process.env, NUELEXITY_ENV_FILE: "none", PORT: port,
    BUN_PUBLIC_SUPABASE_URL: "", BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
    VITE_SUPABASE_URL: "", VITE_SUPABASE_PUBLISHABLE_KEY: "" },
  stdio: "ignore",
});
const exited = once(child, "exit");
const base = `http://127.0.0.1:${port}`;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { ready = (await fetch(base)).ok; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.ok(ready, "Node server startup");
  for (const route of ["/dashboard", "/dashboard/33333333-3333-4333-8333-333333333333", "/auth", "/auth/callback", "/account", "/about", "/legal"]) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200, route);
    const html = await response.text();
    assert.ok(html.includes("Nuelexity"));
    for (const [, asset] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (!asset || asset.startsWith("https:") || asset.startsWith("mailto:") || asset.startsWith("#") || !/\.(?:js|css|svg|png|ico|webmanifest|woff)(?:$|\?)/.test(asset)) continue;
      const response = await fetch(new URL(asset, base + route));
      assert.ok(response.ok, `${route}: ${asset}`);
      assert.ok(!response.headers.get("content-type")?.includes("text/html"), asset);
    }
  }
  assert.equal((await fetch(base + "/assets/missing.js")).status, 404);
  assert.equal((await fetch(base + "/unknown-page")).status, 404);
  for (const route of ["/account", "/dashboard/private-id", "/auth/callback"]) {
    const response = await fetch(base + route);
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.match(response.headers.get('x-robots-tag'), /noindex/);
    const html = await response.text();
    assert.match(html, /name="robots" content="noindex,nofollow"/);
    assert.ok(!html.includes('rel="canonical"'));
  }
  for (const route of ['/', '/about', '/legal']) {
    const response = await fetch(base + route), html = await response.text();
    assert.ok(html.includes(`<link rel="canonical" href="https://nuelexity.devs.surf${route}"`));
    assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.ok(html.includes('<h1>'), 'readable initial HTML');
  }
  const sitemap = await (await fetch(base + '/sitemap.xml')).text();
  assert.equal((sitemap.match(/<loc>/g) || []).length, 3);
  assert.ok(!/account|dashboard|callback/.test(sitemap));
  assert.ok(!(await (await fetch(base + '/robots.txt')).text()).includes('Disallow: /dashboard'));
  for (const [asset, type] of [
    ["logos/lockup-sage.svg", "image/svg+xml"], ["logos/lockup-ink.svg", "image/svg+xml"],
    ["logos/small-mark-sage.svg", "image/svg+xml"], ["logos/small-mark-ink.svg", "image/svg+xml"],
    ["icons/favicon.ico", "image/"], ["icons/apple-touch-icon.png", "image/png"],
    ["fonts/Manrope-Variable.woff", "font/woff"], ["fonts/DMSerifDisplay-Regular.woff", "font/woff"],
    ["social/open-graph.png", "image/png"],
  ]) {
    const response = await fetch(`${base}/brand/v2/${asset}`);
    assert.ok(response.ok, asset);
    assert.ok(response.headers.get("content-type")?.includes(type), `${asset}: type`);
  }
  const manifest = await (await fetch(`${base}/brand/v2/icons/site.webmanifest`)).json();
  for (const icon of manifest.icons) assert.ok((await fetch(base + icon.src)).ok);
  const config = await (await fetch(base + "/config.json")).json();
  assert.deepEqual(Object.keys(config).sort(), ["BUN_PUBLIC_BACKEND_URL", "BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "BUN_PUBLIC_SUPABASE_URL", "BUN_PUBLIC_TURNSTILE_SITE_KEY"]);
  console.log("PASS real Node server: home/auth/callback assets, dark/light vectors, icons, manifest, local fonts, social image and public config whitelist. No external services used.");
} finally {
  child.kill();
  const [code, signal] = await exited;
  assert.equal(code, 0, `graceful shutdown: ${signal}`);
}
