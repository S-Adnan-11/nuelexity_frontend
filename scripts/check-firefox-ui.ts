import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createConnection, createServer, type Socket } from "node:net";
import { once } from "node:events";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { serveFixture, staticResponse } from "./http-fixture";

// Firefox's built-in Marionette protocol; no installed driver or real services.
const requests: string[] = [], unexpected: string[] = [];
const server = await serveFixture(async req => {
  const url = new URL(req.url); requests.push(url.pathname);
  if(url.pathname === "/config.json") return Response.json({BUN_PUBLIC_BACKEND_URL:server.url.origin,BUN_PUBLIC_SUPABASE_URL:server.url.origin+"/supabase",BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"fixture-key",BUN_PUBLIC_TURNSTILE_SITE_KEY:""});
  if(/^\/(ready|models|guest|conversations|nuelexity_ask|supabase)(\/|$)/.test(url.pathname)) {
    unexpected.push(url.pathname); return new Response(null,{status:500});
  }
  const response=await staticResponse("dist",url.pathname);
  // Prevent any external page request, even if a regression introduces one.
  response.headers.set("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self'; font-src 'self'; object-src 'none'");
  return response;
});
const profile=await mkdtemp("/tmp/nuelexity-firefox-");
const reserve=createServer();reserve.listen(0,"127.0.0.1");await once(reserve,"listening");const port=(reserve.address() as any).port;await new Promise<void>(resolve=>reserve.close(()=>resolve()));
await writeFile(path.join(profile,"user.js"),[
  `user_pref("marionette.port", ${port});`,
  'user_pref("browser.shell.checkDefaultBrowser", false);',
  'user_pref("browser.startup.homepage_override.mstone", "ignore");',
  'user_pref("browser.newtabpage.enabled", false);',
  'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
  'user_pref("toolkit.telemetry.enabled", false);',
  'user_pref("app.update.auto", false);',
  'user_pref("browser.safebrowsing.downloads.enabled", false);',
  'user_pref("browser.safebrowsing.malware.enabled", false);',
  'user_pref("browser.safebrowsing.phishing.enabled", false);',
  'user_pref("network.captive-portal-service.enabled", false);',
  'user_pref("network.connectivity-service.enabled", false);',
].join("\n"));
const firefox=spawn(process.env.FIREFOX_BIN||"/snap/firefox/current/usr/lib/firefox/firefox",["--headless","--no-remote","--marionette","--remote-allow-system-access","--profile",profile,"about:blank"],{stdio:["ignore","ignore","pipe"]});
const exited=once(firefox,"exit");let startup="";firefox.stderr.on("data",data=>startup+=data);
const evidence=path.resolve(process.env.BROWSER_EVIDENCE||"docs/evidence/frontend-v1-2026-10-28/firefox");await mkdir(evidence,{recursive:true});
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
let socket:Socket|undefined,sequence=0,buffer=Buffer.alloc(0),greeting=false;
const pending=new Map<number,{resolve:(value:any)=>void,reject:(error:Error)=>void}>();
function send(command:string,params:any={}) {
  const id=++sequence;return new Promise<any>((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error("Firefox timeout: "+command));},20000);
    pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v)},reject:e=>{clearTimeout(timer);reject(e)}});
    const data=JSON.stringify([0,id,command,params]);socket!.write(Buffer.byteLength(data)+":"+data);
  });
}
async function evaluate(script:string) {
  const result=await send("WebDriver:ExecuteScript",{script,args:[],newSandbox:false,sandbox:"default",line:1,filename:"local-ui-regression",scriptTimeout:10000});return result.value;
}
async function until(fn:()=>Promise<unknown>,label:string){for(let i=0;i<180;i++){if(await fn())return;await delay(60)}throw new Error("Firefox timed out: "+label)}
async function shot(name:string){const result=await send("WebDriver:TakeScreenshot",{full:false,hash:false});await writeFile(path.join(evidence,name+".png"),Buffer.from(result.value,"base64"));}
async function zoom(value:number){
  await send("Marionette:SetContext",{value:"chrome"});
  const actual=await evaluate(`window.gBrowser.selectedBrowser.fullZoom=${value};return window.gBrowser.selectedBrowser.fullZoom;`);
  assert.equal(actual,value,"actual browser fullZoom");
  await send("Marionette:SetContext",{value:"content"});await delay(150);return actual;
}
try {
  for(let i=0;i<150;i++) {
    try {socket=await new Promise<Socket>((resolve,reject)=>{const client=createConnection({port,host:"127.0.0.1"});client.once("error",reject);client.once("connect",()=>resolve(client));});break;}catch{if(firefox.exitCode!==null)throw new Error("Firefox failed to start: "+startup.slice(-400));await delay(80);}
  }
  assert.ok(socket,"Firefox Marionette listening");
  socket.on("data",chunk=>{buffer=Buffer.concat([buffer,chunk]);while(true){const colon=buffer.indexOf(58);if(colon<0)return;const len=Number(buffer.subarray(0,colon).toString());if(buffer.length<colon+1+len)return;const message=JSON.parse(buffer.subarray(colon+1,colon+1+len).toString());buffer=buffer.subarray(colon+1+len);if(!Array.isArray(message)){greeting=true;continue}const waiter=pending.get(message[1]);if(waiter){pending.delete(message[1]);message[2]?waiter.reject(new Error(message[2].message)):waiter.resolve(message[3]);}}});
  await until(async()=>greeting,"protocol greeting");
  const session=await send("WebDriver:NewSession",{capabilities:{alwaysMatch:{acceptInsecureCerts:false}}});
  console.log("Firefox session: "+JSON.stringify({version:session.capabilities.browserVersion}));
  const layouts:object[]=[];
  await send("WebDriver:SetWindowRect",{width:1440,height:1000});
  await send("WebDriver:Navigate",{url:server.url.href+"about"});
  await until(()=>evaluate("return !!document.querySelector('.product-demo');"),"About");
  await evaluate("document.querySelector('.product-demo').scrollIntoView({block:'start'});return true;");
  await until(()=>evaluate("return document.querySelector('.product-demo').dataset.demoTime>5900;"),"typed question");
  assert.equal(await evaluate("return document.querySelector('.demo-draft').innerText;"),"Help me understand Quantum Computing");
  assert.equal(await evaluate("return document.querySelector('.demo-model').innerText;"),"GPT-OSS 120B");
  await shot("about-question-dark-1440");
  // Set the OS accessibility preference inside this isolated test profile.
  await send("Marionette:SetContext",{value:"chrome"});
  await evaluate("Services.prefs.setIntPref('ui.prefersReducedMotion',1);return true;");
  await send("Marionette:SetContext",{value:"content"});
  await until(()=>evaluate("return document.querySelector('.product-demo').dataset.demoPhase==='complete';"),"reduced motion");
  assert.equal(await evaluate("return document.querySelector('.demo-model').innerText;"),"Qwen 3.8 27B · Preview");
  for(const width of [1440,390]) {
    await send("WebDriver:SetWindowRect",{width,height:1000});
    // Firefox enforces a native minimum window width. Record the actual CSS
    // width, and keep narrow-window zoom within the app’s 320px minimum.
    for(const theme of ["dark","light"])for(const fullZoom of (width===1440?[1,1.25,2]:[1,1.25])) {
      await zoom(fullZoom);
      await evaluate(`document.documentElement.dataset.theme='${theme}';document.querySelector('.product-demo').scrollIntoView({block:'start'});return true;`);
      await delay(100);
      const m=await evaluate(`const b=document.querySelector('.demo-composer .send-button').getBoundingClientRect(),i=document.querySelector('.demo-composer .send-button svg').getBoundingClientRect();return {requestedWidth:${width},width:innerWidth,theme:'${theme}',fullZoom:${fullZoom},overflow:document.documentElement.scrollWidth>innerWidth,centerX:Math.abs(b.x+b.width/2-i.x-i.width/2),centerY:Math.abs(b.y+b.height/2-i.y-i.height/2),phase:document.querySelector('.product-demo').dataset.demoPhase,eyeAnimation:getComputedStyle(document.querySelector('.return-cat-eye')).animationName};`);
      if(m.overflow){await shot("overflow");console.log(JSON.stringify(m));}
      assert.equal(m.overflow,false,JSON.stringify(m));assert.ok(m.centerX<.6&&m.centerY<.6);assert.equal(m.phase,"complete");assert.equal(m.eyeAnimation,"none");layouts.push(m);
      await shot(`about-${width}-${theme}-zoom-${fullZoom*100}`);
      if(fullZoom===2) {
        await evaluate("document.querySelector('.demo-composer').scrollIntoView({block:'end'});return true;");
        await shot(`about-${width}-${theme}-zoom-${fullZoom*100}-composer`);
      }
    }
  }
  assert.deepEqual(unexpected,[],"zero application API/provider requests");
  await writeFile(path.join(evidence,"verification.json"),JSON.stringify({version:session.capabilities.browserVersion,layouts,actualBrowserZoom:true,physicalDevices:false,screenReader:false,applicationApiRequests:unexpected,requestedPaths:[...new Set(requests)]},null,2));
  console.log("PASS Firefox: exact first prompt, autoplay, reduced motion, centered composer, both themes, native 100/125/200% browser zoom, no horizontal overflow. Actual CSS widths recorded; no device or screen-reader claim.");
} finally {
  if(socket){try{await send("WebDriver:DeleteSession");}catch{}socket.destroy();}
  firefox.kill();await exited;server.stop();await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:150});
}
