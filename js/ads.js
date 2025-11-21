/******************************
 * Robust Popup + Sticky (drop-in)
 ******************************/
(function(){
  const popup = document.getElementById('adPopup');
  const popupClose = document.getElementById('adPopupClose');
  const sticky = document.getElementById('stickyAd');
  const stickyClose = document.getElementById('stickyClose');

  if (!popup) { console.warn('adPopup not found'); }
  if (!sticky) { console.warn('stickyAd not found'); }

  // helpers
  const isMobile = () => window.innerWidth < (typeof CONFIG !== 'undefined' ? CONFIG.minDesktopWidth : 769);
  const showFallbackIfBlocked = (container) => {
    try {
      const ins = container.querySelector && container.querySelector('ins.adsbygoogle');
      const fallback = container.querySelector && (container.querySelector('.ad-fallback') || container.querySelector('.ad-blocker-fallback'));
      const visible = ins && ins.offsetParent !== null && ins.clientHeight > 0 && ins.clientWidth > 0;
      if (!visible && fallback) fallback.style.display = 'block';
      if (visible && fallback) fallback.style.display = 'none';
      return visible;
    } catch (e) {
      console.warn('showFallbackIfBlocked error', e);
      return false;
    }
  };
  const safePushAds = () => {
    try { (adsbygoogle = window.adsbygoogle || []).push({}); console.log('adsbygoogle push attempted'); } 
    catch(e){ console.warn('adsbygoogle push failed', e); }
  };

  /*** POPUP ***/
  (function(){
    if (!popup) return;
    const popupBody = popup.querySelector('.ads-popup-body') || popup;
    const popupFallback = popup.querySelector('.ad-fallback, .ad-blocker-fallback');
    let popupTimer = null, popupCountdownTimer = null;
    let shown = false;

    function showPopup(force=false){
      // Removed strict mobile early-return — allow scheduled/mobile triggers to show popup.
      if (shown) return;
      shown = true;
      console.log('showPopup called', { force, isMobile: isMobile() });

      // Show UI
      popup.classList.add('active');
      popup.setAttribute('aria-hidden','false');

      // Try loading ad slot
      safePushAds();

      // After short delay show fallback if necessary
      setTimeout(()=> {
        const visible = showFallbackIfBlocked(popupBody);
        if (!visible && popupFallback) popupFallback.style.display = 'block';
        // hide ad-loading spinner if present
        const adLoading = popup.querySelector('#adLoading') || document.getElementById('adLoading');
        if (adLoading) adLoading.style.display = 'none';
      }, 800);

      // Focus management (only if exists)
      try { if (popupClose && typeof popupClose.focus === 'function') popupClose.focus(); } catch(e){}

      // Auto-close countdown
      const autoCloseSec = (typeof CONFIG !== 'undefined' ? CONFIG.popupAutoCloseSec : 15);
      if (autoCloseSec && autoCloseSec > 0) {
        let t = autoCloseSec;
        // update countdown display if present
        const countdownEl = popup.querySelector('#autoCloseCountdown') || document.getElementById('autoCloseCountdown');
        if (countdownEl) countdownEl.textContent = t;
        popupCountdownTimer = setInterval(()=> {
          t--;
          if (countdownEl) countdownEl.textContent = Math.max(0,t);
          if (t <= 0) closePopup();
        }, 1000);
      }
    }

    function closePopup(){
      if (!popup) return;
      popup.classList.remove('active');
      popup.setAttribute('aria-hidden','true');
      if (popupCountdownTimer) { clearInterval(popupCountdownTimer); popupCountdownTimer = null; }
      shown = false;
    }

    // Schedule initial show (desktop + mobile)
    document.addEventListener('DOMContentLoaded', function(){
      const delay = isMobile() ? (CONFIG ? CONFIG.popupDelayMsMobile : 6000) : (CONFIG ? CONFIG.popupDelayMsDesktop : 4000);
      popupTimer = setTimeout(()=> showPopup(false), delay);
    });

    // Close handlers
    if (popupClose) popupClose.addEventListener('click', closePopup);
    popup.addEventListener('click', function(e){ if (e.target === popup) closePopup(); });
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && popup.classList.contains('active')) closePopup(); });

    // On mobile: also show after user scrolls some px (engagement)
    let scrolled = false;
    window.addEventListener('scroll', function(){
      if (!scrolled && isMobile() && (CONFIG ? window.scrollY > CONFIG.scrollTriggerPx : window.scrollY > 420)) {
        scrolled = true;
        showPopup(true);
      }
    }, { passive: true });

    // debug helper
    window.showAdPopupNow = () => showPopup(true);
    window.closeAdPopupNow = () => closePopup();
  })();

  /*** STICKY ***/
  (function(){
    if (!sticky) return;
    const stickyInner = sticky.querySelector('.sticky-inner') || sticky;
    const stickyFallback = sticky.querySelector('.ad-fallback, .ad-blocker-fallback');
    let stickyTimer = null;

    function showSticky(force=false){
      if (sticky.classList.contains('active')) return;
      console.log('showSticky', { force, isMobile: isMobile() });
      // attempt ad push
      safePushAds();
      // show
      sticky.classList.add('active');
      sticky.setAttribute('aria-hidden','false');
      // show fallback if ad blocked
      setTimeout(()=> showFallbackIfBlocked(stickyInner), 900);
    }
    function hideSticky(){ sticky.classList.remove('active'); sticky.setAttribute('aria-hidden','true'); }

    document.addEventListener('DOMContentLoaded', function(){
      const delay = isMobile() ? (CONFIG ? CONFIG.stickyShowDelayMsMobile : 8000) : (CONFIG ? CONFIG.stickyShowDelayMsDesktop : 12000);
      stickyTimer = setTimeout(()=> showSticky(false), delay);
      // auto-close on mobile
      if (isMobile() && CONFIG && CONFIG.stickyAutoCloseMsMobile && CONFIG.stickyAutoCloseMsMobile > 0) {
        setTimeout(()=> hideSticky(), delay + CONFIG.stickyAutoCloseMsMobile);
      }
    });

    if (stickyClose) stickyClose.addEventListener('click', hideSticky);
    sticky.addEventListener('click', function(e){
      // close when clicking outside actual ins element
      if (e.target === sticky || e.target === stickyClose) hideSticky();
    });

    window.showStickyNow = () => showSticky(true);
    window.hideStickyNow = () => hideSticky();
  })();

  // Final defensive check: after load, ensure fallback shown for any blocked ins elements
  window.addEventListener('load', function(){
    setTimeout(()=> {
      document.querySelectorAll('ins.adsbygoogle').forEach(ins => {
        if (!ins || ins.offsetParent === null || ins.clientHeight === 0 || ins.clientWidth === 0) {
          const fb = ins && ins.parentElement && ins.parentElement.querySelector('.ad-fallback, .ad-blocker-fallback');
          if (fb) fb.style.display = 'block';
        }
      });
    }, 1200);
  });

})();
