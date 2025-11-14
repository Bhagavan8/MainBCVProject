// button-fix-permanent.js - PERMANENT SOLUTION
class ButtonFixManager {
    constructor() {
        this.initialized = false;
        this.init();
    }

    init() {
        if (this.initialized) return;
        
        console.log('🔧 PERMANENT BUTTON FIX MANAGER LOADED');
        
        // Fix apply button immediately
        this.fixApplyButton();
        
        // Set up monitoring for dynamic changes
        this.setupMutationObserver();
        
        // Final cleanup after page load
        window.addEventListener('load', () => this.finalCleanup());
        
        this.initialized = true;
    }

    fixApplyButton() {
        const applyButton = document.getElementById('bottomApplyBtn');
        if (!applyButton) {
            console.log('⏳ Apply button not found yet, retrying...');
            setTimeout(() => this.fixApplyButton(), 500);
            return;
        }

        console.log('✅ Apply button found, applying permanent fix...');

        // Remove ALL existing event listeners by complete replacement
        const newButton = applyButton.cloneNode(true);
        applyButton.parentNode.replaceChild(newButton, applyButton);

        // Add the permanent click handler
        newButton.addEventListener('click', (e) => {
            this.handleApplyClick(e);
        }, true); // Use capture phase

        // Ensure button is always clickable
        this.applyButtonStyles(newButton);
        
        console.log('✅ Apply button permanently fixed');
    }

    handleApplyClick(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('🎯 PERMANENT BUTTON HANDLER TRIGGERED');

        // Get job data
        const jobManager = window.jobDetailsManager;
        
        if (!jobManager || !jobManager.currentJob) {
            this.showEmergencyToast('⚠️ Job data still loading...', 'warning');
            console.log('❌ Job data not ready:', jobManager);
            return;
        }

        const job = jobManager.currentJob;
        console.log('📋 Job data:', job);

        if (!job.applicationLink) {
            this.showEmergencyToast('❌ Application link not available', 'error');
            console.log('❌ No application link in job data');
            return;
        }

        // Build the URL
        let applicationUrl = job.applicationLink;
        if (!applicationUrl.startsWith('http')) {
            applicationUrl = 'https://' + applicationUrl;
        }

        console.log('🚀 Opening application URL:', applicationUrl);
        this.showEmergencyToast('🚀 Opening application form...', 'success');

        // Open the URL - MULTIPLE FALLBACK METHODS
        this.openApplicationUrl(applicationUrl);

        // Also call the original handler for tracking
        if (jobManager.handleApplyClick) {
            setTimeout(() => {
                jobManager.handleApplyClick(job);
            }, 100);
        }
    }

    openApplicationUrl(url) {
        // Method 1: Standard window.open
        const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
        
        if (!newWindow) {
            console.log('❌ Popup blocked, trying Method 2...');
            
            // Method 2: Create a temporary link and click it
            const tempLink = document.createElement('a');
            tempLink.href = url;
            tempLink.target = '_blank';
            tempLink.rel = 'noopener noreferrer';
            tempLink.style.display = 'none';
            document.body.appendChild(tempLink);
            tempLink.click();
            document.body.removeChild(tempLink);
            
            console.log('✅ Method 2 executed');
        } else {
            console.log('✅ Method 1 executed successfully');
        }
    }

    applyButtonStyles(button) {
        button.style.cssText = `
            pointer-events: auto !important;
            cursor: pointer !important;
            z-index: 10000 !important;
            position: relative !important;
        `;
    }

    showEmergencyToast(message, type = 'info') {
        // Remove existing toasts
        document.querySelectorAll('.emergency-toast').forEach(toast => toast.remove());
        
        const toast = document.createElement('div');
        toast.className = `emergency-toast ${type}`;
        toast.innerHTML = message;
        
        // Inline styles for reliability
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${this.getToastColor(type)};
            color: ${this.getToastTextColor(type)};
            padding: 12px 20px;
            border-radius: 8px;
            border: 1px solid ${this.getToastBorderColor(type)};
            z-index: 10060;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 14px;
            font-weight: 500;
        `;
        
        document.body.appendChild(toast);
        
        // Auto remove
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 3000);
    }

    getToastColor(type) {
        const colors = {
            success: '#d4edda',
            warning: '#fff3cd', 
            error: '#f8d7da',
            info: '#d1ecf1'
        };
        return colors[type] || colors.info;
    }

    getToastTextColor(type) {
        const colors = {
            success: '#155724',
            warning: '#856404',
            error: '#721c24', 
            info: '#0c5460'
        };
        return colors[type] || colors.info;
    }

    getToastBorderColor(type) {
        const colors = {
            success: '#c3e6cb',
            warning: '#ffeaa7',
            error: '#f5c6cb',
            info: '#bee5eb'
        };
        return colors[type] || colors.info;
    }

    setupMutationObserver() {
        const observer = new MutationObserver((mutations) => {
            let shouldFix = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) {
                            // Check if apply button was added/modified
                            if (node.id === 'bottomApplyBtn' || 
                                node.querySelector?.('#bottomApplyBtn') ||
                                node.classList?.contains('action-btn')) {
                                shouldFix = true;
                            }
                        }
                    });
                }
            });

            if (shouldFix) {
                console.log('🔄 DOM changed, reapplying button fix...');
                setTimeout(() => this.fixApplyButton(), 100);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['id', 'class', 'style']
        });
    }

    finalCleanup() {
        console.log('🎯 Final cleanup started...');
        
        // Disable all ad interference
        const adSelectors = [
            '.adsbygoogle', '.ad-section', '.ad-column', 
            '.ad-section-responsive', '.ad-box-job', 
            '.ad-left', '.ad-right', 'ins', 'iframe'
        ];
        
        adSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(ad => {
                ad.style.pointerEvents = 'none';
                ad.style.zIndex = '1';
            });
        });
        
        // Ensure all buttons are clickable
        const buttonSelectors = [
            '#bottomApplyBtn', '.action-btn', '.apply-now',
            '.back-btn-enhanced', '.nav-view-btn', '.social-share-btn'
        ];
        
        buttonSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(btn => {
                btn.style.pointerEvents = 'auto';
                btn.style.zIndex = '10000';
                btn.style.cursor = 'pointer';
                btn.style.position = 'relative';
            });
        });
        
        console.log('✅ Final cleanup completed');
    }
}

// Initialize the permanent fix
document.addEventListener('DOMContentLoaded', () => {
    window.buttonFixManager = new ButtonFixManager();
});

// Emergency global fallback
window.applyForJob = function() {
    const jobManager = window.jobDetailsManager;
    if (jobManager?.currentJob?.applicationLink) {
        let url = jobManager.currentJob.applicationLink;
        if (!url.startsWith('http')) url = 'https://' + url;
        window.open(url, '_blank', 'noopener,noreferrer');
        return true;
    }
    alert('Application link not available');
    return false;
};