import { defineConfig } from "vite";
import tailwind from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: "src",
  publicDir: "../public",
  // Config arrives through publicEnv()/config.json. Never inline VITE_* secrets.
  envDir: false,
  envPrefix: [],
  plugins: [tailwind()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  esbuild: { jsx: "automatic" },
  build: { outDir: "../dist", emptyOutDir: true, target: "es2022" },
});
