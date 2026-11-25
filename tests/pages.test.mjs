import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pagePath, listPages } from '../scripts/pages.mjs';
import { decodeEntities } from '../scripts/extract-seo.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (file) => readFileSync(root + file, 'utf8');
const plain = (html) => decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

test('pagePath maps files to URL paths', () => {
  assert.equal(pagePath('index.html'), '/');
  assert.equal(pagePath('services/index.html'), '/services/');
  assert.equal(pagePath('services/window-treatment-seo/index.html'), '/services/window-treatment-seo/');
  assert.equal(pagePath('published/privacy-policy.html'), '/published/privacy-policy');
});

test('listPages finds source pages and skips build, archive and docs folders', () => {
  const pages = listPages(root);
  assert.ok(pages.includes('index.html'));
  assert.ok(pages.includes('full-service/index.html'));
  assert.ok(pages.includes('published/privacy-policy.html'));
  for (const page of pages) assert.ok(!/^(preview-build|archive|docs|node_modules|migration|\.)/.test(page), page);
});

const LEGAL = [
  ['published/privacy-policy.html', 'published__privacy-policy.html'],
  ['published/terms-and-conditions.html', 'published__terms-and-conditions.html'],
];

for (const [file, archived] of LEGAL) {
  test(`${file} keeps its address, layout and Webflow text`, () => {
    assert.ok(existsSync(root + file), file);
    const html = read(file);
    assert.match(html, /class="site-header"/);
    assert.match(html, /class="site-footer"/);
    const path = file.replace(/\.html$/, '');
    assert.ok(html.includes(`<link rel="canonical" href="https://shadestrategy.com/${path}">`), 'canonical');
    for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const url = m[1];
      if (/^(https?:|mailto:|tel:|#)/.test(url)) continue;
      assert.ok(url.startsWith('../'), `relative asset path: ${url}`);
    }
    const old = read(`archive/webflow-2026-11/${archived}`);
    const block = old.match(/<div class="rich-text-block-\d w-richtext">([\s\S]*?)<\/div>/)[1];
    const firstParagraph = plain(block.match(/<p\b[^>]*>([\s\S]*?)<\/p>/)[1]);
    assert.ok(firstParagraph.length > 20);
    assert.ok(plain(html).includes(firstParagraph), 'first Webflow paragraph present');
  });
}
