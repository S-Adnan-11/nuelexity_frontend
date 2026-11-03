import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { publicationBlockers } from "./publication.mjs";
import { preparePages } from "./pages-artifacts.mjs";

const review = process.argv.includes("--review");
// Artifact preparation never uploads or records a successful production test.
await rm("pages-dist", { recursive: true, force: true });
await rm("pages-acceptance-dist", { recursive: true, force: true });
if (process.argv.slice(2).some(arg => arg !== "--review")) throw new Error("Use build:pages for the Pages artifact or pages:prepare for a local review. The separate acceptance-candidate workflow has been removed.");
const held = async (checkBuild) => {
  const blockers = await publicationBlockers({ checkBuild });
  if (blockers.length) throw new Error("Pages artifact validation failed: " + blockers.join("; "));
};
if (!review) await held(false);
await new Promise((resolve, reject) => {
  const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], { stdio: "inherit", shell: false });
  child.once("error", reject);
  child.once("exit", code => code === 0 ? resolve() : reject(new Error("Frontend build failed.")));
});
if (!review) await held(true);
await preparePages("dist", review ? "pages-review" : "pages-dist");
console.log(review ? "Local Pages fixture prepared in pages-review/." : "Static Pages artifact prepared in pages-dist/. No deployment occurred; production acceptance remains a post-deployment check.");
