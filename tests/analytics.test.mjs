import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../analytics.js', import.meta.url), 'utf8');

function run(hostname) {
  const appended = [];
  const context = {
    location: { hostname },
    document: {
      createElement: () => ({}),
      head: { appendChild: (el) => appended.push(el) },
    },
  };
  context.window = context;
  vm.runInNewContext(source, context);
  return { appended, context };
}

test('loads GA4 only on the production domain', () => {
  const { appended, context } = run('shadestrategy.com');
  assert.equal(appended.length, 1);
  assert.equal(appended[0].src, 'https://www.googletagmanager.com/gtag/js?id=G-REG436NDS5');
  assert.equal(appended[0].async, true);
  assert.ok(Array.isArray(context.dataLayer) && context.dataLayer.length >= 2);
  assert.equal(typeof context.gtag, 'function');
});

test('stays off on previews, netlify.app, www and localhost', () => {
  for (const host of ['shadestrategywebsite.netlify.app', 'deploy-preview-5--shadestrategywebsite.netlify.app', 'www.shadestrategy.com', 'localhost']) {
    const { appended, context } = run(host);
    assert.equal(appended.length, 0, host);
    assert.equal(context.dataLayer, undefined, host);
  }
});
