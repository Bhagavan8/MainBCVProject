  const cacheNotice = document.getElementById('cacheNotice');
        const clearCacheBtn = document.getElementById('clearCache');
        const closeNoticeBtn = document.getElementById('closeNotice');
        const googleAds = document.getElementById('googleAds');
        const adsCloseBtn = document.querySelector('.ads-close');
        const cacheLoader = document.getElementById('cacheLoader');
        const btnText = document.getElementById('btnText');
        const successMsg = document.getElementById('successMsg');
        const ignoreMsg = document.getElementById('ignoreMsg');
        const noticeText = document.getElementById('noticeText');
        const adsTime = document.getElementById('adsTime');

        // State Management
        let adsTimerInterval;
        let adsSecondsLeft = 60;
        let adInterval;
        let dismissTimer;
        
        // Check URL parameters to see if we should show popups
        function checkURLParams() {
            const urlParams = new URLSearchParams(window.location.search);
            const cacheCleared = urlParams.get('cacheCleared');
            const adShown = urlParams.get('adShown');
            
            console.log('URL Params:', { cacheCleared, adShown });
            
            // If both cacheCleared and adShown are true, don't show any popups
            if (cacheCleared === 'true' && adShown === 'true') {
                console.log('Both actions completed - hiding all popups');
                return false;
            }
            
            // If only cacheCleared is true, show ad popup
            if (cacheCleared === 'true' && adShown !== 'true') {
                console.log('Cache cleared but ad not shown - showing ad popup');
                setTimeout(() => {
                    showGoogleAds();
                }, 1000);
                return false;
            }
            
            // Otherwise show cache notice
            console.log('First visit - showing cache notice');
            return true;
        }

        // Initialize
        function initialize() {
            const shouldShowCacheNotice = checkURLParams();
            
            if (shouldShowCacheNotice) {
                loadState();
                updateUI();
                showCacheNotice();
            }
            
            startAdsInterval();
        }

        // Load state from localStorage
        function loadState() {
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
        }

        // Real-time state tracking
        const state = {
            cacheCleared: false,
            noticeDismissed: false,
            lastCleared: null,
            lastDismissed: null
        };

        // Save state to localStorage
        function saveState() {
            localStorage.setItem('cacheNoticeState', JSON.stringify(state));
        }

        // Show cache notice
        function showCacheNotice() {
            cacheNotice.classList.remove('hidden');
        }

        // Update UI based on current state
        function updateUI() {
            if (state.noticeDismissed) {
                cacheNotice.classList.add('hidden');
            } else {
                cacheNotice.classList.remove('hidden');
            }

            if (state.cacheCleared) {
                cacheNotice.classList.add('cleared');
                clearCacheBtn.disabled = true;
                btnText.style.display = 'none';
                successMsg.style.display = 'none';
                cacheLoader.style.display = 'none';
                ignoreMsg.style.display = 'inline';
                noticeText.innerHTML = '<strong>✓ Cache Status:</strong> Already cleared - You\'re good to go!';
            } else {
                cacheNotice.classList.remove('cleared');
                clearCacheBtn.disabled = false;
                btnText.style.display = 'inline';
                ignoreMsg.style.display = 'none';
                successMsg.style.display = 'none';
                cacheLoader.style.display = 'none';
                noticeText.innerHTML = '<strong>Clear Browser Cache:</strong> For optimal performance';
            }
        }

        // Clear cache functionality
        clearCacheBtn.addEventListener('click', () => {
            if (state.cacheCleared) {
                showTemporaryMessage(ignoreMsg, 2000);
                return;
            }

            // Show loading state
            btnText.style.display = 'none';
            cacheLoader.style.display = 'block';
            clearCacheBtn.disabled = true;

            // Simulate cache clearing process (2 seconds)
            setTimeout(() => {
                // Hide loader and show success
                cacheLoader.style.display = 'none';
                successMsg.style.display = 'inline';
                
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

        // Show temporary message
        function showTemporaryMessage(element, duration) {
            element.style.display = 'inline';
            setTimeout(() => {
                if (!state.cacheCleared) {
                    element.style.display = 'none';
                }
            }, duration);
        }

        // Close notice functionality
        closeNoticeBtn.addEventListener('click', () => {
            // Update state
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

        // Start Google Ads interval (every 40 seconds)
        function startAdsInterval() {
            adInterval = setInterval(() => {
                // Don't show ads if URL indicates both actions are complete
                const urlParams = new URLSearchParams(window.location.search);
                const cacheCleared = urlParams.get('cacheCleared');
                const adShown = urlParams.get('adShown');
                
                if (cacheCleared === 'true' && adShown === 'true') {
                    return; // Don't show ads
                }
                
                if (!googleAds.classList.contains('active')) {
                    showGoogleAds();
                }
            }, 40000);
        }

        // Show Google Ads
        function showGoogleAds() {
            googleAds.classList.add('active');
            startAdsTimer();
        }

        // Start ads timer
        function startAdsTimer() {
            adsSecondsLeft = 60;
            adsTime.textContent = adsSecondsLeft;
            
            adsTimerInterval = setInterval(() => {
                adsSecondsLeft--;
                adsTime.textContent = adsSecondsLeft;
                
                if (adsSecondsLeft <= 0) {
                    closeGoogleAds(true); // Auto-close
                }
            }, 1000);
        }

        // Close Google Ads
        function closeGoogleAds(isAutoClose = false) {
            googleAds.classList.remove('active');
            if (adsTimerInterval) {
                clearInterval(adsTimerInterval);
            }
            
            if (isAutoClose) {
                // When ad auto-closes, set both parameters to prevent future popups
                const url = new URL(window.location.href);
                url.searchParams.set('cacheCleared', 'true');
                url.searchParams.set('adShown', 'true');
                // Remove cache busting parameter
                url.searchParams.delete('_');
                window.history.replaceState({}, document.title, url.toString());
            }
        }

        // Clear browser cache without page refresh
        function clearBrowserCache() {
            // Clear localStorage and sessionStorage
            localStorage.clear();
            sessionStorage.clear();
            
            // Clear cookies
            document.cookie.split(";").forEach(function(c) {
                document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
            });
            
            // Clear service worker cache if available
            if ('caches' in window) {
                caches.keys().then(function(names) {
                    for (let name of names) {
                        caches.delete(name);
                    }
                });
            }
            
            console.log('Browser cache cleared successfully');
        }

        // Close ads manually
        adsCloseBtn.addEventListener('click', () => {
            closeGoogleAds(false); // Manual close
        });

        // Close ads when clicking outside
        googleAds.addEventListener('click', (e) => {
            if (e.target === googleAds) {
                closeGoogleAds(false); // Manual close
            }
        });

        // Keyboard support
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && googleAds.classList.contains('active')) {
                closeGoogleAds(false); // Manual close
            }
        });

        // Initialize when page loads
        window.addEventListener('load', initialize);

        // Periodically check dismissal timeout
        setInterval(() => {
            if (state.lastDismissed && (Date.now() - state.lastDismissed) >= 60000) {
                state.noticeDismissed = false;
                saveState();
                updateUI();
            }
        }, 1000);