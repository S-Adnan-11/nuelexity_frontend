import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { createHash } from "node:crypto";
import { canonicalOrigin, routeMetadata, routeStructuredData } from "../src/lib/seo";
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
  if(privateRoute){assert.match(cache||"",/no-store/);assert.match(robots||"",/noindex/);assert.match(html,/name="robots" content="noindex,nofollow"/);assert.ok(!html.includes('rel="canonical"'));assert.ok(!html.includes('application/ld+json'));}
  if(["/","/about","/legal"].includes(route)){assert.ok(!robots?.includes("noindex"),"production page is indexable "+route);assert.ok(!cache?.includes("no-store"),"no local-preview cache policy on production public page");assert.ok(html.includes(`rel="canonical" href="https://nuelexity.devs.surf${route}"`));assert.ok(html.includes('property="og:image" content="https://nuelexity.devs.surf/brand/v2/social/open-graph.png"'));}
  if(["/","/about","/legal"].includes(route)) {
    const meta=routeMetadata(route),escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('"','&quot;');
    assert.match(html,/<html lang="en">/);assert.equal((html.match(/<h1\b/g)||[]).length,1);
    assert.ok(html.includes(`<title>${escape(meta.title)}</title>`));
    for(const [tag,value] of [['description',meta.description],['twitter:title',meta.title],['twitter:description',meta.description]] as const)assert.ok(html.includes(`name="${tag}" content="${escape(value)}"`),tag);
    assert.ok(!/Public preview|Research and sign-in are (?:closed|not open)/.test(html));
    const schemas=[...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)].map(m=>m[1]!);
    assert.deepEqual(schemas.map(s=>JSON.parse(s)),routeStructuredData(route)?[routeStructuredData(route)]:[]);
    for(const data of schemas)assert.ok(csp?.includes("'sha256-"+createHash('sha256').update(data).digest('base64')+"'"),'structured-data CSP hash');
    assert.ok(!/SearchAction|AggregateRating|"@type":"Organization"/.test(schemas.join('')));
    if(route==='/') {
      assert.ok(html.includes('role="status" class="sr-only">Loading…')&&html.includes('<noscript>'),'quiet accessible app entry with a no-JavaScript explanation');
      assert.ok(!/about-hero|data-prerendered-public|Where curiosity<br\s*\/>finds its answers/.test(html),'no promotional page in initial HTML');
      const token=JSON.parse(await readFile('site-content.json','utf8')).searchConsoleVerification;
      assert.ok(token&&html.slice(0,html.indexOf('</head>')).includes(`name="google-site-verification" content="${token}"`),'Search Console tag preserved in head');
    }
  }
  if(route==="/config.json"){validatePagesConfig(JSON.parse(html));assert.match(cache||"",/no-store/);}
  responses.push({route,status:response.status,robots,cache,csp:!!csp});
}
for(const route of ["/about/","/legal/","/dashboard/"]){const r=await fetch(base+route,{redirect:"manual"});assert.equal(r.status,301);assert.equal(new URL(r.headers.get('location')!,base).pathname,route.slice(0,-1));}
const sitemap=await(await fetch(base+"/sitemap.xml")).text();assert.equal((sitemap.match(/<loc>/g)||[]).length,3);assert.ok(!/dashboard|account|callback/.test(sitemap));
assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]),['https://nuelexity.devs.surf/','https://nuelexity.devs.surf/about','https://nuelexity.devs.surf/legal']);assert.ok(!/lastmod|pages\.dev/.test(sitemap));
const robotsText=await(await fetch(base+"/robots.txt")).text();assert.match(robotsText,/User-agent: \*\nAllow: \/\nSitemap: https:\/\/nuelexity.devs.surf\/sitemap.xml/);assert.ok(!/Disallow|noindex/i.test(robotsText));
const entry=await(await fetch(base+"/about")).text();
for(const [,asset] of entry.matchAll(/(?:href|src)="(\/assets\/[^\"]+)"/g)){const r=await fetch(base+asset);assert.equal(r.status,200);assert.match(r.headers.get("cache-control")||"",/immutable/);}
for(const asset of ['/brand/v2/social/open-graph.png','/brand/v2/icons/favicon.ico','/brand/v2/icons/favicon.svg','/brand/v2/logos/lockup-sage.svg','/brand/v2/logos/lockup-ink.svg'])assert.equal((await fetch(base+asset)).status,200,asset);
const image=Buffer.from(await(await fetch(base+'/brand/v2/social/open-graph.png')).arrayBuffer());assert.deepEqual([image.readUInt32BE(16),image.readUInt32BE(20)],[1200,630]);
for(const host of ["review-project.pages.dev","review-version.review-project.pages.dev"]){
  // fetch controls Host itself; raw HTTP is needed to exercise host match rules.
  const robots=await new Promise<string>((resolve,reject)=>{const target=new URL(base);http.get({hostname:target.hostname,port:target.port,path:'/about',headers:{host}},r=>{r.resume();r.on('end',()=>resolve(String(r.headers['x-robots-tag']||'')))}).on('error',reject)});
  assert.match(robots,/noindex/,"pages.dev is excluded from indexing");
}
const profile=await mkdtemp("/tmp/nuelexity-pages-chrome-");const chrome=launchChrome(profile);
let socket:WebSocket|undefined,sequence=0,commits=0;const pending=new Map<number,{resolve:(v:any)=>void,reject:(e:Error)=>void}>();
const errors:string[]=[],external:string[]=[],mocked:string[]=[];
let holdScripts=false;const heldScripts:string[]=[];
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn:()=>Promise<unknown>,label:string){for(let i=0;i<200;i++){if(await fn())return;await delay(50)}throw new Error("Pages browser timeout: "+label)}
function send(method:string,params:any={}){return new Promise<any>((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>reject(new Error("CDP timeout "+method)),15000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v)},reject:e=>{clearTimeout(timer);reject(e)}});socket!.send(JSON.stringify({id,method,params}));});}
// Navigation can cancel a paused request before its interception response arrives.
async function intercepted(method:string,params:any){try{return await send(method,params)}catch(error){if(!/Invalid InterceptionId/.test(String(error)))throw error}}
function respond(method:string,params:any){void intercepted(method,params).catch(()=>errors.push('Interception failed'));}
async function evaluate(expression:string){const r=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error("Pages expression failed: "+expression.slice(0,100));return r.result.value;}
try{
  let port="";await until(async()=>{try{port=(await readFile(path.join(profile,"DevToolsActivePort"),"utf8")).split("\n")[0]!;return port}catch{return false}},"Chrome");
  const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json() as any[];socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  socket.onmessage=event=>{const p=JSON.parse(String(event.data));if(p.method==='Page.frameNavigated'&&!p.params.frame.parentId)commits++;if(p.method==='Runtime.exceptionThrown')errors.push('Uncaught browser exception');if(p.method==='Runtime.consoleAPICalled'&&p.params.type==='error')errors.push('Console: '+p.params.args.map((a:any)=>a.value||a.description||'').join(' ').slice(0,240));if(p.method==='Log.entryAdded'&&/content.security|violat.*directive/i.test(p.params.entry.text))errors.push('CSP failure');
    if(p.method==='Fetch.requestPaused'){
      const url=new URL(p.params.request.url);let body:object|undefined;
      if(url.origin!==base){external.push(url.origin);respond('Fetch.failRequest',{requestId:p.params.requestId,errorReason:'BlockedByClient'});}
      else if(url.pathname==='/nuelexity_ask'){errors.push('Unexpected search submission');respond('Fetch.failRequest',{requestId:p.params.requestId,errorReason:'BlockedByClient'});}
      else{
        if(holdScripts&&url.pathname.startsWith('/assets/')&&url.pathname.endsWith('.js')){heldScripts.push(p.params.requestId);return;}
        if(url.pathname==='/config.json')body={BUN_PUBLIC_BACKEND_URL:base,BUN_PUBLIC_SUPABASE_URL:base+'/supabase',BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-key',BUN_PUBLIC_TURNSTILE_SITE_KEY:''};
        else if(url.pathname==='/models')body={defaultModelId:'openai/gpt-oss-20b',canSelect:false,answerMode:'sources-only',models:[]};
        else if(['/ready','/health'].includes(url.pathname))body={status:'ready'};
        else if(url.pathname==='/guest/session')body={verified:false,verificationRequired:false,expiresAt:null};
        if(body){mocked.push(url.pathname);respond('Fetch.fulfillRequest',{requestId:p.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});}
        else respond('Fetch.continueRequest',{requestId:p.params.requestId});
      }
    }
    const w=pending.get(p.id);if(w){pending.delete(p.id);p.error?w.reject(new Error(p.error.message)):w.resolve(p.result);}
  };
  await new Promise<void>(resolve=>{socket!.onopen=()=>resolve()});await send('Page.enable');
  await send("Page.addScriptToEvaluateOnNewDocument", { source: 'window.__entryViews=[];new MutationObserver(()=>{if(location.pathname!=="/")return;for(const [name,selector] of [["promotional",".about-hero"],["eligibility",".eligibility-page"],["workspace","#question"]])if(document.querySelector(selector)&&!window.__entryViews.includes(name))window.__entryViews.push(name)}).observe(document,{childList:true,subtree:true});document.addEventListener("DOMContentLoaded",()=>{window.__initialH1=document.querySelector("h1");window.__initialText=window.__initialH1?.textContent;window.__domReadyTheme=document.documentElement.dataset.theme},{once:true});' });await send('Runtime.enable');await send('Log.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
  const noJavaScript:object[]=[];
  await send('Emulation.setScriptExecutionDisabled',{value:true});
  for(const route of ['/','/about','/legal']){
    const before=commits;await send('Page.navigate',{url:base+route});await until(async()=>commits>before,'no-JS commit');await until(()=>evaluate("document.readyState==='complete'&&!!document.querySelector('main h1')"),'no-JS public HTML');
    const content=await evaluate("({h1:document.querySelector('main h1').textContent,main:document.querySelector('main').innerText,lang:document.documentElement.lang,links:document.querySelectorAll('main a[href]').length})");
    assert.ok(content.main.length>150&&content.links>0&&content.lang==='en');noJavaScript.push({route,h1:content.h1,readable:true});
  }
  await send('Emulation.setScriptExecutionDisabled',{value:false});
  // Hold the actual app bundles while HTML and early theme initialization paint.
  // Exercise both fresh and returning tabs, without seeding away the fresh gate.
  for(const theme of ['dark','light']) {
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme}]});
    await evaluate('sessionStorage.clear();localStorage.clear()');
    for(const returning of [false,true]) {
      // Leave the preceding workspace before measuring the new document's calls.
      const publicCommit=commits;await send('Page.navigate',{url:base+'/legal'});await until(async()=>commits>publicCommit,'public commit before slow entry');
      await until(()=>evaluate("document.readyState==='complete'&&!!document.querySelector('.legal-nav')&&Object.keys(document.getElementById('root')).some(k=>k.startsWith('__reactContainer'))"),'public startup settled');
      const callsBefore=mocked.length;holdScripts=true;
      const before=commits;await send('Page.navigate',{url:base+'/'});await until(async()=>commits>before,'slow root commit');
      await until(async()=>heldScripts.length>0&&await evaluate("!!document.querySelector('main [role=status]')"),'root shell while app JavaScript is held');
      assert.equal(await evaluate('document.documentElement.dataset.theme'),theme,'early theme on slow entry');
      assert.ok(await evaluate("!document.querySelector('.about-hero,.eligibility-page,#question')&&document.querySelector('h1').textContent==='Nuelexity research'"),'only neutral startup HTML is displayed');
      assert.equal(mocked.length,callsBefore,'no config/auth/API before the app loads');
      holdScripts=false;await Promise.all(heldScripts.splice(0).map(requestId=>intercepted('Fetch.continueRequest',{requestId})));
      await until(()=>evaluate(returning?"!!document.querySelector('#question')":"!!document.querySelector('.eligibility-page')"),returning?'returning root composer':'fresh root eligibility');
      if(!returning) {
        assert.equal(mocked.length,callsBefore,'fresh root performs no private initialization before eligibility');
        assert.equal(await evaluate("document.querySelectorAll('input:checked').length"),0);
        await evaluate("document.querySelectorAll('input[type=checkbox]').forEach(i=>i.click());document.querySelector('.eligibility-page form').requestSubmit()");
        await until(()=>evaluate("!!document.querySelector('#question')"),'root composer after confirmation');
      }
      assert.equal(await evaluate('location.pathname'),'/','research entry stays at the root');
      assert.deepEqual(await evaluate('window.__entryViews'),returning?['workspace']:['eligibility','workspace'],'no promotional flash or returning eligibility flash');
    }
  }
  await send("Page.addScriptToEvaluateOnNewDocument", { source: 'sessionStorage.setItem("nuelexity:eligibility.v1",JSON.stringify({version:"adults-v1-2026-10-30",adult:true,terms:true,confirmedAt:new Date().toISOString()}));' });
  const layouts:object[]=[];
  for(const width of [1440,390])for(const theme of ['dark','light']){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<800});
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme}]});
    for(const [route,selector] of [['/','#question'],['/about','.product-demo'],['/legal','.document-title'],['/auth','.oauth-button'],['/auth/callback','.auth-card'],['/account','.oauth-button'],['/dashboard/33333333-3333-4333-8333-333333333333','#question'],['/missing-page','.document-title']] as const){
      const callsBefore=mocked.length;
      const before=commits;await send('Page.navigate',{url:base+route});await until(async()=>commits>before,route+' committed');await until(()=>evaluate(`!!document.querySelector('${selector}')`),route+' rendered');await until(()=>evaluate("Object.keys(document.getElementById('root')).some(k=>k.startsWith('__reactContainer'))"),'interactive root');await evaluate('document.fonts.ready');await delay(120);
      assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false,route+' overflow');
      assert.equal(await evaluate('document.documentElement.dataset.theme'),theme,'system theme at startup');
      if(['/','/about','/legal'].includes(route)) {
        if(route!=='/')assert.ok(await evaluate("window.__initialH1===document.querySelector('h1')&&window.__initialText===document.querySelector('h1').textContent"),'prerendered public heading is hydrated in place: '+route);
        assert.equal(await evaluate('window.__domReadyTheme'),theme,'theme before app paint');
        assert.equal(await evaluate('document.title'),routeMetadata(route).title);
        assert.deepEqual(await evaluate("[...document.head.querySelectorAll('script[type=\"application/ld+json\"]')].map(s=>JSON.parse(s.textContent))"),routeStructuredData(route)?[routeStructuredData(route)]:[]);
        assert.ok(!await evaluate("!!document.querySelector('.eligibility-page')"),'public page stays public after startup');
        if(route!=='/')assert.equal(mocked.length,callsBefore,'public HTML/hydration makes no configuration/auth/backend calls');
      }
      layouts.push({route,width,theme,overflow:false});
      if(['/about','/legal','/auth'].includes(route)){const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(evidence,`${route.slice(1)}-${width}-${theme}.png`),Buffer.from(shot.data,'base64'));}
    }
  }
  await send('Page.navigate',{url:base+'/about'});await until(()=>evaluate("!!document.querySelector('.about-hero .primary-link')"),'About');await delay(150);
  await evaluate("sessionStorage.removeItem('nuelexity:eligibility.v1');document.querySelector('.about-hero .primary-link').click()");
  await until(()=>evaluate("!!document.querySelector('.eligibility-page')&&document.querySelector('meta[name=robots]').content==='noindex,nofollow'"),'workspace eligibility');
  assert.equal(await evaluate("document.querySelectorAll('script[type=\"application/ld+json\"]').length"),0);
  assert.equal(await evaluate("document.querySelectorAll('input:checked').length"),0);
  await evaluate("document.querySelector('a[href=\"/about\"]').click()");await until(()=>evaluate("document.querySelector('script[type=\"application/ld+json\"]')?.textContent.includes('AboutPage')"),'About schema restored');
  await evaluate("document.querySelector('a[aria-label=\"Nuelexity home\"]').click()");await until(()=>evaluate("document.querySelector('script[type=\"application/ld+json\"]')?.textContent.includes('WebSite')"),'homepage schema restored');
  const xmlValid=await evaluate(`!new DOMParser().parseFromString(${JSON.stringify(sitemap)},'application/xml').querySelector('parsererror')`);assert.ok(xmlValid,'well-formed sitemap XML');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  await writeFile(path.join(evidence,'verification.json'),JSON.stringify({runtime:'Wrangler 4.154.0 local Pages static handler',responses,layouts,noJavaScript,aboutLegalHydratedInPlace:true,rootFreshAndReturningSlowEntry:true,structuredDataNavigation:true,sitemapXmlValid:xmlValid,errors,external,mockedPaths:[...new Set(mocked)],applicationCalls:'Only intercepted local fixtures; no search/generation or real auth',liveCloudflareDeployment:false},null,2));
  console.log('PASS Pages emulator: fresh and returning root entry with delayed JavaScript in both themes, production indexing/cache, private deep-link noindex/no-store, OAuth/account entry routes, real CSP, assets/404s, sitemap/social/canonical, pages.dev exclusions, 32 rendered dark/light desktop/mobile layouts. No external or provider requests.');
}finally{socket?.close();chrome.kill();await chrome.exited;await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:150});}
