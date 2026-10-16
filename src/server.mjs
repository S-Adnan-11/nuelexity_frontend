import express from "express";
import path from "node:path";
import { access } from "node:fs/promises";
import { loadEnvironment } from "../scripts/load-env.mjs";
import { publicEnv } from "../public-env.mjs";

process.env.NODE_ENV = "production";
if (process.env.NUELEXITY_ENV_FILE !== "none") loadEnvironment("production");
const settings = publicEnv();
const root = path.resolve("dist");
await access(path.join(root, "index.html"));
const app = express();
app.disable("x-powered-by");
app.get("/config.json", (_req, res) => res.set("Cache-Control", "no-store").json(settings));
app.use(express.static(root, { index: false }));
// Missing assets are errors; only application routes use the SPA entry point.
app.get(["/", "/dashboard", "/auth", "/auth/callback"], (_req, res) => res.sendFile(path.join(root, "index.html")));
const server = app.listen(Number(process.env.PORT || 3000), () => {
  console.log(`Nuelexity frontend running on port ${server.address().port}`);
});
const stop = () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
