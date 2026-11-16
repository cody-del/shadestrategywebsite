// Shows the strategy-call questionnaire one screen at a time: what they need, revenue, budget, timing, the business,
// and how to reach them. A tap on a revenue, budget or timing answer moves on by itself; the keyboard uses Continue.
// lead-form.js (Shade Hub's embed, unchanged) still checks and sends the whole form; this file only shows one step at a
// time, checks a step's own answers before Continue (with lead-form.js's own rules and words) and, when the function
// marks an answer on an earlier step, goes back to it. The CS rep's page (?entry=cs-rep) stays on one page.
(() => {
  'use strict';
  const form = document.querySelector('[data-shade-lead-form]');
  if (!form || new URLSearchParams(location.search).get('entry') === 'cs-rep') return;
  const steps = Array.from(form.querySelectorAll('[data-step]'));
  const count = form.querySelector('[data-step-count]');
  const bar = form.querySelector('[data-progress]');
  const back = form.querySelector('[data-back]');
  if (steps.length < 2 || !count || !bar) return;

  const last = steps.length - 1;
  const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let current = 0;

  function show(i, focus) {
    current = i;
    steps.forEach((step, k) => {
      const off = k !== i;
      step.toggleAttribute('data-off', off);
      step.inert = off;
    });
    count.textContent = (i + 1) + ' of ' + steps.length;
    if (back) {
      back.setAttribute('aria-hidden', String(i === 0));
      back.tabIndex = i === 0 ? -1 : 0;
    }
    bar.style.transform = 'scaleX(' + (i + 1) / steps.length + ')';
    if (!focus) return;
    // Only when the form's top has scrolled away (a phone): on a screen that holds it, the page stays still.
    if (form.getBoundingClientRect().top < 0) form.scrollIntoView({ block: 'start', behavior: calm() ? 'auto' : 'smooth' });
    const title = steps[i].querySelector('.ss-step-title');
    if (title) title.focus({ preventScroll: true });
  }

  const stepOf = (el) => steps.findIndex((step) => step.contains(el));
  const val = (k) => { const el = form.querySelector('[name="' + k + '"]'); return el ? el.value : ''; };
  const picked = (k) => { const el = form.querySelector('input[name="' + k + '"]:checked'); return el ? el.value : null; };

  const fieldStep = (k) => stepOf(form.querySelector('[data-field="' + k + '"]'));
  const firstChoice = (k) => { const el = form.querySelector('input[name="' + k + '"]'); return el ? el.value : null; };

  /** The first answer wrong on step i or before it, as lead-form.js words it, or null. Later steps count as answered. */
  function problemUpTo(i) {
    const api = window.ShadeLeadForm;
    if (!api) return null;
    const later = (k) => fieldStep(k) > i;
    const values = {
      name: later('name') ? 'Answered later' : val('name'),
      revenue: later('revenue') ? firstChoice('revenue') : picked('revenue'),
      invest: later('invest') ? firstChoice('invest') : picked('invest'),
      timing: later('timing') ? firstChoice('timing') : picked('timing'),
      contact: later('contact') ? 'Answered later' : val('contact'),
      email: later('email') ? 'later@example.com' : val('email'),
      phone: later('phone') ? '' : val('phone'), website: later('website') ? '' : val('website'),
      support: Array.from(form.querySelectorAll('input[name="support"]:checked')).map((el) => el.value),
      runningAds: later('runningAds') ? null : picked('runningAds'), smsAgreed: false, note: '',
    };
    const problem = api.check(api.payload(values, 'website', ''));
    if (problem.ok) return null;
    const step = stepOf(form.querySelector('[data-field="' + problem.field + '"]'));
    return step >= 0 && step <= i ? { field: problem.field, error: problem.error, step } : null;
  }

  /** The same marks lead-form.js makes (its own edits clear them): the words under the answer, tied to its controls. */
  function mark(key, text) {
    const box = form.querySelector('[data-field="' + key + '"]');
    if (!box) return null;
    let msg = box.querySelector('.ss-lf-msg');
    if (!msg) {
      msg = document.createElement('p');
      msg.className = 'ss-lf-msg';
      msg.id = 'ss-lf-msg-' + key;
      box.appendChild(msg);
    }
    msg.textContent = text;
    msg.hidden = false;
    const list = Array.from(form.querySelectorAll('[name="' + key + '"]'));
    list.forEach((el) => {
      if (!el.hasAttribute('data-ss-lf-described')) el.setAttribute('data-ss-lf-described', el.getAttribute('aria-describedby') || '');
      el.setAttribute('aria-invalid', 'true');
      el.setAttribute('aria-describedby', (el.getAttribute('data-ss-lf-described') + ' ' + msg.id).trim());
    });
    return list.find((el) => el.checked) || list[0] || null;
  }

  function next() {
    const problem = problemUpTo(current);
    if (problem) {
      if (problem.step !== current) show(problem.step, false);
      const el = mark(problem.field, problem.error);
      if (el) el.focus();
      return;
    }
    if (current < last) show(current + 1, true);
  }

  form.addEventListener('click', (ev) => {
    const button = ev.target instanceof Element ? ev.target.closest('[data-next], [data-back]') : null;
    if (!button || !form.contains(button)) return;
    if (button.hasAttribute('data-next')) next();
    else if (current > 0) show(current - 1, true);
  });

  // A tap (not the keyboard: arrow keys move between answers) on an answer in a [data-auto] step moves on once it shows.
  let tapped = 0;
  let timer = 0;
  form.addEventListener('pointerdown', () => { tapped = Date.now(); });
  form.addEventListener('keydown', () => { tapped = 0; });
  form.addEventListener('change', (ev) => {
    const input = ev.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'radio') return;
    if (!steps[current].hasAttribute('data-auto') || !steps[current].contains(input) || Date.now() - tapped > 1500) return;
    clearTimeout(timer);
    const from = current;
    timer = setTimeout(() => { if (current === from) next(); }, calm() ? 0 : 260);
  });

  // Enter in a field before the last step means Continue, not Send: this runs before lead-form.js's own submit.
  document.addEventListener('submit', (ev) => {
    if (ev.target !== form || current === last) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    next();
  }, true);

  // An answer the function (or the full check at Send) marks on another step: go back to it and focus it.
  new MutationObserver((changes) => {
    for (const change of changes) {
      const el = change.target;
      if (!(el instanceof HTMLElement) || el.getAttribute('aria-invalid') !== 'true') continue;
      const step = stepOf(el);
      if (step < 0 || step === current) continue;
      show(step, false);
      const name = el.getAttribute('name');
      const target = (name && form.querySelector('[name="' + name + '"]:checked')) || el;
      target.focus();
      return;
    }
  }).observe(form, { subtree: true, attributes: true, attributeFilter: ['aria-invalid'] });

  form.setAttribute('data-stepped', '');
  form.querySelectorAll('[data-steps-ui]').forEach((el) => { el.hidden = false; });
  show(0, false);
})();
