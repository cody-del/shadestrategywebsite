import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { listPages } from '../scripts/pages.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (file) => readFileSync(root + file, 'utf8');
const home = read('index.html');
const section = (id) => home.match(new RegExp(`<section[^>]*id="${id}"[\\s\\S]*?</section>`))?.[0] ?? '';
const plain = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

test('the homepage leads with proof and individual services', () => {
  const ids = [...home.matchAll(/<section[^>]*\bid="([^"]+)"/g)].map((m) => m[1]).filter((id) => id !== 'tool-bundle');
  assert.deepEqual(ids, ['proof', 'services', 'about-me', 'ways-to-work', 'ai-tools', 'ebook', 'inquiry']);
  assert.ok(!/id="contact"/.test(home), 'the repeated Get in touch bar is gone');
  assert.ok(home.indexOf('class="hero"') < home.indexOf('id="proof"'));
});

test('the proof strip repeats what the Results page publishes and links to it', () => {
  const proof = plain(section('proof'));
  const results = plain(read('results/index.html'));
  for (const name of ['Tom Shinn', 'The Shutter Factory', 'Todd D.', 'Five Day Plantation Shutters Largo']) {
    assert.ok(proof.includes(name), name);
    assert.ok(results.includes(name), `${name} is on the Results page`);
  }
  assert.ok(proof.includes('Google Maps') && results.includes('Google Maps'));
  assert.ok(proof.includes('review requests') && results.includes('review requests'));
  assert.match(section('proof'), /href="\.\/results\/"/);
  assert.ok(!/[“”"]\s*The new website/.test(proof), 'summaries, not invented quotes');
});

test('Two Ways One System names Individual Services first', () => {
  const ways = section('ways-to-work');
  assert.ok(ways.indexOf('<h3>Individual Services</h3>') < ways.indexOf('<h3>Machine Learning</h3>'));
});

test('the Machine Learning cards show their link without a Learn more toggle', () => {
  const tools = section('ai-tools');
  assert.ok(!tools.includes('tool-details'), 'no Learn more toggles');
  const cards = [...tools.matchAll(/<li class="offering tool-card">([\s\S]*?)<\/li>/g)].map((m) => m[1]);
  assert.equal(cards.length, 5);
  for (const card of cards) assert.match(card, /<a class="action-link" href="[^"]+"/);
});

test('the Google Ads price says which product it is for', () => {
  for (const page of ['index.html', 'services/index.html']) {
    const html = read(page);
    const card = [...html.matchAll(/<li class="offering">([\s\S]*?)<\/li>/g)].map((m) => m[1]).find((c) => c.includes('<h3>Google Ads</h3>'));
    assert.ok(card.includes('Managed campaigns are quoted on a strategy call.'), page);
  }
});

test('the announcement is a single static line, not a scrolling button', () => {
  for (const page of listPages(root)) {
    const html = read(page);
    if (!html.includes('class="site-header"')) continue;
    assert.ok(!html.includes('<button class="nav-announcement"'), `${page}: scrolling button`);
    assert.ok(!html.includes('announcement-copy'), `${page}: marquee markup`);
    assert.match(html, /<p class="nav-announcement">Individual services, no package needed\. <a href="\/services\/">See services<\/a><\/p>/, page);
  }
  assert.ok(!read('navigation.js').includes('nav-announcement'), 'navigation.js no longer drives the marquee');
});

test('the brand font is preloaded and has a size-matched fallback', () => {
  for (const page of listPages(root)) {
    assert.ok(read(page).includes('<link rel="preload" href="/assets/hanken-grotesk-latin.woff2" as="font" type="font/woff2" crossorigin>'), page);
  }
  const css = read('styles.css');
  assert.match(css, /@font-face \{\s*font-family: "Hanken Grotesk Fallback";\s*src: local\("Arial"\);\s*size-adjust: \d+(\.\d+)?%;/);
  assert.match(css, /font-family: "Hanken Grotesk", "Hanken Grotesk Fallback", "Helvetica Neue", sans-serif;/);
});

test('each landmark on the Full Service page has its own name', () => {
  const html = read('full-service/index.html');
  const wrap = html.match(/<div class="compare-wrap"[^>]*>/)[0];
  assert.match(wrap, /role="region"/);
  assert.match(wrap, /tabindex="0"/);
  assert.ok(!wrap.includes('aria-labelledby="compare-title"'), 'shares the section label');
  assert.match(wrap, /aria-label="Package comparison table"/);
});

test('pages reflow at 320px: long words wrap and the strategy-call grid can shrink', () => {
  const css = read('styles.css');
  assert.match(css, /\.article-body \{[^}]*overflow-wrap: break-word;/);
  assert.match(read('strategy-call/index.html'), /\.strategy-layout\{display:grid;grid-template-columns:minmax\(0,1fr\);/);
  // Two answer columns only where whole words fit; one column on the narrowest phones.
  const call = read('strategy-call/index.html');
  assert.match(call, /\.ss-choices-compact,\.strategy-form \.ss-choices-three\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(call, /@media \(min-width:360px\)\{\.strategy-form \.ss-choices-compact,\.strategy-form \.ss-choices-three\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}\}/);
  assert.ok(!call.includes('.ss-lf-opt span{min-width:0}'), 'no mid-word breaks');
});

test('the terms are linked in every footer and beside the SMS opt-in', () => {
  for (const page of listPages(root)) {
    const html = read(page);
    const footer = html.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)?.[0];
    if (!footer) continue;
    assert.match(footer, /<a href="[^"]*published\/terms-and-conditions">Terms and Conditions<\/a>/, page);
  }
  assert.match(read('strategy-call/index.html'), /<p class="ss-privacy">[^]*?privacy-policy">Privacy Policy<\/a>[^<]*<a href="[^"]*terms-and-conditions">Terms and Conditions<\/a>/);
});
