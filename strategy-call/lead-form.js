// Shade Strategy's website questionnaire (spec 29): the script for form.html, pasted into the /strategy-call page's
// Before-body custom code inside a script tag (tools/lead-form/README.md). It must never hold a closing script tag or
// an HTML comment opener, since it's pasted inline; the test checks. One classic script, no modules and no
// libraries but Cloudflare's Turnstile, which it loads itself. It mounts every [data-shade-lead-form] form:
//   - ?entry=cs-rep in the page's address shows the CS rep's fields and words;
//   - it checks the answers with the lead-form function's rules, order and words (checkLeadFields in
//     supabase/functions/_shared/lead-form.ts; tests/functions/lead-form-embed.test.ts holds the two together);
//   - it sends them as JSON to data-endpoint with the Turnstile token (data-sitekey's widget, action "lead-form");
//   - it shows the answer where the form was and moves focus there, or shows the error and marks its field.
// Every word from the function goes on the page as text, never as HTML. It sets globalThis.ShadeLeadForm = {check,
// payload} for the tests, and without a DOM it does nothing else.
(() => {
  'use strict';

  // The answers' keys: public/launch/lead-routing.js' REVENUE, INVEST, TIMING and ADS, and app.js' SERVICES, in order.
  const REVENUE = ['lt20', '20to30', '30to40', '40to60', '60to100', '100plus'];
  const INVEST = ['lt1', '1to2', '2to4', '4to6', '6plus', 'unsure'];
  const TIMING = ['asap', '30d', '60to90d', 'exploring'];
  const ADS = ['yes', 'no', 'unsure'];
  const SERVICES = ['web', 'seo', 'gads', 'meta', 'gbp', 'ghl', 'calls'];
  /** The most each text field may hold (the function's LIMITS), in UTF-16 units as maxlength counts them. */
  const LIMITS = { name: 120, contact: 120, email: 254, phone: 40, website: 200, note: 1000, repName: 80, retailer: 120 };

  /** The function's LEAD_FIELD_ERRORS, word for word. */
  const E = {
    name: 'Add the business name.',
    nameLong: 'Keep the business name to 120 characters.',
    revenue: 'Pick your monthly revenue.',
    invest: 'Pick your monthly budget, or “I’m not sure yet”.',
    timing: 'Pick when you want to decide.',
    entry: 'This form’s link isn’t right. Open it again from the link you were given.',
    repName: 'Add your name as the CS rep.',
    repNameLong: 'Keep your name to 80 characters.',
    retailer: 'Add the referring retailer.',
    retailerLong: 'Keep the retailer’s name to 120 characters.',
    contact: 'Add your name.',
    contactLong: 'Keep your name to 120 characters.',
    email: 'Add an email address we can reply to.',
    emailBad: 'Check the email address: a plain one, like name@example.com.',
    smsAgreed: 'Tick the texts box, or leave it unticked.',
    phone: 'Add a phone number to get texts.',
    phoneLong: 'Keep the phone number to 40 characters.',
    phoneBad: 'Check the phone number: it needs 7 to 15 digits.',
    websiteLong: 'Keep the website to 200 characters.',
    support: 'Pick the support you’re looking for from the list.',
    runningAds: 'Pick Yes, No or Not sure for ads.',
    noteLong: 'Keep the note to 1000 characters.',
  };
  /** The function's LEAD_FORM_WORDS this page says itself. */
  const WORDS = {
    notSetUp: 'This form can’t take answers right now.',
    token: 'Finish the check that you’re a person first.',
    failed: 'That didn’t go through. Try again in a moment.',
    turnstileDown: 'The check that you’re a person couldn’t be made. Try again in a moment.',
  };
  /** The function's FAIL_MESSAGE, word for word: Customer Success or Cody's review. */
  const FAIL_MESSAGE = 'Thanks! Our customer success team will review the info and reach out with the most appropriate option.';
  const PASS = {
    website: 'Thanks! You’re a good fit for a strategy call with Cody, our founder.',
    button: 'Pick a time with Cody',
    rep: 'They’re a good fit. Send them Cody’s booking link:',
    copy: 'Copy link',
    copied: 'Link copied.',
    copyFailed: 'Couldn’t copy it. Select the link and copy it instead.',
  };
  /** The function's short answers for requests no page of ours makes: shown as WORDS.failed instead. */
  const TERSE = ['not JSON', 'POST only', 'not allowed'];
  const SENDING = 'Sending…';
  const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  const TURNSTILE_ACTION = 'lead-form';
  /** The fields a problem can name, each a [data-field] box with controls of that name in form.html. */
  const FIELDS = ['name', 'revenue', 'invest', 'timing', 'repName', 'retailer', 'contact', 'email', 'smsAgreed', 'phone', 'website', 'support', 'runningAds', 'note'];

  // What a field's text loses, as the function removes it: control characters other than the line break
  // (U+0000–U+0009, U+000B–U+001F, U+007F–U+009F), zero-width ones and the marks that set direction (U+200B–U+200F),
  // the line and paragraph separators (U+2028, U+2029) and the text-reversing controls (U+202A–U+202E, U+2066–U+2069).
  // Built from code points so no invisible character sits in this file.
  const cp = (n) => '\\u' + n.toString(16).padStart(4, '0');
  const CONTROL = new RegExp('[' + cp(0x00) + '-' + cp(0x09) + cp(0x0b) + '-' + cp(0x1f) + cp(0x7f) + '-' + cp(0x9f)
    + cp(0x200b) + '-' + cp(0x200f) + cp(0x2028) + '-' + cp(0x202e) + cp(0x2066) + '-' + cp(0x2069) + ']', 'gu');
  /** config.ts' ADDRESS: a plain address, the one the GHL and email steps take. */
  const ADDRESS = /^[A-Za-z0-9._%+'-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

  const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
  const cleanText = (v) => (typeof v === 'string' ? v.replace(CONTROL, '').trim() : '');
  const plainAddress = (raw) => {
    const v = typeof raw === 'string' ? raw.trim() : '';
    return v.length <= 254 && ADDRESS.test(v) ? v : '';
  };
  const known = (list, key) => typeof key === 'string' && list.includes(key);
  const none = (v) => v === undefined || v === null || v === '';
  const digitCount = (s) => s.replace(/[^0-9]/g, '').length;

  /**
   * The first thing wrong with a body, as the function says it ({ok: false, field, error}), or {ok: true}: the same
   * rules, order, field keys and words as checkLeadFields.
   */
  function check(body) {
    const b = isObject(body) ? body : {};
    const bad = (field, error) => ({ ok: false, field, error });

    const name = cleanText(b.name);
    if (!name) return bad('name', E.name);
    if (name.length > LIMITS.name) return bad('name', E.nameLong);
    if (!known(REVENUE, b.revenue)) return bad('revenue', E.revenue);
    if (!known(INVEST, b.invest)) return bad('invest', E.invest);
    if (!known(TIMING, b.timing)) return bad('timing', E.timing);

    if (!none(b.entry) && b.entry !== 'website' && b.entry !== 'cs-rep') return bad('entry', E.entry);
    if (b.entry === 'cs-rep') {
      const repName = cleanText(b.repName);
      if (!repName) return bad('repName', E.repName);
      if (repName.length > LIMITS.repName) return bad('repName', E.repNameLong);
      const retailer = cleanText(b.retailer);
      if (!retailer) return bad('retailer', E.retailer);
      if (retailer.length > LIMITS.retailer) return bad('retailer', E.retailerLong);
    }

    const contact = cleanText(b.contact);
    if (!contact) return bad('contact', E.contact);
    if (contact.length > LIMITS.contact) return bad('contact', E.contactLong);
    const email = cleanText(b.email);
    if (!email) return bad('email', E.email);
    if (!plainAddress(email)) return bad('email', E.emailBad);

    if (!none(b.smsAgreed) && typeof b.smsAgreed !== 'boolean') return bad('smsAgreed', E.smsAgreed);
    const phone = cleanText(b.phone);
    // A rep's entry records no consent (the rep's page has no texts box), so its phone is optional.
    if (!phone && b.smsAgreed === true && b.entry !== 'cs-rep') return bad('phone', E.phone);
    if (phone.length > LIMITS.phone) return bad('phone', E.phoneLong);
    if (phone && (digitCount(phone) < 7 || digitCount(phone) > 15)) return bad('phone', E.phoneBad);

    if (cleanText(b.website).length > LIMITS.website) return bad('website', E.websiteLong);

    if (!none(b.support) && !(Array.isArray(b.support) && b.support.every((s) => typeof s === 'string' && SERVICES.includes(s)))) {
      return bad('support', E.support);
    }
    if (!none(b.runningAds) && !known(ADS, b.runningAds)) return bad('runningAds', E.runningAds);
    if (cleanText(b.note).length > LIMITS.note) return bad('note', E.noteLong);
    return { ok: true };
  }

  /**
   * The body the function takes, from the form's values ({name, revenue, …}, a choice not made as null), the entry and
   * the Turnstile token. The CS rep's fields go only with entry cs-rep, which never sends texts agreed: a rep can't give
   * the prospect's consent.
   */
  function payload(values, entry, token) {
    const v = isObject(values) ? values : {};
    const text = (k) => (typeof v[k] === 'string' ? v[k] : '');
    const pick = (k) => (typeof v[k] === 'string' && v[k] ? v[k] : null);
    const rep = entry === 'cs-rep';
    const body = {
      name: text('name'), revenue: pick('revenue'), invest: pick('invest'), timing: pick('timing'),
      contact: text('contact'), email: text('email'), phone: text('phone'), website: text('website'),
      support: Array.isArray(v.support) ? v.support.filter((s) => typeof s === 'string') : [],
      runningAds: pick('runningAds'), smsAgreed: !rep && v.smsAgreed === true, note: text('note'),
      entry: rep ? 'cs-rep' : 'website',
    };
    if (rep) {
      body.repName = text('repName');
      body.retailer = text('retailer');
    }
    body.turnstile = typeof token === 'string' ? token : '';
    return body;
  }

  /** An https address as the browser reads it, or "": the booking link is shown only when it's https. */
  function httpsUrl(raw) {
    if (typeof raw !== 'string') return '';
    try {
      const url = new URL(raw);
      return url.protocol === 'https:' && url.hostname ? url.href : '';
    } catch {
      return '';
    }
  }

  /**
   * Cloudflare's script once per page, then fn; fn runs at once when it's already there. failed runs if the script
   * can't load (blocked, or Cloudflare down), so the page can say so instead of waiting on a check that never comes.
   */
  function withTurnstile(fn, failed) {
    if (globalThis.turnstile) { fn(); return; }
    let script = Array.from(document.scripts).find((s) => s.src === TURNSTILE_SCRIPT);
    if (!script) {
      script = document.createElement('script');
      script.src = TURNSTILE_SCRIPT;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', fn);
    script.addEventListener('error', failed);
  }

  function mount(form) {
    if (form.hasAttribute('data-ss-lf-mounted')) return;
    form.setAttribute('data-ss-lf-mounted', '');
    const entry = new URLSearchParams(location.search).get('entry') === 'cs-rep' ? 'cs-rep' : 'website';
    const rep = entry === 'cs-rep';
    const fields = form.querySelector('[data-fields]');
    const result = form.querySelector('[data-result]');
    const alertBox = form.querySelector('[data-alert]');
    const submit = form.querySelector('[data-submit]');
    const checkBox = form.querySelector('[data-turnstile]');
    const sms = form.querySelector('input[name="smsAgreed"]');
    if (!fields || !result || !alertBox || !submit || !checkBox) return;
    const say = (text) => { alertBox.textContent = text; };
    // Send's own label from form.html, put back after each send.
    const sendLabel = submit.textContent;

    // The rep's page: its fields and words in, the website's out. The texts box is the website's only: a rep can't give
    // the prospect's consent (payload sends texts agreed false), and staff tick it in Launch Hub once they've confirmed it.
    form.querySelectorAll('[data-rep-only]').forEach((el) => { el.hidden = !rep; });
    form.querySelectorAll('[data-website-only]').forEach((el) => { el.hidden = rep; });
    if (rep) {
      if (sms) sms.checked = false;
      // The rep types the lead's details: the browser mustn't fill in the rep's own.
      ['name', 'contact', 'email', 'phone', 'website'].forEach((k) => {
        const el = form.querySelector('[name="' + k + '"]');
        if (el) el.setAttribute('autocomplete', 'off');
      });
    }

    const endpoint = form.getAttribute('data-endpoint') || '';
    const sitekey = form.getAttribute('data-sitekey') || '';
    if (!endpoint || !sitekey || /PROJECT-REF|TURNSTILE-SITE-KEY/.test(endpoint + ' ' + sitekey)) {
      say(WORDS.notSetUp);
      return;
    }

    let token = '';
    let widget = null;
    let sending = false;
    let turnstileDown = false;
    withTurnstile(() => {
      const ts = globalThis.turnstile;
      if (widget !== null || !ts) return;
      widget = ts.render(checkBox, {
        sitekey, action: TURNSTILE_ACTION, size: checkBox.clientWidth < 300 ? 'compact' : 'flexible',
        callback: (t) => { token = typeof t === 'string' ? t : ''; },
        'expired-callback': () => { token = ''; },
        'error-callback': () => { token = ''; },
      });
    }, () => { turnstileDown = true; say(WORDS.turnstileDown); });
    const newCheck = () => {
      token = '';
      if (widget !== null && globalThis.turnstile) globalThis.turnstile.reset(widget);
    };

    const controls = (key) => Array.from(form.querySelectorAll('[name="' + key + '"]'));
    /** Marks a field with its words (aria-invalid, aria-describedby) and gives the control to focus. */
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
      const list = controls(key);
      list.forEach((el) => {
        if (!el.hasAttribute('data-ss-lf-described')) el.setAttribute('data-ss-lf-described', el.getAttribute('aria-describedby') || '');
        el.setAttribute('aria-invalid', 'true');
        el.setAttribute('aria-describedby', (el.getAttribute('data-ss-lf-described') + ' ' + msg.id).trim());
      });
      return list.find((el) => el.checked) || list[0] || null;
    }
    function unmark(key) {
      const box = form.querySelector('[data-field="' + key + '"]');
      const msg = box && box.querySelector('.ss-lf-msg');
      if (msg) { msg.textContent = ''; msg.hidden = true; }
      controls(key).forEach((el) => {
        el.removeAttribute('aria-invalid');
        if (!el.hasAttribute('data-ss-lf-described')) return;
        const base = el.getAttribute('data-ss-lf-described');
        if (base) el.setAttribute('aria-describedby', base);
        else el.removeAttribute('aria-describedby');
        el.removeAttribute('data-ss-lf-described');
      });
    }
    const onEdit = (ev) => {
      const key = ev.target && ev.target.name;
      if (FIELDS.includes(key)) unmark(key);
    };
    form.addEventListener('input', onEdit);
    form.addEventListener('change', onEdit);

    function read() {
      const val = (k) => {
        const el = form.querySelector('[name="' + k + '"]');
        return el && typeof el.value === 'string' ? el.value : '';
      };
      const picked = (k) => {
        const el = form.querySelector('input[name="' + k + '"]:checked');
        return el ? el.value : null;
      };
      return {
        name: val('name'), revenue: picked('revenue'), invest: picked('invest'), timing: picked('timing'),
        repName: val('repName'), retailer: val('retailer'), contact: val('contact'), email: val('email'),
        phone: val('phone'), website: val('website'),
        support: Array.from(form.querySelectorAll('input[name="support"]:checked')).map((el) => el.value),
        runningAds: picked('runningAds'), smsAgreed: Boolean(sms && sms.checked), note: val('note'),
      };
    }

    function link(className, href, text) {
      const a = document.createElement('a');
      a.className = className;
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = text;
      return a;
    }
    /** The answer where the form was, focused: pass with Cody's booking link (https only), or the fail message. */
    function showResult(data) {
      const booking = data.result === 'pass' ? httpsUrl(data.booking) : '';
      const lead = document.createElement('p');
      result.replaceChildren(lead);
      if (!booking) {
        lead.textContent = FAIL_MESSAGE;
      } else if (!rep) {
        lead.textContent = PASS.website;
        result.append(link('ss-lf-button', booking, PASS.button));
      } else {
        lead.textContent = PASS.rep;
        const copy = document.createElement('button');
        copy.type = 'button';
        copy.className = 'ss-lf-button ss-lf-plain';
        copy.textContent = PASS.copy;
        const note = document.createElement('p');
        note.className = 'ss-lf-hint';
        note.setAttribute('aria-live', 'polite');
        copy.addEventListener('click', () => {
          const done = () => { note.textContent = PASS.copied; };
          const failed = () => { note.textContent = PASS.copyFailed; };
          try {
            navigator.clipboard.writeText(booking).then(done, failed);
          } catch {
            failed();
          }
        });
        result.append(link('ss-lf-link', booking, booking), copy, note);
      }
      fields.hidden = true;
      result.hidden = false;
      result.focus();
    }

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (sending) return;
      FIELDS.forEach(unmark);
      say('');
      const body = payload(read(), entry, token);
      const problem = check(body);
      if (!problem.ok) {
        // The field's own message, tied to it with aria-describedby, is read when it takes focus: not the live region too.
        const el = mark(problem.field, problem.error);
        if (el) el.focus();
        else say(problem.error);
        return;
      }
      if (!body.turnstile) {
        say(turnstileDown ? WORDS.turnstileDown : WORDS.token);
        return;
      }

      sending = true;
      submit.disabled = true;
      submit.textContent = SENDING;
      form.setAttribute('aria-busy', 'true');
      let status = 0;
      let data = null;
      try {
        const res = await fetch(endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
          credentials: 'omit', cache: 'no-store',
        });
        status = res.status;
        data = await res.json().catch(() => null);
      } catch {
        status = 0;
      }
      sending = false;
      form.removeAttribute('aria-busy');
      submit.textContent = sendLabel;
      submit.disabled = false;
      if (status === 200 && isObject(data) && (data.result === 'pass' || data.result === 'fail')) {
        showResult(data);
        return;
      }

      // The answers stay; the error shows above the button, and a field error marks its field and takes focus.
      const said = isObject(data) && typeof data.error === 'string' ? data.error.trim().slice(0, 300) : '';
      const error = said && !TERSE.includes(said) ? said : WORDS.failed;
      say(error);
      newCheck();
      const field = isObject(data) && FIELDS.includes(data.field) ? data.field : '';
      const el = field ? mark(field, error) : null;
      if (el) el.focus();
      else if (!form.contains(document.activeElement) || document.activeElement === form) submit.focus();
    });

    submit.disabled = false;
  }

  globalThis.ShadeLeadForm = Object.freeze({ check, payload });
  if (typeof document === 'undefined') return;
  const start = () => document.querySelectorAll('[data-shade-lead-form]').forEach(mount);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
