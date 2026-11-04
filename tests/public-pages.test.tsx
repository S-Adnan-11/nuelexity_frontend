import { test, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { About, Legal, PublicHome, PublicInformation } from '../src/components/pages/PublicPages';
import { canonicalOrigin, publicPaths, routeMetadata, routeStructuredData } from '../src/lib/seo';

test('legal sections keep stable anchors without internal review commentary or an invented effective date', () => {
  const html = renderToStaticMarkup(<StaticRouter location="/legal"><Legal /></StaticRouter>);
  for (const id of ['privacy', 'cookies', 'terms']) {
    expect(html.match(new RegExp(`id="${id}"`, 'g'))).toHaveLength(1);
    expect(html).toContain(`href="/legal#${id}"`);
  }
  expect(html).not.toMatch(/Local pre-release review|Policy draft|workflow.*approval|6,000|1,024|400 characters|62 days/);
  expect(html).not.toContain('Effective <time');
  expect(html).not.toContain('accept everything</button>');
});
test('About has original crawlable content and confirmed developer links', () => {
  const html = renderToStaticMarkup(<StaticRouter location="/about"><About /></StaticRouter>);
  expect(html).toContain('Groq serves the answer models.');
  expect(html).toContain('not a live search');
  expect(html).not.toContain('No Vercel AI SDK');
  expect(html).not.toContain('href="#"');
  expect(html).toContain('aria-label="Developer links"');
  expect(html).toContain('S. Adnan');
  expect(html).toContain('https://github.com/S-Adnan-11');
});
test('only intended public routes are indexable; private metadata never uses a thread title', () => {
  for (const route of ['/', '/about', '/legal']) expect(routeMetadata(route).index).toBe(true);
  for (const route of ['/account', '/dashboard', '/dashboard/private-thread', '/auth', '/auth/callback', '/unknown']) {
    expect(routeMetadata(route).index).toBe(false);
    expect(routeMetadata(route).canonical).toBeNull();
  }
});
test('full-beta homepage contains the product and existing workspace entry without a closed-release message', () => {
  const html = renderToStaticMarkup(<StaticRouter location="/"><PublicHome /></StaticRouter>);
  expect(html).toContain('Nuelexity, an independent research project');
  expect(html).toContain('href="/dashboard"');
  expect(html).not.toMatch(/research.*not open|Public preview|Research and sign-in are closed/);
  expect(publicPaths).toEqual(['/', '/about', '/legal']);
});
test('structured data describes only visible public identity and never private routes or unsupported features', () => {
  expect(routeStructuredData('/')).toEqual({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'Nuelexity', url: canonicalOrigin + '/', description: routeMetadata('/').description, inLanguage: 'en' });
  expect(routeStructuredData('/about')?.['@type']).toBe('AboutPage');
  for (const route of ['/legal', '/auth', '/account', '/dashboard', '/dashboard/private-thread', '/missing']) expect(routeStructuredData(route)).toBeNull();
  expect(JSON.stringify(publicPaths.map(routeStructuredData))).not.toMatch(/SearchAction|Organization|AggregateRating|Review|private-thread/);
});

test('public preview and full application receive accurate release-specific legal introductions', () => {
  const render = (limited: boolean) => renderToStaticMarkup(<StaticRouter location="/legal"><PublicInformation value={limited}><Legal /></PublicInformation></StaticRouter>);
  expect(render(true)).toContain('Research and sign-in are closed.');
  expect(render(false)).not.toContain('Research and sign-in are closed.');
  expect(render(true)).toContain('preference is saved in local storage');
  expect(render(false)).toContain('automatically loads Cloudflare Turnstile');
});
