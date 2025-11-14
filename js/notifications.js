(function () {
    // Element references
    const cacheNotice = document.getElementById('cacheNotice');
    const clearCacheBtn = document.getElementById('clearCacheBtn');
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

    // Apply padding based on sticky ad height
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
        topStickyAd.classList.remove('hidden');
        setTimeout(applyStickyPadding, 50);
        setTimeout(applyStickyPadding, 1500);
    }

    // Check URL parameters
    function checkURLParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const cacheCleared = urlParams.get('cacheCleared');
        const adShown = urlParams.get('adShown');

        if (cacheCleared === 'true' && adShown === 'true') {
            return false;
        }

        if (cacheCleared === 'true' && adShown !== 'true') {
            setTimeout(() => {
                showGoogleAds();
            }, 1000);
            return false;
        }

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
                closeGoogleAds(true);
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
            const url = new URL(window.location.href);
            url.searchParams.set('cacheCleared', 'true');
            url.searchParams.set('adShown', 'true');
            url.searchParams.delete('_');
            window.history.replaceState({}, document.title, url.toString());
        }
    }

    // Start Google Ads interval
    function startAdsInterval() {
        if (adInterval) clearInterval(adInterval);
        adInterval = setInterval(() => {
            if (googleAds && !googleAds.classList.contains('active')) {
                showGoogleAds();
            }
        }, 40000);
    }

    // Guard apply buttons from ad triggers
    function guardApplyButtons() {
        const applyButtons = document.querySelectorAll('.action-btn.apply-now, #bottomApplyBtn');
        applyButtons.forEach(btn => {
            btn.setAttribute('data-ads-ignore', 'true');
            btn.style.touchAction = 'manipulation';
            btn.addEventListener('click', (e) => { e.stopPropagation(); }, { capture: true });
        });
    }

    // Observe fixed bottom ads for safe area calculation
    function observeFixedBottomAds() {
        const updateBottomPadding = () => {
            const candidates = Array.from(document.body.querySelectorAll('div, ins'))
                .filter(el => {
                    const style = getComputedStyle(el);
                    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
                    const isFixed = style.position === 'fixed';
                    const touchesBottom = (style.bottom && style.bottom !== 'auto') || (el.getBoundingClientRect().bottom >= window.innerHeight - 2);
                    const tallEnough = el.getBoundingClientRect().height >= 40;
                    return isFixed && touchesBottom && tallEnough;
                });

            if (candidates.length) {
                const height = Math.max(...candidates.map(el => el.getBoundingClientRect().height));
                document.documentElement.style.setProperty('--bottom-ad-height', `${Math.ceil(height)}px`);
                document.body.classList.add('with-bottom-anchor-ad');
            } else {
                document.documentElement.style.removeProperty('--bottom-ad-height');
                document.body.classList.remove('with-bottom-anchor-ad');
            }
        };

        updateBottomPadding();
        window.addEventListener('resize', updateBottomPadding);

        const mo = new MutationObserver(updateBottomPadding);
        mo.observe(document.body, { childList: true, subtree: true });
    }

    // Initialize
    function initialize() {
        initStickyAd();
        const shouldShowCacheNotice = true;
        loadState();
        updateUI();

        if (shouldShowCacheNotice) {
            showCacheNotice();
        }

        setTimeout(() => {
            if (googleAds && !googleAds.classList.contains('active')) {
                showGoogleAds();
            }
        }, 60000);

        startAdsInterval();
        guardApplyButtons();
        observeFixedBottomAds();
    }

    // Event Listeners
    if (closeNoticeBtn) {
        closeNoticeBtn.addEventListener('click', () => {
            state.noticeDismissed = true;
            state.lastDismissed = Date.now();
            saveState();
            updateUI();

            clearTimeout(dismissTimer);
            dismissTimer = setTimeout(() => {
                state.noticeDismissed = false;
                saveState();
                updateUI();
            }, 60000);
        });
    }

    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', () => {
            if (state.cacheCleared) {
                showTemporaryMessage(ignoreMsg, 2000);
                return;
            }

            if (btnText) btnText.style.display = 'none';
            if (cacheLoader) cacheLoader.style.display = 'block';
            if (clearCacheBtn) clearCacheBtn.disabled = true;

            setTimeout(() => {
                if (cacheLoader) cacheLoader.style.display = 'none';
                if (successMsg) successMsg.style.display = 'inline';

                clearBrowserCache();

                state.cacheCleared = true;
                state.lastCleared = Date.now();
                saveState();

                setTimeout(() => {
                    updateUI();
                    setTimeout(() => {
                        showGoogleAds();
                    }, 500);
                }, 2000);

            }, 2000);
        });
    }

    // Close ads manually (direct button binding)
    if (adsCloseBtn) {
    adsCloseBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeGoogleAds(false);
    });
    }
    
    // Also handle clicks via delegation (robust if markup changes)
    if (googleAds) {
    googleAds.addEventListener('click', (e) => {
    // Close when the "X" is clicked
    if (e.target.closest('.ads-close')) {
    e.preventDefault();
    e.stopPropagation();
    closeGoogleAds(false);
    return;
    }
    // Optional: close when clicking backdrop (only if you want that)
    if (e.target === googleAds) {
    closeGoogleAds(false);
    }
    });
    }
    
    // Sticky ad close button
    if (stickyCloseBtn && topStickyAd) {
    stickyCloseBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    topStickyAd.classList.add('hidden'); // hide sticky ad
    removeStickyPadding();               // restore header/content position
    });
    }
    
    // Fallback: delegate close click in case button renders later
    document.addEventListener('click', (e) => {
    const btn = e.target.closest('.sticky-ad-close');
    if (btn && topStickyAd) {
    e.preventDefault();
    e.stopPropagation();
    topStickyAd.classList.add('hidden');
    removeStickyPadding();
    }
    });
    
    // Initialize early so handlers attach before interaction
    // window.addEventListener('load', initialize);
    document.addEventListener('DOMContentLoaded', initialize);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && googleAds && googleAds.classList.contains('active')) {
            closeGoogleAds(false);
        }
    });

    setInterval(() => {
        if (state.lastDismissed && (Date.now() - state.lastDismissed) >= 60000) {
            state.noticeDismissed = false;
            saveState();
            updateUI();
        }
    }, 1000);

    window.addEventListener('load', initialize);
})();