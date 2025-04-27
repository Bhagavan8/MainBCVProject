import initializeFirebase from './firebase-init.js';
window.addEventListener('load', function () {
    const fontAwesomeLinks = [
        'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/fontawesome.min.css',
        'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/solid.min.css'
    ];

    fontAwesomeLinks.forEach(href => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
    });
});
document.addEventListener('DOMContentLoaded', function() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
    document.head.appendChild(link);
  });
  document.addEventListener('DOMContentLoaded', () => {
    // Defer modal initialization
    const modalTemplate = document.getElementById('subscribeModalTemplate');
    if (modalTemplate && !document.getElementById('subscribeModal')) {
        document.body.appendChild(modalTemplate.content.cloneNode(true));
    }
    
    // Use Intersection Observer for lazy loading
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.contentVisibility = 'visible';
                observer.unobserve(entry.target);
            }
        });
    });
    
    // Observe sections for lazy loading
    document.querySelectorAll('[style*="content-visibility"]').forEach(el => observer.observe(el));
});

// Debounce event handlers
function debounce(fn, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

// Optimize event listeners
const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
    themeToggle.addEventListener('click', debounce(() => {
        const currentTheme = document.documentElement.dataset.theme;
        criticalFns.toggleTheme(currentTheme === 'dark' ? 'light' : 'dark');
    }, 150));
}

try {
    const app = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    // Firebase loaded successfully
    console.log('Firebase SDK loaded successfully');
} catch (error) {
    console.error('Error loading Firebase SDK:', error);
    // Show user-friendly error message
    const errorMessage = document.createElement('div');
    errorMessage.className = 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded fixed top-4 right-4 z-50';
    errorMessage.setAttribute('role', 'alert');
    errorMessage.innerHTML = `
        <div class="flex">
            <div class="py-1"><svg class="fill-current h-6 w-6 text-red-500 mr-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zm12.73-1.41A8 8 0 1 0 4.34 4.34a8 8 0 0 0 11.32 11.32zM9 11V9h2v6H9v-4zm0-6h2v2H9V5z"/></svg></div>
            <div>
                <p class="font-bold">Warning</p>
                <p class="text-sm">Some features may be temporarily unavailable.</p>
            </div>
        </div>
    `;
    document.body.appendChild(errorMessage);

    // Remove error message after 5 seconds
    setTimeout(() => {
        errorMessage.remove();
    }, 5000);
}
const loadFirebase = async () => {
    try {
        const [
            { initializeApp },
            { getFirestore },
            { getAuth },
        ] = await Promise.all([
            import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js'),
            import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js'),
            import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js')
        ]);
        const encryptedConfig = "eyJhcGlLZXkiOiJBSXphU3lEOVhWYUI0Vk1zaXBHUTRmUTQ1VFg3UHhiTTNEdTVfWEUiLCJhdXRoRG9tYWluIjoiYmN2d29ybGQtY2M0MGUuZmlyZWJhc2VhcHAuY29tIiwicHJvamVjdElkIjoiYmN2d29ybGQtY2M0MGUiLCJzdG9yYWdlQnVja2V0IjoiYmN2d29ybGQtY2M0MGUuZmlyZWJhc2VzdG9yYWdlLmFwcCIsIm1lc3NhZ2luZ1NlbmRlcklkIjoiMTA4MzI5NTgwODIyNyIsImFwcElkIjoiMToxMDgzMjk1ODA4MjI3OndlYjo4MDcwZDA4MGJlYjdlOWE4MTlhM2Q2IiwibWVhc3VyZW1lbnRJZCI6IkctRlZUU0tLTkpCSCJ9";
        const decryptConfig = (encrypted) => {
            try {
                const decoded = atob(encrypted);
                const config = JSON.parse(decoded);

                // Validate required fields
                if (!config.apiKey || !config.authDomain || !config.projectId) {
                    throw new Error('Missing required configuration fields');
                }

                return config;
            } catch (e) {
                console.error('Configuration error:', e);
            }
        };
        let db, auth;
        try {
            const firebaseConfig = decryptConfig(encryptedConfig);
            const app = initializeApp(firebaseConfig);
            db = getFirestore(app);
            auth = getAuth(app);
        } catch (error) {
            console.error('Initialization error:', error);
        }

        // Signal that Firebase is ready
        window.dispatchEvent(new CustomEvent('firebaseReady'));
    } catch (error) {
        console.error('Error loading Firebase:', error);
        // Show user-friendly error message
        const errorMessage = document.createElement('div');
        errorMessage.className = 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded fixed top-4 right-4 z-50';
        errorMessage.setAttribute('role', 'alert');
        errorMessage.innerHTML = `
        <div class="flex">
            <div class="py-1"><svg class="fill-current h-6 w-6 text-red-500 mr-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zm12.73-1.41A8 8 0 1 0 4.34 4.34a8 8 0 0 0 11.32 11.32zM9 11V9h2v6H9v-4zm0-6h2v2H9V5z"/></svg></div>
            <div>
                <p class="font-bold">Service Unavailable</p>
                <p class="text-sm">Some features may be temporarily unavailable. Please try again later.</p>
            </div>
        </div>
    `;
        document.body.appendChild(errorMessage);
        setTimeout(() => errorMessage.remove(), 5000);
    }
};

// Load Firebase when the page is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadFirebase);
} else {
    loadFirebase();
}

const criticalFns = {
    toggleTheme: (theme) => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem('theme', theme);
    },
    initTheme: () => {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.dataset.theme = savedTheme;
    }
};
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initializeFirebase();
        // Continue with your application initialization
    } catch (error) {
        console.error('Failed to initialize Firebase:', error);
        // Handle initialization failure
    }
});
// Initialize theme immediately
criticalFns.initTheme();