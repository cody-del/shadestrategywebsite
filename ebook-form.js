// The homepage ebook form: a Cloudflare Turnstile check, then the name and email go to /api/ebook-signup, which
// saves the contact in GoHighLevel. The download page opens only once the site confirms the signup.
(function () {
  var TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  var MIN_FILL_MS = 3000; // the function refuses faster signups, so the page waits out any remainder
  var FALLBACK = 'Email cody@shadestrategy.com and we’ll send the ebook.';

  function payload(values, token, startedAt, now, page) {
    return {
      name: String(values.name || '').trim(),
      email: String(values.email || '').trim(),
      website: String(values.website || ''),
      elapsedMs: Math.max(0, Math.round(now - startedAt)),
      page: page,
      'cf-turnstile-response': token || '',
    };
  }
  globalThis.ShadeEbookForm = Object.freeze({ payload: payload });
  if (typeof document === 'undefined') return;

  var form = document.querySelector('[data-ebook-form]');
  if (!form) return;
  var status = form.querySelector('[data-ebook-status]');
  var button = form.querySelector('button[type="submit"]');
  var box = form.querySelector('[data-turnstile]');
  var label = button.innerHTML;
  var startedAt = Date.now();
  var token = '';
  var widget = null;
  var sending = false;
  var say = function (text) { status.textContent = text; };

  var script = document.createElement('script');
  script.src = TURNSTILE_SCRIPT;
  script.async = true;
  script.defer = true;
  script.addEventListener('load', function () {
    if (!globalThis.turnstile) return;
    widget = globalThis.turnstile.render(box, {
      sitekey: box.getAttribute('data-sitekey'),
      action: 'ebook',
      size: box.clientWidth < 300 ? 'compact' : 'flexible',
      callback: function (t) { token = typeof t === 'string' ? t : ''; },
      'expired-callback': function () { token = ''; },
      'error-callback': function () { token = ''; },
    });
  });
  script.addEventListener('error', function () { say('The check that you’re a person couldn’t load. ' + FALLBACK); });
  document.head.appendChild(script);

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (sending || !form.reportValidity()) return;
    if (!token) {
      say('Finish the check that you’re a person first.');
      return;
    }
    var wait = MIN_FILL_MS - (Date.now() - startedAt);
    if (wait > 0) await new Promise(function (resolve) { setTimeout(resolve, wait + 50); });
    sending = true;
    button.disabled = true;
    button.textContent = 'Sending…';
    say('');
    var values = Object.fromEntries(new FormData(form));
    try {
      var response = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload(values, token, startedAt, Date.now(), location.pathname)),
      });
      var data = await response.json().catch(function () { return null; });
      if (response.ok && data && data.success) {
        document.dispatchEvent(new CustomEvent('shade:lead', { detail: { form_name: 'ebook' } }));
        location.assign('/ebook/');
        return;
      }
      say((data && data.error) || 'That didn’t go through. Try again in a moment.');
    } catch (error) {
      say('That didn’t go through. Check your connection and try again.');
    }
    sending = false;
    button.disabled = false;
    button.innerHTML = label;
    token = '';
    if (widget !== null && globalThis.turnstile) globalThis.turnstile.reset(widget);
  });
})();
