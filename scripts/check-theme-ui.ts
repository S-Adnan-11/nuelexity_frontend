import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { serveFixture, staticResponse, launchChrome } from "./http-fixture";
const requests:string[]=[],external:string[]=[],errors:string[]=[];
const hashes=JSON.parse(await readFile('dist/csp-hashes.json','utf8')) as string[];
const server=await serveFixture(async req=>{
  const url=new URL(req.url);requests.push(url.pathname);
  if(url.pathname==='/config.json')return Response.json({BUN_PUBLIC_BACKEND_URL:server.url.origin,BUN_PUBLIC_SUPABASE_URL:server.url.origin+'/supabase',BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-key',BUN_PUBLIC_TURNSTILE_SITE_KEY:''});
  if(url.pathname==='/models')return Response.json({defaultModelId:'openai/gpt-oss-20b',canSelect:false,answerMode:'sources-only',models:[]});
  if(url.pathname==='/guest/session')return Response.json({verified:false,verificationRequired:false,expiresAt:null});
  if(['/ready','/health'].includes(url.pathname))return Response.json({status:'ready'});
  if(url.pathname==='/nuelexity_ask')throw Error('Theme tests must never search');
  const response=await staticResponse('dist',url.pathname);
  response.headers.set('Content-Security-Policy',`default-src 'self'; script-src 'self' ${hashes.join(' ')}; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src 'none'; object-src 'none'`);
  return response;
});
const profile=await mkdtemp('/tmp/nuelexity-theme-');const chrome=launchChrome(profile);
const evidence=path.resolve('docs/evidence/policy-corrections-2026-10-30/theme');await mkdir(evidence,{recursive:true});
let socket:WebSocket|undefined,id=0,commits=0;const pending=new Map<number,{resolve:(v:any)=>void,reject:(e:Error)=>void}>();
const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function until(fn:()=>Promise<unknown>,label:string){for(let i=0;i<250;i++){if(await fn())return;await delay(40)}throw Error('Theme: '+label+' '+JSON.stringify(await evaluate("({theme:document.documentElement.dataset.theme,media:matchMedia('(prefers-color-scheme: light)').matches,stored:(()=>{try{return localStorage.getItem('nuelexity:theme')}catch{return 'blocked'}})(),body:document.body.innerText.slice(0,80)})")))}
function send(method:string,params:any={}){return new Promise<any>((resolve,reject)=>{const sequence=++id;const timer=setTimeout(()=>reject(Error(method)),15000);pending.set(sequence,{resolve:v=>{clearTimeout(timer);resolve(v)},reject:e=>{clearTimeout(timer);reject(e)}});socket!.send(JSON.stringify({id:sequence,method,params}));})}
async function evaluate(expression:string){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(expression.slice(0,100));return r.result.value}
async function go(route:string,selector=route==='/about'?'.product-demo':route==='/legal'?'.legal-nav':'.eligibility-page'){const before=commits;await send('Page.navigate',{url:server.url.origin+route});await until(async()=>commits>before,'commit');await until(()=>evaluate(`!!document.querySelector('${selector}')`),'render');await evaluate('document.fonts.ready')}
async function pressEnter(){await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',windowsVirtualKeyCode:13});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13})}
try{
  let port='';await until(async()=>{try{port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]!;return port}catch{return false}},'Chrome');
  const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json() as any[];socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  socket.onmessage=event=>{const p=JSON.parse(String(event.data));if(p.method==='Page.frameNavigated'&&!p.params.frame.parentId)commits++;if(p.method==='Runtime.exceptionThrown')errors.push('browser exception');if(p.method==='Fetch.requestPaused'){const url=new URL(p.params.request.url);if(url.origin!==server.url.origin){external.push(url.origin);void send('Fetch.failRequest',{requestId:p.params.requestId,errorReason:'BlockedByClient'}).catch(e=>{if(!/Invalid InterceptionId/.test(e.message))errors.push('Interception failed')})}else void send('Fetch.continueRequest',{requestId:p.params.requestId}).catch(e=>{if(!/Invalid InterceptionId/.test(e.message))errors.push('Interception failed')})}const w=pending.get(p.id);if(w){pending.delete(p.id);p.error?w.reject(Error(p.error.message)):w.resolve(p.result)}};
  await new Promise<void>(r=>{socket!.onopen=()=>r()});await send('Page.enable');await send('Runtime.enable');await send('Emulation.setFocusEmulationEnabled',{enabled:true});await send('Fetch.enable',{patterns:[{urlPattern:'https://*'}]});
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});
  await go('/about');assert.equal(await evaluate('document.documentElement.dataset.theme'),'light');
  assert.deepEqual(await evaluate('Object.keys(localStorage)'),[],'system default does not write');
  const early=await send('Page.addScriptToEvaluateOnNewDocument',{source:"document.addEventListener('DOMContentLoaded',()=>window.themeAtDomReady=document.documentElement.dataset.theme,{once:true})"});
  await go('/about');assert.equal(await evaluate('window.themeAtDomReady'),'light');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'}]});
  await until(()=>evaluate("document.documentElement.dataset.theme==='dark'"),'follows system changes before explicit choice');
  await evaluate("document.querySelector('.theme-toggle').focus()");await pressEnter();
  await until(()=>evaluate("document.documentElement.dataset.theme==='light'"),'keyboard chooses light');
  assert.equal(await evaluate("localStorage.getItem('nuelexity:theme')"),'light');
  assert.equal(await evaluate("document.querySelector('.theme-toggle').getAttribute('aria-label')"),'Switch to dark theme');
  for(const route of ['/legal','/auth','/account','/dashboard']) {await go(route);assert.equal(await evaluate('document.documentElement.dataset.theme'),'light');assert.equal(await evaluate('window.themeAtDomReady'),'light','saved appearance applied before app starts');}
  assert.ok(!requests.some(p=>p.startsWith('/assets/PrivateApp-')),'eligibility remains unconfirmed');
  await evaluate("sessionStorage.setItem('nuelexity:eligibility.v1',JSON.stringify({version:'adults-v1-2026-10-30',adult:true,terms:true,confirmedAt:new Date().toISOString()}))");
  const layouts:object[]=[];
  for(const width of [390,1440,1920])for(const route of ['/about','/dashboard','/auth'])for(const theme of ['dark','light']){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<800});
    await go(route,route==='/dashboard'?'#question':route==='/auth'?'.auth-card':'.product-demo');
    if(await evaluate('document.documentElement.dataset.theme')!==theme)await evaluate("document.querySelector('.theme-toggle').click()");
    await until(()=>evaluate(`document.documentElement.dataset.theme==='${theme}'`),'theme selected');
    assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false);
    const metric=await evaluate("(()=>{const b=document.querySelector('.theme-toggle'),r=b.getBoundingClientRect(),s=getComputedStyle(b),lum=c=>{const v=c.match(/\\d+(?:\\.\\d+)?/g).slice(0,3).map(Number).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4});return .2126*v[0]+.7152*v[1]+.0722*v[2]},a=lum(s.color),z=lum(s.backgroundColor);return {width:r.width,height:r.height,top:r.top,right:r.right,contrast:(Math.max(a,z)+.05)/(Math.min(a,z)+.05),label:b.getAttribute('aria-label')}})()");
    assert.ok(metric.width>=44&&metric.height>=44);assert.ok(metric.top>=0&&metric.top<100&&metric.right<=width);assert.ok(metric.contrast>=4.5);
    layouts.push({width,route,theme,...metric});
  }
  // Storage blocking keeps the action usable; early boot also handles this case (unit test).
  const blocked=await send('Page.addScriptToEvaluateOnNewDocument',{source:"Storage.prototype.getItem=function(){throw Error('blocked')};Storage.prototype.setItem=function(){throw Error('blocked')}"});
  await go('/about');const before=await evaluate('document.documentElement.dataset.theme');await evaluate("document.querySelector('.theme-toggle').click()");await until(()=>evaluate(`document.documentElement.dataset.theme!=='${before}'`),'blocked-storage action');
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:blocked.identifier});
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:early.identifier});
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  await writeFile(path.join(evidence,'verification.json'),JSON.stringify({systemInitiallyRespected:true,noInitialWrite:true,keyboardAction:true,explicitChoicePersistsAcrossRoutesAndReload:true,earlyThemeBeforeApp:true,blockedStorageUsable:true,layouts,external,errors},null,2));
  console.log('PASS theme: system initial/change, no initial storage write, keyboard action, explicit preference across reload/routes, early prepaint script, 44px controls/contrast, mobile workspace access and blocked storage. No provider requests.');
}finally{socket?.close();chrome.kill();await chrome.exited;server.stop();await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:150})}
