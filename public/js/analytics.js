/* GA4 wrapper. Replace GA_MEASUREMENT_ID before deploy. Falls back to console
   if no measurement id is set so dev mode still shows event flow. */
(function () {
  const MEASUREMENT_ID = window.__GA_MEASUREMENT_ID__ || null;

  if (MEASUREMENT_ID) {
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    document.head.appendChild(s);

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', MEASUREMENT_ID, { anonymize_ip: true });
  }

  window.rcTrack = function (event, params = {}) {
    if (window.gtag) {
      window.gtag('event', event, params);
    } else if (window.console) {
      console.debug('[analytics]', event, params);
    }
  };
})();
