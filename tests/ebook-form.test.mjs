import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../ebook-form.js', import.meta.url), 'utf8');
const context = { globalThis: {} };
context.globalThis = context;
vm.runInNewContext(source, context);
const { payload } = context.ShadeEbookForm;

test('the payload carries the answers, the honeypot, the time on page and the person check', () => {
  const body = payload({ name: '  Pat  Example ', email: ' pat@example.com ', website: '' }, 'tok', 1000, 6500, '/');
  assert.equal(JSON.stringify(body), JSON.stringify({ name: 'Pat  Example', email: 'pat@example.com', website: '', elapsedMs: 5500, page: '/', 'cf-turnstile-response': 'tok' }));
});
