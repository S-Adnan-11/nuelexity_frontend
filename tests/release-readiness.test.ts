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
  const root = await mkdtemp("/tmp/nuelexity-readiness-test-"); directories.push(root);
  const content = { operator: "Test operator", privacyContact: "privacy@example.test", effectiveDate: null as string | null, googleBrandingVerified: false, productionAcceptanceComplete: false };
  const save = () => writeFile(path.join(root, "site-content.json"), JSON.stringify(content));
  await save();
  return { root, content, save };
}
test("preparing either artifact does not fabricate Google or production acceptance", async () => {
  const { root } = await fixture();
  const before = await readFile(path.join(root, "site-content.json"), "utf8");
  for (const release of ["application", "public-information"]) expect(await publicationBlockers({ root, checkBuild: false, release })).toEqual([]);
  expect(await readFile(path.join(root, "site-content.json"), "utf8")).toBe(before);
});
test("confirmed operator and contact are still required", async () => {
  const { root, content, save } = await fixture();
  content.operator = ""; content.privacyContact = "not-an-email"; await save();
  expect(await publicationBlockers({ root, checkBuild: false })).toEqual(["Confirmed operator name", "Working privacy/contact email"]);
});
test("dates can remain unset before publication, but an invalid date cannot pass", async () => {
  const { root, content, save } = await fixture();
  expect(await publicationBlockers({ root, checkBuild: false })).toEqual([]);
  content.effectiveDate = "2026-02-30"; await save();
  expect(await publicationBlockers({ root, checkBuild: false })).toContain("Valid policy effective date, or null before first publication");
});
test("fresh rendered source is required even without an approval flag", async () => {
  const { root, content } = await fixture();
  await mkdir(path.join(root, "dist/legal"), { recursive: true });
  await mkdir(path.join(root, "src/components/pages"), { recursive: true });
  const hash = (text: string) => createHash("sha256").update(text).digest("hex");
  await writeFile(path.join(root, "src/components/pages/PublicPages.tsx"), "reviewed source");
  await writeFile(path.join(root, "dist/content.sha256"), hash(JSON.stringify(content)));
  await writeFile(path.join(root, "dist/policy-source.sha256"), hash("reviewed source"));
  await writeFile(path.join(root, "dist/legal/index.html"), "Public policy");
  expect(await publicationBlockers({ root })).toEqual([]);
  await writeFile(path.join(root, "dist/content.sha256"), hash("older configuration"));
  await writeFile(path.join(root, "dist/policy-source.sha256"), hash("older source"));
  await writeFile(path.join(root, "dist/legal/index.html"), "Policy draft for review");
  expect(await publicationBlockers({ root })).toEqual(expect.arrayContaining(["Rebuild after changing public content configuration", "Rebuild after changing policy source", "Finalize rendered legal copy and rebuild"]));
});
test("removed candidate switches cannot silently build and clear stale artifacts", async () => {
  const { root } = await fixture();
  for (const dir of ["pages-dist", "pages-acceptance-dist"]) { await mkdir(path.join(root, dir)); await writeFile(path.join(root, dir, "stale.txt"), "old artifact"); }
  const script = fileURLToPath(new URL("../scripts/pages-build.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [script, "--acceptance-candidate", "--live-test-authorized"], { cwd: root, encoding: "utf8" });
  expect(result.status).not.toBe(0); expect(result.stderr).toContain("workflow has been removed");
  for (const dir of ["pages-dist", "pages-acceptance-dist"]) await expect(readFile(path.join(root, dir, "stale.txt"))).rejects.toThrow();
});
