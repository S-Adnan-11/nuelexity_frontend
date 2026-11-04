import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { serveFixture, staticResponse, launchChrome } from "./http-fixture";
const requests:string[]=[], external:string[]=[], errors:string[]=[];
let allowed=false;
const server=await serveFixture(async req=>{
  const url=new URL(req.url);requests.push(url.pathname);
  if(url.pathname==='/config.json')return Response.json({BUN_PUBLIC_BACKEND_URL:server.url.origin,BUN_PUBLIC_SUPABASE_URL:server.url.origin+'/supabase',BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-key',BUN_PUBLIC_TURNSTILE_SITE_KEY:'fixture-site-key'});
  if(/^\/(models|ready|health|guest|conversations|supabase|nuelexity_ask)(\/|$)/.test(url.pathname)) {
    assert.ok(allowed,'no API/auth/provider work before affirmative declaration');
    assert.ok(!url.pathname.includes('nuelexity_ask'),'no search at all');
    if(url.pathname==='/models')return Response.json({defaultModelId:'openai/gpt-oss-20b',canSelect:false,answerMode:'sources-only',models:[]});
    if(url.pathname==='/guest/session')return Response.json({verified:false,verificationRequired:true,expiresAt:null});
    return Response.json({status:'ready'});
  }
  return staticResponse('dist',url.pathname);
});
const profile=await mkdtemp('/tmp/nuelexity-eligibility-');const chrome=launchChrome(profile);
const evidence=path.resolve('docs/evidence/policy-corrections-2026-10-30/eligibility');await mkdir(evidence,{recursive:true});
const pending=new Map<number,{resolve:(v:any)=>void,reject:(e:Error)=>void}>();let socket:WebSocket|undefined,id=0,commits=0;
const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function until(fn:()=>Promise<unknown>,label:string){for(let i=0;i<200;i++){if(await fn())return;await delay(50)}throw new Error(label+" "+JSON.stringify(await evaluate("({path:location.pathname,body:document.body.innerText.slice(0,600),resources:performance.getEntriesByType('resource').map(r=>new URL(r.name).pathname).slice(-12),focus:document.activeElement.outerHTML.slice(0,150)})")))}
function send(method:string,params:any={}){return new Promise<any>((resolve,reject)=>{const sequence=++id;pending.set(sequence,{resolve,reject});socket!.send(JSON.stringify({id:sequence,method,params}));})}
async function evaluate(expression:string){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error('Expression: '+expression.slice(0,100));return r.result.value}
async function go(route:string){const before=commits;await send('Page.navigate',{url:server.url.origin+route});await until(async()=>commits>before,'commit');await until(()=>evaluate("!!document.querySelector('.eligibility-page')"),'eligibility page');await evaluate('document.fonts.ready');await delay(80)}
async function key(key:string,code:number){await send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key===' '?'Space':key,windowsVirtualKeyCode:code,...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key===' '?'Space':key,windowsVirtualKeyCode:code});}
try{
  let port='';await until(async()=>{try{port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]!;return port}catch{return false}},'Chrome');
  const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json() as any[];socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  socket.onmessage=event=>{const p=JSON.parse(String(event.data));if(p.method==='Page.frameNavigated'&&!p.params.frame.parentId)commits++;if(p.method==='Runtime.exceptionThrown')errors.push(p.params.exceptionDetails.exception?.description||p.params.exceptionDetails.text);if(p.method==='Fetch.requestPaused'){const url=new URL(p.params.request.url);if(url.origin!==server.url.origin){external.push(url.origin);void send('Fetch.failRequest',{requestId:p.params.requestId,errorReason:'BlockedByClient'}).catch(e=>{if(!/Invalid InterceptionId/.test(e.message))errors.push('Interception failed')})}else void send('Fetch.continueRequest',{requestId:p.params.requestId}).catch(e=>{if(!/Invalid InterceptionId/.test(e.message))errors.push('Interception failed')})}const w=pending.get(p.id);if(w){pending.delete(p.id);p.error?w.reject(new Error(p.error.message)):w.resolve(p.result)}};
  await new Promise<void>(r=>{socket!.onopen=()=>r()});await send('Page.enable');await send('Emulation.setFocusEmulationEnabled',{enabled:true});await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
  const layouts:object[]=[];
  for(const width of [1920,1440,390,320])for(const theme of ['dark','light'])for(const route of ['/dashboard','/auth','/account','/auth/callback']){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<800});await go(route);await evaluate(`document.documentElement.dataset.theme='${theme}'`);
    assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false);
    assert.equal(await evaluate("document.querySelectorAll('input:checked').length"),0);
    assert.equal(await evaluate("document.querySelector('button[type=submit]').disabled"),true);
    assert.deepEqual(await evaluate('({local:Object.keys(localStorage),session:Object.keys(sessionStorage)})'),{local:[],session:[]});
    assert.ok(!requests.some(p=>p.includes('/assets/PrivateApp-')));
    const geometry=await evaluate("(()=>{const c=document.querySelector('.eligibility-content').getBoundingClientRect(),m=document.querySelector('.eligibility-page').getBoundingClientRect();return {x:c.x,width:c.width,top:c.top,bottom:c.bottom,mainTop:m.top,mainHeight:m.height,height:c.height,textAlign:getComputedStyle(document.querySelector('.eligibility-content')).textAlign}})()");
    assert.ok(Math.abs(geometry.x+geometry.width/2-width/2)<1,'horizontally centered');
    if(geometry.height+48<=geometry.mainHeight)assert.ok(Math.abs((geometry.top+geometry.bottom)/2-(geometry.mainTop+geometry.mainHeight/2))<2,'vertically centered within usable main');
    assert.equal(geometry.textAlign,'left');assert.ok(geometry.top>=0);
    if(route==='/dashboard'&&[390,1440,1920].includes(width)) {const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(path.join(evidence,`eligibility-${width}-${theme}.png`),Buffer.from(shot.data,'base64'));}
    layouts.push({width,theme,route,geometry});
  }
  // Short and landscape screens must start at the beginning and scroll to Continue.
  for(const [width,height] of [[390,480],[844,390]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await go('/dashboard');
    assert.ok(await evaluate("document.querySelector('.eligibility-content').getBoundingClientRect().top>=0"));
    await evaluate("document.querySelector('button[type=submit]').scrollIntoView({block:'center'})");
    assert.ok(await evaluate("(()=>{const r=document.querySelector('button[type=submit]').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()"));
    assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false);
  }
  await go('/auth');
  await send('Page.bringToFront');await evaluate("document.querySelector('input').focus()");await key(' ',32);
  assert.equal(await evaluate("document.querySelector('button[type=submit]').disabled"),true,'adult declaration alone is insufficient');
  await key('Tab',9);await key(' ',32);
  assert.equal(await evaluate("document.querySelector('button[type=submit]').disabled"),false,'separate terms assent');
  await evaluate("document.querySelector('button[type=submit]').focus()");allowed=true;await key('Enter',13);
  await until(()=>evaluate("!!document.querySelector('.auth-card')"),'auth opens after declaration');
  assert.equal(external.length,0);
  const record=await evaluate("JSON.parse(sessionStorage.getItem('nuelexity:eligibility.v1'))");assert.ok(record.adult&&record.terms);assert.ok(!('birthDate'in record));
  await send('Page.navigate',{url:server.url.origin+'/dashboard'});
  assert.ok(!await evaluate("[...document.querySelectorAll('button')].some(b=>/Start guest/.test(b.innerText))"),'no extra verification button');
  await until(async()=>external.length===1,'blocked simulated Turnstile load');assert.equal(external[0],'https://challenges.cloudflare.com');
  await evaluate('sessionStorage.clear()');allowed=false;
  await go('/dashboard');assert.ok(!await evaluate("!!document.querySelector('#question')"),'clearing confirmation restores gate');
  assert.deepEqual(errors,[]);
  await writeFile(path.join(evidence,'verification.json'),JSON.stringify({layouts,recordFields:Object.keys(record),externalRequestsBlocked:external,beforeDeclarationApiCalls:0,searchCalls:0,automaticGuestVerification:true,keyboardConfirmation:true,termsSeparate:true,storageClearingRechecks:true},null,2));
  console.log('PASS eligibility: 32 private route/theme/width layouts plus short screens, unchecked affirmative age + terms, no private client/API before declaration, keyboard completion, automatic bot script only after eligibility and guest entry, recheck after storage clearing. All third parties blocked.');
}catch(error){console.error(JSON.stringify({errors,external,lastRequests:requests.slice(-20)}));throw error;}finally{socket?.close();chrome.kill();await chrome.exited;server.stop();await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:150})}
