import { build } from "vite";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router";
import { About, Legal, NotFound, PublicHome, PublicInformation, Unavailable } from "./src/components/pages/PublicPages";
import { canonicalOrigin, publicPaths, routeMetadata, serializedStructuredData } from "./src/lib/seo";
import { publicEnv } from "./public-env.mjs";
import content from "./site-content.json";

const limited = process.argv.includes("--public-info");
const output = limited ? "public-build" : "dist";
await build(limited ? { plugins: [{ name: "public-information-boundary", generateBundle() {
  for (const id of this.getModuleIds()) if (/@supabase\/|\/(?:PrivateApp|AuthProvider|OAuthButtons|Turnstile)\.tsx$|\/lib\/(?:api|startup|config|useGuestSession)\.ts$|\/pages\/(?:Dashboard|Account|Auth)\.tsx$/.test(id)) throw new Error("Private integration imported into the limited public bundle.");
} }], build: { outDir: "../public-build", rollupOptions: { input: "src/public-information.html" } } } : {});
await writeFile(`${output}/release-mode.json`, JSON.stringify({ mode: limited ? "public-information" : "application" }));
if (!limited) await writeFile(`${output}/config.json`, JSON.stringify(publicEnv(), null, 2) + "\n");
const template = await readFile(`${output}/${limited ? "public-information.html" : "index.html"}`, "utf8");
const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const scripts: string[] = [];
function document(path: string, body: string) {
  const meta = routeMetadata(path);
  let html = template.replace(/<title>[^<]*<\/title>/, `<title>${escape(meta.title)}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/>/, `<meta name="description" content="${escape(meta.description)}" />`)
    .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escape(meta.title)}" />`)
    .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escape(meta.description)}" />`)
    .replace(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${escape(meta.title)}" />`)
    .replace(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${escape(meta.description)}" />`)
    .replace(/<link rel="canonical"[^>]*>/, meta.canonical ? `<link rel="canonical" href="${canonicalOrigin}${meta.canonical}" />` : '')
    .replace(/<meta property="og:url"[^>]*>/, meta.canonical ? `<meta property="og:url" content="${canonicalOrigin}${meta.canonical}" />` : '')
    .replace('<head>', `<head>\n<meta name="robots" content="${meta.index ? 'index,follow' : 'noindex,nofollow'}" />`)
    .replace(/<div id="root">[\s\S]*<\/div>\s*<\/body>/, `<div id="root"${meta.index ? ` data-prerendered-public="${path}"` : ''}>${body}</div>\n</body>`);
  const data = serializedStructuredData(path);
  if (data) {
    scripts.push(`'sha256-${createHash('sha256').update(data).digest('base64')}'`);
    html = html.replace('</head>', `<script type="application/ld+json">${data}</script></head>`);
  }
  if (content.searchConsoleVerification && /^[a-zA-Z0-9_-]+$/.test(content.searchConsoleVerification)) html = html.replace('</head>', `<meta name="google-site-verification" content="${content.searchConsoleVerification}" /></head>`);
  return html;
}
for (const [route, Component] of [['/', PublicHome], ['/about', About], ['/legal', Legal], ['/404', NotFound]] as const) {
  const html = document(route, renderToString(createElement(StaticRouter, { location: route }, createElement(PublicInformation, { value: limited }, createElement(Component)))));
  const file = route === '/' ? `${output}/index.html` : route === '/404' ? `${output}/404.html` : `${output}${route}/index.html`;
  await mkdir(file.slice(0, file.lastIndexOf('/')), { recursive: true });
  await writeFile(file, html);
}
for (const route of ['/account', '/auth', '/auth/callback', '/dashboard']) {
  await mkdir(`${output}${route}`, { recursive: true });
  await writeFile(`${output}${route}/index.html`, document(route, limited ? renderToString(createElement(StaticRouter, { location: route }, createElement(PublicInformation, { value: true }, createElement(Unavailable)))) : '<main class="workspace-pending" role="status">Opening Nuelexity…</main>'));
}
await writeFile(`${output}/private.html`, document('/dashboard', limited ? renderToString(createElement(StaticRouter, { location: '/dashboard' }, createElement(PublicInformation, { value: true }, createElement(Unavailable)))) : '<main class="workspace-pending" role="status">Opening your workspace…</main>'));
await writeFile(`${output}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${publicPaths.map(route => `<url><loc>${canonicalOrigin}${route}</loc></url>`).join('')}</urlset>\n`);
// Let crawlers see private routes' noindex. Robots exclusions cannot protect data.
await writeFile(`${output}/robots.txt`, `User-agent: *\nAllow: /\nSitemap: ${canonicalOrigin}/sitemap.xml\n`);
await writeFile(`${output}/csp-hashes.json`, JSON.stringify(scripts));
await writeFile(`${output}/policy-source.sha256`, createHash('sha256').update(await readFile('src/components/pages/PublicPages.tsx')).digest('hex'));
await writeFile(`${output}/content.sha256`, createHash('sha256').update(JSON.stringify(content)).digest('hex'));
console.log('Public pages prerendered; private routes have generic noindex HTML. Publication remains subject to release:check.');
