import { serve } from "bun";
import index from "./index.html";
import { publicEnv } from "../public-env";

const settings = publicEnv();
const server = serve({
  port: Number(process.env.PORT || 3000),
  routes: {
    "/config.json": () => Response.json(settings, { headers: { "Cache-Control": "no-store" } }),
    "/*": index,
  },
  development: process.env.NODE_ENV !== "production" && { hmr: true, console: true },
});
console.log(`Nuelexity frontend running at ${server.url}`);
