// GA4 for shadestrategy.com (property "Shade Strategy", G-REG436NDS5).
// Loads only on the production domain, so previews, netlify.app and local runs never count as visits or leads.
(function () {
  if (location.hostname !== 'shadestrategy.com') return;
  var id = 'G-REG436NDS5';
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', id);
  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
  document.head.appendChild(script);

  // Leads. ebook-form.js announces a signup only after GoHighLevel has confirmed it, just before it leaves the
  // page, so the event goes by beacon.
  document.addEventListener('shade:lead', function (event) {
    var name = event && event.detail && event.detail.form_name;
    window.gtag('event', 'generate_lead', { form_name: name || 'unknown', transport_type: 'beacon' });
  });

  // The strategy-call questionnaire stays on the page and reveals its result box once the lead is recorded.
  var result = document.querySelector('[data-shade-lead-form] [data-result]');
  if (result && typeof MutationObserver === 'function') {
    var sent = false;
    var observer = new MutationObserver(function () {
      // Records already queued can still arrive after disconnect, so count the lead once.
      if (sent || result.hidden) return;
      sent = true;
      observer.disconnect();
      window.gtag('event', 'generate_lead', { form_name: 'strategy_call' });
    });
    observer.observe(result, { attributes: true, attributeFilter: ['hidden'] });
  }

  // Other ways people reach out.
  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    if (target.closest('a[href^="mailto:"]')) window.gtag('event', 'email_click');
    else if (target.closest('a[href^="tel:"]')) window.gtag('event', 'phone_click');
  }, true);
})();
