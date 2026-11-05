import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { launchChrome, serveFixture, staticResponse } from "./http-fixture";

// Inspect the built page with external requests blocked, including link activation.
const evidence = path.resolve(process.env.BROWSER_EVIDENCE || "docs/evidence/about-details-2026-11-03");
await mkdir(evidence, { recursive: true });
const external: string[] = [], failures: string[] = [], layouts: object[] = [];
const server = await serveFixture(async req => {
  const url = new URL(req.url);
  if (url.pathname === "/config.json") return Response.json({ BUN_PUBLIC_BACKEND_URL: server.url.origin, BUN_PUBLIC_SUPABASE_URL: server.url.origin + "/supabase", BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-key", BUN_PUBLIC_TURNSTILE_SITE_KEY: "" });
  if (/^\/(models|ready|health|guest|conversations|nuelexity_ask|supabase)(\/|$)/.test(url.pathname)) { failures.push(url.pathname); return new Response(null, { status: 500 }); }
  return staticResponse("dist", url.pathname);
});
const profile = await mkdtemp("/tmp/nuelexity-about-details-");
const chrome = launchChrome(profile);
let socket: WebSocket | undefined, sequence = 0, commits = 0;
const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
function send(method: string, params: any = {}) {
  return new Promise<any>((resolve, reject) => {
    const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(new Error("CDP timeout: " + method)); }, 15000);
    pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
    socket!.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression: string) {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error("Browser expression failed: " + expression.slice(0, 120));
  return result.result.value;
}
async function until(fn: () => Promise<unknown>, label: string) {
  for (let i = 0; i < 180; i++) { if (await fn()) return; await delay(60); }
  throw new Error("Timed out: " + label);
}
async function key(key: string, code = key, modifiers = 0) {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, modifiers });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, modifiers });
}
async function shot(name: string, full = false) {
  const metrics = full ? await send("Page.getLayoutMetrics") : null;
  const result = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: full,
    ...(metrics ? { clip: { x: 0, y: 0, width: metrics.cssContentSize.width, height: metrics.cssContentSize.height, scale: 1 } } : {}) });
  await writeFile(path.join(evidence, name + ".png"), Buffer.from(result.data, "base64"));
}
try {
  let port = "";
  await until(async () => { try { port = (await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]!; return port; } catch { return false; } }, "Chrome");
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() as any[];
  socket = new WebSocket(tabs.find(tab => tab.type === "page").webSocketDebuggerUrl);
  socket.onmessage = event => {
    const packet = JSON.parse(String(event.data));
    if (packet.method === "Page.frameNavigated" && !packet.params.frame.parentId) commits++;
    if (packet.method === "Runtime.exceptionThrown") failures.push("Uncaught browser exception");
    if (packet.method === "Fetch.requestPaused") {
      const url = new URL(packet.params.request.url);
      if (url.origin !== server.url.origin) { external.push(url.origin); void send("Fetch.failRequest", { requestId: packet.params.requestId, errorReason: "BlockedByClient" }); }
      else void send("Fetch.continueRequest", { requestId: packet.params.requestId });
    }
    const waiter = pending.get(packet.id);
    if (waiter) { pending.delete(packet.id); packet.error ? waiter.reject(new Error(packet.error.message)) : waiter.resolve(packet.result); }
  };
  await new Promise<void>(resolve => { socket!.onopen = () => resolve(); });
  await send("Page.enable"); await send("Runtime.enable"); await send("Accessibility.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  for (const width of [390, 1440, 1920]) for (const theme of ["dark", "light"]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: width < 800 ? 844 : 1000, deviceScaleFactor: 1, mobile: width < 800 });
    const before = commits;
    await send("Page.navigate", { url: new URL("/about", server.url).href });
    await until(async () => commits > before, "navigation");
    await until(() => evaluate("!!document.querySelector('.developer-link') && !!document.querySelector('.demo-window-title')"), "About details rendered");
    await evaluate(`document.documentElement.dataset.theme='${theme}';document.fonts.ready`);
    await delay(150);
    const frame = await evaluate(`(()=>{
      const bar=document.querySelector('.demo-titlebar'),title=document.querySelector('.demo-window-title'),dots=document.querySelector('.window-dots');
      const b=bar.getBoundingClientRect(),t=title.getBoundingClientRect(),w=document.querySelector('.demo-window').getBoundingClientRect();
      return {title:title.innerText,centerError:Math.abs(t.x+t.width/2-b.x-b.width/2),height:b.height,width:w.width,
        dots:[...dots.children].map(dot=>getComputedStyle(dot).backgroundColor),decorative:dots.getAttribute('aria-hidden')==='true',
        stationary:!bar.closest('.demo-playback'),inert:document.querySelector('.demo-window').inert,
        focusable:dots.querySelectorAll('a,button,input,[tabindex]').length,overflow:document.documentElement.scrollWidth>innerWidth};
    })()`);
    assert.equal(frame.title, "Nuelexity"); assert.ok(frame.centerError < .6); assert.ok(frame.height >= 32 && frame.height <= 44);
    assert.deepEqual(frame.dots, ["rgb(255, 96, 88)", "rgb(255, 189, 46)", "rgb(40, 200, 64)"]);
    assert.ok(frame.decorative && frame.stationary && frame.inert); assert.equal(frame.focusable, 0); assert.equal(frame.overflow, false);
    if (width >= 1440) assert.ok(frame.width > 900, "enlarged desktop composition preserved");
    await shot(`about-${width}-${theme}-full`, true);
    await evaluate("document.querySelector('.product-demo').scrollIntoView({block:'start',behavior:'instant'})");
    await shot(`about-${width}-${theme}-demo`);
    const barClip = await evaluate("(()=>{const r=document.querySelector('.demo-titlebar').getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:2}})()");
    const barShot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: barClip });
    await writeFile(path.join(evidence, `frame-${width}-${theme}.png`), Buffer.from(barShot.data, "base64"));
    await evaluate("document.querySelector('.developer-card').scrollIntoView({block:'center',behavior:'instant'})");
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 0, y: 0 });
    const links = await evaluate(`(()=>{
      const rgb=s=>s.match(/[\\d.]+/g).slice(0,3).map(Number),luma=c=>c.map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4}).reduce((s,n,i)=>s+n*[.2126,.7152,.0722][i],0);
      const bg=luma(rgb(getComputedStyle(document.querySelector('.developer-card')).backgroundColor));
      return [...document.querySelectorAll('.developer-link')].map(a=>{const r=a.getBoundingClientRect(),style=getComputedStyle(a),fg=luma(rgb(style.color));return {href:a.href,label:a.getAttribute('aria-label'),target:a.target,rel:a.rel,width:r.width,height:r.height,icon:a.querySelector('svg')?.getAttribute('aria-hidden'),contrast:(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05),labelHidden:getComputedStyle(a.querySelector('.developer-link-label')).visibility==='hidden'};});
    })()`);
    assert.deepEqual(links.map((link: any) => link.href), ["https://github.com/S-Adnan-11", "https://s-adnan.dev/"]);
    for (const link of links) { assert.ok(link.label.includes("")); assert.ok(link.width >= 44 && link.height >= 44); assert.equal(link.icon, "true"); assert.ok(link.contrast >= 4.5); assert.ok(link.labelHidden); assert.ok(link.target === "_blank" && link.rel.includes("noopener") && link.rel.includes("noreferrer")); }
    await evaluate("document.querySelectorAll('.developer-link').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();window.__developerClicked=a.href}));document.querySelector('.developer-link').focus()");
    await key("Tab"); await key("Tab", "Tab", 8);
    assert.ok(await evaluate("document.activeElement===document.querySelector('.developer-link') && document.activeElement.matches(':focus-visible')"));
    const focus = await evaluate("(()=>{const a=document.activeElement,s=getComputedStyle(a),r=a.querySelector('.developer-link-label').getBoundingClientRect();return {outline:s.outlineStyle,width:parseFloat(s.outlineWidth),label:getComputedStyle(a.querySelector('.developer-link-label')).visibility,fits:r.left>=0&&r.right<=innerWidth}})()");
    assert.ok(focus.outline !== "none" && focus.width >= 2 && focus.label === "visible" && focus.fits);
    await shot(`project-${width}-${theme}-focus`);
    await key("Escape"); assert.equal(await evaluate("getComputedStyle(document.activeElement.querySelector('.developer-link-label')).visibility"), "hidden");
    await key("Tab");
    assert.ok(await evaluate("document.activeElement===document.querySelectorAll('.developer-link')[1] && getComputedStyle(document.activeElement.querySelector('.developer-link-label')).visibility==='visible'"));
    await key("Enter"); assert.equal(await evaluate("window.__developerClicked"), "https://s-adnan.dev/");
    await evaluate("document.activeElement.blur()");
    const point = await evaluate("(()=>{const r=document.querySelector('.developer-link').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.developer-link-label')).visibility"), "visible");
    const labelPoint = await evaluate("(()=>{const r=document.querySelector('.developer-link-label').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", ...labelPoint });
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.developer-link-label')).visibility"), "visible", "label remains available on hover");
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 0, y: 0 });
    await shot(`project-${width}-${theme}`);
    const ax = await send("Accessibility.getFullAXTree");
    for (const link of links) assert.ok(ax.nodes.some((node: any) => !node.ignored && node.role?.value === "link" && node.name?.value === link.label), "accessible icon link name");
    layouts.push({ width, theme, frame, links, keyboardFocus: true, hoverAndFocusLabels: true, escapeDismissal: true, keyboardActivation: true });
  }
  assert.deepEqual(external, []); assert.deepEqual(failures, []);
  await writeFile(path.join(evidence, "verification.json"), JSON.stringify({ layouts, external, applicationRequests: failures, realScreenReaderTested: false, source: "local built page; external links prevented only by test fixture" }, null, 2));
  console.log("PASS About frame/icons: both themes at 390/1440/1920, centered title, decorative RGB dots, enlarged demo, local icons, 44px targets, contrast, keyboard focus/activation, descriptive hover/focus labels, Escape dismissal, accessibility tree, zero API/provider/external calls. Evidence: " + evidence);
} finally {
  socket?.close(); chrome.kill(); await chrome.exited; server.stop();
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 });
}
