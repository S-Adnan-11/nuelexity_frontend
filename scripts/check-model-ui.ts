import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { strict as assert } from "node:assert";

// Production-bundle browser checks with local HTTP/auth/provider fixtures only.
// No real credentials, searches, generations, or third-party browser packages.
const owner = "11111111-1111-4111-8111-111111111111", thread = "33333333-3333-4333-8333-333333333333";
const models = [
  { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B", provider: "Groq", preview: false },
  { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B", provider: "Groq", preview: false },
  { id: "qwen/qwen3.8-27b", name: "Qwen 3.8 27B", provider: "Groq", preview: true },
];
let selected = models[0]!.id, unavailable = "", failNextSave = false, releaseAnswer: (() => void) | null = null;
const requests: string[] = [];
const messages: any[] = [{ id: "legacy", role: "assistant", content: "An older answer", sources: [], followUps: [], status: "complete", created_at: "now" }];
const conversation = () => ({ id: thread, title: "Browser verification", selected_model: selected, created_at: "now", updated_at: "now" });
const event = (name: string, data: unknown) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
const user = { id: owner, aud: "authenticated", role: "authenticated", email: "browser@example.test", user_metadata: {}, app_metadata: { provider: "google" }, created_at: "now" };
const server = Bun.serve({ port: 0, hostname: "127.0.0.1", async fetch(req): Promise<Response> {
  const url = new URL(req.url), signed = !!req.headers.get("Authorization");
  if (url.pathname === "/config.json") return Response.json({ BUN_PUBLIC_BACKEND_URL: server.url.origin,
    BUN_PUBLIC_SUPABASE_URL: `${server.url.origin}/supabase`, BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "browser-fixture-key", BUN_PUBLIC_TURNSTILE_SITE_KEY: "" });
  if (url.pathname.startsWith("/supabase/auth/v1/")) {
    if (url.pathname.endsWith("/logout")) return new Response(null, { status: 204 });
    return Response.json(user);
  }
  if (url.pathname === "/models") return Response.json({ defaultModelId: models[0]!.id, canSelect: signed, answerMode: "ai",
    models: models.map((model) => ({ ...model, available: model.id !== unavailable, maxInputBytes: 6000, maxOutputTokens: 1024 })) });
  if (url.pathname === "/guest/session") return Response.json({ verified: true, verificationRequired: false, expiresAt: Date.now() + 60000 });
  if (url.pathname === "/conversations") return Response.json({ conversations: [conversation()] });
  if (url.pathname === `/conversations/${thread}/model`) {
    if (failNextSave) {
      failNextSave = false;
      return Response.json({ error: { code: "DATABASE_UNAVAILABLE", message: "Could not save the choice." } }, { status: 503 });
    }
    selected = (await req.json()).modelId;
    return Response.json({ selectedModelId: selected });
  }
  if (url.pathname === `/conversations/${thread}`) return Response.json({ conversation: conversation(), messages });
  if (url.pathname === "/nuelexity_ask") {
    const body = await req.json();
    const modelId = body.modelId || models[0]!.id;
    requests.push(modelId);
    const model = models.find((model) => model.id === modelId)!;
    if (body.query === "quota") return Response.json({ error: { code: "DAILY_LIMIT", message: "Search limit reached." } }, { status: 429, headers: { "Retry-After": "60" } });
    if (signed && !body.conversationId) selected = modelId;
    const content = `Answer from ${model.name}`;
    const assistant = { id: crypto.randomUUID(), role: "assistant", content, sources: [], followUps: [], status: "complete", created_at: "now", model, answerKind: "ai" };
    const stream = new ReadableStream<Uint8Array>({ start(controller) {
      const send = (name: string, data: unknown) => controller.enqueue(new TextEncoder().encode(event(name, data)));
      send("meta", { requestId: "browser-request", conversationId: signed ? thread : null, answerMode: "ai", remaining: 4, requestedModelId: modelId });
      send("delta", { text: content });
      const finish = () => {
        if (body.query === "interrupted") { controller.close(); return; }
        if (body.query === "permission") {
          unavailable = modelId;
          send("error", { code: "MODEL_PERMISSION", message: "Groq restricted this model. Select another available model." });
          controller.close(); return;
        }
        if (signed) messages.push({ ...assistant, id: crypto.randomUUID(), role: "user", model: null, answerKind: null, content: body.query }, assistant);
        send("done", { conversationId: signed ? thread : null, model, answerKind: "ai" });
        controller.close();
      };
      if (body.query === "freeze") releaseAnswer = finish;
      else setTimeout(finish, 100);
    }});
    return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
  }
  const candidate = path.resolve("dist", url.pathname.slice(1));
  const file = candidate.startsWith(path.resolve("dist") + path.sep) ? Bun.file(candidate) : null;
  return new Response(file && await file.exists() ? file : Bun.file("dist/index.html"));
}});
const profile = await mkdtemp(path.join(tmpdir(), "nuelexity-model-browser-"));
const chrome = Bun.spawn([process.env.CHROME_BIN || "/usr/bin/google-chrome", "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdout: "ignore", stderr: "ignore" });
const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
let socket: WebSocket | undefined, sequence = 0;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(run: () => Promise<boolean>, label: string) {
  const end = Date.now() + 15000;
  while (Date.now() < end) { if (await run()) return; await delay(50); }
  throw new Error(`Timed out: ${label}`);
}
function command(method: string, params: Record<string, unknown> = {}) {
  const id = ++sequence;
  return new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } });
    socket!.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression: string) {
  const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(`Browser expression failed: ${expression.slice(0, 80)}`);
  return result.result.value;
}
async function key(key: string, code = key) {
  await command("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: key === "Enter" ? 13 : key === "Tab" ? 9 : key === "ArrowDown" ? 40 : 38 });
  await command("Input.dispatchKeyEvent", { type: "keyUp", key, code });
}
async function choose(index: number) {
  await evaluate("document.querySelector('#chat-model').focus()");
  const current = await evaluate("document.querySelector('#chat-model').selectedIndex");
  for (let i = current; i < index; i++) await key("ArrowDown");
  for (let i = current; i > index; i--) await key("ArrowUp");
  await until(async () => await evaluate(`document.querySelector('#chat-model').value === ${JSON.stringify(models[index]!.id)}`), "keyboard selection");
  await until(async () => await evaluate("!document.body.innerText.includes('Saving model choice')"), "choice saved");
}
async function submit(query: string) {
  await evaluate(`(() => { const input = document.querySelector('#question'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, ${JSON.stringify(query)}); input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); })()`);
  await until(async () => await evaluate("document.querySelector('[aria-label=\"Send question\"]')?.disabled === false"), "send enabled");
  await key("Enter");
}
async function idle() { await until(async () => await evaluate("!document.querySelector('[aria-label=\"Stop search\"]')"), "answer finished"); }
try {
  let port = "";
  await until(async () => { try { port = (await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]!; return !!port; } catch { return false; } }, "Chrome startup");
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() as any[];
  socket = new WebSocket(tabs.find((tab) => tab.type === "page").webSocketDebuggerUrl);
  socket.onmessage = (message) => {
    const packet = JSON.parse(String(message.data));
    if (!packet.id) return;
    const waiter = pending.get(packet.id); if (!waiter) return;
    pending.delete(packet.id);
    if (packet.error) waiter.reject(new Error(packet.error.message)); else waiter.resolve(packet.result);
  };
  await new Promise<void>((resolve, reject) => { socket!.onopen = () => resolve(); socket!.onerror = () => reject(new Error("Chrome connection failed")); });
  await command("Page.enable"); await command("Runtime.enable");
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: owner, role: "authenticated", aud: "authenticated", exp })).toString("base64url")}.browser-fixture-signature`;
  const session = { access_token: token, refresh_token: "browser-fixture-refresh", token_type: "bearer", expires_at: exp, expires_in: 3600, user };
  const injected = await command("Page.addScriptToEvaluateOnNewDocument", { source: `if (!sessionStorage.getItem('fixture-signed-out')) localStorage.setItem('sb-127-auth-token', ${JSON.stringify(JSON.stringify(session))});` });
  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await command("Page.navigate", { url: `${server.url}dashboard` });
  await until(async () => await evaluate("document.querySelector('#chat-model')?.disabled === false"), "signed-in selector");
  await evaluate("document.querySelector('#question').focus()");
  await key("Tab");
  assert.equal(await evaluate("document.activeElement.id"), "chat-model");
  assert.equal(await evaluate("document.querySelector('#chat-model').labels[0].textContent"), "Model");
  assert.equal(await evaluate("document.querySelector('#chat-model').value"), models[0]!.id);
  assert.ok(await evaluate("document.querySelector('#chat-model').options[2].text.includes('Preview')"));
  await evaluate("Array.from(document.querySelectorAll('.thread-row button')).find(button => button.title === 'Browser verification').click()");
  await until(async () => await evaluate("document.body.innerText.includes('Model unknown')"), "legacy attribution");
  await choose(2);
  assert.equal(selected, models[2]!.id);
  await submit("freeze");
  await until(async () => releaseAnswer !== null, "in-flight generation");
  await choose(0);
  releaseAnswer!(); releaseAnswer = null;
  await idle();
  assert.equal(requests[0], models[2]!.id);
  assert.ok(await evaluate("document.body.innerText.includes('Qwen 3.8 27B · Preview')"));
  assert.equal(await evaluate("document.querySelector('#chat-model').value"), models[0]!.id);
  await submit("next"); await idle();
  assert.equal(requests[1], models[0]!.id);
  assert.ok(await evaluate("document.body.innerText.includes('GPT-OSS 20B ·')"));
  await choose(1);
  await submit("larger model"); await idle();
  assert.equal(requests[2], models[1]!.id);
  assert.ok(await evaluate("document.body.innerText.includes('GPT-OSS 120B ·')"));

  await command("Page.reload");
  await until(async () => await evaluate(`document.querySelector('#chat-model')?.value === ${JSON.stringify(models[1]!.id)} && document.body.innerText.includes('Model unknown')`), "refresh restores conversation and choice");
  await evaluate("document.querySelector('.new-search').click()");
  await until(async () => await evaluate(`document.querySelector('#chat-model')?.value === ${JSON.stringify(models[0]!.id)}`), "new conversation uses default");
  await evaluate("Array.from(document.querySelectorAll('.thread-row button')).find(button => button.title === 'Browser verification').click()");
  await until(async () => await evaluate(`document.querySelector('#chat-model')?.value === ${JSON.stringify(models[1]!.id)}`), "reopening restores model");
  failNextSave = true;
  await choose(0);
  await until(async () => await evaluate("document.body.innerText.includes('Your choice was not saved')"), "failed choice is visible");
  assert.ok(await evaluate("document.querySelector('[aria-label=\"Send question\"]').disabled"));
  await evaluate("document.querySelector('.model-refresh').click()");
  await until(async () => await evaluate("!document.body.innerText.includes('Your choice was not saved') && !document.body.innerText.includes('Saving model choice')"), "manual save retry");
  assert.equal(selected, models[0]!.id);
  selected = "retired/model";
  await evaluate("document.querySelector('.new-search').click(); Array.from(document.querySelectorAll('.thread-row button')).find(button => button.title === 'Browser verification').click()");
  await until(async () => await evaluate("document.querySelector('#chat-model')?.value === 'retired/model'"), "retired stored selection");
  assert.ok(await evaluate("document.querySelector('[aria-label=\"Send question\"]').disabled"));
  assert.ok(await evaluate("document.body.innerText.includes('Choose an available model.')"));
  await evaluate(`(() => { const select = document.querySelector('#chat-model'); select.value = ${JSON.stringify(models[0]!.id)}; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await until(async () => await evaluate(`document.querySelector('#chat-model')?.value === ${JSON.stringify(models[0]!.id)} && !document.body.innerText.includes('Saving model choice')`), "explicit recovery from retired selection");
  await choose(2); await submit("permission"); await idle();
  await until(async () => await evaluate("document.querySelector('#chat-model').options[2].disabled"), "permission recovery");
  assert.ok(await evaluate("document.querySelector('[aria-label=\"Send question\"]').disabled"));
  assert.ok(await evaluate("document.body.innerText.includes('Incomplete')"));
  await choose(1); await submit("recovered"); await idle();
  await submit("interrupted"); await idle();
  assert.ok(await evaluate("document.body.innerText.includes('connection closed before the answer finished')"));
  await submit("quota"); await idle();
  assert.ok(await evaluate("document.body.innerText.includes('Search limit reached')"));
  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await delay(300); // Allow the existing mobile sidebar transition to settle.
  assert.ok(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"));
  await evaluate("document.querySelector('#chat-model').focus()");
  assert.equal(await evaluate("document.activeElement.id"), "chat-model");
  await key("Tab");
  assert.notEqual(await evaluate("document.activeElement.id"), "chat-model");
  const screenshot = await command("Page.captureScreenshot", { format: "png" });
  await writeFile("/tmp/nuelexity-model-selector-mobile.png", Buffer.from(screenshot.data, "base64"));
  await evaluate("sessionStorage.setItem('fixture-signed-out','1'); document.querySelector('[aria-label=\"Sign out\"]').click()");
  await until(async () => await evaluate("document.querySelector('#chat-model')?.disabled === true && document.body.innerText.includes('Sign in to access more models')"), "sign-out returns guest behavior");
  await until(async () => await evaluate(`document.querySelector('#chat-model')?.value === ${JSON.stringify(models[0]!.id)}`), "guest catalogue loaded");
  assert.equal(await evaluate("document.querySelector('#chat-model').value"), models[0]!.id);
  assert.ok(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"));
  const guestScreenshot = await command("Page.captureScreenshot", { format: "png" });
  await writeFile("/tmp/nuelexity-model-selector-guest.png", Buffer.from(guestScreenshot.data, "base64"));
  await command("Page.removeScriptToEvaluateOnNewDocument", { identifier: injected.identifier });
  console.log("PASS production browser: desktop/mobile, keyboard selection and Tab, persistence across refresh/reopening, frozen generation, legacy attribution, failed-save/retired-model/permission/interruption/quota recovery, sign-out/default behavior. All auth/provider calls mocked.");
  console.log(`Mock generation submissions: ${requests.length}; mobile screenshot: /tmp/nuelexity-model-selector-mobile.png`);
} finally {
  socket?.close(); chrome.kill(); await chrome.exited; server.stop(true);
  await rm(profile, { recursive: true, force: true });
}
