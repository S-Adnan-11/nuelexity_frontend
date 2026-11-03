import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { launchChrome } from "./http-fixture";


// Run against Wrangler's real local static-asset handler, never a reimplementation.
const base = process.env.PAGES_PUBLIC_URL || "http://127.0.0.1:8789";
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error("Use the loopback Pages emulator only.");
const evidence=path.resolve(process.env.BROWSER_EVIDENCE||"docs/evidence/policy-corrections-2026-10-30/public");await mkdir(evidence,{recursive:true});
const responses:object[]=[];
for(const route of ["/","/about","/legal","/account","/auth","/auth/callback","/dashboard","/dashboard/33333333-3333-4333-8333-333333333333","/private","/missing-page","/assets/missing.js","/config.json"]){
  const response=await fetch(base+route,{redirect:'manual'}),html=await response.text(),privateRoute=/^\/(account|auth|dashboard|private)(\/|$)/.test(route);
  assert.equal(response.status,/missing/.test(route)||route==="/config.json"?404:200,route);
  const robots=response.headers.get("x-robots-tag"),cache=response.headers.get("cache-control"),csp=response.headers.get("content-security-policy");
  assert.ok(csp?.includes("frame-ancestors 'none'"),"actual static CSP "+route);
  if(privateRoute){assert.match(cache||"",/no-store/);assert.match(robots||"",/noindex/);assert.match(html,/name="robots" content="noindex,nofollow"/);assert.ok(!html.includes('rel="canonical"'));}
  if(["/","/about","/legal"].includes(route)){assert.ok(!robots?.includes("noindex"),"production page is indexable "+route);assert.ok(!cache?.includes("no-store"),"no local-preview cache policy on production public page");assert.ok(html.includes(`rel="canonical" href="https://nuelexity.devs.surf${route}"`));assert.ok(html.includes('property="og:image" content="https://nuelexity.devs.surf/brand/v2/social/open-graph.png"'));}
  assert.ok(csp?.includes("connect-src 'none'"));
  assert.ok(csp?.includes("frame-src 'none'"));
  if(privateRoute) assert.ok(html.includes("Research and sign-in are not open yet"));
  assert.ok(!html.includes('Private fixture conversation'));
  responses.push({route,status:response.status,robots,cache,csp:!!csp});
}
for(const route of ["/about/","/legal/","/dashboard/"]){const r=await fetch(base+route,{redirect:"manual"});assert.equal(r.status,301);assert.equal(new URL(r.headers.get('location')!,base).pathname,route.slice(0,-1));}
const sitemap=await(await fetch(base+"/sitemap.xml")).text();assert.equal((sitemap.match(/<loc>/g)||[]).length,3);assert.ok(!/dashboard|account|callback/.test(sitemap));
assert.ok((await(await fetch(base+"/robots.txt")).text()).includes("Sitemap: https://nuelexity.devs.surf/sitemap.xml"));
const entry=await(await fetch(base+"/about")).text();
assert.ok(entry.indexOf('/theme-init.js')<entry.indexOf('rel="stylesheet"'),'appearance boot runs before stylesheet/app paint');
assert.ok((await fetch(base+'/theme-init.js')).ok);
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
async function until(fn:()=>Promise<unknown>,label:string){for(let i=0;i<200;i++){if(await fn())return;await delay(50)}throw new Error("Pages browser timeout: "+label+" "+JSON.stringify(await evaluate("({path:location.pathname,hash:location.hash,focus:document.activeElement.outerHTML.slice(0,200)})")))}
function send(method:string,params:any={}){return new Promise<any>((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>reject(new Error("CDP timeout "+method)),15000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v)},reject:e=>{clearTimeout(timer);reject(e)}});socket!.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression:string){const r=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error("Pages expression failed: "+expression.slice(0,100));return r.result.value;}
try{
  let port="";await until(async()=>{try{port=(await readFile(path.join(profile,"DevToolsActivePort"),"utf8")).split("\n")[0]!;return port}catch{return false}},"Chrome");
  const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json() as any[];socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  socket.onmessage=event=>{const p=JSON.parse(String(event.data));if(p.method==='Page.frameNavigated'&&!p.params.frame.parentId)commits++;if(p.method==='Runtime.exceptionThrown')errors.push('Uncaught browser exception');if(p.method==='Log.entryAdded'&&/content.security|violat.*directive/i.test(p.params.entry.text))errors.push('CSP failure');
    if(p.method==='Fetch.requestPaused'){
      const url=new URL(p.params.request.url);let body:object|undefined;
      if(url.origin!==base){external.push(url.origin);void send('Fetch.failRequest',{requestId:p.params.requestId,errorReason:'BlockedByClient'}).catch(e=>{if(!/Invalid InterceptionId/.test(e.message))errors.push('Interception failed')});}
      else if(/^\/(config\.json|models|ready|health|guest|conversations|nuelexity_ask|supabase)(\/|$)/.test(url.pathname)){errors.push('Unexpected search submission');void send('Fetch.failRequest',{requestId:p.params.requestId,errorReason:'BlockedByClient'}).catch(e=>{if(!/Invalid InterceptionId/.test(e.message))errors.push('Interception failed')});}
      else void send('Fetch.continueRequest',{requestId:p.params.requestId}).catch(e=>{if(!/Invalid InterceptionId/.test(e.message))errors.push('Interception failed')});
    }
    const w=pending.get(p.id);if(w){pending.delete(p.id);p.error?w.reject(new Error(p.error.message)):w.resolve(p.result);}
  };
  await new Promise<void>(resolve=>{socket!.onopen=()=>resolve()});await send('Page.enable');await send('Emulation.setFocusEmulationEnabled',{enabled:true});await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await send('Runtime.enable');await send('Log.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
  const layouts:object[]=[];
  for(const width of [1920,1440,768,390,320])for(const theme of ['dark','light']){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<800});
    for(const [route,selector] of [['/','.launch-status'],['/about','.product-demo'],['/legal','.document-title'],['/auth','.launch-status'],['/auth/callback','.launch-status'],['/account','.launch-status'],['/dashboard/33333333-3333-4333-8333-333333333333','.launch-status'],['/missing-page','.document-title']] as const){
      const before=commits;await send('Page.navigate',{url:base+route});await until(async()=>commits>before,route+' committed');await until(()=>evaluate(`!!document.querySelector('${selector}')`),route+' rendered');await until(()=>evaluate("getComputedStyle(document.querySelector('.document-page')).display==='flex'"),'public CSS loaded');await evaluate(`document.documentElement.dataset.theme='${theme}';document.fonts.ready`);await delay(120);
      assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false,route+' overflow');
      if(route==='/about') {
        const geometry=await evaluate("(()=>{const outer=document.querySelector('.about-page').getBoundingClientRect(),story=document.querySelector('.demo-story'),cols=getComputedStyle(story).gridTemplateColumns.split(' ').map(parseFloat),demo=document.querySelector('.product-demo').getBoundingClientRect(),notes=document.querySelector('.demo-notes').getBoundingClientRect();return {outer:outer.width,ratio:cols[0]/cols.reduce((a,b)=>a+b,0),stacked:notes.top>=demo.bottom-1}})()");
        if(width>=1440){assert.ok(geometry.outer>=1380&&geometry.outer<=1520,JSON.stringify({width,geometry}));assert.ok(geometry.ratio>=.69&&geometry.ratio<=.71);assert.ok(await evaluate("document.querySelector('.product-demo').getBoundingClientRect().width>900"),'actual demo expands beyond previous inner cap');}
        if(width<=768)assert.ok(geometry.stacked,'demo and supporting prose stack naturally');
      }
      layouts.push({route,width,theme,overflow:false});
      if(['/about','/legal'].includes(route) && [1920,1440,390].includes(width)){const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(evidence,`${route.slice(1)}-${width}-${theme}.png`),Buffer.from(shot.data,'base64'));
        if(route==='/about') {
          const metrics=await send('Page.getLayoutMetrics');
          const full=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:metrics.cssContentSize.height,scale:1}});
          await writeFile(path.join(evidence,`about-${width}-${theme}-full.png`),Buffer.from(full.data,'base64'));
          await evaluate("document.querySelector('.demo-story').scrollIntoView({block:'center',behavior:'instant'})");
          const demoShot=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(evidence,`about-${width}-${theme}-demo.png`),Buffer.from(demoShot.data,'base64'));
        }
      }
    }
  }
  const storage = await evaluate('({local:Object.keys(localStorage),session:Object.keys(sessionStorage)})');
  assert.deepEqual(storage,{local:[],session:[]},'public pages never restore/write account or eligibility storage');
  const cookies = await send('Network.getCookies');assert.deepEqual(cookies.cookies,[]);
  await send('Page.navigate',{url:base+'/about'});await until(()=>evaluate("!!document.querySelector('.theme-toggle')"),'public theme control');
  const beforeTheme=await evaluate('document.documentElement.dataset.theme');
  await evaluate("document.querySelector('.theme-toggle').focus()");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',windowsVirtualKeyCode:13});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await until(()=>evaluate(`document.documentElement.dataset.theme!=='${beforeTheme}'`),'public keyboard theme');
  const chosenTheme=await evaluate("localStorage.getItem('nuelexity:theme')");
  assert.deepEqual(await evaluate('Object.keys(localStorage)'),['nuelexity:theme'],'only requested appearance is saved');
  await send('Page.navigate',{url:base+'/legal'});await until(()=>evaluate(`document.documentElement.dataset.theme==='${chosenTheme}'&&!!document.querySelector('#privacy')`),'public theme persists after navigation/reload');

  // An old same-origin session cannot re-enable the separate public bundle.
  await evaluate(`localStorage.setItem('sb-stale-auth-token','PRIVATE_SESSION_MARKER');sessionStorage.setItem('nuelexity:active-thread:stale','PRIVATE_THREAD_MARKER')`);
  await send('Page.navigate',{url:base+'/dashboard/private-thread'});
  await until(()=>evaluate("!!document.querySelector('.launch-status')"),'stale-session restricted');
  assert.ok(!await evaluate("document.body.innerText.includes('PRIVATE_')"));
  await send('Page.navigate',{url:base+'/about'});await until(()=>evaluate("!!document.querySelector('.product-demo')"),'keyboard About');
  await evaluate("document.querySelector('.skip-link').focus()");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await until(()=>evaluate("document.activeElement?.id==='page-content'"),'keyboard skip link');
  for(let i=0;i<25;i++) {
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    assert.ok(!await evaluate("!!document.activeElement.closest('.demo-window')"),'simulation never takes keyboard focus');
  }
  for(const anchor of ['privacy','cookies','terms']) {
    await send('Page.navigate',{url:base+'/legal#'+anchor});
    await until(()=>evaluate(`document.activeElement?.id==='${anchor}'`),'legal anchor focus '+anchor);
    assert.ok(await evaluate(`[...document.querySelectorAll('footer a')].some(a=>a.getAttribute('href')==='/legal#${anchor}')`));
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(mocked,[]);

  await writeFile(path.join(evidence,'verification.json'),JSON.stringify({runtime:'Wrangler 4.154.0 local Pages static handler',responses,layouts,errors,external,mockedPaths:[...new Set(mocked)],applicationCalls:'Zero; no API/config/auth/Turnstile request permitted',storage,chosenTheme,themePersistence:true,cookieCount:cookies.cookies.length,liveCloudflareDeployment:false},null,2));
  console.log('PASS limited Pages emulator: production public indexing/cache, private deep-link noindex/no-store, research/auth/account unavailable, real CSP, assets/404s, sitemap/social/canonical, pages.dev exclusions, 80 rendered dark/light 320/390/768/1440/1920 layouts, keyboard skip/anchor focus and inert demo, empty fresh cookies/storage, stale-session denial. No external or provider requests.');
}finally{socket?.close();chrome.kill();await chrome.exited;await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:150});}
