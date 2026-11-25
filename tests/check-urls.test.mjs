import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkUrl, GOOGLEBOT } from '../scripts/check-urls.mjs';

const origin = 'https://example.test';

// A fake fetch: routes maps a full URL to { status, location?, headers?, body? }.
function fakeFetch(routes, seen = []) {
  return async (url, init) => {
    seen.push({ url, init });
    const route = routes[url] ?? { status: 404 };
    const headers = new Headers(route.headers ?? {});
    if (route.location) headers.set('location', route.location);
    return new Response(route.body ?? '', { status: route.status, headers });
  };
}

test('a kept page passes on 200 and is requested as Googlebot without following redirects', async () => {
  const seen = [];
  const result = await checkUrl({ origin, path: '/', expectTo: null, fetchImpl: fakeFetch({ [`${origin}/`]: { status: 200 } }, seen) });
  assert.equal(result.ok, true, result.detail);
  assert.equal(seen[0].init.redirect, 'manual');
  assert.equal(new Headers(seen[0].init.headers).get('user-agent'), GOOGLEBOT);
});

test('a kept page that redirects fails', async () => {
  const result = await checkUrl({ origin, path: '/blog/x', expectTo: null, fetchImpl: fakeFetch({ [`${origin}/blog/x`]: { status: 301, location: '/blog/x/' } }) });
  assert.equal(result.ok, false);
});

test('a 302 is reported as a failure', async () => {
  const result = await checkUrl({
    origin, path: '/pricing', expectTo: '/full-service/',
    fetchImpl: fakeFetch({ [`${origin}/pricing`]: { status: 302, location: '/full-service/' }, [`${origin}/full-service/`]: { status: 200 } }),
  });
  assert.equal(result.ok, false);
  assert.match(result.detail, /expected 301/);
});

test('a 301 to the wrong page fails', async () => {
  const result = await checkUrl({
    origin, path: '/pricing', expectTo: '/full-service/',
    fetchImpl: fakeFetch({ [`${origin}/pricing`]: { status: 301, location: '/strategy-call/' }, [`${origin}/strategy-call/`]: { status: 200 } }),
  });
  assert.equal(result.ok, false);
});

test('a redirect chain fails', async () => {
  const result = await checkUrl({
    origin, path: '/pricing', expectTo: '/full-service/',
    fetchImpl: fakeFetch({ [`${origin}/pricing`]: { status: 301, location: '/full-service/' }, [`${origin}/full-service/`]: { status: 301, location: '/x/' } }),
  });
  assert.equal(result.ok, false);
});

test('a relative Location to the right page passes', async () => {
  const result = await checkUrl({
    origin, path: '/pricing', expectTo: '/full-service/',
    fetchImpl: fakeFetch({ [`${origin}/pricing`]: { status: 301, location: '/full-service/' }, [`${origin}/full-service/`]: { status: 200 } }),
  });
  assert.equal(result.ok, true, result.detail);
});

test('the query string must survive the redirect', async () => {
  const kept = await checkUrl({
    origin, path: '/pricing?gclid=test', expectTo: '/full-service/',
    fetchImpl: fakeFetch({ [`${origin}/pricing?gclid=test`]: { status: 301, location: '/full-service/?gclid=test' }, [`${origin}/full-service/?gclid=test`]: { status: 200 } }),
  });
  assert.equal(kept.ok, true, kept.detail);
  const dropped = await checkUrl({
    origin, path: '/pricing?gclid=test', expectTo: '/full-service/',
    fetchImpl: fakeFetch({ [`${origin}/pricing?gclid=test`]: { status: 301, location: '/full-service/' }, [`${origin}/full-service/`]: { status: 200 } }),
  });
  assert.equal(dropped.ok, false);
});

test('allowDirect accepts a 200 or a single 301 to the expected page', async () => {
  const direct = await checkUrl({ origin, path: '/p/', expectTo: '/p', allowDirect: true, fetchImpl: fakeFetch({ [`${origin}/p/`]: { status: 200 } }) });
  assert.equal(direct.ok, true, direct.detail);
  const hop = await checkUrl({
    origin, path: '/p/', expectTo: '/p', allowDirect: true,
    fetchImpl: fakeFetch({ [`${origin}/p/`]: { status: 301, location: '/p' }, [`${origin}/p`]: { status: 200 } }),
  });
  assert.equal(hop.ok, true, hop.detail);
});

test('allowDirect fails a 200 whose stylesheet does not load from that address', async () => {
  const page = '<link rel="stylesheet" href="../styles.css?v=1">';
  const broken = await checkUrl({
    origin, path: '/blog/x/', expectTo: '/blog/x', allowDirect: true,
    fetchImpl: fakeFetch({ [`${origin}/blog/x/`]: { status: 200, body: page }, [`${origin}/blog/styles.css?v=1`]: { status: 404 } }),
  });
  assert.equal(broken.ok, false);
  assert.match(broken.detail, /stylesheet/);
  const fixed = await checkUrl({
    origin, path: '/blog/x/', expectTo: '/blog/x', allowDirect: true,
    fetchImpl: fakeFetch({ [`${origin}/blog/x/`]: { status: 200, body: '<link rel="stylesheet" href="/styles.css?v=1">' }, [`${origin}/styles.css?v=1`]: { status: 200 } }),
  });
  assert.equal(fixed.ok, true, fixed.detail);
});
