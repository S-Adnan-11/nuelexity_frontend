import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { demoDuration, demoScenes, demoQuestion, demoFollowUp, demoModels } from "../src/lib/product-demo";
import { serveFixture, staticResponse, launchChrome } from "./http-fixture";

// Built UI only. No application backend, OAuth, Turnstile or model services.
const requests: string[] = [], external: string[] = [], failures: string[] = [];
const server = await serveFixture(async req => {
  const url = new URL(req.url);
  requests.push(req.method + " " + url.pathname);
  if (url.pathname === "/config.json") return Response.json({ BUN_PUBLIC_BACKEND_URL: server.url.origin, BUN_PUBLIC_SUPABASE_URL: server.url.origin + "/supabase", BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-key", BUN_PUBLIC_TURNSTILE_SITE_KEY: "" });
  if (/^\/(models|ready|health|guest|conversations|nuelexity_ask|supabase)(\/|$)/.test(url.pathname)) {
    failures.push(req.method + " " + url.pathname);
    return new Response(null, { status: 500 });
  }
  return staticResponse("dist", url.pathname);
});
const evidence = path.resolve(process.env.BROWSER_EVIDENCE || "docs/evidence/frontend-v1-2026-10-28");
await mkdir(evidence, { recursive: true });
const profile = await mkdtemp("/tmp/nuelexity-about-chrome-");
const chrome = launchChrome(profile);
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn: () => Promise<unknown>, label: string, tries = 180) {
  for (let i = 0; i < tries; i++) { if (await fn()) return; await delay(60); }
  throw new Error("Timed out: " + label);
}
let socket: WebSocket | undefined, sequence = 0, commits = 0;
const pending = new Map<number, { resolve: (data: any) => void; reject: (error: Error) => void }>();
function send(method: string, params: any = {}) {
  return new Promise<any>((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error("CDP timeout: " + method)); }, 15000);
    pending.set(id, { resolve: data => { clearTimeout(timer); resolve(data); }, reject: error => { clearTimeout(timer); reject(error); } });
    socket!.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression: string) {
  const value = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (value.exceptionDetails) throw new Error("Browser expression failed: " + expression.slice(0, 100));
  return value.result.value;
}
const frameWrites: Promise<void>[] = [], frames: { file: string; timestamp: number }[] = [];
let recording = false, failWorkspace = false;
async function shot(name: string, full = false) {
  const metrics = full ? await send("Page.getLayoutMetrics") : null;
  const capture = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: full,
    ...(metrics ? { clip: { x: 0, y: 0, width: metrics.cssContentSize.width, height: metrics.cssContentSize.height, scale: 1 } } : {}) });
  await writeFile(path.join(evidence, name + ".png"), Buffer.from(capture.data, "base64"));
}
async function go(route = "/about") {
  const before = commits;
  await send("Page.navigate", { url: new URL(route, server.url).href });
  await until(async () => commits > before, "navigation committed");
  await until(() => evaluate(route === "/about" ? "!!document.querySelector('.product-demo')" : "!!document.querySelector('.auth-card')"), route);
  await evaluate("document.fonts.ready");
  await delay(120);
}
const demo = (suffix = "") => `document.querySelector('.product-demo')${suffix}`;
const ticks = () => evaluate("window.__demoAudit.ticks");
async function seek(time: number) {
  await evaluate(`window.__demoAudit.seek(${time})`);
  await delay(70);
}
async function composerShot(name: string) {
  const clip = await evaluate("(()=>{const r=document.querySelector('.demo-composer').getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:2}})()");
  const capture = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip });
  await writeFile(path.join(evidence, name + ".png"), Buffer.from(capture.data, "base64"));
}
const layoutSample = `(()=>{
  const demo=document.querySelector('.product-demo'), pane=document.querySelector('.demo-viewport'), button=document.querySelector('.demo-composer .send-button'), icon=button.querySelector('svg');
  const b=button.getBoundingClientRect(),i=icon.getBoundingClientRect(),c=document.querySelector('.demo-composer').getBoundingClientRect(),f=document.querySelector('.demo-stage').getBoundingClientRect();
  return {phase:demo.dataset.demoPhase,time:Number(demo.dataset.demoTime),draft:document.querySelector('.demo-draft').innerText,model:document.querySelector('.demo-model').innerText,
    centerX:Math.abs(b.x+b.width/2-i.x-i.width/2),centerY:Math.abs(b.y+b.height/2-i.y-i.height/2),
    framed:b.left>=f.left&&b.right<=f.right&&b.bottom<=f.bottom&&c.top>=f.top,
    draftFits:document.querySelector('.demo-draft').scrollHeight<=document.querySelector('.demo-draft').clientHeight,
    sources:[...document.querySelectorAll('.demo-thread .source-card')].filter(n=>getComputedStyle(n).visibility==='visible').length,
    answer:document.querySelector('.demo-thread .answer-text')?.innerText||'', scroll:pane.scrollTop,
    height:document.documentElement.scrollHeight,y:scrollY,focus:document.activeElement.tagName,scale:new DOMMatrix(getComputedStyle(document.querySelector('.demo-playback')).transform).a};
})()`;
try {
  let debugPort = "";
  await until(async () => { try { debugPort = (await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]!; return debugPort; } catch { return false; } }, "Chrome");
  const tabs = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json() as any[];
  socket = new WebSocket(tabs.find(tab => tab.type === "page").webSocketDebuggerUrl);
  socket.onmessage = event => {
    const packet = JSON.parse(String(event.data));
    if (packet.method === "Page.frameNavigated" && !packet.params.frame.parentId) commits++;
    if (packet.method === "Runtime.exceptionThrown") failures.push("Uncaught browser exception");
    if (packet.method === "Fetch.requestPaused") {
      const url = new URL(packet.params.request.url);
      if (url.origin !== server.url.origin) { external.push(url.origin); void send("Fetch.failRequest", { requestId: packet.params.requestId, errorReason: "BlockedByClient" }); }
      else if (failWorkspace && /\/assets\/Dashboard-/.test(url.pathname)) void send("Fetch.failRequest", { requestId: packet.params.requestId, errorReason: "ConnectionFailed" });
      else void send("Fetch.continueRequest", { requestId: packet.params.requestId });
    }
    if (packet.method === "Page.screencastFrame") {
      void send("Page.screencastFrameAck", { sessionId: packet.params.sessionId });
      if (recording) {
        const file = path.join(evidence, "demo-frames", String(frames.length).padStart(5, "0") + ".jpg");
        frames.push({ file, timestamp: packet.params.metadata.timestamp });
        frameWrites.push(writeFile(file, Buffer.from(packet.params.data, "base64")));
      }
    }
    const waiter = pending.get(packet.id);
    if (waiter) { pending.delete(packet.id); packet.error ? waiter.reject(new Error(packet.error.message)) : waiter.resolve(packet.result); }
  };
  await new Promise<void>(resolve => { socket!.onopen = () => resolve(); });
  await send("Page.enable"); await send("Runtime.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
  // Instrument the browser clock only in this fixture. The product has no seek UI.
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `
    window.__demoAudit = {ticks:0,frames:new Set(),observers:new Set(),resizes:new Set(),visibility:new Set(),offset:0};
    const audit=window.__demoAudit, raf=window.requestAnimationFrame, cancel=window.cancelAnimationFrame;
    window.requestAnimationFrame=function(callback){let id;id=raf(function(now){audit.frames.delete(id);audit.ticks++;callback(now+audit.offset)});audit.frames.add(id);return id};
    window.cancelAnimationFrame=function(id){audit.frames.delete(id);return cancel(id)};
    audit.seek=t=>{audit.offset+=t-Number(document.querySelector('.product-demo').dataset.demoTime)};
    const Observer=window.IntersectionObserver;
    window.IntersectionObserver=class extends Observer {constructor(...args){super(...args);audit.observers.add(this)}disconnect(){audit.observers.delete(this);return super.disconnect()}};
    const Resize=window.ResizeObserver;
    window.ResizeObserver=class extends Resize {constructor(...args){super(...args);audit.resizes.add(this)}disconnect(){audit.resizes.delete(this);return super.disconnect()}};
    const add=document.addEventListener.bind(document),remove=document.removeEventListener.bind(document);
    document.addEventListener=function(type,listener,...args){if(type==='visibilitychange')audit.visibility.add(listener);return add(type,listener,...args)};
    document.removeEventListener=function(type,listener,...args){if(type==='visibilitychange')audit.visibility.delete(listener);return remove(type,listener,...args)};
  ` });
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 700, deviceScaleFactor: 1, mobile: false });
  await go();
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.demo-measurements')).opacity"), "0", "responsive measurement copies cannot paint over playback");
  assert.equal(await evaluate(demo(".dataset.playing")), "false", "offscreen demo starts paused");
  assert.equal(await evaluate("window.__demoAudit.frames.size"), 0);
  const original = await ticks(); await delay(300); assert.equal(await ticks(), original, "no offscreen callbacks");
  // Observe two real blinks, including their duration. No animation seek here.
  const blink = await evaluate(`new Promise(resolve=>{
    const eye=document.querySelector('.return-cat-eye'),samples=[],start=performance.now();
    function sample(){const t=performance.now()-start;samples.push({t,closed:new DOMMatrix(getComputedStyle(eye).transform).d<.99});if(t<3300)setTimeout(sample,10);else resolve(samples)}sample();
  })`);
  const closures: { start: number; end: number }[] = [];
  for (let i=0;i<blink.length;i++) if(blink[i].closed) {
    const start=blink[i].t;while(i+1<blink.length&&blink[i+1].closed)i++;
    closures.push({start,end:blink[i+1]?.t??blink[i].t});
  }
  assert.ok(closures.length>=2, "cat repeats the blink");
  for(const c of closures.slice(0,2)) assert.ok(c.end-c.start>=95&&c.end-c.start<=155, "brief 100–150ms eye closure: "+(c.end-c.start));
  assert.ok(Math.abs(closures[1]!.start-closures[0]!.start-1500)<35, "approximately 1.5 seconds between blinks");
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.return-cat-mark')).transform"), "none", "body stays settled");
  await shot("about-desktop-dark-hero");
  await evaluate("document.querySelector('.demo-section').scrollIntoView({block:'start',behavior:'instant'})");
  await until(() => evaluate(demo(".dataset.playing === 'true'")), "visible playback");
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.return-cat-eye')).animationPlayState"), "paused", "offscreen cat pauses");
  await delay(100);
  assert.equal(await evaluate("window.__demoAudit.frames.size"), 1, "one coordinated frame callback after Strict Mode cleanup");
  await send("Accessibility.enable");
  const accessibility = await send("Accessibility.getFullAXTree");
  assert.ok(accessibility.nodes.some((node: any) => node.role?.value === "figure" && node.description?.value?.includes("not a live search")));
  assert.ok(!accessibility.nodes.some((node: any) => node.name?.value === "Researching…"), "simulation excluded from accessibility tree");
  assert.ok(await evaluate("document.querySelector('.demo-window').inert && document.querySelector('.demo-window').getAttribute('aria-hidden') === 'true'"));
  const hiddenTab = await send("Target.createTarget", { url: "about:blank", background: false });
  await send("Target.activateTarget", { targetId: hiddenTab.targetId });
  await until(() => evaluate("document.hidden"), "actual background tab");
  await until(() => evaluate(demo(".dataset.playing === 'false'")), "background pause");
  const hiddenTicks = await ticks(); await delay(300); assert.equal(await ticks(), hiddenTicks);
  await send("Page.bringToFront"); await send("Target.closeTarget", { targetId: hiddenTab.targetId });
  await until(() => evaluate(demo(".dataset.playing === 'true'")), "foreground resumes");
  await evaluate("window.scrollTo(0,0)");
  await until(() => evaluate(demo(".dataset.playing === 'false'")), "offscreen pause");
  const offscreenTicks=await ticks();await delay(300);assert.equal(await ticks(),offscreenTicks);
  await evaluate("document.querySelector('.demo-section').scrollIntoView({block:'start',behavior:'instant'})");
  await until(() => evaluate(demo(".dataset.playing === 'true'")), "back onscreen");
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await evaluate("document.querySelector('figcaption a').focus({preventScroll:true})");
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 600, y: 400 });
  const hoverTicks=await ticks();await delay(350);assert.ok(await ticks()>hoverTicks,"pointer/focused reference cannot freeze mid-typing");
  await evaluate("document.activeElement.blur()");

  const layouts: object[] = [];
  const checkpoints=[700,3700,6100,7500,10000,13100,18200,27000,30200,34000,36900,38500,41000,44000,49000,58000,63500,500];
  for (const width of [1440,768,390,320]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: width<800?900:1000, deviceScaleFactor:1,mobile:width<800 });
    for(const theme of ["dark","light"]) {
      await go();
      await evaluate(`document.documentElement.dataset.theme='${theme}';document.querySelector('.product-demo').scrollIntoView({block:'start',behavior:'instant'})`);
      await until(() => evaluate(demo(".dataset.playing === 'true'")), "matrix playback");
      const baseline=await evaluate(layoutSample);
      for(const t of checkpoints) {
        await seek(t);
        const m=await evaluate(layoutSample);
        assert.ok(m.centerX<.6&&m.centerY<.6,`centered icon ${width} ${theme} ${t}: ${m.centerX},${m.centerY}`);
        assert.ok(m.framed,`composer camera stays framed ${width} ${theme} ${t}`);
        assert.ok(m.draftFits,`draft fits ${width} ${theme} ${t}`);
        assert.equal(m.height,baseline.height,"fixed document height");assert.equal(m.y,baseline.y,"no outer scroll");assert.equal(m.focus,baseline.focus,"no focus theft");
        assert.equal(await evaluate("document.documentElement.scrollWidth>innerWidth"),false,`no page overflow ${width} ${theme}`);
        if(t===6100) {assert.equal(m.draft,demoQuestion);assert.equal(m.model,demoModels[0]);assert.ok(m.scale>1.04,"composer zoom");}
        if(t===36900) {assert.equal(m.draft,demoFollowUp);assert.equal(m.model,demoModels[1]);}
        layouts.push({width,theme,checkpoint:t,...m});
        if([1440,390].includes(width)&&[6100,30200,36900,58000].includes(t)) {
          await shot(`demo-${width}-${theme}-${t}`);
          if([6100,36900].includes(t))await composerShot(`composer-${width}-${theme}-${t}`);
        }
      }
    }
  }
  await send("Emulation.setEmulatedMedia", { features:[{name:"prefers-reduced-motion",value:"reduce"}] });
  for(const width of [1440,768,390,320]) {
    await send("Emulation.setDeviceMetricsOverride", {width,height:width<800?900:1000,deviceScaleFactor:1,mobile:width<800});
    for(const theme of ["dark","light"]) {
      await evaluate(`document.documentElement.dataset.theme='${theme}';window.scrollTo(0,0)`);await delay(120);
      assert.equal(await evaluate(demo(".dataset.demoPhase")),"complete");
      assert.equal(await evaluate("window.__demoAudit.frames.size"),0,"static reduced motion");
      assert.equal(await evaluate("getComputedStyle(document.querySelector('.return-cat-eye')).animationName"),"none");
      assert.ok(await evaluate("(()=>{const pane=document.querySelector('.demo-viewport').getBoundingClientRect(),end=[...document.querySelectorAll('.demo-thread .answer-text p')].at(-1).getBoundingClientRect();return end.bottom<=pane.bottom&&end.top>=pane.top})()"),"ending readable on resize "+width);
      assert.ok(await evaluate("[...document.querySelectorAll('img')].every(img=>img.complete&&img.naturalWidth>0)"));
      if([1440,390].includes(width)) {
        await shot(`about-${width}-${theme}-full`,true);await shot(`about-${width}-${theme}-cat`);
        await evaluate("document.querySelector('.product-demo').scrollIntoView({block:'start',behavior:'instant'})");await shot(`about-${width}-${theme}-demo`);
      }
    }
  }
  const completed=await evaluate(demo(".innerText"));await delay(300);assert.equal(await evaluate(demo(".innerText")),completed);

  // A full loop recorded at real speed; the fixture clock offset starts at zero.
  await send("Emulation.setDeviceMetricsOverride", {width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send("Emulation.setEmulatedMedia", {features:[{name:"prefers-reduced-motion",value:"no-preference"}]});
  await go();await evaluate("document.documentElement.dataset.theme='dark';document.querySelector('.demo-section').scrollIntoView({block:'start',behavior:'instant'})");
  await until(() => evaluate(demo(".dataset.playing === 'true'")),"fresh loop");
  if(process.env.RECORD_DEMO==="1") {
    await mkdir(path.join(evidence,"demo-frames"),{recursive:true});recording=true;
    await send("Page.startScreencast",{format:"jpeg",quality:92,maxWidth:1440,maxHeight:1000,everyNthFrame:2});
  }
  const phases=new Set<string>(),started=Date.now(),baseline=await evaluate(layoutSample),sourceCounts=new Set<number>(),drafts=new Set<string>(),progressiveCounts=new Set<number>(),scrollStops=new Map<string,number[]>();
  while(Date.now()-started<demoDuration+650) {
    const m=await evaluate(layoutSample);phases.add(m.phase);sourceCounts.add(m.sources);drafts.add(m.draft);progressiveCounts.add(m.answer.length);
    assert.equal(m.height,baseline.height);assert.equal(m.y,baseline.y);assert.equal(m.focus,baseline.focus);
    assert.ok(m.centerX<.6&&m.centerY<.6&&m.framed&&m.draftFits);
    if(["read","follow-up","complete"].includes(m.phase)){const a=scrollStops.get(m.phase)||[];a.push(m.scroll);scrollStops.set(m.phase,a);}
    await delay(90);
  }
  if(recording){await send("Page.stopScreencast");recording=false;await Promise.all(frameWrites);}
  for(const phase of ["establish","question","research","answer","read","follow-up","research-follow-up","answer-follow-up","complete","reset"])assert.ok(phases.has(phase),phase);
  assert.ok(progressiveCounts.size>30);assert.ok(drafts.has(demoQuestion)&&drafts.has(demoFollowUp),"both exact completed questions held");
  assert.deepEqual([...sourceCounts].sort(),[0,1,2,3,4,5,6],"successive sources for both answers");
  for(const phase of ["read","complete"]) {const a=scrollStops.get(phase)!;assert.ok(Math.max(...a)-Math.min(...a)<1,"still reading hold: "+phase);}
  assert.ok(scrollStops.get("complete")![0]!>scrollStops.get("read")![0]!,"second answer scrolls downward");
  await evaluate("history.pushState({},'', '/auth');dispatchEvent(new PopStateEvent('popstate'))");
  await until(()=>evaluate("!!document.querySelector('.auth-card')"),"demo unmounted");
  assert.deepEqual(await evaluate("({frames:__demoAudit.frames.size,observers:__demoAudit.observers.size,resizes:__demoAudit.resizes.size,visibility:__demoAudit.visibility.size})"),{frames:0,observers:0,resizes:0,visibility:0});
  assert.ok(!requests.some(p=>p.includes('/assets/Dashboard-')),"public page never downloads the workspace chunk");
  failWorkspace=true;
  await evaluate("history.pushState({},'', '/dashboard');dispatchEvent(new PopStateEvent('popstate'))");
  await until(()=>evaluate("document.body.innerText.includes('The workspace couldn’t load')"),"failed chunk has a useful recovery state");
  assert.ok(await evaluate("!![...document.querySelectorAll('button')].find(b=>b.innerText==='Reload workspace')"));
  await evaluate("document.querySelector('a[href=\"/about\"]').click()");
  await until(()=>evaluate("!!document.querySelector('.product-demo')"),"failed workspace leaves public navigation usable");
  assert.deepEqual(failures,[],"zero application API calls or errors");assert.deepEqual(external,[],"zero external/provider requests");
  if(frames.length) {
    const concat=frames.map((f,i)=>`file '${f.file}'\nduration ${Math.max(.02,(frames[i+1]?.timestamp??f.timestamp+.25)-f.timestamp)}`).join("\n");
    const concatPath=path.join(evidence,"demo-frames","frames.txt");await writeFile(concatPath,concat);
    const video=spawnSync("ffmpeg",["-y","-v","error","-safe","0","-f","concat","-i",concatPath,"-vf","fps=30,format=yuv420p","-c:v","libx264","-preset","fast","-movflags","+faststart","-an",path.join(evidence,"about-demo.mp4")],{encoding:"utf8"});assert.equal(video.status,0,video.stderr);
    // Composer close-up follows the same real loop, including zoom and reset.
    const crop=spawnSync("ffmpeg",["-y","-v","error","-i",path.join(evidence,"about-demo.mp4"),"-vf","crop=872:208:284:724","-c:v","libx264","-preset","fast","-movflags","+faststart","-an",path.join(evidence,"composer-loop.mp4")],{encoding:"utf8"});assert.equal(crop.status,0,crop.stderr);
    await rm(path.join(evidence,"demo-frames"),{recursive:true,force:true});
  }
  await writeFile(path.join(evidence,"about-verification.json"),JSON.stringify({layouts,phases:[...phases],cycleSeconds:demoDuration/1000,applicationApiRequests:failures,externalRequests:external,requestedPaths:[...new Set(requests)],closures,offscreenPause:true,actualBackgroundTabPause:true,hoverDoesNotFreeze:true,reducedMotionStatic:true,unmountCleanup:true,stableDocumentAndFocus:true,accessibilityTreeChecked:true,recordedFrames:frames.length,physicalDevices:false,screenReaderManuallyTested:false},null,2));
  console.log("PASS About: exact prompts/models, 64s coordinated loop, camera framing, internal scroll/read holds, centered send icon, repeating short blink, zero API/provider requests, background/offscreen pause, no hover freeze, reduced motion, cleanup, both themes at 320/390/768/1440. Evidence: "+evidence);
} finally {
  socket?.close();chrome.kill();await chrome.exited;server.stop();
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:150});
}
