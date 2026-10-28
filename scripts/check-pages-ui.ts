import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { launchChrome } from "./http-fixture";
import { validatePagesConfig } from "./pages-artifacts.mjs";

// Run against Wrangler's real local static-asset handler, never a reimplementation.
const base = process.env.PAGES_REVIEW_URL || "http://127.0.0.1:8788";
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error("Use the loopback Pages emulator only.");
const evidence=path.resolve(process.env.BROWSER_EVIDENCE||"docs/evidence/frontend-release-2026-10-28/pages");await mkdir(evidence,{recursive:true});
const responses:object[]=[];
for(const route of ["/","/about","/legal","/account","/auth","/auth/callback","/dashboard","/dashboard/33333333-3333-4333-8333-333333333333","/private","/missing-page","/assets/missing.js","/config.json"]){
  const response=await fetch(base+route,{redirect:'manual'}),html=await response.text(),privateRoute=/^\/(account|auth|dashboard|private)(\/|$)/.test(route);
  assert.equal(response.status,/missing/.test(route)?404:200,route);
  const robots=response.headers.get("x-robots-tag"),cache=response.headers.get("cache-control"),csp=response.headers.get("content-security-policy");
  assert.ok(csp?.includes("frame-ancestors 'none'"),"actual static CSP "+route);
  if(privateRoute){assert.match(cache||"",/no-store/);assert.match(robots||"",/noindex/);assert.match(html,/name="robots" content="noindex,nofollow"/);assert.ok(!html.includes('rel="canonical"'));}
  if(["/","/about","/legal"].includes(route)){assert.ok(!robots?.includes("noindex"),"production page is indexable "+route);assert.ok(!cache?.includes("no-store"),"no local-preview cache policy on production public page");assert.ok(html.includes(`rel="canonical" href="https://nuelexity.devs.surf${route}"`));assert.ok(html.includes('property="og:image" content="https://nuelexity.devs.surf/brand/v2/social/open-graph.png"'));}
  if(route==="/config.json"){validatePagesConfig(JSON.parse(html));assert.match(cache||"",/no-store/);}
  responses.push({route,status:response.status,robots,cache,csp:!!csp});
}
for(const route of ["/about/","/legal/","/dashboard/"]){const r=await fetch(base+route,{redirect:"manual"});assert.equal(r.status,301);assert.equal(new URL(r.headers.get('location')!,base).pathname,route.slice(0,-1));}
const sitemap=await(await fetch(base+"/sitemap.xml")).text();assert.equal((sitemap.match(/<loc>/g)||[]).length,3);assert.ok(!/dashboard|account|callback/.test(sitemap));
assert.ok((await(await fetch(base+"/robots.txt")).text()).includes("Sitemap: https://nuelexity.devs.surf/sitemap.xml"));
const entry=await(await fetch(base+"/about")).text();
for(const [,asset] of entry.matchAll(/(?:href|src)="(\/assets\/[^\"]+)"/g)){const r=await fetch(base+asset);assert.equal(r.status,200);assert.match(r.headers.get("cache-control")||"",/immutable/);}
for(const host of ["review-project.pages.dev","review-version.review-project.pages.dev"]){
  // fetch controls Host itself; raw HTTP is needed to exercise host match rules.
  const robots=await new Promise<string>((resolve,reject)=>{const target=new URL(base);http.get({hostname:target.hostname,port:target.port,path:'/about',headers:{host}},r=>{r.resume();r.on('end',()=>resolve(String(r.headers['x-robots-tag']||'')))}).on('error',reject)});
  assert.match(robots,/noindex/,"pages.dev is excluded from indexing");
}
const profile=await mkdtemp("/tmp/nuelexity-pages-chrome-");const chrome=launchChrome(profile);
let socket:WebSocket|undefined,sequence=0,commits=0;const pending=new Map<number,{resolve:(v:any)=>void,reject:(e:Error)=>void}>();
const errors:string[]=[],external:string[]=[],mocked:string[]=[];
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn:()=>Promise<unknown>,label:string){for(let i=0;i<200;i++){if(await fn())return;await delay(50)}throw new Error("Pages browser timeout: "+label)}
function send(method:string,params:any={}){return new Promise<any>((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>reject(new Error("CDP timeout "+method)),15000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v)},reject:e=>{clearTimeout(timer);reject(e)}});socket!.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression:string){const r=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error("Pages expression failed: "+expression.slice(0,100));return r.result.value;}
try{
  let port="";await until(async()=>{try{port=(await readFile(path.join(profile,"DevToolsActivePort"),"utf8")).split("\n")[0]!;return port}catch{return false}},"Chrome");
  const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json() as any[];socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  socket.onmessage=event=>{const p=JSON.parse(String(event.data));if(p.method==='Page.frameNavigated'&&!p.params.frame.parentId)commits++;if(p.method==='Runtime.exceptionThrown')errors.push('Uncaught browser exception');if(p.method==='Log.entryAdded'&&/content.security|violat.*directive/i.test(p.params.entry.text))errors.push('CSP failure');
    if(p.method==='Fetch.requestPaused'){
      const url=new URL(p.params.request.url);let body:object|undefined;
      if(url.origin!==base){external.push(url.origin);void send('Fetch.failRequest',{requestId:p.params.requestId,errorReason:'BlockedByClient'});}
      else if(url.pathname==='/nuelexity_ask'){errors.push('Unexpected search submission');void send('Fetch.failRequest',{requestId:p.params.requestId,errorReason:'BlockedByClient'});}
      else{
        if(url.pathname==='/config.json')body={BUN_PUBLIC_BACKEND_URL:base,BUN_PUBLIC_SUPABASE_URL:base+'/supabase',BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-key',BUN_PUBLIC_TURNSTILE_SITE_KEY:''};
        else if(url.pathname==='/models')body={defaultModelId:'openai/gpt-oss-20b',canSelect:false,answerMode:'sources-only',models:[]};
        else if(['/ready','/health'].includes(url.pathname))body={status:'ready'};
        else if(url.pathname==='/guest/session')body={verified:false,verificationRequired:false,expiresAt:null};
        if(body){mocked.push(url.pathname);void send('Fetch.fulfillRequest',{requestId:p.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});}
        else void send('Fetch.continueRequest',{requestId:p.params.requestId});
      }
    }
    const w=pending.get(p.id);if(w){pending.delete(p.id);p.error?w.reject(new Error(p.error.message)):w.resolve(p.result);}
  };
  await new Promise<void>(resolve=>{socket!.onopen=()=>resolve()});await send('Page.enable');await send('Runtime.enable');await send('Log.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
  const layouts:object[]=[];
  for(const width of [1440,390])for(const theme of ['dark','light']){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<800});
    for(const [route,selector] of [['/','#question'],['/about','.product-demo'],['/legal','.document-title'],['/auth','.oauth-button'],['/auth/callback','.auth-card'],['/account','.oauth-button'],['/dashboard/33333333-3333-4333-8333-333333333333','#question'],['/missing-page','.document-title']] as const){
      const before=commits;await send('Page.navigate',{url:base+route});await until(async()=>commits>before,route+' committed');await until(()=>evaluate(`!!document.querySelector('${selector}')`),route+' rendered');await evaluate(`document.documentElement.dataset.theme='${theme}';document.fonts.ready`);await delay(60);
      assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false,route+' overflow');
      layouts.push({route,width,theme,overflow:false});
      if(['/about','/legal','/auth'].includes(route)){const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(evidence,`${route.slice(1)}-${width}-${theme}.png`),Buffer.from(shot.data,'base64'));}
    }
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  await writeFile(path.join(evidence,'verification.json'),JSON.stringify({runtime:'Wrangler 4.154.0 local Pages static handler',responses,layouts,errors,external,mockedPaths:[...new Set(mocked)],applicationCalls:'Only intercepted local fixtures; no search/generation or real auth',liveCloudflareDeployment:false},null,2));
  console.log('PASS Pages emulator: production public indexing/cache, private deep-link noindex/no-store, OAuth/account entry routes, real CSP, assets/404s, sitemap/social/canonical, pages.dev exclusions, 32 rendered dark/light desktop/mobile layouts. No external or provider requests.');
}finally{socket?.close();chrome.kill();await chrome.exited;await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:150});}
