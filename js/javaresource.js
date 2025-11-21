const basePath = '/assets/javapdf/';
const pdfFiles = [
    'Spring.pdf',
    'Step-26-Non-Techincal-Lead-level-Questions.pdf',
    'Step-25-Junit-and-Mockito.pdf',
    'Step-23-Maven-and-Git-Level-I.pdf',
    'Step-22-Microservices-Design-Patterns.pdf',
    'Step-21-Microservices-Level-II.pdf',
    'Step-20-Microservices-Level-I.pdf',
    'Step-19-Kafka-Optional.pdf',
    'Step-18-Spring-Data-JPA-and-Other-DB-Level-I.pdf',
    'Step-17-SQL.pdf',
    'Step-16-Spring-MVC-Level-I-Optional.pdf',
    'Step-15-Spring-Security-Level-II.pdf',
    'Step-14-Spring-Security-Level-I.pdf',
    'Step-13-Spring-Boot-Level-V-Expert.pdf',
    'Step-12-Spring-Boot-level-IV-Advance.pdf',
    'Step-11-Spring-Boot-Level-III-Scenario-Based.pdf',
    'Step-10-Spring-Boot-Level-II.pdf',
    'Step-9-Spring-Boot-Level-I.pdf',
    'Step-8-Spring-framework-Level-II.pdf',
    'Step-4-Core-Java-Level-IV-Advance-Level.pdf',
    'Common-Step-Stream-API-Coding-Level-I-2.pdf',
    'Common-Step-Java-Coding-2.pdf',
    'Step-23-Junit-and-Mockito.pdf',
    'Step-22-Maven-and-Git-Gradle-and-Deployments-Level-II.pdf',
    'Step-21-Maven-and-Git-Level-I.pdf',
    'Step-20-Microservices-Design-Patterns.pdf',
    'Step-19-Microservices-Level-II.pdf',
    'Step-18-Microservices-Level-I.pdf',
    'Step-17-Kafka-Optional.pdf',
    'Step-16-Spring-Data-JPA-and-Other-DB-Level-I.pdf',
    'Step-15-SQL.pdf',
    'Step-14-Spring-MVC-Level-I-Optional.pdf',
    'Step-13-Spring-Security-Level-II.pdf',
    'Step-12-Spring-Security-Level-I.pdf',
    'Step-11-Spring-Boot-level-IV-Advance.pdf',
    'Step-10-Spring-Boot-Level-III-Scenario-Based.pdf',
    'Step-9-Spring-Security-Level-II.pdf',
    'Step-6-Spring-Framework-Level-I.pdf',
    'Common-Step-Java-Coding-1.pdf',
    'Step-17-Junit-and-Mockito.pdf',
    'Step-16-Maven-and-Git-Gradle-and-Deployments-Level-II.pdf',
    'Step-15-Maven-and-Git-Level-I.pdf',
    'Step-14-Microservices-Level-I.pdf',
    'Step-13-Kafka-Optional.pdf',
    'Step-12-Spring-Data-JPA-and-Other-DB-Level-I.pdf',
    'Step-11-SQL.pdf',
    'Step-10-Spring-MVC-Level-I-Optional.pdf',
    'Step-9-Spring-Security-Level-I.pdf',
    'Step-8-Spring-Boot-Level-III-Scenario-Based.pdf',
    'Step-7-Spring-Boot-Level-II.pdf',
    'Step-5-Spring-framework-Level-II.pdf',
    'Step-3-Core-Java-Level-III.pdf',
    'Common-Step-Stream-API-Coding-Level-II.pdf',
    'Common-Step-Stream-API-Coding-Level-I.pdf',
    'Common-Step-Java-Coding.pdf',
    'Step-9-Maven-and-Git-Level-I.pdf',
    'Step-8-Microservices-Level-I.pdf',
    'Step-7-SQL.pdf',
    'Step-4-Spring-Boot-Level-I.pdf',
    'Step-2-Core-Java-Level-II.pdf',
    'Step-1-Core-Java-Level-I.pdf',
    'Common-Step-Stream-API-Coding-Questions-Level-I.pdf',
    'Java-PDF-Notes.pdf',
    'Spring-Framework-Notes.pdf',
    'SQL-Hand-written-notes.pdf',
    'SQL-PDF-Notes.pdf'
];

function toTitle(name) {
    return name
        .replace(/\.pdf$/i, '')
        .replace(/[-_]+/g, ' ')
        .replace(/(^|\s)step\s*\d+(\s|$)/gi, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

const cardsContainer = document.querySelector('.download-cards');
const pageSize = 10;
let currentPage = 1;
const totalPages = Math.ceil(pdfFiles.length / pageSize);

function buildCard(file) {
    const title = toTitle(file);
    return `
                <div class="download-card">
                    <div class="card-header">
                        <h3>${title}</h3>
                    </div>
                    <div class="card-body">
                        <p>${title} reference PDF</p>
                        <div class="file-info">
                            <span>PDF</span>
                        </div>
                        <button class="download-btn" data-file="${file}">Download Now</button>
                    </div>
                </div>
            `;
}

function buildInlineAd(index) {
    const adSlots = [
        '7551857423', // Ad slot 1 for inline ads
        '2303400170', // Ad slot 2 for inline ads  
        '8659542079', // Ad slot 3 for inline ads
        '9603305692'  // Ad slot 4 for inline ads
    ];

    // Cycle through ad slots based on index to show different ads
    const adSlot = adSlots[index % adSlots.length];

    return `
                <div class="ad-container">
                    <div class="ad-label">Advertisement</div>
                    <div class="ad-content horizontal-ad">
                        <ins class="adsbygoogle" 
                             style="display:block"
                             data-ad-client="ca-pub-6284022198338659" 
                             data-ad-slot="${adSlot}" 
                             data-ad-format="auto"
                             data-full-width-responsive="true"></ins>
                    </div>
                </div>
            `;
}

function buildPagination() {
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
                <button class="page-link ${p === currentPage ? 'active' : ''}" data-page="${p}" ${p === currentPage ? 'disabled' : ''}>${p}</button>
            `).join('');
    return `
                <div class="pagination-controls">
                    <button class="page-prev" ${currentPage === 1 ? 'disabled' : ''}>Prev</button>
                    ${pages}
                    <button class="page-next" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
                </div>
            `;
}

function renderPage(page) {
    currentPage = Math.max(1, Math.min(page, totalPages));
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const items = pdfFiles.slice(start, end);

    let html = '';
    items.forEach((file, idx) => {
        html += buildCard(file);
        if ((idx + 1) % 2 === 0) {
            html += buildInlineAd(start + idx + 1);
        }
    });
    html += buildPagination();
    cardsContainer.innerHTML = html;

    // Refresh ads after DOM update
    setTimeout(() => {
        loadAllAds();
    }, 100);

    attachPaginationHandlers();
    attachDownloadHandlers();
}

function attachPaginationHandlers() {
    const prev = cardsContainer.querySelector('.page-prev');
    const next = cardsContainer.querySelector('.page-next');
    const links = cardsContainer.querySelectorAll('.page-link');
    if (prev) prev.addEventListener('click', () => renderPage(currentPage - 1));
    if (next) next.addEventListener('click', () => renderPage(currentPage + 1));
    links.forEach(l => l.addEventListener('click', () => renderPage(parseInt(l.getAttribute('data-page'), 10))));
}

function attachDownloadHandlers() {
    document.querySelectorAll('.download-btn').forEach(button => {
        button.addEventListener('click', function () {
            const file = this.getAttribute('data-file');
            currentFile = file;
            downloadModal.style.display = 'flex';

            progressBar.style.width = '0%';
            progressText.textContent = '0%';
            downloadReady.style.display = 'none';

            let progress = 0;
            const interval = setInterval(() => {
                progress += 1;
                progressBar.style.width = progress + '%';
                progressText.textContent = progress + '%';

                if (progress >= 100) {
                    clearInterval(interval);
                    setTimeout(() => {
                        downloadReady.style.display = 'block';
                        finalDownload.href = basePath + currentFile;
                        finalDownload.setAttribute('download', currentFile);
                    }, 300);
                }
            }, 40);
        });
    });
}

function loadAllAds() {
    const adElements = document.querySelectorAll('.adsbygoogle[data-ad-client]:not([data-adsbygoogle-status])');
    adElements.forEach(ad => {
        try {
            (adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
            console.error('Ad loading error:', e);
        }
    });
}

// Initialize the page
if (cardsContainer) {
    renderPage(1);
}

// Mobile menu functionality
document.querySelector('.mobile-menu-btn').addEventListener('click', function () {
    document.querySelector('.nav-links').classList.toggle('active');
});

// Download modal functionality
const downloadModal = document.getElementById('downloadModal');
const closeModal = document.querySelector('.close-modal');
const progressBar = document.getElementById('adProgress');
const progressText = document.getElementById('progressText');
const downloadReady = document.getElementById('downloadReady');
const finalDownload = document.getElementById('finalDownload');
let currentFile = '';

closeModal.addEventListener('click', function () {
    downloadModal.style.display = 'none';
});

finalDownload.addEventListener('click', function () {
    downloadModal.style.display = 'none';
});

window.addEventListener('click', function (e) {
    if (e.target === downloadModal) {
        downloadModal.style.display = 'none';
    }
});

// Popup ad functionality
const popupAd = document.getElementById('popupAd');
const popupClose = document.querySelector('.popup-close');
const timerCount = document.getElementById('timerCount');

setTimeout(() => {
    popupAd.style.display = 'block';
    startPopupTimer();
}, 30000);

setInterval(() => {
    if (!popupAd.style.display || popupAd.style.display === 'none') {
        popupAd.style.display = 'block';
        startPopupTimer();
    }
}, 60000);

popupClose.addEventListener('click', function () {
    popupAd.style.display = 'none';
});

function startPopupTimer() {
    let count = 10;
    timerCount.textContent = count;
    const timer = setInterval(() => {
        count--;
        timerCount.textContent = count;
        if (count <= 0) {
            clearInterval(timer);
            popupAd.style.display = 'none';
        }
    }, 1000);
}

// Ads Popup functionality
const adsPopup = document.getElementById('adsPopup');
const adsPopupClose = document.getElementById('adsPopupClose');

function showAdsPopup() {
    adsPopup.style.display = 'flex';
    // Load the ad when popup is shown
    setTimeout(() => {
        const adElement = adsPopup.querySelector('.adsbygoogle');
        if (adElement && !adElement.getAttribute('data-adsbygoogle-status')) {
            try {
                (adsbygoogle = window.adsbygoogle || []).push({});
            } catch (e) {
                console.error('Ads popup ad loading error:', e);
            }
        }
    }, 100);
}

function closeAdsPopup() {
    adsPopup.style.display = 'none';
}

adsPopupClose.addEventListener('click', closeAdsPopup);

// Show ads popup after 15 seconds
setTimeout(() => {
    showAdsPopup();
}, 15000);

// Show ads popup every 2 minutes
setInterval(() => {
    if (!adsPopup.style.display || adsPopup.style.display === 'none') {
        showAdsPopup();
    }
}, 120000);

// Close ads popup when clicking outside
window.addEventListener('click', function (e) {
    if (e.target === adsPopup) {
        closeAdsPopup();
    }
});

// Initial ad load
window.addEventListener('load', function () {
    setTimeout(() => {
        loadAllAds();
    }, 1000);
});

// Handle window resize for ads
window.addEventListener('resize', function () {
    setTimeout(() => {
        loadAllAds();
    }, 500);
});