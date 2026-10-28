import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { publicationBlockers } from "./publication.mjs";
import { preparePages } from "./pages-artifacts.mjs";

const review = process.argv.includes("--review");
// Remove stale deployable output even when publication is currently blocked.
await rm("pages-dist", { recursive: true, force: true });
const held = async (checkBuild) => {
  const blockers = await publicationBlockers({ checkBuild });
  if (blockers.length) throw new Error("Pages publication held: " + blockers.join("; "));
};
if (!review) await held(false);
await new Promise((resolve, reject) => {
  const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], { stdio: "inherit", shell: false });
  child.once("error", reject);
  child.once("exit", code => code === 0 ? resolve() : reject(new Error("Frontend build failed.")));
});
if (!review) await held(true);
await preparePages("dist", review ? "pages-review" : "pages-dist");
console.log(review ? "Local Pages review prepared in pages-review/. It is an unapproved fixture, not the configured deployment output." : "Approved static Pages artifact prepared in pages-dist/. No upload or deployment was performed.");
