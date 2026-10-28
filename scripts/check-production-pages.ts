import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { serveFixture, launchChrome } from './http-fixture';

// Exercise actual Node HTML/security headers and client scripts, with no external services.
const backend = await serveFixture(async req => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Guest-Pass' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  return Response.json(new URL(req.url).pathname === '/models' ? { defaultModelId: 'openai/gpt-oss-20b', canSelect: false, answerMode: 'sources-only', models: [] } : { verified: false, verificationRequired: false, expiresAt: null }, { headers });
});
const child = spawn(process.execPath, ['src/server.mjs', '--local-preview'], { env: { PATH: process.env.PATH, PORT: '0', NUELEXITY_ENV_FILE: 'none', BUN_PUBLIC_BACKEND_URL: backend.url.origin }, stdio: ['ignore', 'pipe', 'pipe'] });
let output = ''; child.stdout.on('data', data => { output += data; });
const exited = once(child, 'exit');
const profile = await mkdtemp(path.join(tmpdir(), 'nuelexity-csp-')); const chrome = launchChrome(profile);
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn: () => Promise<unknown>, label: string) { for (let i=0;i<150;i++) { if(await fn())return; await delay(50); } throw new Error('Timed out: '+label); }
let socket: WebSocket | undefined, sequence=0;
const pending = new Map<number,{resolve:(data:any)=>void;reject:(err:Error)=>void}>();
const violations: string[]=[];
function send(method: string, params: any={}) { return new Promise<any>((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>reject(new Error('CDP '+method)),10000);pending.set(id,{resolve:(data)=>{clearTimeout(timer);resolve(data)},reject});socket!.send(JSON.stringify({id,method,params}));}); }
async function evaluate(expression: string) { const data=await send('Runtime.evaluate',{expression,returnByValue:true});if(data.exceptionDetails)throw new Error('Browser expression');return data.result.value; }
try {
  await until(async()=>/port \d+/.test(output),'Node startup'); const port=output.match(/port (\d+)/)![1]; const base=`http://127.0.0.1:${port}`;
  let debugPort='';await until(async()=>{try{debugPort=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]!;return debugPort;}catch{return false;}},'Chrome');
  const tabs=await(await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json() as any[];socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
  socket.onmessage=event=>{const packet=JSON.parse(String(event.data));if(packet.method==='Log.entryAdded'&&/content security|content-security|violates.*directive/i.test(packet.params.entry.text))violations.push(packet.params.entry.text);const waiter=pending.get(packet.id);if(!waiter)return;pending.delete(packet.id);packet.error?waiter.reject(new Error(packet.error.message)):waiter.resolve(packet.result);};
  await new Promise<void>(resolve=>{socket!.onopen=()=>resolve();});await send('Page.enable');await send('Runtime.enable');await send('Log.enable');
  for(const [route,selector] of [['/','#question'],['/about','.return-cat'],['/legal#terms','#terms'],['/auth','.oauth-button'],['/account','.oauth-button'],['/missing','.document-title']] as const){
    const response=await fetch(base+route);assert.equal(response.status,route==='/missing'?404:200);
    assert.match(response.headers.get('content-security-policy')!,/script-src 'self'/);assert.match(response.headers.get('cache-control')!,/no-store/);
    await send('Page.navigate',{url:base+route});await until(()=>evaluate(`!!document.querySelector('${selector}')`),route+' rendered under CSP');
    await until(()=>evaluate('!!document.querySelector(\'.site-footer\')'),'footer');
    if (route === '/' || route === '/about') assert.ok(await evaluate(`!!document.querySelector('script[type="application/ld+json"]')`), 'public structured data survives app initialization');
  }
  assert.deepEqual(violations,[],'No actual CSP failures on local app routes');
  console.log('PASS real Node frontend + Chrome: public/private/missing routes render under actual CSP/no-store headers; account guard and footer work. External services not used.');
} finally {socket?.close();chrome.kill();await chrome.exited;child.kill();await exited;backend.stop();await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:150});}
