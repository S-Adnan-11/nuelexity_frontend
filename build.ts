import tailwind from "bun-plugin-tailwind";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { publicEnv } from "./public-env";

const outdir = path.join(process.cwd(), "dist");
const settings = publicEnv();
await rm(outdir, { recursive: true, force: true });
const result = await Bun.build({
  entrypoints: ["src/index.html"],
  outdir,
  plugins: [tailwind],
  minify: true,
  target: "browser",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
await writeFile(path.join(outdir, "config.json"), JSON.stringify(settings, null, 2) + "\n");
for (const output of result.outputs)
  console.log(
    `${path.relative(process.cwd(), output.path)}  ${(output.size / 1024).toFixed(1)} KB`,
  );
