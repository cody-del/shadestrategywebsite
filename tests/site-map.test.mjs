import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SITE_ORIGIN, KEPT, REDIRECTS, OLD_URLS } from '../scripts/site-map.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

test('site origin is the apex https domain', () => {
  assert.equal(SITE_ORIGIN, 'https://shadestrategy.com');
});

test('covers the 22 Webflow sitemap paths exactly once', () => {
  assert.equal(KEPT.length, 7);
  assert.equal(REDIRECTS.length, 15);
  assert.equal(OLD_URLS.length, 22);
  assert.equal(new Set(OLD_URLS).size, 22);
});

test('no redirect target is itself redirected (no chains)', () => {
  const froms = new Set(REDIRECTS.map((r) => r.from));
  for (const r of REDIRECTS) assert.ok(!froms.has(r.to), r.to);
});

test('pricing goes to full service and keeps the capital M path', () => {
  assert.deepEqual(REDIRECTS.find((r) => r.from === '/pricing'), { from: '/pricing', to: '/full-service/' });
  assert.ok(REDIRECTS.some((r) => r.from === '/windows-treatment-for-Manufacturers'));
});

test('every redirect target exists as a page in the repo', () => {
  for (const { to } of REDIRECTS) {
    const file = to === '/' ? 'index.html' : to.endsWith('/') ? `${to.slice(1)}index.html` : `${to.slice(1)}.html`;
    assert.ok(existsSync(root + file), `${to} → ${file}`);
  }
});
