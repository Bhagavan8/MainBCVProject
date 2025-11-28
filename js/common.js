const __assetVersion = (() => {
    try {
        const meta = document.querySelector('meta[name="asset-version"]');
        if (meta && meta.content) return meta.content.trim();
        const lm = new Date(document.lastModified);
        const y = lm.getFullYear();
        const m = String(lm.getMonth() + 1).padStart(2, '0');
        const d = String(lm.getDate()).padStart(2, '0');
        return `${y}${m}${d}`;
    } catch (_) { return String(Date.now()); }
})();

function stampUrl(u) {
    try {
        const url = new URL(u, location.origin);
        if (url.origin !== location.origin) return u;
        if (url.searchParams.has('v')) return u;
        url.searchParams.set('v', __assetVersion);
        return url.pathname + '?' + url.searchParams.toString();
    } catch (_) { return u; }
}

function initToastr() {
    try {
        if (window.toastr) {
            toastr.options = {
                closeButton: true,
                debug: false,
                newestOnTop: true,
                progressBar: true,
                positionClass: "toast-top-right",
                preventDuplicates: false,
                showDuration: "300",
                hideDuration: "1000",
                timeOut: "5000",
                extendedTimeOut: "1000",
                showEasing: "swing",
                hideEasing: "linear",
                showMethod: "fadeIn",
                hideMethod: "fadeOut"
            };
        }
    } catch (_) {}
}

async function loadComponents() {
    try {
        const containers = {
            'header-container': '/components/header.html',
            'navigation-container': '/components/navigation.html',
            'top-bar-container': '/components/top-bar.html'
        };
        for (const [containerId, componentPath] of Object.entries(containers)) {
            const container = document.getElementById(containerId);
            if (container) {
                try {
                    const response = await fetch(stampUrl(componentPath));
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    const content = await response.text();
                    container.innerHTML = content;
                } catch (error) {
                    console.error(`Error loading ${componentPath}:`, error);
                    container.innerHTML = '<div class="alert alert-danger">Failed to load component</div>';
                }
            }
        }
    } catch (error) {
        console.error('Error in loadComponents:', error);
    }
}

try {
    document.querySelectorAll('link[rel="stylesheet"]').forEach(el => {
        const href = el.getAttribute('href');
        if (href && (href.startsWith('/') || href.startsWith('./'))) el.setAttribute('href', stampUrl(href));
    });
} catch (_) {}

document.addEventListener('DOMContentLoaded', async function() {
    try {
        initToastr();
        await import(stampUrl('/js/firebase-config.js'));
        await loadComponents();
    } catch (error) {
        console.error('Initialization error:', error);
        try { if (window.toastr) toastr.error('Failed to initialize application'); } catch (_) {}
    }
});

function safeGetElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Element with id '${id}' not found`);
    }
    return element;
}

export { safeGetElement };
