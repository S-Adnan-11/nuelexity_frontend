import { serveFixture, staticResponse, launchChrome } from "./http-fixture";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { strict as assert } from "node:assert";

// Test-only identities and answers; never connect this fixture to real services.
const baseline = process.argv.includes("--baseline");
const dist = process.env.BROWSER_DIST || "dist";
const evidence = process.env.BROWSER_EVIDENCE || path.join(tmpdir(), "nuelexity-research-evidence");
const rsaQuestions = ["Can you walk me through RSA key generation with small numbers?", "Why does RSA decryption recover the original message?", "How does factoring the modulus help reveal the private key?"];
const owner = "11111111-1111-4111-8111-111111111111";
const first = "33333333-3333-4333-8333-333333333333", second = "44444444-4444-4444-8444-444444444444";
const models = [
  { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B", provider: "Groq", preview: false },
  { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B", provider: "Groq", preview: false },
  { id: "qwen/qwen3.8-27b", name: "Qwen 3.8 27B", provider: "Groq", preview: true },
];
const user = { id: owner, aud: "authenticated", role: "authenticated", email: "fixture@example.test", user_metadata: {}, app_metadata: { provider: "google" }, created_at: "now" };
const source = { id: 1, title: "A source with a sufficiently long title to test wrapping", url: "https://example.test/research", snippet: "Fixture" };
const markdown = '## Follow the evidence\n\nA **clear answer** with *emphasis* and a source [1].\n\n- Read the source\n- Ask another question\n\n| Model | Finding | Evidence | Context | Date | Scope | Method | Notes |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n| GPT-OSS | A readable result | Sources | Research | Today | Bounded | Search | Check sources |\n\n```js\nconst sample = "[1]"; // ' + 'x'.repeat(120) + '\n```\n\n<script>window.UNSAFE=true</script>\n\n[unsafe](javascript:alert(1))\n\n![tracking](https://tracker.invalid/pixel)\n\n' + Array.from({length: 10}, (_, i) => `Paragraph ${i+1}: Curiosity starts with a question and continues through the sources.`).join('\n\n');
const rsaAnswer = "## RSA: the math in three steps\n\nRSA connects prime numbers with modular arithmetic. The public key encrypts a message; the private key recovers it [1].\n\n### 1. Build the keys\n\nChoose two distinct primes, **p** and **q**, and compute **n = p × q**. Choose a public exponent **e** that is coprime to (p − 1)(q − 1). The private exponent **d** is its modular inverse [1].\n\n### 2. Encrypt and decrypt\n\nEncryption computes `c = m^e mod n`. Decryption computes `m = c^d mod n`. The relationship between e and d makes these operations undo each other [1].\n\n### 3. Understand the hard part\n\nKnowing the prime factors lets you calculate the private key. Recovering those factors from a sufficiently large modulus is the difficult step [1].\n\nReal systems also need secure padding and appropriate key sizes. Small examples are useful for learning, but are insecure.";
const answer = (id: string, content: string) => ({ id, role: "assistant", content, sources: [source, { ...source, id: 2, url: "https://a-very-long-source-hostname.example.test/other" }], followUps: ["What should I explore next?"], status: "complete", created_at: "now", model: models[0], answerKind: "ai" });
const thread = (id: string) => ({ id, title: id === first ? "First research thread" : id === second ? "Second research thread" : `Older research ${id.slice(-4)}`, selected_model: models[1]!.id, created_at: "now", updated_at: "now" });
const olderIds = Array.from({ length: 63 }, (_, index) => `55555555-5555-4555-8555-${String(index).padStart(12, "0")}`);
const pagedIds = [first, second, ...olderIds];
// An overlapping row models history reordering between offset requests.
pagedIds.splice(30, 0, pagedIds[29]!);
const removedIds = new Set<string>();
const offsets: number[] = [];
let failOlder = false, deleteDelay = 0;
let listDelay = 850, detailDelay = 1100, listMode = "populated", detailMode = "populated", streamPaused = false;
let configMode = "ready";
let listCount = 0, detailCount = 0, generationCount = 0;
let abortedStreams = 0;
let releaseStream: (() => void) | undefined;
let appendStream: ((text: string) => void) | undefined;
let unavailableModel = "";
const timeline: { event: string; ms: number }[] = [];
let start = performance.now();
const record = (event: string) => timeline.push({ event, ms: Math.round(performance.now() - start) });
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const server = await serveFixture(async (req): Promise<Response> => {
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
  if (url.pathname === "/models") return Response.json({ defaultModelId: models[0]!.id, canSelect: signed, answerMode: "ai", models: models.map((model) => ({...model, available: model.id !== unavailableModel, unavailableReason: model.id === unavailableModel ? "Temporarily unavailable from the provider" : undefined, maxInputBytes: 6000, maxOutputTokens: 1024})) });
  if (url.pathname === "/guest/session") return Response.json({ verified: true, verificationRequired: false, expiresAt: Date.now() + 600000 });
  if (url.pathname === "/conversations") {
    const offset = Number(url.searchParams.get("offset") || 0); offsets.push(offset);
    const mode = listMode; listCount++; record("library-start"); await delay(listDelay); record("library-done");
    if (mode === "failed") return Response.json({ error: { code: "OFFLINE", message: "Library fixture unavailable." } }, { status: 503 });
    if (mode === "paged" && failOlder && offset === 30) return Response.json({ error: { code: "OFFLINE", message: "Older threads fixture unavailable." } }, { status: 503 });
    if (mode === "paged" && !otherAccount) return Response.json({ conversations: pagedIds.filter(id => !removedIds.has(id)).slice(offset, offset + 30).map(thread) });
    return Response.json({ conversations: mode === "empty" || otherAccount ? [] : [thread(first), thread(second)] });
  }
  if (url.pathname.endsWith("/model")) return Response.json({ selectedModelId: (await req.json()).modelId });
  if (url.pathname.startsWith("/conversations/")) {
    const id = url.pathname.split("/").pop()!, mode = detailMode, wait = detailDelay;
    if (req.method === "DELETE") { await delay(deleteDelay); removedIds.add(id); return new Response(null, { status: 204 }); }
    detailCount++; record(`thread-${id === first ? "A" : "B"}-start`); await delay(wait); record(`thread-${id === first ? "A" : "B"}-done`);
    if (otherAccount || removedIds.has(id)) return Response.json({ error: { code: "NOT_FOUND", message: "Conversation not found." } }, { status: 404 });
    if (mode === "failed") return Response.json({ error: { code: "OFFLINE", message: "Thread fixture unavailable." } }, { status: 503 });
    if(mode === "rsa") return Response.json({conversation:thread(id),messages:[{id:'rsa-question',role:'user',content:'What is the mathematics behind RSA?',sources:[],followUps:[],status:'complete',created_at:'now'}, {...answer('rsa-answer',rsaAnswer),followUps:rsaQuestions,model:models[2],sources:[{id:1,title:'The mathematics behind RSA',url:'https://example.test/rsa',snippet:'A fictional test source'}]}]});
    return Response.json({ conversation: thread(id), messages: mode === "empty" ? [] : [{ id: "question-"+id, role: "user", content: id === first ? "A long question about curiosity, evidence and how to keep exploring. " + "LongQuestion".repeat(22) : "Second thread question", sources: [], followUps: [], status: "complete", created_at: "now" }, answer(id, id === first ? markdown : "Second thread answer")] });
  }
  if (url.pathname === "/nuelexity_ask") {
    generationCount++;
    req.signal.addEventListener("abort", () => abortedStreams++, { once: true });
    const request = await req.json();
    const scrolling = request.query === "RSA streaming verification";
    const stream = new ReadableStream({ start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      send("meta", { requestId: "fixture", conversationId: signed ? first : null, answerMode: "ai", remaining: 2 });
      send("sources", { sources: [source] });
      appendStream = text => send("delta", {text});
      send("delta", { text: scrolling ? "RSA key generation uses prime factors and modular arithmetic [1].\n\n" + "A grounded RSA explanation.\n\n".repeat(80) : "A **stream" });
      releaseStream = () => { try { send("delta", { text: scrolling ? "A completed RSA explanation." : "ed answer** [1]." }); if(scrolling) send("follow_ups", {questions:rsaQuestions}); send("done", { conversationId: signed ? first : null, model: models[1], answerKind: "ai" }); controller.close(); } catch {} };
      if (!streamPaused) setTimeout(releaseStream, 100);
    }});
    return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
  }
  return staticResponse(dist, url.pathname);
});
const exp = Math.floor(Date.now() / 1000) + 3600;
const token = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: owner, role: "authenticated", aud: "authenticated", exp })).toString("base64url")}.fixture-signature`;
const session = { access_token: token, refresh_token: "fixture-refresh", token_type: "bearer", expires_at: exp, expires_in: 3600, user };
const profile = await mkdtemp(path.join(tmpdir(), "nuelexity-research-browser-"));
const chrome = launchChrome(profile);
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
async function key(key: string) {
  const code=({Enter:13,ArrowDown:40,ArrowUp:38,Escape:27,Home:36,End:35,Tab:9} as Record<string,number>)[key] ?? 0;
  await command('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:code});
  await command('Input.dispatchKeyEvent',{type:'keyUp',key,code:key});
  await delay(60);
}
async function open(id: string) { await click(`.thread-row a[href="/dashboard/${id}"]`); }
async function submit(question = "Explore the evidence") {
  await evaluate(`(() => { const input = document.querySelector('#question'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, ${JSON.stringify(question)}); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
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
    const layout = await evaluate(`(() => {
      const pane=document.querySelector('.research-main').getBoundingClientRect(), scroll=document.querySelector('.conversation-scroll'), column=document.querySelector('.messages').getBoundingClientRect(), composer=document.querySelector('.composer').getBoundingClientRect();
      return {paneRight:pane.right,scrollRight:scroll.getBoundingClientRect().right,readingWidth:column.width,composerWidth:composer.width,columnLeft:column.left,composerLeft:composer.left,nested:getComputedStyle(document.querySelector('.reading-column')).overflowY,composerHeight:composer.height};
    })()`);
    assert.ok(Math.abs(layout.paneRight-layout.scrollRight)<1,JSON.stringify(layout));
    assert.ok(layout.readingWidth>=830 && layout.readingWidth<=880,JSON.stringify(layout));
    assert.ok(Math.abs(layout.readingWidth-layout.composerWidth)<1 && Math.abs(layout.columnLeft-layout.composerLeft)<=1,JSON.stringify(layout));
    assert.ok(await evaluate("(()=>{const table=document.querySelector('.table-scroll'),code=document.querySelector('.answer-text pre');return table.scrollWidth>table.clientWidth && code.scrollWidth>code.clientWidth && document.documentElement.scrollWidth<=innerWidth;})()"));
    assert.equal(layout.nested,'visible'); assert.ok(layout.composerHeight<140,JSON.stringify(layout));
    await writeFile(path.join(evidence,'layout.json'),JSON.stringify(layout,null,2));
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
    // Stream following respects the reader's position and suggestions submit once.
    streamPaused=true; await submit('RSA streaming verification');
    await until(async()=>await text('RSA key generation'),'RSA stream started');
    await evaluate("document.querySelector('.conversation-scroll').scrollTop=0"); await delay(100);
    appendStream!('More RSA context.\n\n'.repeat(30)); await delay(100);
    assert.ok(await evaluate("document.querySelector('.conversation-scroll').scrollTop < 5"));
    await evaluate("document.querySelector('.conversation-scroll').scrollTop=100000"); await delay(100);
    appendStream!('More modular arithmetic.\n\n'.repeat(30)); await delay(100);
    assert.ok(await evaluate("(()=>{const s=document.querySelector('.conversation-scroll');return s.scrollHeight-s.scrollTop-s.clientHeight<20})()"));
    releaseStream!(); await until(async()=>await evaluate("!document.querySelector('[aria-label=\"Stop search\"]')"),'RSA complete');
    assert.ok(await text(rsaQuestions[0]!));
    assert.equal(await evaluate("Array.from(document.querySelectorAll('.answer-model')).some(el=>/Groq|Served by|via /i.test(el.textContent))"),false);
    await delay(100); await shot('contextual-follow-ups');
    const previousGenerations=generationCount;
    await evaluate("(()=>{const button=Array.from(document.querySelectorAll('.follow-ups button')).find(b=>b.textContent.includes('RSA key generation'));button.click();button.click();})()");
    await until(async()=>generationCount>previousGenerations,'suggestion submission');
    assert.equal(generationCount,previousGenerations+1); releaseStream!();
    await until(async()=>await evaluate("!document.querySelector('[aria-label=\"Stop search\"]')"),'suggestion answer complete');
    await open(first); await until(async()=>await text('Follow the evidence'),'restore after stream verification');
    // Representative app screenshots use a clearly fictional RSA response fixture.
    detailMode='rsa'; await open(first); await until(async()=>await text('RSA: the math in three steps'),'RSA history fixture');
    await evaluate("document.querySelector('.conversation-scroll').scrollTop=0"); await shot('desktop-rsa');
    await evaluate("document.querySelector('#chat-model').focus()"); await key('Enter');
    await until(async()=>await evaluate("!!document.querySelector('[role=listbox]')"),'desktop model menu');
    await shot('desktop-model-menu'); await key('Escape');
    await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true}); await delay(300);
    await shot('mobile-rsa');
    await evaluate("document.querySelector('#chat-model').focus()"); await key('Enter');
    await until(async()=>await evaluate("!!document.querySelector('[role=listbox]')"),'mobile model menu'); await shot('mobile-model-menu'); await key('Escape');
    detailMode='populated'; await open(first); await until(async()=>await text('Follow the evidence'),'restore general fixture');
    // Narrow layout, long text/code/tables and keyboard-sized viewport.
    await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await delay(300); assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"));
    await evaluate("document.querySelector('.conversation-scroll').scrollTop=0"); await shot("mobile-conversation");
    await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 430, deviceScaleFactor: 1, mobile: true });
    await evaluate("document.querySelector('#question').focus()"); await delay(100);
    assert.ok(await evaluate("document.querySelector('#question').getBoundingClientRect().bottom < innerHeight"));
    assert.ok(await evaluate("document.querySelector('[aria-label=\"Send question\"]').getBoundingClientRect().bottom <= innerHeight"));
    await shot("mobile-keyboard-sized");
    await evaluate("document.querySelector('#chat-model').focus()"); await key('Enter');
    await until(async()=>await evaluate("!!document.querySelector('[role=listbox]')"),'keyboard-sized model menu');
    assert.ok(await evaluate("(()=>{const m=document.querySelector('.model-menu').getBoundingClientRect(),t=document.querySelector('#chat-model').getBoundingClientRect();return m.top>=0 && m.bottom<=t.top && m.right<=innerWidth})()"));
    await shot('mobile-keyboard-model-menu'); await key('Escape');
    await evaluate("document.querySelector('#question').focus()");
    const initialHeight=await evaluate("document.querySelector('#question').clientHeight");
    await evaluate(`(()=>{const i=document.querySelector('#question');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(i,${JSON.stringify('A long draft\n'.repeat(45))});i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    assert.ok(await evaluate(`document.querySelector('#question').clientHeight > ${initialHeight} && document.querySelector('#question').clientHeight <= 181`));
    assert.equal(await evaluate("getComputedStyle(document.querySelector('#question')).resize"),'none');
    assert.ok(await evaluate("document.querySelector('#question').scrollHeight > document.querySelector('#question').clientHeight && document.querySelector('[aria-label=\"Send question\"]').getBoundingClientRect().bottom <= innerHeight"));
    const beforeIme=generationCount;
    await evaluate("document.querySelector('#question').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true}))");
    assert.equal(generationCount,beforeIme);
    await evaluate("(()=>{const i=document.querySelector('#question');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(i,'');i.dispatchEvent(new Event('input',{bubbles:true}));})()");
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
    // A direct URL beats the old tab pointer. Pagination preserves visible rows,
    // retries only the failed page and advances by raw rows despite overlap.
    listMode = "paged"; listDelay = 180; detailDelay = 120; offsets.length = 0;
    await command("Page.navigate", { url: `${server.url}dashboard/${second}` });
    await until(async () => await text("Second thread answer") && await evaluate("document.querySelectorAll('.thread-row').length === 30"), "direct thread URL and first library page");
    assert.equal(await evaluate("location.pathname"), `/dashboard/${second}`);
    assert.equal(await evaluate("document.querySelector('.thread-row a[aria-current=page]').getAttribute('href')"), `/dashboard/${second}`);
    const more = '.library-pagination button';
    failOlder = true; await click(more);
    await until(async () => await text("Older threads fixture unavailable"), "older-page failure");
    assert.equal(await evaluate("document.querySelectorAll('.thread-row').length"), 30);
    assert.equal(offsets.at(-1), 30);
    failOlder = false;
    const beforeRetry = offsets.length;
    await evaluate(`document.querySelector('${more}').click();document.querySelector('${more}').click()`);
    await until(async () => await evaluate("document.querySelectorAll('.thread-row').length === 59"), "deduplicated older page");
    assert.equal(offsets.length, beforeRetry + 1, "rapid activation fetches one page");
    assert.equal(offsets.at(-1), 30, "failure does not advance the offset");
    await click(more);
    await until(async () => await evaluate("document.querySelectorAll('.thread-row').length === 65"), "final older page");
    assert.equal(offsets.at(-1), 60, "overlap does not rewind the offset");
    assert.equal(await evaluate("!!document.querySelector('.library-pagination')"), false);
    await evaluate("document.querySelector('.thread-list').scrollTop=900");
    const refreshStart = offsets.length;
    await evaluate(`(()=>{const channel=new BroadcastChannel('sb-127-auth-token');channel.postMessage({event:'SIGNED_IN',session:${JSON.stringify({...session, access_token: token + '-library'})}});setTimeout(()=>channel.close(),100);})()`);
    await until(async () => await text("Refreshing library"), "loaded pages revalidation");
    assert.equal(await evaluate("document.querySelectorAll('.thread-row').length"), 65);
    await until(async () => !await text("Refreshing library"), "all loaded pages refreshed");
    assert.deepEqual(offsets.slice(refreshStart), [0, 30, 60]);
    assert.ok(await evaluate("document.querySelector('.thread-list').scrollTop > 500"));
    await shot("paginated-library");
    await open(olderIds.at(-1)!);
    await until(async () => await evaluate(`location.pathname === '/dashboard/${olderIds.at(-1)}' && !document.querySelector('[aria-label="Loading conversation"]')`), "open older-page thread");
    await open(first); await until(async () => await text("Follow the evidence"), "first route");
    await evaluate("document.querySelector('.conversation-scroll').scrollTop=230"); await delay(80);
    await open(second); await until(async () => await text("Second thread answer"), "second route");
    await evaluate("history.back()");
    await until(async () => await evaluate(`location.pathname === '/dashboard/${first}'`) && await text("Follow the evidence"), "browser back restores first thread");
    assert.ok(await evaluate("document.querySelector('.conversation-scroll').scrollTop > 150"));
    await evaluate("history.forward()");
    await until(async () => await evaluate(`location.pathname === '/dashboard/${second}'`) && await text("Second thread answer"), "browser forward restores second thread");
    await click('.new-search');
    await until(async () => await evaluate("location.pathname === '/dashboard' && !document.querySelector('.messages')"), "new search has its own history entry");
    await evaluate("history.back()");
    await until(async () => await text("Second thread answer"), "back from new search");
    await command("Page.reload");
    await until(async () => await text("Second thread answer"), "direct URL refresh");
    const beforeInvalid = detailCount;
    await command("Page.navigate", { url: `${server.url}dashboard/not-a-thread` });
    await until(async () => await text("This conversation URL is invalid"), "invalid URL state");
    assert.equal(detailCount, beforeInvalid);
    assert.equal(await evaluate("!!document.querySelector('.messages')"), false);
    const missing = "66666666-6666-4666-8666-666666666666";
    removedIds.add(missing);
    await command("Page.navigate", { url: `${server.url}dashboard/${missing}` });
    await until(async () => await text("Conversation not found"), "missing/private thread state");
    assert.equal(await evaluate("!!document.querySelector('.messages')"), false);
    await click('.new-search');
    await until(async () => await evaluate("document.querySelector('.suggestion-list button')?.disabled === false"), "home ready after missing thread");
    const beforeStreamDetail = detailCount, beforeAbort = abortedStreams;
    streamPaused = true; await submit('RSA streaming verification');
    await until(async () => await text('RSA key generation') && await evaluate(`location.pathname === '/dashboard/${first}'`), 'new answer receives a thread URL');
    assert.equal(detailCount, beforeStreamDetail, "assigning a URL must preserve the running answer");
    await evaluate("history.back()");
    await until(async () => await evaluate("location.pathname === '/dashboard' && !document.querySelector('.messages')"), "back cancels streaming");
    await until(async () => abortedStreams > beforeAbort, "navigation abort reaches the server");
    releaseStream!(); await delay(200);
    assert.equal(await evaluate("!!document.querySelector('.messages')"), false);
    await evaluate("history.forward()");
    await until(async () => await text("Follow the evidence"), "forward loads the saved thread instead of stale stream updates");
    await evaluate("window.confirm=()=>true");
    await click(`[aria-label="Delete First research thread"]`);
    await until(async () => await evaluate("location.pathname === '/dashboard'") && !await text("First research thread"), "deleting active thread returns home");
    await evaluate("history.back()");
    await until(async () => await text("Conversation not found"), "back to a deleted thread is recoverable");
    await click('.new-search');
    // Deletion may finish after navigating into the thread from the home route.
    deleteDelay = 650;
    await click('[aria-label="Delete Older research 0000"]');
    await open(olderIds[0]!);
    await until(async () => await evaluate(`location.pathname === '/dashboard/${olderIds[0]}'`) && await text('Second thread answer'), "open a thread while deletion is pending");
    await until(async () => await evaluate("location.pathname === '/dashboard' && !document.querySelector('.messages')"), "late deletion also clears the current URL");
    deleteDelay = 0;
    await until(async () => await evaluate("!!document.querySelector('.library-pagination button:not(:disabled)')"), "library ready before sign-out race");
    listDelay = 650; await click(more);
    // Only the allowed OAuth buttons are present, and both invoke Supabase PKCE.
    await click('[aria-label="Sign out"]');
    await until(async () => await text("Guest workspace"), "guest reset");
    await delay(800);
    assert.equal(await evaluate("document.querySelectorAll('.thread-row').length"), 0, "late older-page response stays private");
    const guestDetailCount = detailCount;
    await command("Page.navigate", { url: `${server.url}dashboard/${second}` });
    await until(async () => await text("Sign in to open a saved conversation"), "signed-out private URL");
    assert.equal(detailCount, guestDetailCount, "guest URLs never request private history");
    await click('.error-notice a');
    await until(async () => await text('Continue with Google'), "sign-in from private URL");
    assert.equal(await evaluate("sessionStorage.getItem('nuelexity:sign-in-thread')"), second);
    await evaluate(`localStorage.setItem('sb-127-auth-token', ${JSON.stringify(JSON.stringify(session))})`);
    await command("Page.navigate", { url: `${server.url}auth/callback` });
    await until(async () => await evaluate(`location.pathname === '/dashboard/${second}'`) && await text('Second thread answer'), "OAuth return resumes the requested private URL");
    assert.equal(await evaluate("sessionStorage.getItem('nuelexity:sign-in-thread')"), null);
    await click('[aria-label="Sign out"]');
    await until(async () => await text("Guest workspace"), "guest after private URL sign-in");
    await click('.new-search');
    await until(async () => await evaluate("location.pathname === '/dashboard'"), "guest private-URL recovery");
    await evaluate("sessionStorage.removeItem('nuelexity:guest-invitation-dismissed')"); await command("Page.reload");
    await until(async () => await text("Make room for"), "guest card reset");
    await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await delay(300); assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth")); await shot("mobile-guest-card");
    await evaluate("document.querySelector('#chat-model').focus()"); await key('Enter');
    await until(async()=>await evaluate("!!document.querySelector('[role=listbox]')"),'guest menu opens');
    assert.equal(await evaluate("document.querySelectorAll('[data-locked=true]').length"),2);
    const beforeLocked=generationCount;
    await key('Home'); await key('ArrowDown'); await key('Enter');
    assert.equal(await evaluate("document.querySelector('#chat-model').value"),models[0]!.id);
    assert.equal(generationCount,beforeLocked);
    assert.ok(await evaluate("!!document.querySelector('[role=listbox]')"));
    assert.ok(await evaluate("(()=>{const m=document.querySelector('.model-menu').getBoundingClientRect(),t=document.querySelector('#chat-model').getBoundingClientRect();return m.bottom<=t.top && m.left>=0 && m.right<=innerWidth})()"));
    await shot('guest-model-padlocks'); await key('Escape');
    assert.equal(await evaluate("document.activeElement.id"),'chat-model');
    await key('Enter'); await until(async()=>await evaluate("!!document.querySelector('[role=listbox]')"),'guest menu for sign in');
    await key('End'); await key('Enter'); await until(async()=>await text('Continue with Google'),'menu sign-in action');
    assert.equal(generationCount,beforeLocked);
    await command('Page.navigate',{url:`${server.url}dashboard`}); await until(async()=>await text('Make room for'),'return to guest');
    unavailableModel=models[2]!.id; await command('Page.reload');
    await until(async()=>await evaluate("document.querySelector('#chat-model')?.disabled === false"),'guest catalogue with unavailable model');
    await evaluate("document.querySelector('#chat-model').focus()"); await key('Enter');
    await until(async()=>await evaluate("!!document.querySelector('[data-unavailable=true]')"),'unavailable model distinct from auth lock');
    assert.ok(await text('Temporarily unavailable from the provider')); await shot('guest-model-unavailable'); await key('Escape');
    unavailableModel='';

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
    console.log("PASS research browser: paginated library/retries/overlap/refresh, direct thread URLs, back/forward/scroll, invalid/deleted/guest URLs, navigation abort, account isolation, auth/loading races, Markdown, mobile/keyboard viewports and OAuth wiring. All services mocked.");
    console.log(JSON.stringify({ timeline: timeline.slice(0, 7), evidence, generationCount }));
  }
  await command("Page.removeScriptToEvaluateOnNewDocument", { identifier: injection.identifier });
} finally {
  socket?.close(); chrome.kill(); await chrome.exited; server.stop(); await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
