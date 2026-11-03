import { afterEach, expect, test } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { publicationBlockers } from "../scripts/publication.mjs";

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
async function fixture() {
  const root = await mkdtemp("/tmp/nuelexity-acceptance-test-"); directories.push(root);
  const content = { operator: "Test operator", privacyContact: "privacy@example.test", effectiveDate: "2026-11-03", ownerDecisionsReviewed: true, publicationApproved: true, publicHostingReviewed: true, applicationProviderReviewComplete: true, googleBrandingVerified: true, productionAcceptanceComplete: false };
  const save = () => writeFile(path.join(root, "site-content.json"), JSON.stringify(content));
  await save();
  return { root, content, save };
}
test("an acceptance candidate defers only completed production acceptance and never changes its record", async () => {
  const { root } = await fixture();
  const before = await readFile(path.join(root, "site-content.json"), "utf8");
  expect(await publicationBlockers({ root, checkBuild: false, release: "acceptance-candidate" })).toEqual([]);
  expect(await publicationBlockers({ root, checkBuild: false })).toContain("Owner production acceptance for full application launch");
  expect(await readFile(path.join(root, "site-content.json"), "utf8")).toBe(before);
});
test("a candidate still requires real policy, hosting, provider and Google evidence", async () => {
  const { root, content, save } = await fixture();
  for (const key of ["ownerDecisionsReviewed", "publicationApproved", "publicHostingReviewed", "applicationProviderReviewComplete", "googleBrandingVerified"] as const) {
    content[key] = false; await save();
    expect((await publicationBlockers({ root, checkBuild: false, release: "acceptance-candidate" })).length, key).toBeGreaterThan(0);
    content[key] = true;
  }
  content.effectiveDate = ""; await save();
  expect(await publicationBlockers({ root, checkBuild: false, release: "acceptance-candidate" })).toContain("Approved effective date");
});
test("an untested candidate requires an explicit incomplete acceptance record", async () => {
  const { root, content, save } = await fixture();
  content.productionAcceptanceComplete = true; await save();
  expect(await publicationBlockers({ root, checkBuild: false, release: "acceptance-candidate" })).toContain("Record productionAcceptanceComplete: false for the untested candidate");
  expect(await publicationBlockers({ root, checkBuild: false })).toEqual([]);
});
test("candidate promotion also rejects stale configuration, source and draft copy", async () => {
  const { root, content } = await fixture();
  await mkdir(path.join(root, "dist/legal"), { recursive: true });
  await mkdir(path.join(root, "src/components/pages"), { recursive: true });
  const hash = (text: string) => createHash("sha256").update(text).digest("hex");
  await writeFile(path.join(root, "src/components/pages/PublicPages.tsx"), "reviewed policy source");
  await writeFile(path.join(root, "dist/content.sha256"), hash(JSON.stringify(content)));
  await writeFile(path.join(root, "dist/policy-source.sha256"), hash("reviewed policy source"));
  await writeFile(path.join(root, "dist/legal/index.html"), "Approved public policy");
  expect(await publicationBlockers({ root, release: "acceptance-candidate" })).toEqual([]);
  await writeFile(path.join(root, "dist/content.sha256"), hash("older configuration"));
  await writeFile(path.join(root, "dist/policy-source.sha256"), hash("older source"));
  await writeFile(path.join(root, "dist/legal/index.html"), "Policy draft for review");
  expect(await publicationBlockers({ root, release: "acceptance-candidate" })).toEqual(expect.arrayContaining(["Rebuild after changing public content configuration", "Rebuild after changing policy source", "Finalize rendered legal copy and rebuild"]));
});
test("candidate preparation without explicit authorization fails before a build and clears stale artifacts", async () => {
  const { root } = await fixture();
  for (const dir of ["pages-dist", "pages-acceptance-dist"]) { await mkdir(path.join(root, dir)); await writeFile(path.join(root, dir, "stale.txt"), "old artifact"); }
  const script = fileURLToPath(new URL("../scripts/pages-build.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [script, "--acceptance-candidate"], { cwd: root, encoding: "utf8" });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("owner's separate live-test authorization");
  expect(result.stdout).not.toContain("vite");
  for (const dir of ["pages-dist", "pages-acceptance-dist"]) await expect(readFile(path.join(root, dir, "stale.txt"))).rejects.toThrow();
});
