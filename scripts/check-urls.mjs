// Check that every old Webflow address works on an origin, as Googlebot sees it.
// Usage: node scripts/check-urls.mjs <origin> [--indexable]
import { pathToFileURL } from 'node:url';
import { KEPT, REDIRECTS, SITE_ORIGIN } from './site-map.mjs';
import { extractSeo } from './extract-seo.mjs';

export const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

function request(fetchImpl, url) {
  return fetchImpl(url, { redirect: 'manual', headers: { 'user-agent': GOOGLEBOT } });
}

export async function checkUrl({ origin, path, expectTo, allowDirect = false, fetchImpl = fetch }) {
  const url = origin + path;
  const res = await request(fetchImpl, url);
  if (allowDirect && res.status === 200) {
    // A 200 at an alternate address must still render: its stylesheet has to load from there.
    const href = (await res.text()).match(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/)?.[1];
    if (href) {
      const css = await request(fetchImpl, new URL(href, url).href);
      if (css.status !== 200) return { ok: false, detail: `${path}: 200 but its stylesheet ${new URL(href, url).pathname} answered ${css.status}` };
    }
    return { ok: true, detail: `${path} 200` };
  }
  if (expectTo == null) {
    return res.status === 200 ? { ok: true, detail: `${path} 200` } : { ok: false, detail: `${path}: expected 200, got ${res.status}` };
  }
  if (res.status !== 301) return { ok: false, detail: `${path}: expected 301 to ${expectTo}, got ${res.status}` };
  const location = res.headers.get('location');
  if (!location) return { ok: false, detail: `${path}: 301 without a Location` };
  const query = new URL(url).search;
  const target = new URL(location, url).href;
  const wanted = new URL(expectTo + query, origin).href;
  if (target !== wanted) return { ok: false, detail: `${path}: 301 to ${target}, expected ${wanted}` };
  const final = await request(fetchImpl, target);
  if (final.status !== 200) return { ok: false, detail: `${path}: target ${target} answered ${final.status} (want 200, no chain)` };
  return { ok: true, detail: `${path} 301 → ${expectTo}` };
}

async function checkSitemapPage({ origin, loc, indexable, fetchImpl }) {
  const path = loc.replace(SITE_ORIGIN, '');
  const res = await request(fetchImpl, origin + path);
  if (res.status !== 200) return { ok: false, detail: `sitemap ${path}: ${res.status}` };
  if (indexable) {
    if (/noindex/i.test(res.headers.get('x-robots-tag') ?? '')) return { ok: false, detail: `sitemap ${path}: X-Robots-Tag noindex` };
    const { canonical } = extractSeo(await res.text());
    if (canonical !== loc) return { ok: false, detail: `sitemap ${path}: canonical ${canonical}, expected ${loc}` };
  }
  return { ok: true, detail: `sitemap ${path} 200` };
}

export async function checkOrigin(origin, { indexable = false, fetchImpl = fetch } = {}) {
  const checks = [
    ...KEPT.map((path) => ({ path, expectTo: null })),
    ...REDIRECTS.map(({ from, to }) => ({ path: from, expectTo: to })),
    ...REDIRECTS.map(({ from, to }) => ({ path: `${from}/`, expectTo: to })),
    { path: '/pricing?gclid=test', expectTo: '/full-service/' },
    ...KEPT.filter((path) => path !== '/').map((path) => ({ path: `${path}/`, expectTo: path, allowDirect: true })),
  ];
  const results = [];
  for (const check of checks) results.push(await checkUrl({ origin, fetchImpl, ...check }));
  const sitemap = await request(fetchImpl, `${origin}/sitemap.xml`);
  if (sitemap.status !== 200) {
    results.push({ ok: false, detail: `sitemap.xml: ${sitemap.status}` });
  } else {
    const locs = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    if (!locs.length) results.push({ ok: false, detail: 'sitemap.xml has no <loc>' });
    for (const loc of locs) results.push(await checkSitemapPage({ origin, loc, indexable, fetchImpl }));
  }
  return results;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const origin = process.argv[2]?.replace(/\/$/, '');
  if (!origin) {
    console.error('Usage: node scripts/check-urls.mjs <origin> [--indexable]');
    process.exit(2);
  }
  const results = await checkOrigin(origin, { indexable: process.argv.includes('--indexable') });
  const failures = results.filter((r) => !r.ok);
  for (const failure of failures) console.log(`FAIL ${failure.detail}`);
  console.log(`${results.length - failures.length}/${results.length} passed on ${origin}`);
  process.exit(failures.length ? 1 : 0);
}
