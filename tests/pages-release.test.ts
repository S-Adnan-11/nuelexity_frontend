import { afterEach, expect, test } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { pagesHeaders, pagesRedirects, preparePages, validatePagesConfig } from "../scripts/pages-artifacts.mjs";
import { publicationBlockers } from "../scripts/publication.mjs";

const settings = { BUN_PUBLIC_SUPABASE_URL: "https://example.supabase.co", BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture", BUN_PUBLIC_BACKEND_URL: "https://nuelexity-backend.onrender.com", BUN_PUBLIC_TURNSTILE_SITE_KEY: "0x4AAAAAAAAAAAAAAAAAAAAA" };
const temp: string[] = [];
afterEach(async () => { await Promise.all(temp.splice(0).map(dir => rm(dir, { recursive: true, force: true }))); });
async function fixture() {
  const root = await mkdtemp("/tmp/nuelexity-release-test-"); temp.push(root);
  await mkdir(path.join(root, "dist/legal"), { recursive: true });
  await mkdir(path.join(root, "src/components/pages"), { recursive: true });
  const content = { operator: "Adnan Muhammad Sadiq", privacyContact: "s.adnan.werk@gmail.com", effectiveDate: "2026-10-28", publicationApproved: true, ownerDecisionsReviewed: true, googleBrandingVerified: true };
  await writeFile(path.join(root, "site-content.json"), JSON.stringify(content));
  await writeFile(path.join(root, "dist/content.sha256"), createHash("sha256").update(JSON.stringify(content)).digest("hex"));
  await writeFile(path.join(root, "src/components/pages/PublicPages.tsx"), "approved fixture source");
  await writeFile(path.join(root, "dist/policy-source.sha256"), createHash("sha256").update("approved fixture source").digest("hex"));
  await writeFile(path.join(root, "dist/legal/index.html"), "Approved fixture policy.");
  return { root, content };
}
test("policy approval does not bypass the separate Google confirmation or a stale policy build", async () => {
  const { root, content } = await fixture();
  expect(await publicationBlockers({ root })).toEqual([]);
  await writeFile(path.join(root, "site-content.json"), JSON.stringify({ ...content, googleBrandingVerified: false }));
  expect(await publicationBlockers({ root })).toContain("Owner confirmation of Google branding verification");
  await writeFile(path.join(root, "site-content.json"), JSON.stringify(content));
  await writeFile(path.join(root, "src/components/pages/PublicPages.tsx"), "changed policy");
  expect(await publicationBlockers({ root })).toContain("Rebuild after changing policy source");
});
test("a draft, impossible effective date or unreviewed choice cannot pass publication", async () => {
  const { root, content } = await fixture();
  await writeFile(path.join(root, "dist/legal/index.html"), "Policy draft for review. These terms are not yet in effect.");
  expect(await publicationBlockers({ root })).toContain("Finalize rendered legal copy and rebuild");
  await writeFile(path.join(root, "site-content.json"), JSON.stringify({ ...content, effectiveDate: "2026-99-99", ownerDecisionsReviewed: false }));
  const held = await publicationBlockers({ root });
  expect(held).toContain("Approved effective date");
  expect(held.some((s: string) => s.includes("manual rights"))).toBe(true);
});
test("static config rejects localhost, test Turnstile keys, private Supabase keys and extra settings", () => {
  expect(validatePagesConfig(settings)).toBe("https://example.supabase.co");
  for (const update of [{ BUN_PUBLIC_BACKEND_URL: "http://localhost:3002" }, { BUN_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA" }, { BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_invalid" }, { GROQ_API_KEY: "fixture-secret" }]) expect(() => validatePagesConfig({ ...settings, ...update })).toThrow();
  const key = `fixture.${Buffer.from('{"role":"service_role"}').toString("base64url")}.fixture`;
  expect(() => validatePagesConfig({ ...settings, BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key })).toThrow();
});
test("public production headers stay indexable; private paths and preview hosts have explicit controls", () => {
  const hash = "'sha256-" + Buffer.alloc(32).toString("base64") + "'";
  const headers = pagesHeaders(settings, [hash]);
  const global = headers.split("\n\n")[0]!;
  expect(global).not.toMatch(/X-Robots-Tag|no-store|localhost/);
  expect(global).toContain("frame-ancestors 'none'");
  expect(global).toContain("https://nuelexity-backend.onrender.com");
  expect(headers).toContain("/dashboard/*\n  Cache-Control: private, no-store");
  expect(headers).toContain("https://:project.pages.dev/*\n  X-Robots-Tag: noindex");
  expect(pagesRedirects).toContain("/dashboard/* /private 200");
  expect(pagesRedirects).not.toContain("/* /index.html");
});
test("Pages assembly flattens public route HTML and excludes private build/source files", async () => {
  const { root } = await fixture();
  const source = path.join(root, "dist"), dest = path.join(root, "pages-review");
  for (const file of ["index.html", "about/index.html", "account/index.html", "auth/index.html", "auth/callback/index.html", "dashboard/index.html", "private.html", "404.html", "robots.txt", "sitemap.xml", "assets/app.js", "brand/mark.svg"]) {
    await mkdir(path.dirname(path.join(source, file)), { recursive: true }); await writeFile(path.join(source, file), "static fixture");
  }
  await writeFile(path.join(source, "config.json"), JSON.stringify(settings));
  await writeFile(path.join(source, "csp-hashes.json"), JSON.stringify(["'sha256-" + Buffer.alloc(32).toString("base64") + "'"]));
  await writeFile(path.join(source, ".env"), "private fixture");
  await preparePages(source, dest);
  expect(await readFile(path.join(dest, "about.html"), "utf8")).toBe("static fixture");
  expect(await readFile(path.join(dest, "auth/callback.html"), "utf8")).toBe("static fixture");
  for (const excluded of [".env", "csp-hashes.json", "content.sha256", "policy-source.sha256"]) await expect(readFile(path.join(dest, excluded))).rejects.toThrow();
});
test("blocked Pages build removes stale deployable output without running a build", async () => {
  const { root, content } = await fixture();
  await mkdir(path.join(root, "pages-dist")); await writeFile(path.join(root, "pages-dist/stale"), "never upload");
  await writeFile(path.join(root, "site-content.json"), JSON.stringify({ ...content, publicationApproved: false }));
  const script = path.resolve("scripts/pages-build.mjs");
  // Publication reads are explicitly anchored to the repo, so test a self-contained copy.
  for (const file of ["pages-build.mjs", "pages-artifacts.mjs", "publication.mjs"]) {
    await mkdir(path.join(root, "scripts"), { recursive: true });
    await writeFile(path.join(root, "scripts", file), await readFile(path.resolve("scripts", file)));
  }
  await writeFile(path.join(root, "public-env.mjs"), await readFile("public-env.mjs"));
  const result = spawnSync(process.execPath, [path.join(root, "scripts/pages-build.mjs")], { cwd: root, encoding: "utf8" });
  expect(result.status).not.toBe(0); expect(result.stderr).toContain("Pages publication held");
  await expect(readFile(path.join(root, "pages-dist/stale"))).rejects.toThrow();
});
