import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractSeo } from '../scripts/extract-seo.mjs';

const html = `<!DOCTYPE html><html><head>
<title>A | B</title>
<meta content="Old description" name="description">
<link href="https://shadestrategy.com/x" rel="canonical">
<script type="application/ld+json">{"@type":"Organization","name":"Shade Strategy"}</script>
<script type="application/ld+json">{not json</script>
</head><body><h1 class="hero">Main <span>heading</span></h1></body></html>`;

test('reads title, description, canonical and H1', () => {
  const seo = extractSeo(html);
  assert.equal(seo.title, 'A | B');
  assert.equal(seo.description, 'Old description');
  assert.equal(seo.canonical, 'https://shadestrategy.com/x');
  assert.equal(seo.h1, 'Main heading');
});

test('keeps only JSON-LD blocks that parse', () => {
  const seo = extractSeo(html);
  assert.equal(seo.jsonLd.length, 1);
  assert.equal(seo.jsonLd[0].name, 'Shade Strategy');
});

test('missing fields are null and no JSON-LD is an empty list', () => {
  const seo = extractSeo('<html><head></head><body><p>x</p></body></html>');
  assert.equal(seo.title, null);
  assert.equal(seo.h1, null);
  assert.equal(seo.description, null);
  assert.equal(seo.canonical, null);
  assert.deepEqual(seo.jsonLd, []);
});

test('decodes HTML entities in text fields', () => {
  const seo = extractSeo('<title>Tips &amp; Tricks &#x27;24</title><h1>It&#39;s here</h1>');
  assert.equal(seo.title, "Tips & Tricks '24");
  assert.equal(seo.h1, "It's here");
});
