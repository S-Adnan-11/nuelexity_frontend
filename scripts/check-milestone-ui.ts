import { serveFixture, staticResponse, launchChrome } from './http-fixture';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { strict as assert } from 'node:assert';

// Entirely fictional identities and local service fixtures. Never call real OAuth/AI.
const owner = '11111111-1111-4111-8111-111111111111', thread = '33333333-3333-4333-8333-333333333333';
let user: any = { id: owner, aud: 'authenticated', role: 'authenticated', email: 'curious.researcher@example.test', created_at: 'now', app_metadata: { provider: 'google' }, user_metadata: { full_name: 'Ada Curious', picture: 'https://avatar.example.test/profile' }, identities: [{ id: 'one', identity_id: 'one', user_id: owner, provider: 'google', identity_data: { full_name: 'Ada Curious', picture: 'https://avatar.example.test/profile' } }, { id: 'two', identity_id: 'two', user_id: owner, provider: 'github', identity_data: { user_name: 'ada-cat' } }] };
let failLogout = false, logoutCount = 0, streamCancelled = false, avatarFails = false;
const logoutScopes: string[] = [], network = new Set<string>();
const model = { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B', provider: 'Groq', preview: false, available: true, maxInputBytes: 6000, maxOutputTokens: 1024 };
const server = await serveFixture(async req => {
  const url = new URL(req.url); network.add(url.pathname);
  if (url.pathname === "/ready") return Response.json({ status: "ready" });
  if (url.pathname === '/config.json') return Response.json({ BUN_PUBLIC_BACKEND_URL: server.url.origin, BUN_PUBLIC_SUPABASE_URL: server.url.origin + '/supabase', BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'fixture-key', BUN_PUBLIC_TURNSTILE_SITE_KEY: '' });
  if (url.pathname.startsWith('/supabase/auth/v1')) {
    if (url.pathname.endsWith('/logout')) {
      logoutCount++; logoutScopes.push(url.searchParams.get('scope') || '');
      await new Promise(resolve => setTimeout(resolve, 160));
      return failLogout ? Response.json({ msg: 'fixture offline', code: 'fixture' }, { status: 503 }) : new Response(null, { status: 204 });
    }
    return Response.json(user);
  }
  if (url.pathname === '/models') return Response.json({ defaultModelId: model.id, canSelect: !!req.headers.get('Authorization'), answerMode: 'ai', models: [model] });
  if (url.pathname === '/guest/session') return Response.json({ verified: false, verificationRequired: false, expiresAt: null });
  if (url.pathname === '/conversations') return Response.json({ conversations: [{ id: thread, title: 'Private fixture research', created_at: 'now', updated_at: 'now' }] });
  if (url.pathname === '/conversations/' + thread) return Response.json({ conversation: { id: thread, title: 'Private fixture research' }, messages: [{ id: 'message', role: 'assistant', content: 'Private fixture answer [1].\n\n| Source | Detail |\n| --- | --- |\n| Evidence | Inspect the original |\n\n```text\n' + 'long-code-'.repeat(24) + '\n```', sources: [{ id: 1, title: 'A local evidence fixture', url: 'https://example.test/evidence', snippet: 'Evidence' }], followUps: [], status: 'complete', created_at: 'now', model, answerKind: 'ai' }] });
  if (url.pathname === '/nuelexity_ask') {
    req.signal.addEventListener('abort', () => { streamCancelled = true; });
    return new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('event: delta\ndata: {"text":"PRIVATE RUNNING ANSWER"}\n\n')); req.signal.addEventListener('abort', () => { try { c.close(); } catch {} }); } }), { headers: { 'Content-Type': 'text/event-stream' } });
  }
  return staticResponse('dist', url.pathname);
});
const profile = await mkdtemp(path.join(tmpdir(), 'nuelexity-milestone-'));
const evidence = process.env.BROWSER_EVIDENCE || path.join(tmpdir(), 'nuelexity-milestone-evidence'); await mkdir(evidence, { recursive: true });
const chrome = launchChrome(profile);
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn: () => Promise<unknown>, label: string) { for (let i = 0; i < 200; i++) { try { if (await fn()) return; } catch (error) { if (!/context.*destroyed|Cannot find context|Inspected target navigated/i.test(String(error))) throw error; } await delay(60); } throw new Error('Timed out: ' + label); }
async function connect(wsUrl: string) {
  const ws = new WebSocket(wsUrl); let id = 0, commits = 0;
  const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
  const send = (method: string, params: any = {}) => new Promise<any>((resolve, reject) => {
    const sequence = ++id; const timer = setTimeout(() => { pending.delete(sequence); reject(new Error('CDP timeout: ' + method)); }, 15000);
    pending.set(sequence, { resolve(value) { clearTimeout(timer); resolve(value); }, reject }); ws.send(JSON.stringify({ id: sequence, method, params }));
  });
  ws.onmessage = event => { const packet = JSON.parse(String(event.data)); if (packet.method === 'Page.frameNavigated' && !packet.params.frame.parentId) commits++; if (packet.method === 'Fetch.requestPaused') {
    void send('Fetch.fulfillRequest', { requestId: packet.params.requestId, responseCode: avatarFails ? 404 : 200,
      responseHeaders: [{ name: 'Content-Type', value: 'image/svg+xml' }, { name: 'Cache-Control', value: 'no-store' }],
      body: avatarFails ? '' : Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#355542"/><circle cx="48" cy="34" r="16" fill="#b8c7ad"/><path d="M16 92c0-38 64-38 64 0" fill="#b8c7ad"/></svg>').toString('base64') });
  } const waiter = pending.get(packet.id); if (!waiter) return; pending.delete(packet.id); if (packet.error) waiter.reject(new Error(packet.error.message)); else waiter.resolve(packet.result); };
  await new Promise<void>(resolve => { ws.onopen = () => resolve(); });
  const evaluate = async (expression: string) => { const data = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (data.exceptionDetails) throw new Error('Browser expression failed: ' + expression.slice(0, 120)); return data.result.value; };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: 'https://*' }] });
  return { send, evaluate, commits: () => commits, close: () => ws.close() };
}
let first: Awaited<ReturnType<typeof connect>> | undefined, second: typeof first;
try {
  let port = '';
  await until(async () => { try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]!; return port; } catch { return false; } }, 'Chrome');
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() as any[];
  first = await connect(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  const { send, evaluate } = first;
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: owner, exp, role: 'authenticated', aud: 'authenticated' })).toString('base64url')}.fixture`;
  const session = () => ({ access_token: token, refresh_token: 'fixture-refresh', expires_at: exp, expires_in: 3600, token_type: 'bearer', user });
  const signedIn = async () => { await evaluate(`localStorage.setItem('sb-127-auth-token', ${JSON.stringify(JSON.stringify(session()))})`); };
  const go = async (route: string, text: string) => { const before = first!.commits(); await send('Page.navigate', { url: new URL(route, server.url).href }); await until(async () => first!.commits() > before, route + ' committed'); await until(async () => await evaluate(`!!document.body?.innerText.includes(${JSON.stringify(text)})`), route); await evaluate('document.fonts.ready'); await delay(150); };
  const shot = async (name: string) => { const data = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await writeFile(path.join(evidence, name + '.png'), Buffer.from(data.data, 'base64')); };
  const sizes = [{ width: 1440, height: 1000 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 700 }];
  await go('/dashboard', 'Guest workspace'); await signedIn(); await go('/account', 'Ada Curious');
  assert.ok(await evaluate("document.body.innerText.includes('Google · GitHub')"));
  await until(async () => await evaluate("document.querySelector('.avatar img')?.naturalWidth > 0"), 'supplied provider image');
  await shot('account-provider-avatar');
  avatarFails = true;
  await go('/account', 'Ada Curious');
  await until(async () => await evaluate("!document.querySelector('.avatar img')"), 'broken avatar fallback');
  assert.equal(await evaluate("document.querySelector('.avatar').textContent"), 'AC');
  await send('Accessibility.enable');
  const ax = await send('Accessibility.getFullAXTree');
  assert.ok(ax.nodes.some((node: any) => node.role?.value === 'heading' && node.name?.value === 'Your account.'));
  const layouts: any[] = [], contrast: any[] = [];
  for (const size of sizes) {
    await send('Emulation.setDeviceMetricsOverride', { ...size, deviceScaleFactor: 1, mobile: size.width < 800 });
    for (const theme of ['dark', 'light']) {
      for (const [route, text] of [['/account', 'Ada Curious'], ['/about', 'A question is'], ['/legal#cookies', 'Cookies & storage'], ['/auth', 'Curiosity killed'], ['/dashboard/' + thread, 'Private fixture answer']] as const) {
        if (route === '/auth') { // The signed-in auth route intentionally returns to the workspace.
          continue;
        }
        await go(route, text); await evaluate(`document.documentElement.dataset.theme = '${theme}'`); await delay(100);
        if (route === '/account' && size.width === 1440) {
          const ratios = await evaluate(`(() => {
            const style=getComputedStyle(document.documentElement);
            const luminance=(hex)=>{let color=hex.trim().replace('#','');if(color.length===3)color=color.split('').map(c=>c+c).join('');const parts=color.match(/../g).map(n=>parseInt(n,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return parts[0]*.2126+parts[1]*.7152+parts[2]*.0722};
            return [['--nx-text','--nx-bg'],['--nx-muted','--nx-bg'],['--nx-muted','--nx-surface'],['--nx-link','--nx-surface'],['--nx-on-primary','--nx-primary']].map(([fg,bg])=>{const a=luminance(style.getPropertyValue(fg)),b=luminance(style.getPropertyValue(bg));return {fg,bg,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)}});
          })()`);
          for (const ratio of ratios) assert.ok(ratio.ratio >= 4.5, `${theme} ${ratio.fg}/${ratio.bg} contrast: ${ratio.ratio}`);
          contrast.push({theme,ratios});
        }
        const overflow = await evaluate('document.documentElement.scrollWidth > innerWidth'); assert.equal(overflow, false, `${route} ${size.width} ${theme}`);
        if (route.startsWith('/dashboard')) {
          assert.ok(await evaluate("document.querySelector('.composer').getBoundingClientRect().bottom <= innerHeight"));
          assert.ok(await evaluate("document.querySelector('.compact-footer').getBoundingClientRect().bottom <= innerHeight"));
          assert.ok(await evaluate("(()=>{const b=document.querySelector('.send-button').getBoundingClientRect(),i=document.querySelector('.send-button svg').getBoundingClientRect();return Math.abs(b.x+b.width/2-i.x-i.width/2)<.6&&Math.abs(b.y+b.height/2-i.y-i.height/2)<.6})()"), 'real composer icon centered');
        }
        layouts.push({ route, width: size.width, theme, overflow });
        if ([1440, 390].includes(size.width)) await shot(`${route.startsWith('/dashboard') ? 'conversation' : route.split('/')[1]!.split('#')[0]}-${theme}-${size.width}`);
      }
    }
  }
  // Long provider text and GitHub with no shared email are distinct display states.
  user = { ...user, email: '', app_metadata: { provider: 'github' }, identities: [{ id: 'github', identity_id: 'github', user_id: owner, provider: 'github', identity_data: { full_name: 'A very long supplied name '.repeat(20), avatar_url: 'javascript:bad' } }] };
  await signedIn(); await go('/account', 'Not shared by your identity provider');
  assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth'), false);
  await shot('account-long-missing-email-320');
  user = { ...user, email: 'a'.repeat(64) + '@' + 'long-subdomain.'.repeat(8) + 'example.test' };
  await signedIn(); await go('/account', user.email);
  assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth'), false);
  await shot('account-long-email-320');
  user = { ...user, email: '', user_metadata: {}, identities: [] };
  await signedIn(); await go('/account', 'Not provided by your identity provider');
  assert.ok(await evaluate("!!document.querySelector('.account-identity .avatar .brand-mark')"));
  await shot('account-missing-profile-320');
  await evaluate("sessionStorage.setItem('nuelexity:active-thread:' + '11111111-1111-4111-8111-111111111111', 'private'); sessionStorage.setItem('nuelexity:scroll:11111111-1111-4111-8111-111111111111:private', '10')");
  // Honest errors and a synchronous duplicate fence on current-session sign-out.
  failLogout = true;
  await evaluate("document.querySelector('.account-actions button').click(); document.querySelector('.account-actions button').click()");
  await until(async () => await evaluate("document.body.innerText.includes('could not be confirmed')"), 'logout error');
  assert.equal(logoutCount, 1); assert.equal(logoutScopes[0], 'local');
  assert.equal(await evaluate("document.body.innerText.includes('Private fixture answer')"), false);
  assert.ok(await evaluate("document.body.innerText.includes('server revocation could not be confirmed')"));
  // This SDK clears its local session even on a server sign-out error. A fresh
  // fixture sign-in is needed; never restore old credentials to offer a retry.
  await signedIn(); await go('/account', 'Your account.');
  // A second real tab shares Supabase's auth BroadcastChannel and has an active stream.
  const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(server.url.href + 'dashboard/' + thread)}`, { method: 'PUT' })).json() as any;
  second = await connect(tab.webSocketDebuggerUrl);
  await until(async () => await second!.evaluate("!!document.querySelector('#question')"), 'second tab');
  await second.evaluate("(()=>{const i=document.querySelector('#question'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(i,'fixture stream');i.dispatchEvent(new Event('input',{bubbles:true}));})()");
  await until(async () => await second!.evaluate("document.querySelector('[aria-label=\"Send question\"]')?.disabled === false"), 'send ready');
  await second.evaluate("document.querySelector('[aria-label=\"Send question\"]').click()");
  await until(async () => await second!.evaluate("document.body.innerText.includes('PRIVATE RUNNING ANSWER')"), 'active private stream');
  failLogout = false;
  await evaluate("document.querySelector('.account-actions button').click(); document.querySelector('.account-actions button').click()");
  await until(async () => await evaluate("document.body.innerText.includes('Guest workspace')"), 'local sign-out');
  await until(async () => await second!.evaluate("document.body.innerText.includes('Guest workspace')"), 'other tab auth event');
  await until(async () => streamCancelled, 'other tab stream cancelled');
  assert.equal(logoutCount, 2); assert.deepEqual(logoutScopes, ['local', 'local']);
  for (const tab of [first, second]) {
    assert.equal(await tab.evaluate("document.body.innerText.includes('PRIVATE RUNNING ANSWER') || document.body.innerText.includes('Private fixture answer')"), false);
    assert.equal(await tab.evaluate("Object.keys(sessionStorage).some(k=>k.startsWith('nuelexity:scroll:')||k.startsWith('nuelexity:active-thread:'))"), false);
  }
  await go('/account', 'Continue with Google'); assert.ok(await evaluate("location.pathname === '/auth' && location.search === '?return=account'"));
  await shot('auth-guest-mobile');
  // Validated account return only; an arbitrary return URL cannot leave the app.
  await signedIn(); await go('/auth/callback', 'Your account.'); assert.equal(await evaluate('location.pathname'), '/account');
  await evaluate("localStorage.removeItem('sb-127-auth-token')"); await go('/auth?return=https://evil.example', 'Continue with Google'); await signedIn(); await go('/auth/callback', 'Where curiosity'); assert.equal(await evaluate('location.pathname'), '/dashboard');
  await evaluate("localStorage.removeItem('sb-127-auth-token')");
  for (const size of sizes) {
    await send('Emulation.setDeviceMetricsOverride', { ...size, deviceScaleFactor: 1, mobile: size.width < 800 });
    for (const theme of ['dark', 'light']) {
      await go('/auth', 'Continue with Google'); await evaluate(`document.documentElement.dataset.theme = '${theme}'`);
      assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth'), false);
      layouts.push({route:'/auth',width:size.width,theme,overflow:false});
      if ([1440,390].includes(size.width)) await shot(`auth-${theme}-${size.width}`);
    }
  }
  for (const size of [sizes[0]!, sizes[2]!]) {
    await send('Emulation.setDeviceMetricsOverride', { ...size, deviceScaleFactor: 1, mobile: size.width < 800 });
    for (const theme of ['dark','light']) { await go('/', 'Guest workspace'); await evaluate(`document.documentElement.dataset.theme='${theme}'`); await shot(`home-guest-${theme}-${size.width}`); }
  }
  await go('/legal#terms', 'Privacy, storage & terms.');
  assert.equal(await evaluate('document.activeElement.id'), 'terms');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await go('/about', 'A question is'); assert.equal(await evaluate("getComputedStyle(document.querySelector('.return-cat-eye')).animationName"), 'none');
  const cookies = await send('Network.getCookies'); assert.equal(cookies.cookies.length, 0);
  const storage = await evaluate('({local:Object.keys(localStorage),session:Object.keys(sessionStorage)})');
  assert.ok(![...network].some(p => /analytics|sentry|collect|pixel/.test(p)));
  await writeFile(path.join(evidence, 'verification.json'), JSON.stringify({ layouts, contrast, logoutCount, logoutScopes, streamCancelled, cookies: cookies.cookies.length, storageKeys: storage, localRequestPaths: [...network].filter(p => !p.startsWith('/assets/')).sort(), note: 'Mocked third parties; HTTPS avatar intercepted with a 404. Physical devices and assistive technology not tested.' }, null, 2));
  console.log('PASS milestone browser: account metadata/fallbacks, linked identities, long names/missing email, current-session sign-out errors/duplicates, actual two-tab auth event and stream cleanup, safe return, 320/390/768/1440 widths, dark/light, legal focus, reduced motion, storage and local request inventory. Screenshots: ' + evidence);
} finally { first?.close(); second?.close(); chrome.kill(); await chrome.exited; server.stop(); await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 }); }
