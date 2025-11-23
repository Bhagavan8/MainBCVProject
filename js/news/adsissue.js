/* js/adsissue.js
   Single authoritative AdSense helper:
   - pushes each <ins class="adsbygoogle"> only once
   - lazy-initializes in-content ads with IntersectionObserver
   - hides tiny/empty slots to avoid blank space
   - exposes debug helpers
*/

(function () {
  const UNFILLED_TIMEOUT = 3500; // ms to wait before deciding it's unfilled/tiny
  const MIN_FRAME_HEIGHT = 50;   // px -> anything smaller is considered empty

  // Wait until window.adsbygoogle array exists (script loaded)
  function waitForAdsByGoogle(timeout = 5000) {
    return new Promise((resolve) => {
      if (window.adsbygoogle && Array.isArray(window.adsbygoogle)) return resolve(true);
      const start = Date.now();
      const id = setInterval(() => {
        if (window.adsbygoogle && Array.isArray(window.adsbygoogle)) {
          clearInterval(id);
          return resolve(true);
        }
        if (Date.now() - start > timeout) {
          clearInterval(id);
          return resolve(false);
        }
      }, 250);
    });
  }

  // Push the adsbygoogle slot safely (only once per ins)
  function pushInsSafe(ins) {
    if (!ins || ins._pushed) return;
    try {
      if (window.adsbygoogle && Array.isArray(window.adsbygoogle)) {
        window.adsbygoogle.push({});
        ins._pushed = true;
        // mark timestamp for debugging
        ins._pushedAt = Date.now();
      } else {
        // schedule a retry
        setTimeout(() => {
          try {
            if (!ins._pushed && window.adsbygoogle && Array.isArray(window.adsbygoogle)) {
              window.adsbygoogle.push({});
              ins._pushed = true;
              ins._pushedAt = Date.now();
            }
          } catch (e) { console.warn('ads push retry failed', e); }
        }, 1200);
      }
    } catch (e) {
      console.warn('pushInsSafe error', e);
    }
  }

  // Initialize all current ins.adsbygoogle nodes (but do not double-push)
  async function initializeAdsOnce() {
    const ready = await waitForAdsByGoogle(5000);
    document.querySelectorAll('ins.adsbygoogle').forEach((ins) => {
      // if ad already has iframe present, consider it handled (avoid re-push)
      const iframeNow = ins.querySelector('iframe') || (ins.parentElement && ins.parentElement.querySelector('iframe'));
      if (iframeNow) {
        ins._pushed = true;
        return;
      }
      if (ready) pushInsSafe(ins);
      else {
        // try after small delay
        setTimeout(() => pushInsSafe(ins), 1500);
      }
    });
  }

  // Hide tiny iframes and tiny containers to avoid blank holes
  function hideTinyOrUnfilledSlots() {
    document.querySelectorAll('ins.adsbygoogle').forEach((ins) => {
      try {
        const status = ins.getAttribute('data-ad-status');
        const container = ins.closest('.ad-banner-horizontal, .ad-space, .ad-section-responsive, .ad-container') || ins.parentElement;

        // If publisher library sets explicit 'unfilled', hide
        if (status === 'unfilled') {
          ins.style.display = 'none';
          if (container) container.style.minHeight = '0';
          return;
        }

        // Check iframe height
        const iframe = ins.querySelector('iframe') || (container && container.querySelector('iframe'));
        const height = iframe ? (iframe.offsetHeight || iframe.clientHeight || 0) : 0;

        if (height < MIN_FRAME_HEIGHT) {
          ins.style.display = 'none';
          if (container) container.style.minHeight = '0';
        } else {
          ins.style.display = 'block';
        }
      } catch (e) {
        // non-fatal
        console.warn('hideTinyOrUnfilledSlots error', e);
      }
    });
  }

  // Setup lazy-init using IntersectionObserver for banners that are dynamically inserted
  function setupLazyForBanners() {
    if (!('IntersectionObserver' in window)) return;
    const observerOptions = { threshold: 0.25 };

    document.querySelectorAll('.ad-banner-horizontal, .ad-section-responsive, .ad-space').forEach((banner) => {
      const ins = banner.querySelector('ins.adsbygoogle');
      if (!ins || ins._observerAttached || ins._pushed) return;

      const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            pushInsSafe(ins);
            // once pushed, wait a bit and then check iframe size
            setTimeout(() => {
              const iframe = ins.querySelector('iframe') || banner.querySelector('iframe');
              const h = iframe ? (iframe.offsetHeight || iframe.clientHeight || 0) : 0;
              if (h < MIN_FRAME_HEIGHT) {
                ins.style.display = 'none';
                banner.style.minHeight = '0';
              } else {
                ins.style.display = 'block';
              }
            }, UNFILLED_TIMEOUT);
            obs.unobserve(entry.target);
          }
        });
      }, observerOptions);

      observer.observe(banner);
      ins._observerAttached = true;
    });
  }

  // Monitor/cleanup function to detect unfilled/tiny slots after ad creatives had time to arrive
  function monitorAndHandleAdsImproved() {
    setTimeout(() => {
      hideTinyOrUnfilledSlots();
    }, UNFILLED_TIMEOUT);
  }

  // One-combined helper to call from page after dynamic insertion
  async function safeInitAndMonitor() {
    await initializeAdsOnce();
    setupLazyForBanners();
    monitorAndHandleAdsImproved();
  }

  // Debug helper
  function debugAdSlots() {
    document.querySelectorAll('ins.adsbygoogle').forEach((ins, i) => {
      const iframe = ins.querySelector('iframe') || (ins.parentElement && ins.parentElement.querySelector('iframe'));
      console.log({
        index: i,
        slot: ins.getAttribute('data-ad-slot'),
        status: ins.getAttribute('data-ad-status'),
        pushed: !!ins._pushed,
        pushedAt: ins._pushedAt,
        hasIframe: !!iframe,
        iframeRect: iframe ? iframe.getBoundingClientRect() : null
      });
    });
  }

  // Expose API
  window.adsHelper = {
    safeInitAndMonitor,
    initializeAdsOnce,
    setupLazyForBanners,
    monitorAndHandleAdsImproved,
    debugAdSlots
  };

  // Auto-run once DOM is ready (non-blocking)
  document.addEventListener('DOMContentLoaded', () => {
    // small delay so any dynamic markup added on DOMContentLoaded can run
    setTimeout(() => {
      safeInitAndMonitor();
    }, 600);
  });

  // Observe DOM for new ad banners inserted dynamically (so we can attach lazy init)
  const mo = new MutationObserver((mutations) => {
    let found = false;
    for (const m of mutations) {
      if (m.addedNodes && m.addedNodes.length) {
        m.addedNodes.forEach(node => {
          if (node.nodeType === 1 && (node.matches && (node.matches('.ad-banner-horizontal') || node.matches('.ad-section-responsive') || node.matches('.ad-space')))) {
            found = true;
          } else if (node.querySelectorAll && node.querySelectorAll('ins.adsbygoogle').length) {
            found = true;
          }
        });
      }
    }
    if (found) {
      // re-run lazy setup & monitor for newly added slots
      setTimeout(() => {
        setupLazyForBanners();
        monitorAndHandleAdsImproved();
      }, 300);
    }
  });

  mo.observe(document.documentElement || document.body, { childList: true, subtree: true });
})();
