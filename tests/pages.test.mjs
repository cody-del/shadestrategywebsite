import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pagePath, listPages } from '../scripts/pages.mjs';
import { decodeEntities } from '../scripts/extract-seo.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (file) => readFileSync(root + file, 'utf8');
// Pages served at a slashless address (/blog/x) also answer at /blog/x/, where ../ resolves one
// level too deep. Their links must be root-absolute so both addresses load styles and images.
function assertRootAbsolute(html, file) {
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const url = m[1];
    if (/^(https?:|mailto:|tel:|#)/.test(url)) continue;
    assert.ok(url.startsWith('/'), `${file}: root-absolute path expected, got ${url}`);
  }
  for (const m of html.matchAll(/srcset="([^"]+)"/g)) {
    for (const part of m[1].split(',')) assert.ok(part.trim().startsWith('/'), `${file}: srcset ${part}`);
  }
}
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
    assertRootAbsolute(html, file);
    const old = read(`archive/webflow-2026-11/${archived}`);
    const block = old.match(/<div class="rich-text-block-\d w-richtext">([\s\S]*?)<\/div>/)[1];
    const firstParagraph = plain(block.match(/<p\b[^>]*>([\s\S]*?)<\/p>/)[1]);
    assert.ok(firstParagraph.length > 20);
    assert.ok(plain(html).includes(firstParagraph), 'first Webflow paragraph present');
  });
}

const baseline = JSON.parse(read('migration/seo-baseline.json')).pages;
const POSTS = [
  'chatgpt-for-window-treatment-businesses',
  'how-to-increase-revenue-for-your-window-treatment-business',
  'how-to-start-a-window-treatment-business',
  'why-window-treatment-companies-need-seo',
];

for (const slug of POSTS) {
  test(`blog post ${slug} keeps its address, title, H1 and date`, () => {
    const file = `blog/${slug}.html`;
    assert.ok(existsSync(root + file), file);
    const html = read(file);
    const old = baseline[`/blog/${slug}`];
    const title = decodeEntities(html.match(/<title>([\s\S]*?)<\/title>/)[1]);
    assert.equal(title, old.title);
    const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
    assert.equal(h1s.length, 1, 'one H1');
    assert.equal(plain(h1s[0][1]), old.h1);
    assert.ok(html.includes(`<link rel="canonical" href="https://shadestrategy.com/blog/${slug}">`), 'canonical');
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const articles = blocks.filter((b) => b['@type'] === 'Article' || b['@type'] === 'BlogPosting');
    assert.equal(articles.length, 1, 'one Article JSON-LD');
    const [article] = articles;
    assert.equal(article.headline, old.h1);
    assert.equal(article.datePublished, '2025-10-17');
    assert.ok(article.author?.name, 'author');
    assert.equal(article.publisher?.name, 'Shade Strategy');
    assert.match(html, /<time datetime="2025-10-17">/);
    const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]).filter((t) => !t.includes('shade-strategy.png'));
    assert.ok(imgs.length >= 1, 'featured image');
    for (const img of imgs) {
      assert.match(img, /\salt="[^"]+"/, img);
      assert.match(img, new RegExp(`\\ssrc="/assets/blog/${slug}/`), img);
    }
    assertRootAbsolute(html, file);
  });
}

test('no page loads or links anything from Webflow', () => {
  for (const page of listPages(root)) {
    const html = read(page);
    assert.ok(!/website-files\.com|webflow\.com|webflow\.io/.test(html), page);
  }
});

test('Resources lists all four blog posts', () => {
  const html = read('resources/index.html');
  assert.match(html, /id="blog"/);
  for (const slug of POSTS) assert.ok(html.includes(`href="../blog/${slug}"`), slug);
  assert.ok(!html.includes('window-treatment-marketing-blog'), 'old blog list link');
});

test('every page links the stylesheet with the same version tag', () => {
  const tags = new Set(listPages(root).map((page) => read(page).match(/styles\.css(\?v=[\w-]+)?"/)?.[1] ?? 'none'));
  assert.equal(tags.size, 1, [...tags].join(', '));
  assert.ok(![...tags][0].startsWith('none'), 'versioned');
});

import { SITE_ORIGIN } from '../scripts/site-map.mjs';

test('every page except the ebook download is indexable with a self-canonical', () => {
  for (const page of listPages(root)) {
    const html = read(page);
    const noindex = /<meta name="robots" content="noindex">/.test(html);
    const canonicals = [...html.matchAll(/<link rel="canonical" href="([^"]+)">/g)].map((m) => m[1]);
    if (page === 'ebook/index.html') {
      assert.ok(noindex, 'ebook keeps noindex');
      assert.equal(canonicals.length, 0, 'ebook has no canonical');
    } else {
      assert.ok(!noindex, `${page} noindex`);
      assert.deepEqual(canonicals, [SITE_ORIGIN + pagePath(page)], page);
    }
  }
});

test('no link points at the old Webflow site', () => {
  for (const page of listPages(root)) {
    const html = read(page);
    assert.ok(!/<a\b[^>]*href="https:\/\/shadestrategy\.com/.test(html), `${page} absolute link`);
    assert.ok(!html.includes('coming-soon'), `${page} coming-soon`);
    assert.ok(!html.includes('Read the original testimonials'), `${page} testimonials link`);
  }
});

test('the homepage preview forms are replaced by strategy-call links', () => {
  const html = read('index.html');
  assert.ok(!html.includes('contact-form'));
  assert.ok(!html.includes('contact-preview.js'));
  assert.ok(!html.includes('This is a preview'));
  assert.ok(!existsSync(root + 'contact-preview.js'));
  for (const id of ['contact', 'inquiry']) {
    const section = html.match(new RegExp(`<section[^>]*id="${id}"[\\s\\S]*?</section>`))[0];
    assert.match(section, /<a class="cta[^"]*" href="\.\/strategy-call\/">Book a strategy call/, id);
  }
});

test('the ebook signup form still posts to Netlify Forms', () => {
  const form = read('index.html').match(/<form\b[^>]*name="ebook-signup"[^>]*>/)?.[0];
  assert.ok(form, 'ebook form');
  assert.match(form, /action="\/ebook\/"/);
  assert.match(form, /data-netlify="true"/);
  assert.match(form, /netlify-honeypot="bot-field"/);
});

test('the homepage keeps its title and carries the Organization schema over', () => {
  const html = read('index.html');
  assert.match(html, /<title>Window Treatment Marketing \| Shade Strategy<\/title>/);
  const orgs = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => JSON.parse(m[1]))
    .filter((b) => b['@type'] === 'Organization');
  assert.equal(orgs.length, 1);
  const [org] = orgs;
  assert.equal(org.name, 'Shade Strategy');
  assert.equal(org.legalName, 'Winc Solutions LLC, DBA Shade Strategy');
  assert.equal(org.telephone, '(615) 795-7515');
  assert.equal(org.url, 'https://shadestrategy.com/');
  const logo = typeof org.logo === 'string' ? org.logo : org.logo?.url;
  assert.match(logo, /^https:\/\/shadestrategy\.com\/assets\//);
  assert.ok(existsSync(root + logo.replace('https://shadestrategy.com/', '')), 'logo file exists');
  // Only the profiles the Webflow footer linked on every page; its schema's YouTube and Twitter answer 404.
  assert.deepEqual(org.sameAs, ['https://www.facebook.com/shadestrategy', 'https://www.instagram.com/shadestrategy/']);
  assert.equal(org.aggregateRating, undefined);
});

test('the homepage keeps the Search Console verification tag from Webflow', () => {
  const webflow = read('archive/webflow-2026-11/index.html').match(/<meta content="([^"]+)" name="google-site-verification"/)[1];
  assert.ok(read('index.html').includes(`<meta name="google-site-verification" content="${webflow}">`));
});

test('every page loads the analytics script', () => {
  for (const page of listPages(root)) {
    assert.ok(read(page).includes('<script src="/analytics.js" defer></script>'), page);
  }
});

test('the blog posts’ closing links go to the strategy call', () => {
  assert.ok(read('blog/why-window-treatment-companies-need-seo.html').includes('<a href="/strategy-call/">Get your free SEO report from Shade Strategy here</a>'));
  assert.ok(read('blog/chatgpt-for-window-treatment-businesses.html').includes('<a href="/strategy-call/">Reach out to Shade Strategy here</a>'));
});

test('no page shows stale announcements or update sign-ups that do not exist', () => {
  for (const page of listPages(root)) {
    const html = read(page);
    for (const stale of ['IWCE 2025', 'Free Visualizer', 'Get beta updates', 'Get tool updates']) {
      assert.ok(!html.includes(stale), `${page}: ${stale}`);
    }
  }
});

test('the stylesheet has no rules for the removed homepage forms', () => {
  const css = read('styles.css');
  for (const selector of ['.inquiry-form', '.inquiry-fields', '.inquiry-wide', '.contact-status']) {
    assert.ok(!css.includes(selector), selector);
  }
  assert.ok(read('index.html').includes('class="contact-fields ebook-fields"'), 'ebook form still uses .contact-fields');
  assert.ok(css.includes('.contact-fields'), '.contact-fields kept for the ebook form');
});

const serviceCards = (html) => [...html.matchAll(/<li class="offering">([\s\S]*?)<\/li>/g)].map((m) => m[1]);

test('individual services show the prices that exist and leave the rest blank', () => {
  for (const page of ['services/index.html', 'index.html']) {
    const cards = serviceCards(read(page));
    const ads = cards.find((c) => /<h3>Google Ads<\/h3>/.test(c));
    assert.ok(ads, `${page}: Google Ads card`);
    assert.match(ads, /class="offering-price"[^>]*>[\s\S]*\$399[\s\S]*\$299 setup/, `${page}: Google Ads price`);
    for (const card of cards.filter((c) => c !== ads && /<h3>/.test(c))) {
      assert.ok(!card.includes('offering-price'), `${page}: unexpected price in ${card.match(/<h3>(.*?)<\/h3>/)?.[1]}`);
    }
  }
  assert.match(read('services/google-ads-for-window-treatment-companies/index.html'), /class="offer-availability"[^>]*>[^<]*\$399/);
});

test('Full Service packages sit second: no featured tile or badge outside the Full Service page', () => {
  for (const page of ['index.html', 'services/index.html']) {
    const html = read(page);
    assert.ok(!html.includes('tier-featured'), `${page}: tier-featured`);
    assert.ok(!html.includes('Most popular'), `${page}: Most popular`);
    assert.ok(html.includes('tier-mini-grid tier-mini-quiet'), `${page}: quiet package tiles`);
    assert.ok(html.indexOf('offering-price') < html.indexOf('tier-mini-grid'), `${page}: individual prices come first`);
  }
});

test('every page links client and team sign-in in the menu and the footer', () => {
  for (const page of listPages(root)) {
    if (page === 'ebook/index.html') continue; // bare download page: no menu or footer
    const html = read(page);
    const nav = html.match(/<nav class="site-nav"[\s\S]*?<\/nav>/)?.[0] ?? '';
    assert.ok(nav.includes('href="https://ai.shadestrategy.com/sign-in"'), `${page}: menu sign-in`);
    const footer = html.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)?.[0] ?? '';
    assert.ok(footer.includes('href="https://ai.shadestrategy.com/sign-in"'), `${page}: footer client and team sign-in`);
    assert.ok(footer.includes('href="https://ads.shadestrategy.com/login"'), `${page}: footer Google Ads workspace`);
  }
});
