import { createServer } from "node:http";
import { Readable } from "node:stream";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";

// Small Fetch/Node bridge for existing offline browser fixtures, including SSE.
export async function serveFixture(handler: (req: Request) => Promise<Response>) {
  const server = createServer(async (req, res) => {
    const controller = new AbortController();
    res.on("close", () => { if (!res.writableEnded) controller.abort(); });
    try {
      const request = new Request(new URL(req.url!, `http://${req.headers.host}`), {
        method: req.method, headers: req.headers as Record<string, string>,
        ...(req.method === "GET" || req.method === "HEAD" ? {} : { body: Readable.toWeb(req), duplex: "half" }),
        signal: controller.signal,
      } as RequestInit);
      const response = await handler(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.flushHeaders();
      if (!response.body) return void res.end();
      const body = Readable.fromWeb(response.body as import("node:stream/web").ReadableStream);
      res.on("close", () => body.destroy());
      body.on("error", () => res.destroy());
      body.pipe(res);
    } catch { if (!res.headersSent) res.writeHead(500); res.end(); }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as import("node:net").AddressInfo;
  return { url: new URL(`http://127.0.0.1:${address.port}/`), stop() { server.closeAllConnections(); server.close(); } };
}

export async function staticResponse(root: string, pathname: string) {
  const candidate = path.resolve(root, "." + pathname);
  const file = candidate.startsWith(path.resolve(root) + path.sep) ? candidate : path.join(root, "index.html");
  let bytes: Buffer;
  let actual = file;
  try { bytes = await readFile(file); }
  catch { actual = path.join(root, "index.html"); bytes = await readFile(actual); }
  const mime: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".woff": "font/woff", ".json": "application/json", ".webmanifest": "application/manifest+json" };
  return new Response(new Uint8Array(bytes), { headers: { "Content-Type": mime[path.extname(actual)] || "application/octet-stream" } });
}

export function launchChrome(profile: string) {
  const child = spawn(process.env.CHROME_BIN || "google-chrome", ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
  const exited = once(child, "exit");
  return { kill: () => child.kill(), exited };
}
