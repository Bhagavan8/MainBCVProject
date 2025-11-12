// /js/cache-ads.js
(function () {
  // Element references with guards
  const cacheNotice = document.getElementById('cacheNotice');
  const clearCacheBtn = "";
  const closeNoticeBtn = document.getElementById('closeNotice');
  const googleAds = document.getElementById('googleAds');
  const adsCloseBtn = document.querySelector('.ads-close');
  const cacheLoader = document.getElementById('cacheLoader');
  const btnText = document.getElementById('btnText');
  const successMsg = document.getElementById('successMsg');
  const ignoreMsg = document.getElementById('ignoreMsg');
  const noticeText = document.getElementById('noticeText');
  const adsTime = document.getElementById('adsTime');

  // Sticky top ad elements
  const topStickyAd = document.getElementById('topStickyAd');
  const stickyCloseBtn = document.querySelector('.sticky-ad-close');

  // State & timers
  let adsTimerInterval = null;
  let adsSecondsLeft = 60;
  let adInterval = null;
  let dismissTimer = null;

  // Real-time state tracking
  const state = {
    cacheCleared: false,
    noticeDismissed: false,
    lastCleared: null,
    lastDismissed: null
  };

  // Apply padding based on sticky ad height so header/content remain visible
  function applyStickyPadding() {
    if (!topStickyAd) return;
    const height = Math.max(topStickyAd.getBoundingClientRect().height, 72);
    document.documentElement.classList.add('has-sticky-ad');
    document.body.classList.add('has-sticky-ad');
    document.documentElement.style.setProperty('--sticky-ad-height', `${height}px`);
    document.body.style.setProperty('--sticky-ad-height', `${height}px`);
  }

  function removeStickyPadding() {
    document.documentElement.classList.remove('has-sticky-ad');
    document.body.classList.remove('has-sticky-ad');
    document.documentElement.style.removeProperty('--sticky-ad-height');
    document.body.style.removeProperty('--sticky-ad-height');
  }

  function initStickyAd() {
    if (!topStickyAd) return;
    topStickyAd.classList.remove('hidden'); // show sticky ad above header
    setTimeout(applyStickyPadding, 50);
    // Re-measure after AdSense iframe loads
    setTimeout(applyStickyPadding, 1500);
  }

  // Check URL parameters to see if we should show popups
  function checkURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const cacheCleared = urlParams.get('cacheCleared');
    const adShown = urlParams.get('adShown');

    // If both cacheCleared and adShown are true, don't show any popups
    if (cacheCleared === 'true' && adShown === 'true') {
      return false;
    }

    // If only cacheCleared is true, show ad popup
    if (cacheCleared === 'true' && adShown !== 'true') {
      setTimeout(() => {
        showGoogleAds();
      }, 1000);
      return false;
    }

    // Otherwise show cache notice
    return true;
  }

  // Load state from localStorage
  function loadState() {
    try {
      const savedState = localStorage.getItem('cacheNoticeState');
      if (savedState) {
        const parsed = JSON.parse(savedState);
        state.cacheCleared = parsed.cacheCleared || false;
        state.noticeDismissed = parsed.noticeDismissed || false;
        state.lastCleared = parsed.lastCleared || null;
        state.lastDismissed = parsed.lastDismissed || null;

        // Check if dismissal period has expired (1 minute)
        if (state.lastDismissed && (Date.now() - state.lastDismissed) < 60000) {
          state.noticeDismissed = true;
        } else {
          state.noticeDismissed = false;
        }
      }
    } catch (e) {
      console.warn('Failed to load cacheNoticeState from localStorage', e);
    }
  }

  // Save state to localStorage
  function saveState() {
    try {
      localStorage.setItem('cacheNoticeState', JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save cacheNoticeState to localStorage', e);
    }
  }

  // UI helpers
  function showCacheNotice() {
    if (!cacheNotice) return;
    cacheNotice.classList.remove('hidden');
  }

  function updateUI() {
    if (!cacheNotice) return;

    if (state.noticeDismissed) {
      cacheNotice.classList.add('hidden');
    } else {
      cacheNotice.classList.remove('hidden');
    }

    if (state.cacheCleared) {
      cacheNotice.classList.add('cleared');
      if (clearCacheBtn) clearCacheBtn.disabled = true;
      if (btnText) btnText.style.display = 'none';
      if (successMsg) successMsg.style.display = 'none';
      if (cacheLoader) cacheLoader.style.display = 'none';
      if (noticeText) noticeText.innerHTML = '<strong>✓ Cache Status:</strong> Already cleared - Your good to go!';
    } else {
      cacheNotice.classList.remove('cleared');
      if (clearCacheBtn) clearCacheBtn.disabled = false;
      if (btnText) btnText.style.display = 'inline';
      if (successMsg) successMsg.style.display = 'none';
      if (cacheLoader) cacheLoader.style.display = 'none';
      if (noticeText) noticeText.innerHTML = ' <strong>Clear Browser Cache:</strong> Clear your browser cache for the best and most up-to-date viewing experience';
    }
  }

  // Show temporary message
  function showTemporaryMessage(element, duration) {
    if (!element) return;
    element.style.display = 'inline';
    setTimeout(() => {
      if (!state.cacheCleared) {
        element.style.display = 'none';
      }
    }, duration);
  }

  // Clear browser cache without page refresh
  function clearBrowserCache() {
    try {
      localStorage.clear();
      sessionStorage.clear();

      // Clear cookies
      document.cookie.split(";").forEach(function (c) {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });

      // Clear service worker caches if available
      if ('caches' in window) {
        caches.keys().then(function (names) {
          for (let name of names) {
            caches.delete(name);
          }
        }).catch(() => { /* ignore */ });
      }

      console.log('Browser cache cleared successfully');
    } catch (e) {
      console.warn('Error clearing cache', e);
    }
  }

  // Show Google Ads popup
  function showGoogleAds() {
    if (!googleAds) return;
    googleAds.classList.add('active');
    startAdsTimer();
  }

  // Start ads timer
  function startAdsTimer() {
    if (!adsTime) return;
    adsSecondsLeft = 60;
    adsTime.textContent = adsSecondsLeft;

    if (adsTimerInterval) clearInterval(adsTimerInterval);
    adsTimerInterval = setInterval(() => {
      adsSecondsLeft--;
      if (adsTime) adsTime.textContent = adsSecondsLeft;

      if (adsSecondsLeft <= 0) {
        closeGoogleAds(true); // Auto-close
      }
    }, 1000);
  }

  // Close Google Ads
  function closeGoogleAds(isAutoClose = false) {
    if (!googleAds) return;
    googleAds.classList.remove('active');
    if (adsTimerInterval) {
      clearInterval(adsTimerInterval);
      adsTimerInterval = null;
    }

    if (isAutoClose) {
      // When ad auto-closes, set both parameters to prevent future popups
      const url = new URL(window.location.href);
      url.searchParams.set('cacheCleared', 'true');
      url.searchParams.set('adShown', 'true');
      url.searchParams.delete('_'); // remove cache-busting param if any
      window.history.replaceState({}, document.title, url.toString());
    }
  }

  // Start Google Ads interval (every 40 seconds) - always re-show when not active
  function startAdsInterval() {
    if (adInterval) clearInterval(adInterval);
    adInterval = setInterval(() => {
      if (googleAds && !googleAds.classList.contains('active')) {
        showGoogleAds();
      }
    }, 40000);
  }

  // Initialize
  function initialize() {
    // Show sticky top ad above header
    initStickyAd();

    const shouldShowCacheNotice = true; // always allow notice; avoid URL gating
    loadState();
    updateUI();

    if (shouldShowCacheNotice) {
      showCacheNotice();
    }

    // Ensure popup renders at least once after 60s
    setTimeout(() => {
      if (googleAds && !googleAds.classList.contains('active')) {
        showGoogleAds();
      }
    }, 60000);

    startAdsInterval();
  }

  // Close notice functionality (Dismiss)
  if (closeNoticeBtn) {
    closeNoticeBtn.addEventListener('click', () => {
      state.noticeDismissed = true;
      state.lastDismissed = Date.now();
      saveState();
      updateUI();

      // Auto-show after 1 minute
      clearTimeout(dismissTimer);
      dismissTimer = setTimeout(() => {
        state.noticeDismissed = false;
        saveState();
        updateUI();
      }, 60000);
    });
  }

  // Clear cache button handler
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener('click', () => {
      if (state.cacheCleared) {
        showTemporaryMessage(ignoreMsg, 2000);
        return;
      }

      // Show loading state
      if (btnText) btnText.style.display = 'none';
      if (cacheLoader) cacheLoader.style.display = 'block';
      clearCacheBtn.disabled = true;

      // Simulate cache clearing process (2 seconds)
      setTimeout(() => {
        if (cacheLoader) cacheLoader.style.display = 'none';
        if (successMsg) successMsg.style.display = 'inline';

        // Actually clear cache without page refresh
        clearBrowserCache();

        // Update state
        state.cacheCleared = true;
        state.lastCleared = Date.now();
        saveState();

        // After showing success for 2 seconds, update to permanent cleared state
        setTimeout(() => {
          updateUI();
          // Show Google Ads after cache clear
          setTimeout(() => {
            showGoogleAds();
          }, 500);
        }, 2000);

      }, 2000);
    });
  }

  // Close ads manually
  if (adsCloseBtn) {
    adsCloseBtn.addEventListener('click', () => {
      closeGoogleAds(false); // Manual close
    });
  }

  // Sticky ad close button
  if (stickyCloseBtn && topStickyAd) {
    stickyCloseBtn.addEventListener('click', () => {
      topStickyAd.classList.add('hidden'); // hide sticky ad
      removeStickyPadding();               // restore header/content position
    });
  }

  // Close ads when clicking outside (backdrop)
  if (googleAds) {
    googleAds.addEventListener('click', (e) => {
      if (e.target === googleAds) {
        closeGoogleAds(false); // Manual close
      }
    });
  }

  // Keyboard support: Escape closes popup
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && googleAds && googleAds.classList.contains('active')) {
      closeGoogleAds(false); // Manual close
    }
  });

  // Periodically check dismissal timeout to re-show notice after 60s
  setInterval(() => {
    if (state.lastDismissed && (Date.now() - state.lastDismissed) >= 60000) {
      state.noticeDismissed = false;
      saveState();
      updateUI();
    }
  }, 1000);

  // Initialize on load
  window.addEventListener('load', initialize);
})();
