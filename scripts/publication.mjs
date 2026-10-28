import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const pendingPolicyText = /Policy draft for review|Local policy preview|not yet effective|must be approved before public beta|workflow still needs final approval|remain part of the pre-release review/;
export async function publicationBlockers({ root = fileURLToPath(new URL("../", import.meta.url)), checkBuild = true } = {}) {
  const content = JSON.parse(await readFile(path.join(root, "site-content.json"), "utf8"));
  const blockers = [];
  if (!content.operator?.trim()) blockers.push("Confirmed operator name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(content.privacyContact || "")) blockers.push("Working privacy/contact email");
  const date = new Date(content.effectiveDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(content.effectiveDate || "") || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== content.effectiveDate) blockers.push("Approved effective date");
  if (content.ownerDecisionsReviewed !== true) blockers.push("Eligibility, lawful bases/transfers, retention/provider controls and manual rights workflow policy approval");
  if (content.publicationApproved !== true) blockers.push("Final policy copy and publication approval");
  if (content.googleBrandingVerified !== true) blockers.push("Owner confirmation of Google branding verification");
  if (checkBuild && content.publicationApproved === true) {
    try {
      const builtHash = await readFile(path.join(root, "dist/content.sha256"), "utf8");
      if (builtHash !== createHash("sha256").update(JSON.stringify(content)).digest("hex")) blockers.push("Rebuild after changing public content configuration");
      const source = await readFile(path.join(root, "src/components/pages/PublicPages.tsx"));
      const sourceHash = await readFile(path.join(root, "dist/policy-source.sha256"), "utf8");
      if (sourceHash !== createHash("sha256").update(source).digest("hex")) blockers.push("Rebuild after changing policy source");
      const legal = await readFile(path.join(root, "dist/legal/index.html"), "utf8");
      if (pendingPolicyText.test(legal)) blockers.push("Finalize rendered legal copy and rebuild");
    } catch { blockers.push("Build the reviewed public pages"); }
  }
  return blockers;
}
