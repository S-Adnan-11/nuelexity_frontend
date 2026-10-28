import { build } from "vite";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router";
import { About, Legal, NotFound, PublicHome } from "./src/components/pages/PublicPages";
import { canonicalOrigin, routeMetadata } from "./src/lib/seo";
import { publicEnv } from "./public-env.mjs";
import content from "./site-content.json";

await build();
await writeFile("dist/config.json", JSON.stringify(publicEnv(), null, 2) + "\n");
const template = await readFile("dist/index.html", "utf8");
const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const scripts: string[] = [];
function document(path: string, body: string) {
  const meta = routeMetadata(path);
  let html = template.replace(/<title>[^<]*<\/title>/, `<title>${escape(meta.title)}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/>/, `<meta name="description" content="${escape(meta.description)}" />`)
    .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escape(meta.title)}" />`)
    .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escape(meta.description)}" />`)
    .replace(/<link rel="canonical"[^>]*>/, meta.canonical ? `<link rel="canonical" href="${canonicalOrigin}${meta.canonical}" />` : '')
    .replace(/<meta property="og:url"[^>]*>/, meta.canonical ? `<meta property="og:url" content="${canonicalOrigin}${meta.canonical}" />` : '')
    .replace('<head>', `<head>\n<meta name="robots" content="${meta.index ? 'index,follow' : 'noindex,nofollow'}" />`)
    .replace(/<div id="root">[\s\S]*<\/div>\s*<\/body>/, `<div id="root">${body}</div>\n</body>`);
  if (path === '/' || path === '/about') {
    const data = JSON.stringify({ '@context': 'https://schema.org', '@type': path === '/' ? 'WebSite' : 'AboutPage', name: 'Nuelexity', url: canonicalOrigin + path, description: meta.description }).replaceAll('<', '\\u003c');
    scripts.push(`'sha256-${createHash('sha256').update(data).digest('base64')}'`);
    html = html.replace('</head>', `<script type="application/ld+json">${data}</script></head>`);
  }
  if (content.searchConsoleVerification && /^[a-zA-Z0-9_-]+$/.test(content.searchConsoleVerification)) html = html.replace('</head>', `<meta name="google-site-verification" content="${content.searchConsoleVerification}" /></head>`);
  return html;
}
for (const [route, Component] of [['/', PublicHome], ['/about', About], ['/legal', Legal], ['/404', NotFound]] as const) {
  const html = document(route, renderToStaticMarkup(createElement(StaticRouter, { location: route }, createElement(Component))));
  const file = route === '/' ? 'dist/index.html' : route === '/404' ? 'dist/404.html' : `dist${route}/index.html`;
  await mkdir(file.slice(0, file.lastIndexOf('/')), { recursive: true });
  await writeFile(file, html);
}
for (const route of ['/account', '/auth', '/auth/callback', '/dashboard']) {
  await mkdir(`dist${route}`, { recursive: true });
  await writeFile(`dist${route}/index.html`, document(route, '<main class="workspace-pending" role="status">Opening Nuelexity…</main>'));
}
await writeFile('dist/private.html', document('/dashboard', '<main class="workspace-pending" role="status">Opening your workspace…</main>'));
await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/', '/about', '/legal'].map(route => `<url><loc>${canonicalOrigin}${route}</loc></url>`).join('')}</urlset>\n`);
// Let crawlers see private routes' noindex. Robots exclusions cannot protect data.
await writeFile('dist/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${canonicalOrigin}/sitemap.xml\n`);
await writeFile('dist/csp-hashes.json', JSON.stringify(scripts));
await writeFile('dist/policy-source.sha256', createHash('sha256').update(await readFile('src/components/pages/PublicPages.tsx')).digest('hex'));
await writeFile('dist/content.sha256', createHash('sha256').update(JSON.stringify(content)).digest('hex'));
console.log('Public pages prerendered; private routes have generic noindex HTML. Publication remains subject to release:check.');
