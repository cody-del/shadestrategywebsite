import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isIndexable, redirectsFile, headersFile, robotsTxt, sitemapXml } from '../scripts/site-outputs.mjs';
import { REDIRECTS, SITE_ORIGIN } from '../scripts/site-map.mjs';

test('only the production build on the apex domain is indexable', () => {
  assert.equal(isIndexable({ CONTEXT: 'production', URL: 'https://shadestrategy.com' }), true);
  for (const env of [
    { CONTEXT: 'deploy-preview', URL: 'https://shadestrategy.com' },
    { CONTEXT: 'branch-deploy', URL: 'https://shadestrategy.com' },
    { CONTEXT: 'production', URL: 'https://www.shadestrategy.com' },
    { CONTEXT: 'production', URL: 'https://shadestrategywebsite.netlify.app' },
    { CONTEXT: 'production', URL: 'https://shade-strategy-website-preview.netlify.app' },
    {},
  ]) assert.equal(isIndexable(env), false, JSON.stringify(env));
});

test('redirects file has one 301 line per old address', () => {
  const file = redirectsFile(REDIRECTS);
  assert.match(file, /^\/pricing \/full-service\/ 301$/m);
  assert.equal(file.trim().split('\n').length, REDIRECTS.length);
  for (const line of file.trim().split('\n')) assert.match(line, /^\/\S+ \/\S* 301$/);
});

test('non-indexable builds send noindex on every path', () => {
  assert.equal(headersFile(false), '/*\n  X-Robots-Tag: noindex\n');
  assert.equal(headersFile(true), '');
});

test('robots.txt allows crawling and points to the sitemap', () => {
  assert.equal(robotsTxt(), 'User-agent: *\nAllow: /\nSitemap: https://shadestrategy.com/sitemap.xml\n');
});

test('sitemap lists real pages on the apex origin and skips the ebook download page', () => {
  const xml = sitemapXml(['/', '/ebook/', '/services/', '/published/privacy-policy'], SITE_ORIGIN);
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.ok(!xml.includes('/ebook/'));
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs, ['https://shadestrategy.com/', 'https://shadestrategy.com/services/', 'https://shadestrategy.com/published/privacy-policy']);
});
