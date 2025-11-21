 /******************************
     * Config
     ******************************/
    const CONFIG = {
      popupDelayMsDesktop: 4000,   // show popup after this delay on desktop
      popupDelayMsMobile: 6000,    // on mobile a bit later
      popupAutoCloseSec: 15,       // auto close popup after N seconds (0 = no autoclose)
      stickyShowDelayMsDesktop: 12000, // show sticky after delay
      stickyShowDelayMsMobile: 8000,
      stickyAutoCloseMsMobile: 30000, // hide sticky automatically on mobile after this ms (0 = don't auto-close)
      scrollTriggerPx: 420,        // show popup on mobile after user scrolls this many px
      minDesktopWidth: 769
    };

    /******************************
     * Helpers
     ******************************/
    function isMobile() { return window.innerWidth < CONFIG.minDesktopWidth; }
    function safeQuery(selector, ctx=document){ return ctx.querySelector(selector); }

    /******************************
     * Popup Logic
     ******************************/
    (function(){
      const popup = document.getElementById('adPopup');
      const popupClose = document.getElementById('adPopupClose');
      const popupIns = safeQuery('ins.adsbygoogle', popup);

      let popupTimer = null;
      let popupCountdownTimer = null;

      function showPopup(force=false){
        // on mobile require force OR scroll trigger (handled elsewhere)
        if (!force && isMobile()) return;
        if (popup.classList.contains('active')) return;
        // Decide whether ins element is present and visible
        let insVisible = popupIns && popupIns.offsetParent !== null && popupIns.clientHeight > 0;
        // If ad is blocked, show fallback content
       
        popup.classList.add('active');
        popup.setAttribute('aria-hidden','false');

        // focus management
        popupClose.focus();

        // auto-close if configured
        if (CONFIG.popupAutoCloseSec && CONFIG.popupAutoCloseSec > 0) {
          let t = CONFIG.popupAutoCloseSec;
          popupCountdownTimer = setInterval(()=>{
            t--;
            if (t <= 0) {
              closePopup();
            }
          }, 1000);
        }
      }

      function closePopup(){
        popup.classList.remove('active');
        popup.setAttribute('aria-hidden','true');
        if (popupCountdownTimer) { clearInterval(popupCountdownTimer); popupCountdownTimer = null; }
      }

      // schedule initial show
      document.addEventListener('DOMContentLoaded', function(){
        const delay = isMobile() ? CONFIG.popupDelayMsMobile : CONFIG.popupDelayMsDesktop;
        popupTimer = setTimeout(()=> showPopup(false), delay);
      });

      // close handlers
      popupClose.addEventListener('click', closePopup);
      // ESC to close
      document.addEventListener('keydown', function(e){
        if (e.key === 'Escape' && popup.classList.contains('active')) closePopup();
      });

      // On mobile, show popup after user scrolls a bit (simulate engagement)
      let scrolled = false;
      window.addEventListener('scroll', function onScroll(){
        if (!scrolled && isMobile() && window.scrollY > CONFIG.scrollTriggerPx) {
          scrolled = true;
          showPopup(true);
        }
      }, { passive: true });

      // Expose debug force method
      window.showAdPopupNow = function(){ showPopup(true); };
    })();

    /******************************
     * Sticky Logic
     ******************************/
    (function(){
      const sticky = document.getElementById('stickyAd');
      const stickyClose = document.getElementById('stickyClose');
      const stickyFallback = document.getElementById('stickyFallback');
      const stickyIns = safeQuery('ins.adsbygoogle', sticky);

      let stickyTimer = null;
      function showSticky(force=false){
        if (sticky.classList.contains('active')) return;
        // If on mobile and not forced show after scroll or delay (handled by timers)
        // Check if ad slot shows — if blocked, reveal fallback
        let insVisible = stickyIns && stickyIns.offsetParent !== null && stickyIns.clientHeight > 0;
        if (!insVisible) stickyFallback.style.display = 'block'; else stickyFallback.style.display = 'none';

        // try push ads
        try { (adsbygoogle = window.adsbygoogle || []).push({}); } catch(e){ /* ignore */ }

        sticky.classList.add('active');
        sticky.setAttribute('aria-hidden','false');
      }

      function hideSticky(){
        sticky.classList.remove('active');
        sticky.setAttribute('aria-hidden','true');
      }

      // schedule show
      document.addEventListener('DOMContentLoaded', function(){
        const delay = isMobile() ? CONFIG.stickyShowDelayMsMobile : CONFIG.stickyShowDelayMsDesktop;
        stickyTimer = setTimeout(()=> showSticky(false), delay);
        // If on mobile auto-close later (if configured)
        if (isMobile() && CONFIG.stickyAutoCloseMsMobile && CONFIG.stickyAutoCloseMsMobile > 0) {
          setTimeout(()=> hideSticky(), CONFIG.stickyAutoCloseMsMobile + delay);
        }
      });

      // close btn
      stickyClose.addEventListener('click', hideSticky);

      // tap on mobile to hide
      sticky.addEventListener('click', function(e){
        // avoid closing if user clicks the ad itself (ins). Only close when clicking spacer or outside ins.
        if (e.target === sticky || e.target === stickyClose) {
          hideSticky();
        }
      });

      // Expose debug
      window.showStickyNow = function(){ showSticky(true); };
    })();

    /******************************
     * Detect when ads are blocked and ensure placeholders are visible
     ******************************/
    (function(){
      // After some time, if ins tags have no size, show fallback containers (helps when AdBlock hides them)
      window.addEventListener('load', function(){
        setTimeout(()=> {
          document.querySelectorAll('ins.adsbygoogle').forEach(ins => {
            // If the element is not in layout or has zero size, reveal sibling fallback if exists
            if (!ins || ins.offsetParent === null || ins.clientHeight === 0 || ins.clientWidth === 0) {
              const fallback = ins && ins.parentElement && ins.parentElement.querySelector('.ad-fallback');
              if (fallback) fallback.style.display = 'block';
            }
          });
        }, 1200);
      });
    })();

    /******************************
     * Optional: Respect reduced-motion preference (clean UX)
     ******************************/
    (function(){
      const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReduced) {
        document.documentElement.style.scrollBehavior = 'auto';
      }
    })();