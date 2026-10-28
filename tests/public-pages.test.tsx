import { test, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { About, Legal } from '../src/components/pages/PublicPages';
import { routeMetadata } from '../src/lib/seo';

test('legal sections have stable unique anchors and the draft cannot claim to be effective', () => {
  const html = renderToStaticMarkup(<StaticRouter location="/legal"><Legal /></StaticRouter>);
  for (const id of ['privacy', 'cookies', 'terms']) {
    expect(html.match(new RegExp(`id="${id}"`, 'g'))).toHaveLength(1);
    expect(html).toContain(`href="/legal#${id}"`);
  }
  expect(html).toContain('not yet effective');
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
