import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { publicationBlockers } from "./publication.mjs";
import { preparePages } from "./pages-artifacts.mjs";

const review = process.argv.includes("--review");
const candidate = process.argv.includes("--acceptance-candidate");
const liveTestAuthorized = process.argv.includes("--live-test-authorized");
if (review && candidate) throw new Error("Local review and live acceptance candidate are separate stages.");
// Remove stale deployable output even when publication is currently blocked.
await rm("pages-dist", { recursive: true, force: true });
await rm("pages-acceptance-dist", { recursive: true, force: true });
if (candidate && !liveTestAuthorized) throw new Error("Candidate preparation requires the owner's separate live-test authorization; then pass --live-test-authorized. This command never uploads or opens the beta.");
if (liveTestAuthorized && !candidate) throw new Error("--live-test-authorized applies only to --acceptance-candidate.");
const held = async (checkBuild) => {
  const blockers = await publicationBlockers({ checkBuild, release: candidate ? "acceptance-candidate" : "application" });
  if (blockers.length) throw new Error("Pages publication held: " + blockers.join("; "));
};
if (!review) await held(false);
await new Promise((resolve, reject) => {
  const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], { stdio: "inherit", shell: false });
  child.once("error", reject);
  child.once("exit", code => code === 0 ? resolve() : reject(new Error("Frontend build failed.")));
});
if (!review) await held(true);
await preparePages("dist", review ? "pages-review" : candidate ? "pages-acceptance-dist" : "pages-dist");
console.log(review ? "Local Pages review prepared in pages-review/. It is an unapproved fixture, not the configured deployment output." : candidate ? "Restricted live-test candidate prepared in pages-acceptance-dist/. Production acceptance remains incomplete. No upload, deployment or full-beta approval was performed." : "Approved static Pages artifact prepared in pages-dist/. No upload or deployment was performed.");
