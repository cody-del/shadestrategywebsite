import { test } from 'node:test';
import assert from 'node:assert/strict';
import { submitEbookSignup, EBOOK_TAG, GHL_API, MIN_FILL_MS } from '../netlify/lib/ebook.mjs';
import { createEbookHandler } from '../netlify/lib/ebook-http.mjs';

const env = { GHL_PRIVATE_TOKEN: 'pit-test', GHL_LOCATION_ID: 'loc123' };
const good = { name: 'Pat Example', email: 'Pat@Example.com', website: '', elapsedMs: 5000, page: '/' };

// A fake GoHighLevel: records each call and answers from a script.
function ghl({ upsert = { status: 200, body: { contact: { id: 'c1' } } }, tags = { status: 201, body: {} }, notes = { status: 201, body: {} } } = {}) {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init, body: init?.body ? JSON.parse(init.body) : null });
    const reply = url.endsWith('/contacts/upsert') ? upsert : url.endsWith('/tags') ? tags : notes;
    if (reply instanceof Error) throw reply;
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'Content-Type': 'application/json' } });
  };
  return { calls, fetcher };
}

test('a good signup upserts the contact, then tags it, then adds a note', async () => {
  const { calls, fetcher } = ghl();
  const result = await submitEbookSignup(good, { fetcher, env, now: () => new Date('2026-11-25T15:00:00Z') });
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.deepEqual(calls.map((c) => c.url), [`${GHL_API}/contacts/upsert`, `${GHL_API}/contacts/c1/tags`, `${GHL_API}/contacts/c1/notes`]);
  const [upsert, tag, note] = calls;
  assert.equal(upsert.init.method, 'POST');
  assert.equal(upsert.init.headers.Authorization, 'Bearer pit-test');
  assert.equal(upsert.init.headers.Version, '2021-07-28');
  assert.deepEqual(upsert.body, { locationId: 'loc123', firstName: 'Pat', lastName: 'Example', email: 'pat@example.com', source: 'Website: ebook (3 Mistakes)' });
  assert.equal(upsert.body.tags, undefined, 'tags go on separately, after the contact exists');
  assert.deepEqual(tag.body, { tags: [EBOOK_TAG] });
  assert.equal(EBOOK_TAG, 'ebook-signup');
  assert.match(note.body.body, /Ebook signup: 3 Mistakes Keeping You Under \$100K a Month/);
  assert.match(note.body.body, /Page: \//);
  assert.match(note.body.body, /2026-11-25/);
});

test('bots and bad input never reach GoHighLevel', async () => {
  const cases = [
    [{ ...good, website: 'http://spam.test' }, 400],
    [{ ...good, elapsedMs: MIN_FILL_MS - 1 }, 400],
    [{ ...good, elapsedMs: 'soon' }, 400],
    [{ ...good, email: 'not-an-email' }, 400],
    [{ ...good, name: '   ' }, 400],
    [{ ...good, name: 'x'.repeat(121) }, 400],
    [null, 400],
  ];
  for (const [data, status] of cases) {
    const { calls, fetcher } = ghl();
    const result = await submitEbookSignup(data, { fetcher, env });
    assert.equal(result.status, status, JSON.stringify(data));
    assert.equal(calls.length, 0);
  }
});

test('rate limited and unconfigured signups are refused without calling GoHighLevel', async () => {
  let r = ghl();
  assert.equal((await submitEbookSignup(good, { fetcher: r.fetcher, env, rateLimited: () => true })).status, 429);
  assert.equal(r.calls.length, 0);
  r = ghl();
  assert.equal((await submitEbookSignup(good, { fetcher: r.fetcher, env: {} })).status, 500);
  assert.equal(r.calls.length, 0);
});

test('a signup GoHighLevel did not confirm is an error, never a success', async () => {
  for (const scripted of [
    { upsert: { status: 400, body: { message: 'bad' } } },
    { upsert: { status: 200, body: {} } },
    { upsert: new TypeError('network') },
    { tags: { status: 500, body: {} } },
  ]) {
    const { calls, fetcher } = ghl(scripted);
    const result = await submitEbookSignup(good, { fetcher, env });
    assert.equal(result.status, 502, JSON.stringify(scripted));
    assert.equal(result.body.success, false);
    if (!scripted.tags) assert.ok(!calls.some((c) => c.url.endsWith('/tags')), 'no tag call after a failed upsert');
  }
});

test('a note that fails still counts: the contact and its tag are saved', async () => {
  const { fetcher } = ghl({ notes: { status: 500, body: {} } });
  assert.equal((await submitEbookSignup(good, { fetcher, env })).status, 200);
});

const request = (body, { origin = 'https://shadestrategy.com', type = 'application/json', method = 'POST' } = {}) =>
  new Request('https://shadestrategy.com/api/ebook-signup', { method, headers: { Origin: origin, 'Content-Type': type }, body: method === 'POST' ? body : undefined });

test('the HTTP handler checks method, origin, type and the person check before submitting', async () => {
  const seen = [];
  const submit = async (data) => { seen.push(data); return { status: 200, body: { success: true } }; };
  const human = async (token) => token === 'ok';
  const handler = createEbookHandler(submit, () => false, human);
  assert.equal((await handler(request('{}', { method: 'GET' }))).status, 405);
  assert.equal((await handler(request(JSON.stringify(good), { origin: 'https://evil.test' }))).status, 403);
  assert.equal((await handler(request('name=x', { type: 'application/x-www-form-urlencoded' }))).status, 415);
  assert.equal((await handler(request('{nope'))).status, 400);
  assert.equal((await handler(request(JSON.stringify({ ...good, 'cf-turnstile-response': 'no' })))).status, 403);
  assert.equal(seen.length, 0);
  const res = await handler(request(JSON.stringify({ ...good, 'cf-turnstile-response': 'ok' })));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
  assert.equal(seen.length, 1);
  assert.equal(seen[0]['cf-turnstile-response'], undefined, 'the token is not passed on');
});

test('GHL_API_BASE points the calls at a local fake GoHighLevel for testing', async () => {
  const { calls, fetcher } = ghl();
  await submitEbookSignup(good, { fetcher, env: { ...env, GHL_API_BASE: 'http://127.0.0.1:8890' } });
  assert.ok(calls.every((c) => c.url.startsWith('http://127.0.0.1:8890/contacts/')), calls.map((c) => c.url).join(','));
});
