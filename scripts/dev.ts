import { createServer } from "vite";
import { publicEnv } from "../public-env.mjs";

const settings = publicEnv();
const server = await createServer({
  server: { port: Number(process.env.PORT || 3000), strictPort: true },
  plugins: [{
    name: "public-config",
    configureServer(vite) {
      vite.middlewares.use("/config.json", (_req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.end(JSON.stringify(settings));
      });
    },
  }],
});
await server.listen();
server.printUrls();
const stop = async () => { await server.close(); process.exit(0); };
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
