import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { serveFixture, staticResponse, launchChrome } from "./http-fixture";

// Actual production React, local fixtures only. No external scripts or credits.
const user = { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", role: "authenticated", email: "fixture@example.test", user_metadata: {}, app_metadata: { provider: "google" }, created_at: "now" };
const model = { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B", provider: "Groq", preview: false, available: true };
let ready = false, cold = false, configurationFailure = false, ambiguous = false;
let asks = 0, exchanges = 0;
const reads: string[] = [], passes: string[] = [];
const server = await serveFixture(async req => {
  const url = new URL(req.url);
  if (url.pathname === "/config.json") return Response.json({ BUN_PUBLIC_BACKEND_URL: server.url.origin,
    BUN_PUBLIC_SUPABASE_URL: server.url.origin + "/supabase", BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "offline-fixture", BUN_PUBLIC_TURNSTILE_SITE_KEY: "offline-fixture" });
  if (url.pathname.startsWith("/supabase/auth/v1/"))
    return url.pathname.endsWith("/logout") ? new Response(null, { status: 204 }) : Response.json(user);
  if (["/health", "/ready", "/models", "/guest/session", "/conversations"].includes(url.pathname) && req.method === "GET") {
    reads.push(url.pathname);
    if (cold) return new Response("<html>Render is starting</html>", { status: 503, headers: { "Content-Type": "text/html" } });
    if (configurationFailure) return Response.json({ error: { code: "NOT_CONFIGURED" } }, { status: 503 });
  }
  if (url.pathname === "/health") return Response.json({ status: "ok" });
  if (url.pathname === "/ready") return ready ? Response.json({ status: "ready" }) : Response.json({ error: { code: "READINESS_UNAVAILABLE" } }, { status: 503 });
  if (url.pathname === "/models") return Response.json({ defaultModelId: model.id, canSelect: !!req.headers.get("Authorization"), answerMode: "ai", models: [model] });
  if (url.pathname === "/conversations") return Response.json({ conversations: [] });
  if (url.pathname === "/guest/session") {
    if (req.method === "POST") {
      exchanges++;
      assert.ok((await req.json()).turnstileToken.startsWith("fixture-proof"));
      return Response.json({ pass: "v1.fixture.signature", expiresAt: Date.now() + 600000 });
    }
    const pass = req.headers.get("X-Guest-Pass") || ""; passes.push(pass);
    return Response.json({ verified: pass === "v1.fixture.signature", verificationRequired: true, expiresAt: pass ? Date.now() + 600000 : null });
  }
  if (url.pathname === "/nuelexity_ask") {
    asks++;
    const body = await req.json(); assert.ok(body.query);
    if (!req.headers.has("Authorization")) assert.equal(req.headers.get("X-Guest-Pass"), "v1.fixture.signature");
    const text = 'event: delta\ndata: {"text":"Fixture answer"}\n\n' + (ambiguous ? "" : 'event: done\ndata: {"conversationId":null,"model":null,"answerKind":"sources-only"}\n\n');
    return new Response(text, { headers: { "Content-Type": "text/event-stream" } });
  }
  return staticResponse("dist", url.pathname);
});
const profile = await mkdtemp(path.join(tmpdir(), "nuelexity-startup-ui-"));
const chrome = launchChrome(profile);
let socket: WebSocket, sequence = 0;
const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(run: () => Promise<boolean>, label: string) {
  for (let i = 0; i < 240; i++) { if (await run()) return; await delay(50); }
  throw new Error("Timed out: " + label);
}
function command(method: string, params: Record<string, unknown> = {}) {
  const id = ++sequence;
  return new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error("CDP " + method)); }, 15000);
    pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression: string) {
  const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  assert.ok(!result.exceptionDetails, expression.slice(0, 100)); return result.result.value;
}
async function typeAndSubmit(question: string) {
  await until(() => evaluate("!!document.querySelector('#question')"), "composer");
  assert.equal(await evaluate("document.querySelector('#question').disabled"), false);
  await evaluate(`(() => { const input = document.querySelector('#question'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, ${JSON.stringify(question)}); input.dispatchEvent(new Event('input', { bubbles:true })); })()`);
  await until(() => evaluate("document.querySelector('[aria-label=\"Send question\"]')?.disabled === false"), "drafting before startup");
  await evaluate("(() => { const f=document.querySelector('form.composer'); f.requestSubmit(); f.requestSubmit(); })()");
}
async function open(entry: string, extra = "") {
  reads.length = 0; passes.length = 0;
  await command("Page.navigate", { url: `${server.url}dashboard?entry=${entry}${extra}` });
  await until(() => evaluate("!!document.querySelector('#question')"), "workspace");
}
try {
  let port = "";
  await until(async () => { try { port = (await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]!; return !!port; } catch { return false; } }, "Chrome");
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() as any[];
  socket = new WebSocket(tabs.find(tab => tab.type === "page").webSocketDebuggerUrl);
  socket.onmessage = event => { const packet = JSON.parse(String(event.data)), waiter = pending.get(packet.id); if (!waiter) return; pending.delete(packet.id); packet.error ? waiter.reject(new Error(packet.error.message)) : waiter.resolve(packet.result); };
  await new Promise<void>((resolve, reject) => { socket.onopen = () => resolve(); socket.onerror = () => reject(new Error("Chrome connection")); });
  await command("Page.enable");
  const exp = Math.floor(Date.now()/1000) + 3600;
  const token = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub:user.id, exp, role:"authenticated" })).toString("base64url")}.fixture`;
  const session = { access_token: token, refresh_token: "fixture", token_type:"bearer", expires_at:exp, user };
  await command("Page.addScriptToEvaluateOnNewDocument", { source: `
    localStorage.clear(); sessionStorage.clear();
    const entry = new URL(location.href).searchParams.get('entry');
    if (entry === 'signed') localStorage.setItem('sb-127-auth-token', ${JSON.stringify(JSON.stringify(session))});
    if (entry === 'returning') sessionStorage.setItem('nuelexity.guest-pass.v1', 'v1.fixture.signature');
    window.turnstile = { render(_container, options) { window.fixtureChallenge = options; return 'fixture'; }, remove() {} };
    if (location.search.includes('timeout=1')) { const original = AbortSignal.timeout.bind(AbortSignal); AbortSignal.timeout = ms => original(ms === 120000 ? 400 : ms); }
  ` });

  for (const entry of ["guest", "returning", "signed"]) {
    ready = false; cold = true; const before = asks, verifiedBefore = exchanges;
    await open(entry); await typeAndSubmit("Waiting " + entry);
    await until(() => evaluate("!!document.querySelector('[aria-label=\"Cancel waiting question\"]')"), "single pending question");
    assert.equal(asks, before); cold = false; ready = true;
    if (entry === "guest") {
      await until(() => evaluate("!!window.fixtureChallenge"), "challenge after startup");
      await evaluate("window.fixtureChallenge['expired-callback']()");
      await delay(100); assert.equal(exchanges, verifiedBefore);
      await until(() => evaluate("!!document.querySelector('.bot-check')"), "fresh challenge");
      await evaluate("window.fixtureChallenge.callback('fixture-proof-new'); window.fixtureChallenge.callback('fixture-proof-new')");
    }
    await until(async () => asks === before + 1, "one search after ready/auth/verification");
    await until(() => evaluate("!document.querySelector('[aria-label=\"Stop search\"]')"), "completed");
    assert.equal(reads.filter(p => p === "/health").length, 0, "existing read wakes every current entry");
    assert.equal(reads.filter(p => p === "/ready").length, 1, "one shared readiness operation");
    assert.equal(exchanges - verifiedBefore, entry === "guest" ? 1 : 0);
    if (entry === "returning") assert.ok(passes.includes("v1.fixture.signature"));
    if (entry === "signed") assert.ok(reads.includes("/conversations"));
    await delay(150); assert.equal(asks, before + 1);
  }

  for (const entry of ["guest", "returning", "signed"]) {
    ready = false; const before = asks;
    await open(entry); await typeAndSubmit("Cancel " + entry);
    await until(() => evaluate("!!document.querySelector('[aria-label=\"Cancel waiting question\"]')"), "cancel available");
    await evaluate("document.querySelector('[aria-label=\"Cancel waiting question\"]').click()");
    assert.equal(await evaluate("document.querySelector('#question').value"), "Cancel " + entry);
    ready = true; await delay(1200); assert.equal(asks, before);
  }
  ready = false; await open("signed"); const beforeNavigation = asks;
  await typeAndSubmit("Never send after navigation");
  await evaluate("document.querySelector('.workspace-account').click()");
  await until(() => evaluate("location.pathname === '/account'"), "account navigation");
  await evaluate("Array.from(document.querySelectorAll('button')).find(b => /sign out/i.test(b.textContent)).click()");
  ready = true; await delay(1200); assert.equal(asks, beforeNavigation);

  ready = false; await open("signed"); const beforeReplacement = asks;
  await typeAndSubmit("Never send as a different account");
  const other = { ...session, user: { ...user, id: "22222222-2222-4222-8222-222222222222" } };
  await evaluate(`(() => { const next=${JSON.stringify(JSON.stringify(other))}; localStorage.setItem('sb-127-auth-token',next); const c=new BroadcastChannel('sb-127-auth-token'); c.postMessage({event:'SIGNED_IN',session:JSON.parse(next)}); setTimeout(()=>c.close(),100); })()`);
  await until(() => evaluate("document.querySelector('#question')?.value === ''"), "replacement clears pending private question");
  ready = true; await delay(1200); assert.equal(asks, beforeReplacement);

  ready = true; ambiguous = true; await open("returning"); const beforeAmbiguous = asks;
  await typeAndSubmit("Unknown acceptance");
  await until(() => evaluate("document.body.innerText.includes('Incomplete')"), "incomplete stream");
  assert.equal(await evaluate("document.querySelector('#question').value"), "Unknown acceptance");
  await delay(1200); assert.equal(asks, beforeAmbiguous + 1); ambiguous = false;

  configurationFailure = true; await open("guest");
  await until(() => evaluate("document.body.innerText.includes('needs configuration')"), "configuration state");
  configurationFailure = false; cold = true; await open("returning", "&timeout=1");
  await typeAndSubmit("Preserved on startup timeout"); const beforeTimeout = asks;
  await until(() => evaluate("document.body.innerText.includes('unreachable')"), "bounded unreachable state");
  assert.equal(await evaluate("document.querySelector('#question').value"), "Preserved on startup timeout");
  cold = false; await delay(500); assert.equal(asks, beforeTimeout);
  ready = false; await open("returning", "&timeout=1");
  await typeAndSubmit("Preserved on failed readiness");
  await until(() => evaluate("document.body.innerText.includes('not ready for research')"), "application unavailable state");
  assert.equal(await evaluate("document.querySelector('#question').value"), "Preserved on failed readiness");
  console.log("PASS startup UI: three entry paths reuse reads, HTML/slow startup, single readiness operation, token expiry/one exchange, duplicate send, cancel/draft retention, navigation/sign-out, uncertain stream never replayed, config failure and timeout. Zero provider credits.");
} finally {
  socket!?.close(); chrome.kill(); await chrome.exited; server.stop();
  await rm(profile, { recursive: true, force: true, maxRetries:5, retryDelay:100 });
}
