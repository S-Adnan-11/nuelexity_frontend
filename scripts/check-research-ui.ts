import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { strict as assert } from "node:assert";

// Test-only identities and answers; never connect this fixture to real services.
const baseline = process.argv.includes("--baseline");
const dist = process.env.BROWSER_DIST || "dist";
const evidence = process.env.BROWSER_EVIDENCE || "/tmp/nuelexity-research-evidence";
const owner = "11111111-1111-4111-8111-111111111111";
const first = "33333333-3333-4333-8333-333333333333", second = "44444444-4444-4444-8444-444444444444";
const models = [
  { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B", provider: "Groq", preview: false },
  { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B", provider: "Groq", preview: false },
  { id: "qwen/qwen3.8-27b", name: "Qwen 3.8 27B", provider: "Groq", preview: true },
];
const user = { id: owner, aud: "authenticated", role: "authenticated", email: "fixture@example.test", user_metadata: {}, app_metadata: { provider: "google" }, created_at: "now" };
const source = { id: 1, title: "A source with a sufficiently long title to test wrapping", url: "https://example.test/research", snippet: "Fixture" };
const markdown = '## Follow the evidence\n\nA **clear answer** with *emphasis* and a source [1].\n\n- Read the source\n- Ask another question\n\n| Model | Finding |\n| --- | --- |\n| GPT-OSS | A readable result |\n\n```js\nconst sample = "[1]"; // ' + 'x'.repeat(120) + '\n```\n\n<script>window.UNSAFE=true</script>\n\n[unsafe](javascript:alert(1))\n\n![tracking](https://tracker.invalid/pixel)\n\n' + Array.from({length: 10}, (_, i) => `Paragraph ${i+1}: Curiosity starts with a question and continues through the sources.`).join('\n\n');
const answer = (id: string, content: string) => ({ id, role: "assistant", content, sources: [source, { ...source, id: 2, url: "https://a-very-long-source-hostname.example.test/other" }], followUps: ["What should I explore next?"], status: "complete", created_at: "now", model: models[0], answerKind: "ai" });
const thread = (id: string) => ({ id, title: id === first ? "First research thread" : "Second research thread", selected_model: models[1]!.id, created_at: "now", updated_at: "now" });
let listDelay = 850, detailDelay = 1100, listMode = "populated", detailMode = "populated", streamPaused = false;
let configMode = "ready";
let listCount = 0, detailCount = 0, generationCount = 0;
let releaseStream: (() => void) | undefined;
const timeline: { event: string; ms: number }[] = [];
let start = performance.now();
const record = (event: string) => timeline.push({ event, ms: Math.round(performance.now() - start) });
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const server = Bun.serve({ port: 0, hostname: "127.0.0.1", async fetch(req): Promise<Response> {
  const url = new URL(req.url);
  const signed = !!req.headers.get("Authorization");
  const otherAccount = req.headers.get("Authorization")?.endsWith("other-account");
  if (url.pathname === "/config.json" && configMode === "failed") return Response.json({}, {status:503});
  if (url.pathname === "/config.json") return Response.json({ BUN_PUBLIC_BACKEND_URL: server.url.origin, BUN_PUBLIC_SUPABASE_URL: configMode === "missing-auth" ? "" : `${server.url.origin}/supabase`, BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY: configMode === "missing-auth" ? "" : "browser-fixture-key", BUN_PUBLIC_TURNSTILE_SITE_KEY: "" });
  if (url.pathname.startsWith("/supabase/auth/v1/")) {
    if (url.pathname.endsWith("/logout")) return new Response(null, { status: 204 });
    if (url.pathname.endsWith("/token")) { record("auth-refresh-start"); await delay(500); record("auth-refresh-done"); return Response.json(session); }
    return Response.json(user);
  }
  if (url.pathname === "/models") return Response.json({ defaultModelId: models[0]!.id, canSelect: signed, answerMode: "ai", models: models.map((model) => ({...model, available: true, maxInputBytes: 6000, maxOutputTokens: 1024})) });
  if (url.pathname === "/guest/session") return Response.json({ verified: true, verificationRequired: false, expiresAt: Date.now() + 600000 });
  if (url.pathname === "/conversations") {
    const mode = listMode; listCount++; record("library-start"); await delay(listDelay); record("library-done");
    if (mode === "failed") return Response.json({ error: { code: "OFFLINE", message: "Library fixture unavailable." } }, { status: 503 });
    return Response.json({ conversations: mode === "empty" || otherAccount ? [] : [thread(first), thread(second)] });
  }
  if (url.pathname.endsWith("/model")) return Response.json({ selectedModelId: (await req.json()).modelId });
  if (url.pathname.startsWith("/conversations/")) {
    const id = url.pathname.split("/").pop()!, mode = detailMode, wait = detailDelay;
    detailCount++; record(`thread-${id === first ? "A" : "B"}-start`); await delay(wait); record(`thread-${id === first ? "A" : "B"}-done`);
    if (mode === "failed") return Response.json({ error: { code: "OFFLINE", message: "Thread fixture unavailable." } }, { status: 503 });
    return Response.json({ conversation: thread(id), messages: mode === "empty" ? [] : [{ id: "question-"+id, role: "user", content: id === first ? "A long question about curiosity, evidence and how to keep exploring. " + "LongQuestion".repeat(22) : "Second thread question", sources: [], followUps: [], status: "complete", created_at: "now" }, answer(id, id === first ? markdown : "Second thread answer")] });
  }
  if (url.pathname === "/nuelexity_ask") {
    generationCount++;
    const stream = new ReadableStream({ start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      send("meta", { requestId: "fixture", conversationId: signed ? first : null, answerMode: "ai", remaining: 2 });
      send("sources", { sources: [source] });
      send("delta", { text: "A **stream" });
      releaseStream = () => { try { send("delta", { text: "ed answer** [1]." }); send("done", { conversationId: signed ? first : null, model: models[1], answerKind: "ai" }); controller.close(); } catch {} };
      if (!streamPaused) setTimeout(releaseStream, 100);
    }});
    return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
  }
  const name = url.pathname.slice(1);
  const candidate = path.resolve(dist, name);
  const file = candidate.startsWith(path.resolve(dist) + path.sep) ? Bun.file(candidate) : null;
  return new Response(file && await file.exists() ? file : Bun.file(path.join(dist, "index.html")));
}});
const exp = Math.floor(Date.now() / 1000) + 3600;
const token = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: owner, role: "authenticated", aud: "authenticated", exp })).toString("base64url")}.fixture-signature`;
const session = { access_token: token, refresh_token: "fixture-refresh", token_type: "bearer", expires_at: exp, expires_in: 3600, user };
const profile = await mkdtemp(path.join(tmpdir(), "nuelexity-research-browser-"));
const chrome = Bun.spawn([process.env.CHROME_BIN || "/usr/bin/google-chrome", "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdout: "ignore", stderr: "ignore" });
const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
let socket: WebSocket | undefined, sequence = 0;
const command = (method: string, params: Record<string, unknown> = {}) => new Promise<any>((resolve, reject) => {
  const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
  pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject });
  socket!.send(JSON.stringify({ id, method, params }));
});
async function evaluate(expression: string) {
  const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(`Browser expression failed: ${expression.slice(0, 100)}`);
  return result.result.value;
}
async function until(run: () => Promise<boolean>, label: string) {
  const end = Date.now() + 12000;
  while (Date.now() < end) { if (await run()) return; await delay(40); }
  throw new Error(`Timed out: ${label}`);
}
async function shot(name: string) {
  const shot = await command("Page.captureScreenshot", { format: "png" });
  await writeFile(path.join(evidence, name + ".png"), Buffer.from(shot.data, "base64"));
}
const text = (value: string) => evaluate(`(document.body?.innerText.includes(${JSON.stringify(value)}) ?? false)`);
const click = (selector: string) => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
async function open(id: string) { await click(`.thread-row button[title="${id === first ? "First" : "Second"} research thread"]`); }
async function submit() {
  await evaluate(`(() => { const input = document.querySelector('#question'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, 'Explore the evidence'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await until(async () => await evaluate(`document.querySelector('[aria-label="Send question"]')?.disabled === false`), "send enabled");
  await click('[aria-label="Send question"]');
}
try {
  await mkdir(evidence, { recursive: true });
  let port = "";
  await until(async () => { try { port = (await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]!; return !!port; } catch { return false; } }, "Chrome startup");
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() as any[];
  socket = new WebSocket(tabs.find(tab => tab.type === "page").webSocketDebuggerUrl);
  socket.onmessage = message => { const packet = JSON.parse(String(message.data)); const task = pending.get(packet.id); if (!task) return; pending.delete(packet.id); packet.error ? task.reject(new Error(packet.error.message)) : task.resolve(packet.result); };
  await new Promise<void>((resolve, reject) => { socket!.onopen = () => resolve(); socket!.onerror = () => reject(new Error("Chrome connection failed")); });
  await command("Page.enable"); await command("Runtime.enable"); await command("Network.enable");
  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  const injection = await command("Page.addScriptToEvaluateOnNewDocument", { source: `
    if (!sessionStorage.getItem('fixture-booted')) {
      localStorage.setItem('sb-127-auth-token', ${JSON.stringify(JSON.stringify({...session, expires_at: Math.floor(Date.now()/1000)-30}))});
      sessionStorage.setItem('nuelexity:active-thread:${owner}', '${first}');
      sessionStorage.setItem('fixture-booted','1');
    }
    window.fixtureFlashes=[];
    new MutationObserver(() => { if (document.body?.innerText.includes('Your research will appear here.')) window.fixtureFlashes.push(Math.round(performance.now())); if (document.querySelector('.guest-invitation')) window.fixtureGuestFlash=true; }).observe(document, {subtree:true,childList:true});
  ` });
  start = performance.now();
  await command("Page.navigate", { url: `${server.url}dashboard` });
  await until(async () => detailCount > 0, "active conversation request");
  await delay(100);
  record("pending-ui-observed");
  const before: Record<string, any> = { falseEmpty: await text("Your research will appear here."), welcomeDuringRestore: await text("Where curiosity"), guestFlash: await evaluate("!!window.fixtureGuestFlash"), listCount, detailCount };
  await shot(baseline ? "before-refresh-pending" : "refresh-pending");
  await until(async () => await text("Follow the evidence"), "restored answer");
  record("restored-ui");
  if (baseline) {
    await open(second); await delay(100);
    before.staleDuringSwitch = await text("Follow the evidence");
    await writeFile(path.join(evidence,"before-timeline.json"), JSON.stringify({ observations: before, timeline }, null, 2));
    console.log(JSON.stringify({ baseline: before, timeline }));
  } else {
    assert.equal(before.falseEmpty, false); assert.equal(before.welcomeDuringRestore, false); assert.equal(before.guestFlash, false);
    assert.equal(listCount, 1); assert.equal(detailCount, 1);
    assert.equal(await evaluate("document.querySelector('#chat-model').value"), models[1]!.id);
    assert.equal(await evaluate("document.querySelector('.answer-text strong')?.textContent"), "clear answer");
    assert.equal(await evaluate("document.querySelectorAll('.answer-text table').length"), 1);
    assert.equal(await evaluate("document.querySelector('.answer-text pre code').textContent.includes('[1]')"), true);
    assert.equal(await evaluate("!!window.UNSAFE || !!document.querySelector('.answer-text script, .answer-text img, .answer-text a[href^=javascript]')"), false);
    assert.equal(await evaluate("document.querySelectorAll('.citation').length"), 1);
    assert.ok(await evaluate("Array.from(document.images).every(img => img.complete && img.naturalWidth > 0)"));
    const contrast = await evaluate(`(() => {
      const lum = color => { const c=color.match(/[\\d.]+/g).slice(0,3).map(Number).map(v => { v/=255; return v<=.04045?v/12.92:((v+.055)/1.055)**2.4; }); return c[0]*.2126+c[1]*.7152+c[2]*.0722; };
      const check=(selector,property='color')=>{const el=document.querySelector(selector), style=getComputedStyle(el); let bgEl=el, bg=style.backgroundColor; while(bg==='rgba(0, 0, 0, 0)' && bgEl.parentElement){bgEl=bgEl.parentElement; bg=getComputedStyle(bgEl).backgroundColor;} const a=lum(style[property]), b=lum(bg); return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
      return {body:check('.answer-text'), muted:check('.answer-model'), link:check('.citation'), control:check('.composer','borderTopColor')};
    })()`);
    assert.ok(contrast.body >= 4.5 && contrast.muted >= 4.5 && contrast.link >= 4.5 && contrast.control >= 3, JSON.stringify(contrast));
    await writeFile(path.join(evidence,'contrast.json'), JSON.stringify(contrast,null,2));
    await evaluate("document.fonts.ready");
    assert.ok(await evaluate("document.fonts.check('16px Manrope') && document.fonts.check('36px \"DM Serif Display\"')"));
    assert.deepEqual(await evaluate("performance.getEntriesByType('resource').filter(entry => entry.name.startsWith('http') && new URL(entry.name).origin !== location.origin).map(entry => entry.name)"), []);
    await shot("desktop-conversation");
    await evaluate("document.querySelector('.conversation-scroll').scrollTop=100000"); await delay(80);
    assert.ok(await evaluate("document.querySelector('.message.assistant:last-child').getBoundingClientRect().bottom <= document.querySelector('.composer').getBoundingClientRect().top"));
    await shot("desktop-answer-end");
    await command('Browser.grantPermissions',{origin:server.url.origin,permissions:['clipboardReadWrite','clipboardSanitizedWrite']});
    await command('Emulation.setFocusEmulationEnabled', {enabled:true});
    await click('[aria-label="Copy answer"]');
    await until(async () => await evaluate(`!!document.querySelector('[aria-label="Answer copied"]')`), 'copy feedback');
    assert.equal(await evaluate('navigator.clipboard.readText()'),markdown);
    // Same-thread refresh retains the answer and scroll, while another thread clears it immediately.
    await evaluate("document.querySelector('.conversation-scroll').scrollTop=230"); await delay(80);
    await open(first); await delay(80);
    assert.ok(await text("Follow the evidence")); assert.ok(await text("Refreshing conversation"));
    await until(async () => !await text("Refreshing conversation"), "same thread revalidation");
    assert.ok(await evaluate("document.querySelector('.conversation-scroll').scrollTop > 150"));
    await command("Page.reload");
    await until(async () => await text("Follow the evidence"), "authenticated refresh"); await delay(80);
    assert.ok(await evaluate("document.querySelector('.conversation-scroll').scrollTop > 150"));
    detailDelay = 900;
    await open(second); await delay(80);
    assert.equal(await text("Follow the evidence"), false);
    assert.equal(await evaluate("!!document.querySelector('[aria-label=\"Loading conversation\"]')"), true);
    detailDelay = 100; await open(first);
    await until(async () => await text("Follow the evidence"), "switch back wins"); await delay(1000);
    assert.equal(await text("Second thread answer"), false);
    assert.ok(await evaluate("document.querySelector('.conversation-scroll').scrollTop > 150"));
    detailMode = "failed"; await open(second);
    await until(async () => await text("Thread fixture unavailable"), "thread failure"); await shot("thread-failed");
    detailMode = "empty"; await click('.error-notice .text-button');
    await until(async () => await text("This conversation has no messages yet"), "successful empty thread"); await shot("thread-empty");
    detailMode = "populated"; await open(first);
    await until(async () => await text("Follow the evidence"), "thread recovery");
    // Narrow layout, long text/code/tables and keyboard-sized viewport.
    await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await delay(300); assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"));
    await evaluate("document.querySelector('.conversation-scroll').scrollTop=0"); await shot("mobile-conversation");
    await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 430, deviceScaleFactor: 1, mobile: true });
    await evaluate("document.querySelector('#question').focus()"); await delay(100);
    assert.ok(await evaluate("document.querySelector('#question').getBoundingClientRect().bottom < innerHeight"));
    assert.ok(await evaluate("document.querySelector('[aria-label=\"Send question\"]').getBoundingClientRect().bottom <= innerHeight"));
    await shot("mobile-keyboard-sized");
    await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    // Account replacement remounts private state; token renewal keeps current data.
    const renewed = {...session, access_token: token + '-renewed'};
    await evaluate(`(() => { const oldValue=localStorage.getItem('sb-127-auth-token'); const newValue=${JSON.stringify(JSON.stringify(renewed))}; localStorage.setItem('sb-127-auth-token',newValue); const channel=new BroadcastChannel('sb-127-auth-token'); channel.postMessage({event:'SIGNED_IN',session:JSON.parse(newValue)}); setTimeout(()=>channel.close(),100); })()`);
    await delay(80); assert.ok(await text("Follow the evidence")); assert.ok(await text("Refreshing library"));
    detailDelay = 700; await open(second);
    const other = {...session, access_token: token + '.other-account', user: {...user,id:'22222222-2222-4222-8222-222222222222',email:'other@example.test'}};
    await evaluate(`(() => { const oldValue=localStorage.getItem('sb-127-auth-token'); const newValue=${JSON.stringify(JSON.stringify(other))}; localStorage.setItem('sb-127-auth-token',newValue); const channel=new BroadcastChannel('sb-127-auth-token'); channel.postMessage({event:'SIGNED_IN',session:JSON.parse(newValue)}); setTimeout(()=>channel.close(),100); })()`);
    await until(async () => await text('other@example.test'), 'account replacement'); await delay(850);
    assert.equal(await text('Second thread answer'),false); assert.equal(await text('Follow the evidence'),false);
    await evaluate(`(() => { const oldValue=localStorage.getItem('sb-127-auth-token'); const newValue=${JSON.stringify(JSON.stringify(session))}; localStorage.setItem('sb-127-auth-token',newValue); const channel=new BroadcastChannel('sb-127-auth-token'); channel.postMessage({event:'SIGNED_IN',session:JSON.parse(newValue)}); setTimeout(()=>channel.close(),100); })()`);
    await until(async () => await text('First research thread'), 'original account restored');
    // Sign out while a detail fetch is outstanding; its late response must remain private.
    detailDelay = 700; await open(second); await click('[aria-label="Sign out"]');
    await until(async () => await text("Make room for"), "guest invitation after resolved sign-out"); await delay(850);
    assert.equal(await text("Second thread answer"), false); assert.equal(await text("Follow the evidence"), false);
    await shot("guest-home");
    await click('[aria-label="Dismiss sign-in invitation"]'); await command("Page.reload");
    await until(async () => await text("Guest workspace"), "guest reload");
    assert.equal(await evaluate("!!document.querySelector('.guest-invitation')"), false);
    await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    streamPaused = true; await submit();
    await until(async () => await text("A **stream"), "partial Markdown stream"); await shot("streaming-partial");
    releaseStream!(); await until(async () => await text("streamed answer"), "completed Markdown stream");
    assert.ok(await evaluate("document.querySelector('.answer-text strong')?.textContent === 'streamed answer'"));
    streamPaused = true; await submit(); await until(async () => await evaluate("!!document.querySelector('.status-dot')"), "second stream");
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.status-dot')).animationName"), "none");
    await click('[aria-label="Stop search"]'); await until(async () => await text("Search stopped"), "stream cancellation");
    assert.ok(await text("Incomplete"));
    // Initial failed/empty library responses must not pretend to be populated or empty while pending.
    await evaluate(`localStorage.setItem('sb-127-auth-token', ${JSON.stringify(JSON.stringify(session))}); sessionStorage.removeItem('nuelexity:active-thread:${owner}')`);
    listMode = "failed"; listDelay = 100; await command("Page.reload");
    await until(async () => await text("Library fixture unavailable"), "library failure"); await shot("library-failed");
    listMode = "empty"; await click('.sidebar-note .text-button');
    await until(async () => await text("Your research will appear here."), "successful empty library"); await shot("library-empty");
    listMode = "populated"; await command("Page.reload");
    await until(async () => await text("First research thread"), "library populated");
    // Only the allowed OAuth buttons are present, and both invoke Supabase PKCE.
    await click('[aria-label="Sign out"]');
    await until(async () => await text("Guest workspace"), "guest reset");
    await evaluate("sessionStorage.removeItem('nuelexity:guest-invitation-dismissed')"); await command("Page.reload");
    await until(async () => await text("Make room for"), "guest card reset");
    await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await delay(300); assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth")); await shot("mobile-guest-card");
    assert.ok(await evaluate("document.querySelector('.dismiss-invitation').getBoundingClientRect().top >= document.querySelector('.guest-invitation').getBoundingClientRect().top"));
    await command('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true});
    await evaluate("document.querySelector('#question').focus()"); await delay(150);
    assert.ok(await evaluate("document.querySelector('[aria-label=\"Send question\"]').getBoundingClientRect().bottom <= innerHeight"));
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.guest-invitation')).display"),'none');
    await shot('narrow-guest-composing');
    await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await command("Page.navigate", { url: `${server.url}auth` });
    await until(async () => await text("Continue with Google"), "auth page"); await shot("auth");
    await command("Fetch.enable", { patterns: [{ urlPattern: "*/supabase/auth/v1/authorize*", requestStage: "Request" }] });
    const oauth: string[] = [];
    const original = socket.onmessage!;
    socket.onmessage = message => {
      const packet = JSON.parse(String(message.data));
      if (packet.method === "Fetch.requestPaused") {
        oauth.push(packet.params.request.url);
        void command("Fetch.failRequest", { requestId: packet.params.requestId, errorReason: "Aborted" });
      } else original.call(socket!, message);
    };
    await click('.oauth-button'); await until(async () => oauth.length === 1, "Google OAuth action");
    assert.equal(new URL(oauth[0]!).searchParams.get("provider"), "google");
    assert.equal(new URL(oauth[0]!).searchParams.get("redirect_to"), `${server.url.origin}/auth/callback`);
    await command("Page.navigate", { url: `${server.url}auth` }); await until(async () => await text("Continue with GitHub"), "auth reset");
    await click('.oauth-button + .oauth-button'); await until(async () => oauth.length === 2, "GitHub OAuth action");
    assert.equal(new URL(oauth[1]!).searchParams.get("provider"), "github");
    await command("Page.navigate", { url: `${server.url}auth/callback?error=access_denied` });
    await until(async () => await text("Sign-in wasn't completed"), "callback error"); await shot("auth-error");
    configMode = 'failed'; await command('Page.navigate',{url:`${server.url}dashboard`});
    await until(async () => await text("Nuelexity couldn't start"),'configuration failure'); await shot('configuration-failed');
    configMode = 'missing-auth'; await command('Page.navigate',{url:`${server.url}auth`});
    await until(async () => await text('Sign-in setup is incomplete'),'unconfigured auth'); await shot('auth-unconfigured');
    configMode = 'ready';
    await writeFile(path.join(evidence,"after-timeline.json"), JSON.stringify({ observations: before, timeline, listCount, detailCount, generationCount }, null, 2));
    console.log("PASS research browser: delayed auth/refresh, pending/failed/empty states, same-user revalidation/scroll, thread races, sign-out during load, guest dismissal, Google/GitHub OAuth, Markdown/stream/cancel, mobile/keyboard-sized viewport, reduced motion and asset loads. All services mocked.");
    console.log(JSON.stringify({ timeline: timeline.slice(0, 7), evidence, generationCount }));
  }
  await command("Page.removeScriptToEvaluateOnNewDocument", { identifier: injection.identifier });
} finally {
  socket?.close(); chrome.kill(); await chrome.exited; server.stop(true); await rm(profile, { recursive: true, force: true });
}
