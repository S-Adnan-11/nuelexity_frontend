import { strict as assert } from "node:assert";

// Smoke the real Bun server without loading any local .env or external services.
const probe = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => new Response() });
const port = probe.port!;
probe.stop(true);
const child = Bun.spawn([process.execPath, "--no-env-file", "src/index.ts"], {
  env: { PATH: process.env.PATH, PORT: String(port), NODE_ENV: "production" },
  stdout: "ignore", stderr: "pipe",
});
const base = `http://127.0.0.1:${port}`;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { ready = (await fetch(base)).ok; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.ok(ready, "Bun server startup");
  for (const route of ["/dashboard", "/auth", "/auth/callback"]) {
    const html = await (await fetch(base + route)).text();
    assert.ok(html.includes("Nuelexity — Follow your curiosity"));
    for (const [, asset] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (!asset || asset.startsWith("https:")) continue;
      const response = await fetch(new URL(asset, base + route));
      assert.ok(response.ok, `${route}: ${asset}`);
      assert.ok(!response.headers.get("content-type")?.includes("text/html"), asset);
    }
  }
  for (const [asset, type] of [
    ["logos/lockup-sage.svg", "image/svg+xml"], ["logos/lockup-ink.svg", "image/svg+xml"],
    ["logos/small-mark-sage.svg", "image/svg+xml"], ["logos/small-mark-ink.svg", "image/svg+xml"],
    ["icons/favicon.ico", "image/"], ["icons/apple-touch-icon.png", "image/png"],
    ["fonts/Manrope-Variable.woff", "font/woff"], ["fonts/DMSerifDisplay-Regular.woff", "font/woff"],
    ["social/open-graph.png", "image/png"],
  ]) {
    const response = await fetch(`${base}/brand/v2/${asset}`);
    assert.ok(response.ok, asset);
    assert.ok(response.headers.get("content-type")?.includes(type!), `${asset}: type`);
  }
  const manifest = await (await fetch(`${base}/brand/v2/icons/site.webmanifest`)).json();
  for (const icon of manifest.icons) assert.ok((await fetch(base + icon.src)).ok);
  const config = await (await fetch(base + "/config.json")).json();
  assert.deepEqual(Object.keys(config).sort(), ["BUN_PUBLIC_BACKEND_URL", "BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "BUN_PUBLIC_SUPABASE_URL", "BUN_PUBLIC_TURNSTILE_SITE_KEY"]);
  console.log("PASS real Bun server: home/auth/callback assets, dark/light vectors, icons, manifest, local fonts, social image and public config whitelist. No external services used.");
} finally {
  child.kill(); await child.exited;
}
