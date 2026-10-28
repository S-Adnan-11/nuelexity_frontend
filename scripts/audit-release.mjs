import { execFileSync } from "node:child_process";
import { readFile, lstat } from "node:fs/promises";
import path from "node:path";

// Report file names/reasons only. Never echo a matched credential or env value.
const git = args => execFileSync("git", args, { encoding: "utf8" }).trim();
const root = git(["rev-parse", "--show-toplevel"]);
const staged = git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]);
const files = (staged || git(["ls-files"])).split("\n").filter(Boolean);
const privateValues = new Set();
for (const dir of [root, path.resolve(root, "../../backend/nuelexity_backend")]) for (const name of [".env", ".env.local", ".env.production"]) {
  let text = ""; try { text = await readFile(path.join(dir, name), "utf8"); } catch { continue; }
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || /PUBLIC|PUBLISHABLE/.test(match[1]) || !/SECRET|PASSWORD|TOKEN|API_KEY|SERVICE_ROLE_KEY|SERVICE_KEY|PRIVATE_KEY|DATABASE_URL|DIRECT_URL/.test(match[1])) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
    if (value.length >= 16) privateValues.add(value);
  }
}
const problems = [];
const localOnly = /^(?:\.env(?:\..*)?$|(?:dist|pages-dist|pages-review|node_modules|\.wrangler)\/|docs\/(?:evidence\/|FRONTEND_POLISH_REVIEW\.md|MILESTONE_VERIFICATION\.md|RENDER_LOCAL_VERIFICATION\.md|PREDEPLOYMENT\.md|RETURN_CAT_IMPLEMENTATION\.md))|\.(?:har|mp4|webm|log)$/i;
const credential = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|sb_secret_[A-Za-z0-9_-]{20,}|(?:AKIA|ASIA)[A-Z0-9]{16})\b/;
for (const file of files) {
  if (file !== ".env.example" && localOnly.test(file)) problems.push({ file, reason: "Local/private artifact staged" });
  const full = path.join(root, file);
  let info;try { info = await lstat(full); } catch { continue; }
  if (info.isSymbolicLink()) { problems.push({ file, reason: "Review symlink before release" }); continue; }
  if (!info.isFile()) continue;
  const bytes = await readFile(full), text = bytes.toString("utf8");
  if (credential.test(text)) problems.push({ file, reason: "Credential-shaped content" });
  if ([...privateValues].some(value => bytes.includes(Buffer.from(value)))) problems.push({ file, reason: "Configured private value" });
  for (const token of text.match(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}/g) || []) {
    try { const data = JSON.parse(Buffer.from(token.split(".")[1], "base64url")); if (data.role !== "anon") problems.push({ file, reason: "Non-public JWT" }); } catch { problems.push({ file, reason: "Unclassified JWT" }); }
  }
}
let historyFiles = 0;
let revisions = [];
try { revisions = git(["rev-list", "origin/main..HEAD"]).split("\n").filter(Boolean); } catch { /* A shallow checkout may have no comparison ref. */ }
for (const revision of revisions) for (const file of git(["ls-tree", "-r", "--name-only", revision]).split("\n").filter(Boolean)) {
  const bytes = execFileSync("git", ["show", `${revision}:${file}`], { maxBuffer: 10 * 1024 * 1024 });
  const text = bytes.toString("utf8"); historyFiles++;
  if ((file !== ".env.example" && localOnly.test(file)) || credential.test(text) || [...privateValues].some(value => bytes.includes(Buffer.from(value)))) problems.push({ file: `${revision.slice(0, 8)}:${file}`, reason: "Review outgoing-history private content" });
}
let artifacts = 0;
async function scanArtifact(dir, label) {
  let entries;try { entries = await (await import("node:fs/promises")).readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name), file = label + "/" + entry.name;
    if (entry.isSymbolicLink()) { problems.push({ file, reason: "Artifact symlink" }); continue; }
    if (entry.isDirectory()) { await scanArtifact(full, file); continue; }
    artifacts++;
    const bytes = await readFile(full), text = bytes.toString("utf8");
    if (credential.test(text) || [...privateValues].some(value => bytes.includes(Buffer.from(value)))) problems.push({ file, reason: "Private/credential-shaped value in build output" });
  }
}
for (const dir of ["dist", "pages-review", "pages-dist"]) await scanArtifact(path.join(root, dir), dir);
if (problems.length) { console.error(JSON.stringify(problems, null, 2)); process.exitCode = 1; }
else console.log(`PASS release file audit: ${files.length} ${staged ? "staged" : "tracked"} files, ${historyFiles} outgoing-history file snapshots and ${artifacts} artifact files; no configured private values, credential-shaped content, symlinks or local evidence/config artifacts detected. Human diff review is still required.`);
