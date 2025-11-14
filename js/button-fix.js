// button-fix.js - Ultimate fix for button click issues
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Button fix script loaded');
    
    // ULTIMATE Apply Button Fix
    function fixApplyButton() {
        const applyButton = document.getElementById('bottomApplyBtn');
        if (!applyButton) {
            console.log('❌ Apply button not found');
            return;
        }

        // Clone and replace to remove any existing event listeners
        const newApplyButton = applyButton.cloneNode(true);
        applyButton.parentNode.replaceChild(newApplyButton, applyButton);

        // Add robust click handler
        newApplyButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            console.log('✅ Apply Now button clicked successfully!');
            
            // Show loading state
            const originalHTML = this.innerHTML;
            this.innerHTML = '<i class="bi bi-hourglass"></i> Processing...';
            this.disabled = true;
            
            // Your actual application logic here
            setTimeout(() => {
                // Restore button
                this.innerHTML = originalHTML;
                this.disabled = false;
                
                // Redirect to application (replace with your actual URL)
                alert('Redirecting to application form...');
                // window.location.href = 'https://your-application-url.com';
            }, 1000);
        }, true); // Use capture phase

        // Force styles
        newApplyButton.style.cssText = `
            pointer-events: auto !important;
            z-index: 10051 !important;
            position: relative !important;
            cursor: pointer !important;
        `;
    }

    // Fix Back Button
    function fixBackButton() {
        const backButton = document.getElementById('backToJobsBtn');
        if (backButton) {
            backButton.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('🔙 Back to Jobs clicked');
                // Your navigation logic
            });
        }
    }

    // Fix Navigation Buttons
    function fixNavigationButtons() {
        const prevBtn = document.getElementById('prevJobBtn');
        const nextBtn = document.getElementById('nextJobBtn');
        
        [prevBtn, nextBtn].forEach(btn => {
            if (btn) {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('📄 Navigation button clicked');
                    // Your navigation logic
                });
            }
        });
    }

    // Fix Social Share Buttons
    function fixSocialButtons() {
        const shareButtons = document.querySelectorAll('.social-share-btn');
        shareButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const platform = this.dataset.platform;
                console.log(`📱 Share button clicked: ${platform}`);
                // Your share logic
            });
        });
    }

    // NUCLEAR OPTION: Disable ALL ad interference
    function nuclearAdDisable() {
        console.log('🚀 Applying nuclear ad disable...');
        
        // Disable pointer events for ALL ad elements
        const adSelectors = [
            '.adsbygoogle', '.ad-section', '.ad-column', 
            '.ad-section-responsive', '.ad-box-job', 
            '.ad-left', '.ad-right', 'ins', 'iframe'
        ];
        
        adSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                el.style.pointerEvents = 'none';
                el.style.zIndex = '1';
            });
        });
        
        // Enable ALL buttons
        const buttonSelectors = [
            '#bottomApplyBtn', '.back-btn-enhanced', 
            '.nav-view-btn', '.social-share-btn',
            '.action-btn', '.apply-now', '.community-btn',
            'button', 'a', '[onclick]'
        ];
        
        buttonSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                el.style.pointerEvents = 'auto';
                el.style.zIndex = '10051';
                el.style.position = 'relative';
            });
        });
    }

    // Initialize all fixes
    function initializeFixes() {
        console.log('🔄 Initializing button fixes...');
        
        fixApplyButton();
        fixBackButton();
        fixNavigationButtons();
        fixSocialButtons();
        nuclearAdDisable();
        
        console.log('✅ All button fixes applied');
    }

    // Run immediately
    initializeFixes();
    
    // Run again after short delay (for dynamic content)
    setTimeout(initializeFixes, 500);
    setTimeout(initializeFixes, 2000);
    
    // Continuous monitoring for dynamically loaded ads
    const observer = new MutationObserver(function(mutations) {
        let shouldFix = false;
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1) {
                        if (node.classList && 
                            (node.classList.contains('adsbygoogle') || 
                             node.querySelector && node.querySelector('.adsbygoogle') ||
                             node.tagName === 'INS' || 
                             node.tagName === 'IFRAME')) {
                            shouldFix = true;
                        }
                    }
                });
            }
        });
        
        if (shouldFix) {
            setTimeout(() => {
                nuclearAdDisable();
                fixApplyButton();
            }, 100);
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style']
    });
});

// Final protection after page load
window.addEventListener('load', function() {
    console.log('🎯 Page loaded - applying final button protection');
    
    // One final nuclear option
    setTimeout(() => {
        const allAds = document.querySelectorAll('.adsbygoogle, ins, iframe, .ad-section');
        allAds.forEach(ad => {
            ad.style.pointerEvents = 'none';
            ad.style.zIndex = '1';
        });
        
        const allButtons = document.querySelectorAll('button, a, .action-btn');
        allButtons.forEach(btn => {
            btn.style.pointerEvents = 'auto';
            btn.style.zIndex = '10051';
        });
    }, 3000);
});