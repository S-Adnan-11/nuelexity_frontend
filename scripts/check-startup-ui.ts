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
let hangExchange = false, activeExchanges = 0, maxExchanges = 0;
const consumedProofs = new Set<string>();
let holdWidget = true, widgetRequests = 0; const widgetLoads: string[] = [];
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
      const proof=(await req.json()).turnstileToken;
      assert.ok(proof.startsWith("fixture-proof"));
      assert.ok(!consumedProofs.has(proof),'a potentially consumed proof must never be replayed');consumedProofs.add(proof);
      activeExchanges++;maxExchanges=Math.max(maxExchanges,activeExchanges);
      try {
        if(hangExchange) await new Promise<void>(resolve=>{if(req.signal.aborted)resolve();else req.signal.addEventListener('abort',()=>resolve(),{once:true})});
        return Response.json({ pass: "v1.fixture.signature", expiresAt: Date.now() + 600000 });
      } finally {activeExchanges--;}
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
async function typeAndSubmit(question: string, blocked = false) {
  await until(() => evaluate("!!document.querySelector('#question')"), "composer");
  assert.equal(await evaluate("document.querySelector('#question').disabled"), false);
  await evaluate(`(() => { const input = document.querySelector('#question'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, ${JSON.stringify(question)}); input.dispatchEvent(new Event('input', { bubbles:true })); })()`);
  await until(() => evaluate(`document.querySelector('[aria-label="Send question"]')?.disabled === ${blocked}`), "submission fence");
  await evaluate("document.querySelector('#question').focus()");
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await evaluate("(() => { const f=document.querySelector('form.composer'); f.requestSubmit(); f.requestSubmit(); })()");
}
async function open(entry: string, extra = "") {
  reads.length = 0; passes.length = 0;
  await command("Page.navigate", { url: `${server.url}?entry=${entry}${extra}` });
  await until(() => evaluate("!!document.querySelector('#question')"), "workspace");
}
try {
  let port = "";
  await until(async () => { try { port = (await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]!; return !!port; } catch { return false; } }, "Chrome");
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() as any[];
  socket = new WebSocket(tabs.find(tab => tab.type === "page").webSocketDebuggerUrl);
  socket.onmessage = event => {
    const packet = JSON.parse(String(event.data));
    if(packet.method==='Fetch.requestPaused') {
      widgetRequests++;
      if(holdWidget)widgetLoads.push(packet.params.requestId);
      else void command('Fetch.fulfillRequest',{requestId:packet.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/javascript'}],body:Buffer.from('window.turnstile={render(_container,options){window.fixtureRenders=(window.fixtureRenders||0)+1;window.fixtureChallenge=options;return "fixture-"+window.fixtureRenders},remove(){}};').toString('base64')});
    }
    const waiter = pending.get(packet.id); if (!waiter) return; pending.delete(packet.id); packet.error ? waiter.reject(new Error(packet.error.message)) : waiter.resolve(packet.result);
  };
  await new Promise<void>((resolve, reject) => { socket.onopen = () => resolve(); socket.onerror = () => reject(new Error("Chrome connection")); });
  await command("Page.enable");
  await command('Fetch.enable',{patterns:[{urlPattern:'https://challenges.cloudflare.com/*'}]});
  const exp = Math.floor(Date.now()/1000) + 3600;
  const token = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub:user.id, exp, role:"authenticated" })).toString("base64url")}.fixture`;
  const session = { access_token: token, refresh_token: "fixture", token_type:"bearer", expires_at:exp, user };
  await command("Page.addScriptToEvaluateOnNewDocument", { source: `
    localStorage.clear(); sessionStorage.clear();
    const entry = new URL(location.href).searchParams.get('entry');
    if(entry!=='widget')sessionStorage.setItem("nuelexity:eligibility.v1",JSON.stringify({version:"adults-v1-2026-10-30",adult:true,terms:true,confirmedAt:new Date().toISOString()}));
    if (entry === 'signed') localStorage.setItem('sb-127-auth-token', ${JSON.stringify(JSON.stringify(session))});
    if (entry === 'returning') sessionStorage.setItem('nuelexity.guest-pass.v1', 'v1.fixture.signature');
    if(entry!=='widget')window.turnstile = { render(_container, options) { window.fixtureChallenge = options; return 'fixture'; }, remove() {} };
    if(entry==='widget') {
      const timeout=AbortSignal.timeout.bind(AbortSignal);AbortSignal.timeout=ms=>timeout(ms===8000?80:ms===10000?200:ms);
      const later=window.setTimeout.bind(window);window.setTimeout=(fn,ms,...args)=>later(fn,ms===15000?350:ms,...args);
    }
    if (location.search.includes('timeout=1')) { const original = AbortSignal.timeout.bind(AbortSignal); AbortSignal.timeout = ms => original(ms === 120000 ? 400 : ms); }
  ` });

  for (const entry of ["guest", "returning", "signed"]) {
    ready = false; cold = true; const before = asks, verifiedBefore = exchanges;
    await open(entry); await typeAndSubmit("Waiting " + entry, entry !== 'signed');
    if(entry==='signed') await until(() => evaluate("!!document.querySelector('[aria-label=\"Cancel waiting question\"]')"), "single pending question");
    else assert.ok(await evaluate("!document.querySelector('#question').readOnly&&!document.querySelector('[aria-label=\"Cancel waiting question\"]')"),'guests keep drafting; early Enter/form submission never queues a search');
    assert.equal(asks, before); cold = false; ready = true;
    if (entry === "guest") {
      await until(() => evaluate("!!window.fixtureChallenge"), "challenge after startup");
      await evaluate("window.fixtureChallenge['expired-callback']()");
      await delay(100); assert.equal(exchanges, verifiedBefore);
      await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Retry verification').click()");
      await until(() => evaluate("!!document.querySelector('.bot-check')"), "fresh challenge");
      await evaluate("window.fixtureChallenge.callback('fixture-proof-new'); window.fixtureChallenge.callback('fixture-proof-new')");
    }
    if(entry!=='signed') {
      await until(()=>evaluate("document.querySelector('[aria-label=\"Send question\"]')?.disabled===false"),'pass enables manual send');
      assert.equal(asks,before,'verification does not replay an early submission');
      await typeAndSubmit('Waiting '+entry);
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
    await open(entry); await typeAndSubmit("Cancel " + entry, entry !== 'signed');
    if(entry==='signed') {
      await until(() => evaluate("!!document.querySelector('[aria-label=\"Cancel waiting question\"]')"), "cancel available");
      await evaluate("document.querySelector('[aria-label=\"Cancel waiting question\"]').click()");
    }
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
  await typeAndSubmit("Preserved on startup timeout", true); const beforeTimeout = asks;
  await until(() => evaluate("document.body.innerText.includes('unreachable')"), "bounded unreachable state");
  assert.equal(await evaluate("document.querySelector('#question').value"), "Preserved on startup timeout");
  cold = false; await delay(500); assert.equal(asks, beforeTimeout);
  ready = false; await open("returning", "&timeout=1");
  await typeAndSubmit("Preserved on failed readiness", true);
  await until(() => evaluate("document.body.innerText.includes('not ready for research')"), "application unavailable state");
  assert.equal(await evaluate("document.querySelector('#question').value"), "Preserved on failed readiness");
  assert.ok(!await evaluate("document.body.innerText.includes('Retry verification')"),'readiness failure is distinct from a challenge failure');
  ready=true;
  await evaluate("[...document.querySelectorAll('p[role=status] button')].find(b=>b.textContent.trim()==='Retry').click()");
  await until(()=>evaluate("document.querySelector('[aria-label=\"Send question\"]')?.disabled===false"),'startup retry recovers without refresh');
  assert.equal(await evaluate("document.querySelector('#question').value"),'Preserved on failed readiness');
  assert.equal(asks,beforeTimeout,'retry never submits a retained draft');
  // Fresh eligibility, then the real loader (intercepted locally), with a wake
  // response that outlives its attempt signal while readiness is still pending.
  ready=false;const beforeWidget=asks, beforeExchange=exchanges;
  await command('Page.navigate',{url:server.url+'?entry=widget'});
  await until(()=>evaluate("!!document.querySelector('.eligibility-page')"),'fresh eligibility');
  assert.equal(widgetRequests,0,'no Turnstile on public/eligibility entry');
  await evaluate("document.querySelectorAll('input[type=checkbox]').forEach(i=>i.click());document.querySelector('.eligibility-page form').requestSubmit()");
  await typeAndSubmit('Keep this draft through every retry',true);
  await delay(250);assert.equal(widgetRequests,0,'readiness is a separate starting phase');
  assert.ok(!await evaluate("document.body.innerText.includes('Retry verification')"),'delayed readiness must not surface a fetch-body abort as verification failure');
  ready=true;await until(async()=>widgetLoads.length>0,'automatic widget load after readiness');
  await typeAndSubmit('Keep this draft through every retry',true);
  await until(()=>evaluate("document.body.innerText.includes('security check couldn’t load')"),'bounded script loading failure');
  assert.equal(exchanges,beforeExchange);assert.equal(asks,beforeWidget);
  for(const requestId of widgetLoads.splice(0))await command('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'}).catch(()=>{});
  holdWidget=false;
  const retryVerification=()=>evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Retry verification').click()");
  await retryVerification();await until(()=>evaluate('window.fixtureRenders===1'),'loader retries in place');
  assert.equal(widgetRequests,2,'fresh script request after the failed load');
  assert.equal(await evaluate("document.querySelector('#question').value"),'Keep this draft through every retry');
  await evaluate("window.fixtureChallenge['timeout-callback']()");
  await until(()=>evaluate("document.body.innerText.includes('security challenge timed out')"),'challenge timeout distinct from startup or exchange');
  await retryVerification();await until(()=>evaluate('window.fixtureRenders===2'),'new challenge after timeout');
  hangExchange=true;
  await evaluate("window.fixtureStale=window.fixtureChallenge;window.fixtureChallenge.callback('fixture-proof-consumed');window.fixtureChallenge.callback('fixture-proof-consumed')");
  await until(()=>evaluate("document.body.innerText.includes('verification exchange timed out')"),'exchange timeout after a potentially consumed token');
  await until(async()=>activeExchanges===0,'old exchange is cancelled before retry');
  assert.equal(exchanges,beforeExchange+1,'duplicate callback exchanges only once');
  await typeAndSubmit('Keep this draft through every retry',true);
  await retryVerification();await until(()=>evaluate('window.fixtureRenders===3'),'new challenge without refresh');
  await evaluate("window.fixtureStale.callback('fixture-proof-consumed')");
  assert.equal(exchanges,beforeExchange+1,'late callback from a removed challenge is ignored');
  hangExchange=false;
  await evaluate("window.fixtureChallenge.callback('fixture-proof-retry');window.fixtureChallenge.callback('fixture-proof-retry')");
  await until(()=>evaluate("document.querySelector('[aria-label=\"Send question\"]')?.disabled===false"),'fresh proof yields valid pass');
  assert.equal(asks,beforeWidget,'successful verification never submits the early draft');
  assert.equal(await evaluate("document.querySelector('#question').value"),'Keep this draft through every retry');
  assert.equal(exchanges,beforeExchange+2);assert.equal(maxExchanges,1,'verification attempts never overlap');
  await typeAndSubmit('Keep this draft through every retry');
  await until(async()=>asks===beforeWidget+1,'one deliberate submit with a valid pass');
  console.log("PASS startup UI: cold/warm guest and signed-in startup, buffered wake body, early typing/Enter/form fences, delayed widget load, loader/challenge/exchange failure and fresh-proof retry without refresh/overlap/replay, pass reuse, draft retention, startup retry, cancellation/navigation and no automatic search replay. Local fakes only; zero provider credits.");
} finally {
  socket!?.close(); chrome.kill(); await chrome.exited; server.stop();
  await rm(profile, { recursive: true, force: true, maxRetries:5, retryDelay:100 });
}
