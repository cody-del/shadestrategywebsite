import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { listPages, pagePath } from '../scripts/pages.mjs';
import { sitemapXml } from '../scripts/site-outputs.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (file) => readFileSync(root + file, 'utf8');
const attr = (html, re) => html.match(re)?.[1] ?? null;
const meta = (html, key) => attr(html, new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`));
const SHARE_IMAGE = 'https://shadestrategy.com/assets/og/shade-strategy.png';
const PRIVATE = new Set(['ebook/index.html', '404.html']);

test('the brand icon is the browser tab, bookmark and home-screen icon on every page', () => {
  for (const file of ['favicon.ico', 'assets/icons/favicon-32.png', 'assets/icons/apple-touch-icon.png']) assert.ok(existsSync(root + file), file);
  const ico = readFileSync(root + 'favicon.ico');
  assert.deepEqual([...ico.subarray(0, 4)], [0, 0, 1, 0], 'an ICO file');
  for (const page of listPages(root)) {
    const html = read(page);
    assert.ok(html.includes('<link rel="icon" href="/favicon.ico" sizes="any">'), `${page}: favicon.ico`);
    assert.ok(html.includes('<link rel="icon" href="/assets/icons/favicon-32.png" type="image/png" sizes="32x32">'), `${page}: png icon`);
    assert.ok(html.includes('<link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png">'), `${page}: apple-touch-icon`);
  }
  assert.match(read('scripts/build-preview.mjs'), /'favicon\.ico'/, 'the build copies favicon.ico');
});

test('every public page has a link-sharing preview that matches its title, description and address', () => {
  assert.ok(existsSync(root + 'assets/og/shade-strategy.png'), 'share image');
  for (const page of listPages(root)) {
    if (PRIVATE.has(page)) continue;
    const html = read(page);
    const title = attr(html, /<title>([^<]*)<\/title>/);
    const description = attr(html, /<meta name="description" content="([^"]*)">/);
    const canonical = attr(html, /<link rel="canonical" href="([^"]*)">/);
    assert.equal(meta(html, 'og:title'), title, `${page}: og:title`);
    assert.equal(meta(html, 'og:description'), description, `${page}: og:description`);
    assert.equal(meta(html, 'og:url'), canonical, `${page}: og:url`);
    assert.equal(meta(html, 'og:site_name'), 'Shade Strategy', `${page}: og:site_name`);
    assert.equal(meta(html, 'twitter:card'), 'summary_large_image', `${page}: twitter:card`);
    const image = meta(html, 'og:image');
    assert.match(image, /^https:\/\/shadestrategy\.com\/assets\//, `${page}: og:image`);
    if (page.startsWith('blog/')) {
      assert.equal(meta(html, 'og:type'), 'article', page);
      assert.match(image, /\/assets\/blog\//, `${page}: keeps its own image`);
    } else {
      assert.equal(meta(html, 'og:type'), 'website', page);
      assert.equal(image, SHARE_IMAGE, page);
      assert.equal(meta(html, 'og:image:width'), '1200', page);
      assert.equal(meta(html, 'og:image:height'), '630', page);
    }
    assert.equal((html.match(/property="og:title"/g) || []).length, 1, `${page}: one og:title`);
  }
});

test('a branded 404 page keeps the site menu and offers a way back', () => {
  const html = read('404.html');
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.ok(!html.includes('rel="canonical"'));
  assert.match(html, /class="site-header"/);
  assert.match(html, /class="site-footer"/);
  assert.match(html, /<h1[^>]*>[^<]+<\/h1>/);
  for (const href of ['href="/"', 'href="/strategy-call/"', 'href="/services/"']) assert.ok(html.includes(href), href);
  // Served at any missing address, so every local link and asset must be root-absolute.
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^(https?:|mailto:|tel:|#)/.test(m[1])) continue;
    assert.ok(m[1].startsWith('/'), `root-absolute: ${m[1]}`);
  }
  assert.match(read('scripts/build-preview.mjs'), /'404\.html'/, 'the build copies 404.html');
  assert.ok(!sitemapXml(listPages(root).map(pagePath), 'https://shadestrategy.com').includes('/404'), 'not in the sitemap');
});
