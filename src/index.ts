import { serve } from "bun";
import index from "./index.html";
import { publicEnv } from "../public-env";
import path from "node:path";

const settings = publicEnv();
const server = serve({
  port: Number(process.env.PORT || 3000),
  routes: {
    "/brand/v2/*": (req) => {
      const root = path.resolve("public/brand/v2");
      const file = path.resolve("public", "." + new URL(req.url).pathname);
      if (!file.startsWith(root + path.sep)) return new Response(null, { status: 404 });
      return new Response(Bun.file(file), { headers: { "Cache-Control": "public, max-age=3600" } });
    },
    "/config.json": () => Response.json(settings, { headers: { "Cache-Control": "no-store" } }),
    "/*": index,
  },
  development: process.env.NODE_ENV !== "production" && { hmr: true, console: true },
});
console.log(`Nuelexity frontend running at ${server.url}`);
