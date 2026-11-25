import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../analytics.js', import.meta.url), 'utf8');

// A small fake browser: document listeners, one lead-form result box and a MutationObserver we can trigger.
function run(hostname, { result = null } = {}) {
  const appended = [];
  const listeners = {};
  const observers = [];
  const context = {
    location: { hostname },
    document: {
      createElement: () => ({}),
      head: { appendChild: (el) => appended.push(el) },
      addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
      querySelector: (sel) => (sel === '[data-shade-lead-form] [data-result]' ? result : null),
    },
    MutationObserver: class {
      constructor(fn) { this.fn = fn; observers.push(this); }
      observe(target, opts) { this.target = target; this.opts = opts; }
      disconnect() { this.done = true; }
    },
  };
  context.window = context;
  vm.runInNewContext(source, context);
  const events = () => (context.dataLayer || []).map((args) => Array.from(args)).filter((a) => a[0] === 'event');
  const fire = (type, target) => (listeners[type] || []).forEach((fn) => fn({ target }));
  return { appended, context, events, fire, observers, listeners };
}

const element = (matches, attrs = {}) => ({
  matches: (sel) => matches.includes(sel),
  closest(sel) { return this.matches(sel) ? this : null; },
  getAttribute: (k) => attrs[k] ?? null,
  hidden: attrs.hidden ?? false,
});

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
    const { appended, context, listeners } = run(host);
    assert.equal(appended.length, 0, host);
    assert.equal(context.dataLayer, undefined, host);
    assert.deepEqual(listeners, {}, host);
  }
});

test('the ebook signup sends generate_lead once, by beacon', () => {
  const { events, fire } = run('shadestrategy.com');
  fire('submit', element(['form[name="ebook-signup"]']));
  fire('submit', element(['form.other']));
  const leads = events().filter((e) => e[1] === 'generate_lead');
  assert.equal(leads.length, 1);
  assert.equal(leads[0][2].form_name, 'ebook');
  assert.equal(leads[0][2].transport_type, 'beacon');
});

test('the strategy-call questionnaire sends generate_lead when its result appears', () => {
  const result = element([], { hidden: true });
  const { events, observers } = run('shadestrategy.com', { result });
  assert.equal(observers.length, 1);
  assert.equal(observers[0].target, result);
  observers[0].fn([]); // still hidden: nothing yet
  assert.equal(events().filter((e) => e[1] === 'generate_lead').length, 0);
  result.hidden = false;
  observers[0].fn([]);
  observers[0].fn([]); // a second change must not count twice
  const leads = events().filter((e) => e[1] === 'generate_lead');
  assert.equal(leads.length, 1);
  assert.equal(leads[0][2].form_name, 'strategy_call');
  assert.equal(observers[0].done, true);
});

test('email and phone link clicks are counted', () => {
  const { events, fire } = run('shadestrategy.com');
  fire('click', element(['a[href^="mailto:"]']));
  fire('click', element(['a[href^="tel:"]']));
  fire('click', element(['a.cta']));
  const names = events().map((e) => e[1]);
  // Arrays made inside the vm context have another realm's prototype, so compare as JSON.
  assert.equal(JSON.stringify(names.filter((n) => n !== 'page_view')), '["email_click","phone_click"]');
});
