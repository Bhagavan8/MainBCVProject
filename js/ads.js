/* ads.js — Robust Popup + Sticky ad handler
   - safe if window.CONFIG missing
   - reloads AdSense if missing
   - shows fallback placeholders when ads blocked
   - debug helpers: window.showAdPopupNow(), window.showStickyNow()
*/
'use strict';

(function () {
  // Utility: safely read global config or use defaults
  const cfg = (typeof window !== 'undefined' && window.CONFIG) ? window.CONFIG : {
    popupDelayMsDesktop: 4000,
    popupDelayMsMobile: 6000,
    popupAutoCloseSec: 15,
    stickyShowDelayMsDesktop: 12000,
    stickyShowDelayMsMobile: 8000,
    stickyAutoCloseMsMobile: 30000,
    scrollTriggerPx: 420,
    minDesktopWidth: 769,
    adsenseClientId: '' // optional: set to 'ca-pub-...' if you want this script to attempt reloads
  };

  // Helpers
  const isMobile = () => window.innerWidth < (cfg.minDesktopWidth || 769);

  function safeLog(...args) { try { console.log(...args); } catch (e) {} }
  function safeWarn(...args) { try { console.warn(...args); } catch (e) {} }

  // Try to ensure AdSense script is present. Returns Promise<boolean>
  function ensureAdsenseScript(clientId) {
    clientId = clientId || cfg.adsenseClientId || '';
    try {
      const existing = document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]');
      if (existing && typeof window.adsbygoogle !== 'undefined') {
        safeLog('Adsense script present and adsbygoogle defined.');
        return Promise.resolve(true);
      }
      return new Promise((resolve) => {
        const s = document.createElement('script');
        s.async = true;
        s.crossOrigin = 'anonymous';
        s.src = clientId ? `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}` : 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
        let resolved = false;
        s.onload = () => { resolved = true; safeLog('Adsense script loaded.'); resolve(true); };
        s.onerror = (e) => { resolved = true; safeWarn('Adsense script failed to load:', e); resolve(false); };
        document.head.appendChild(s);
        // fallback guard
        setTimeout(() => {
          if (!resolved) {
            resolve(typeof window.adsbygoogle !== 'undefined');
          }
        }, 3500);
      });
    } catch (err) {
      safeWarn('ensureAdsenseScript error', err);
      return Promise.resolve(false);
    }
  }

  // Safe push to adsbygoogle
  function safePushAds() {
    try {
      if (typeof window.adsbygoogle === 'undefined') {
        safeWarn('adsbygoogle not defined when attempting push.');
      }
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      safeLog('adsbygoogle push attempted');
    } catch (e) {
      safeWarn('adsbygoogle push failed', e);
    }
  }

  // If ins is blocked/hidden, reveal fallback element (if present)
  function showFallbackIfBlocked(container) {
    try {
      if (!container || !container.querySelector) return false;
      const ins = container.querySelector('ins.adsbygoogle');
      const fallback = container.querySelector('.ad-fallback, .ad-blocker-fallback');
      const visible = ins && ins.offsetParent !== null && ins.clientHeight > 0 && ins.clientWidth > 0;
      if (!visible && fallback) { fallback.style.display = 'block'; }
      if (visible && fallback) { fallback.style.display = 'none'; }
      return visible;
    } catch (e) {
      safeWarn('showFallbackIfBlocked error', e);
      return false;
    }
  }

  // Grab DOM nodes (may be missing)
  const popup = document.getElementById('adPopup') || null;
  const popupClose = document.getElementById('adPopupClose') || null;
  const sticky = document.getElementById('stickyAd') || null;
  const stickyClose = document.getElementById('stickyClose') || null;

  if (!popup) safeWarn('adPopup element not found in DOM.');
  if (!sticky) safeWarn('stickyAd element not found in DOM.');

  // Defensive unhandled rejection trap so third-party ad script errors don't break UI
  window.addEventListener('unhandledrejection', (ev) => {
    safeWarn('Unhandled promise rejection (suppressed):', ev.reason);
    // don't call preventDefault — leave browser behavior but we logged it
  });

  // POPUP logic
  (function popupIIFE() {
    if (!popup) return;

    const popupBody = popup.querySelector('.ads-popup-body') || popup;
    const popupFallback = popup.querySelector('.ad-fallback, .ad-blocker-fallback') || null;
    let popupTimer = null;
    let popupCountdownTimer = null;
    let shown = false;

    async function showPopup(force = false) {
      if (shown) return;
      shown = true;
      safeLog('showPopup called', { force, isMobile: isMobile() });

      // Ensure adsense script exists (non-blocking)
      ensureAdsenseScript(cfg.adsenseClientId).then(() => {
        // UI show
        popup.classList.add('active');
        popup.setAttribute('aria-hidden', 'false');

        // attempt to load adslot
        safePushAds();

        // after small delay decide fallback
        setTimeout(() => {
          const vis = showFallbackIfBlocked(popupBody);
          if (!vis && popupFallback) popupFallback.style.display = 'block';
          const adLoading = popup.querySelector('#adLoading') || document.getElementById('adLoading');
          if (adLoading) adLoading.style.display = 'none';
        }, 800);
      }).catch((e) => {
        // still show UI even if script failed
        safeWarn('ensureAdsenseScript promise rejected', e);
        popup.classList.add('active');
        popup.setAttribute('aria-hidden', 'false');
        setTimeout(() => {
          showFallbackIfBlocked(popupBody);
          const adLoading = popup.querySelector('#adLoading') || document.getElementById('adLoading');
          if (adLoading) adLoading.style.display = 'none';
        }, 800);
      });

      // focus
      try { if (popupClose && typeof popupClose.focus === 'function') popupClose.focus(); } catch (e) {}

      // auto-close countdown
      const autoCloseSec = (cfg.popupAutoCloseSec || 0);
      if (autoCloseSec && autoCloseSec > 0) {
        let t = autoCloseSec;
        const countdownEl = popup.querySelector('#autoCloseCountdown') || document.getElementById('autoCloseCountdown');
        if (countdownEl) countdownEl.textContent = t;
        popupCountdownTimer = setInterval(() => {
          t--;
          if (countdownEl) countdownEl.textContent = Math.max(0, t);
          if (t <= 0) closePopup();
        }, 1000);
      }
    }

    function closePopup() {
      if (!popup) return;
      popup.classList.remove('active');
      popup.setAttribute('aria-hidden', 'true');
      if (popupCountdownTimer) { clearInterval(popupCountdownTimer); popupCountdownTimer = null; }
      shown = false;
    }

    // Schedule initial show on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', function () {
      const delay = isMobile() ? (cfg.popupDelayMsMobile || 6000) : (cfg.popupDelayMsDesktop || 4000);
      popupTimer = setTimeout(() => showPopup(false), delay);
    });

    // Close handlers
    if (popupClose) popupClose.addEventListener('click', closePopup);
    popup.addEventListener('click', function (e) { if (e.target === popup) closePopup(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && popup.classList.contains('active')) closePopup(); });

    // Show on scroll for mobile (engagement)
    let scrolled = false;
    window.addEventListener('scroll', function () {
      if (!scrolled && isMobile() && (window.scrollY > (cfg.scrollTriggerPx || 420))) {
        scrolled = true;
        showPopup(true);
      }
    }, { passive: true });

    // Debug helpers
    window.showAdPopupNow = () => showPopup(true);
    window.closeAdPopupNow = () => closePopup();
  })();

  // STICKY logic
  (function stickyIIFE() {
    if (!sticky) return;

    const stickyInner = sticky.querySelector('.sticky-inner') || sticky;
    const stickyFallback = sticky.querySelector('.ad-fallback, .ad-blocker-fallback') || null;
    let stickyTimer = null;

    async function showSticky(force = false) {
      if (!sticky || sticky.classList.contains('active')) return;
      safeLog('showSticky called', { force, isMobile: isMobile() });

      // try ensure script and push
      ensureAdsenseScript(cfg.adsenseClientId).then(() => {
        safePushAds();
        sticky.classList.add('active');
        sticky.setAttribute('aria-hidden', 'false');
        setTimeout(() => showFallbackIfBlocked(stickyInner), 900);
      }).catch((e) => {
        safeWarn('ensureAdsenseScript for sticky failed', e);
        sticky.classList.add('active');
        sticky.setAttribute('aria-hidden', 'false');
        setTimeout(() => showFallbackIfBlocked(stickyInner), 900);
      });
    }

    function hideSticky() {
      if (!sticky) return;
      sticky.classList.remove('active');
      sticky.setAttribute('aria-hidden', 'true');
    }

    document.addEventListener('DOMContentLoaded', function () {
      const delay = isMobile() ? (cfg.stickyShowDelayMsMobile || 8000) : (cfg.stickyShowDelayMsDesktop || 12000);
      stickyTimer = setTimeout(() => showSticky(false), delay);

      if (isMobile() && cfg.stickyAutoCloseMsMobile && cfg.stickyAutoCloseMsMobile > 0) {
        setTimeout(() => hideSticky(), delay + cfg.stickyAutoCloseMsMobile);
      }
    });

    if (stickyClose) stickyClose.addEventListener('click', hideSticky);
    sticky.addEventListener('click', function (e) {
      if (e.target === sticky || e.target === stickyClose) hideSticky();
    });

    window.showStickyNow = () => showSticky(true);
    window.hideStickyNow = () => hideSticky();
  })();

  // Final defensive check: reveal fallbacks for any blocked ins elements after load
  window.addEventListener('load', function () {
    setTimeout(() => {
      document.querySelectorAll('ins.adsbygoogle').forEach(ins => {
        if (!ins || ins.offsetParent === null || ins.clientHeight === 0 || ins.clientWidth === 0) {
          const fb = ins && ins.parentElement && ins.parentElement.querySelector('.ad-fallback, .ad-blocker-fallback');
          if (fb) fb.style.display = 'block';
        }
      });
    }, 1200);
  });

})();
