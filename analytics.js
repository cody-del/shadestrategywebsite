// GA4 for shadestrategy.com (property "Shade Strategy", G-REG436NDS5).
// Loads only on the production domain, so previews, netlify.app and local runs never count as visits.
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
})();
