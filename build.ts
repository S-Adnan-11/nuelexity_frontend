import { build } from "vite";
import { writeFile } from "node:fs/promises";
import { publicEnv } from "./public-env.mjs";

await build();
await writeFile("dist/config.json", JSON.stringify(publicEnv(), null, 2) + "\n");
