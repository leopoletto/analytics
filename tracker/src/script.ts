(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const scriptEl = document.currentScript as HTMLScriptElement | null;
  if (!scriptEl) return;

  const domain = scriptEl.getAttribute('data-domain');
  if (!domain) return;

  const allowLocalhost = scriptEl.getAttribute('data-allow-localhost') === 'true';
  const apiUrl =
    scriptEl.getAttribute('data-api') ||
    new URL('/api/event', scriptEl.src).toString();

  let lastUrl: string | null = null;

  function shouldIgnore(): boolean {
    if (allowLocalhost) return false;
    const h = window.location.hostname;
    return (
      /^localhost$|^127(?:\.[0-9]+){0,2}\.[0-9]+$|^\[::1?\]$/.test(h) ||
      window.location.protocol === 'file:'
    );
  }

  function trackPageview(): void {
    if (shouldIgnore()) return;
    if ((document.visibilityState as string) === 'prerender') return;

    const currentUrl = window.location.href;
    if (currentUrl === lastUrl) return;
    lastUrl = currentUrl;

    const payload = JSON.stringify({
      d: domain,
      u: currentUrl,
      r: document.referrer || null,
      w: window.innerWidth,
    });

    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'text/plain' });
      navigator.sendBeacon(apiUrl, blob);
    } else {
      fetch(apiUrl, {
        method: 'POST',
        body: payload,
        headers: { 'Content-Type': 'text/plain' },
        keepalive: true,
        credentials: 'omit',
      }).catch(() => {});
    }
  }

  // Track SPA history navigation
  const origPushState = window.history.pushState;
  if (origPushState) {
    window.history.pushState = function (...args) {
      origPushState.apply(this, args);
      trackPageview();
    };
    window.addEventListener('popstate', trackPageview);
  }

  if ((document.visibilityState as string) === 'prerender') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') trackPageview();
    });
  } else {
    trackPageview();
  }
})();
