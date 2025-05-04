// Load non-critical components dynamically
async function loadNonCriticalResources() {
    try {
        // Load Bootstrap
        const bootstrap = await import('https://cdn.jsdelivr.net/npm/@popperjs/core@2.11.8/dist/esm/popper.min.js')
            .then(() => import('https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js'));

        // Load Toastify via script tag
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/toastify-js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
        
        // Properly assign to window object
        window.Toast = bootstrap.Toast;
        // Toastify is already available on window object after script load
    } catch (error) {
        console.error('Error loading resources:', error);
    }
}

// Initialize after DOM content loads
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load non-critical resources
        if ('requestIdleCallback' in window) {
            requestIdleCallback(loadNonCriticalResources);
        } else {
            setTimeout(loadNonCriticalResources, 2000);
        }
        
        // Import and initialize job details manager
        const { default: JobDetailsManager } = await import('./job-details.js');
        const jobManager = new JobDetailsManager();
    } catch (error) {
        console.error('Error initializing application:', error);
    }
});