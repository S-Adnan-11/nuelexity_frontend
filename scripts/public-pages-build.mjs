import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { publicationBlockers } from "./publication.mjs";
import { preparePages } from "./pages-artifacts.mjs";
const review = process.argv.includes("--review");
await rm("pages-public-dist", { recursive: true, force: true });
const held = async checkBuild => {
  const blockers = await publicationBlockers({ checkBuild, release: "public-information" });
  if (blockers.length) throw new Error("Public-information artifact validation failed: " + blockers.join("; "));
};
if (!review) await held(false);
await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ["--import", "tsx", "build.ts", "--public-info"], { stdio: "inherit", shell: false });
  child.once("error", reject);
  child.once("exit", code => code === 0 ? resolve() : reject(new Error("Public information build failed.")));
});
if (!review) await held(true);
await preparePages("public-build", review ? "pages-public-review" : "pages-public-dist", { limited: true });
console.log(review ? "Local public-information fixture: pages-public-review/." : "Limited public-information artifact: pages-public-dist/. No deployment performed.");
