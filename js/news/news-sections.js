import { db } from './firebase-config.js';
import { collection, query, where, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Global function to initialize ads (call this after loading content)
function resolveImagePath(p){
    if(!p) return '/assets/images/logo.png';
    const s = String(p).trim();
    if (/^https?:\/\//i.test(s)) {
        if (location.protocol === 'https:' && s.startsWith('http://')) return s.replace(/^http:\/\//i, 'https://');
        return s;
    }
    if (s.startsWith('/')) return s;
    if (s.startsWith('assets/') || s.startsWith('assets\\') || s.startsWith('assets/images/') || s.startsWith('images/')) return '/' + s.replace(/^\.\/+/, '');
    return '/assets/images/news/' + s;
}

window.initializeAds = function() {
    console.log('Initializing ads after content load...');
    if (window.adsbygoogle) {
        (adsbygoogle = window.adsbygoogle || []).push({});
        
        // Additional push for safety
        setTimeout(() => {
            (adsbygoogle = window.adsbygoogle || []).push({});
        }, 500);
    }
};



async function loadBreakingNews() {
    try {
        const breakingNewsQuery = query(
            collection(db, 'news'),
            where('section', '==', 'breaking'),
            where('approvalStatus', '==', 'approved'),
            orderBy('createdAt', 'desc'),
            limit(3)
        );

        const querySnapshot = await getDocs(breakingNewsQuery);
        const breakingNews = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        if (breakingNews.length > 0) {
            // Populate main breaking news
            document.getElementById('mainBreakingNews').innerHTML = createMainNewsHTML(breakingNews[0]);
            
            // Populate secondary breaking news
            if (breakingNews[1]) {
                document.getElementById('secondaryBreakingNews1').innerHTML = createSecondaryNewsHTML(breakingNews[1]);
            }
            if (breakingNews[2]) {
                document.getElementById('secondaryBreakingNews2').innerHTML = createSecondaryNewsHTML(breakingNews[2]);
            }
            
            // Initialize ads after content is loaded
            setTimeout(() => {
                initializeAds();
                monitorAndHandleAds();
            }, 100);
        }
    } catch (error) {
        console.error('Error loading breaking news:', error);
    }
}

function createMainNewsHTML(news) {
    return `
        <div class="position-relative main-breaking-news">
            <div class="social-share-icons position-absolute top-0 end-0 m-3 z-1">
                <a href="https://facebook.com/share.php?u=${window.location.origin}/news/${news.id}" 
                   class="btn btn-glass btn-sm rounded-circle me-2" target="_blank">
                    <i class="bi bi-facebook"></i>
                </a>
                <a href="https://twitter.com/intent/tweet?url=${window.location.origin}/news/${news.id}&text=${encodeURIComponent(news.title)}" 
                   class="btn btn-glass btn-sm rounded-circle me-2" target="_blank">
                    <i class="bi bi-twitter"></i>
                </a>
                <a href="https://api.whatsapp.com/send?text=${encodeURIComponent(news.title + ' ' + window.location.origin + '/news/' + news.id)}" 
                   class="btn btn-glass btn-sm rounded-circle" target="_blank">
                    <i class="bi bi-whatsapp"></i>
                </a>
            </div>
            <div class="image-wrapper">
                <img src="${resolveImagePath(news.imageUrl || news.imagePath)}" alt="${news.title}">
            </div>
            <div class="news-overlay">
                <span class="news-category">${news.category}</span>
                <h3 class="mt-3 mb-2 text-white">${news.title}</h3>
                <p class="content-preview text-white-50">${news.content.substring(0, 150)}...</p>
                <div class="d-flex justify-content-between align-items-center mt-4">
                    <div class="news-meta text-white-50">
                        <span><i class="bi bi-calendar3 me-1"></i>${formatDate(news.createdAt)}</span>
                        <span class="ms-3"><i class="bi bi-eye me-1"></i>${news.views}</span>
                        <span class="ms-3"><i class="bi bi-heart me-1"></i>${news.likes}</span>
                    </div>
                    <a href="${news.url || ('news-detail.html?id=' + news.id)}" class="btn-read-more" ${news.url ? 'target="_blank" rel="noopener"' : ''}>
                        Read More <i class="bi bi-arrow-right ms-1"></i>
                    </a>
                </div>
            </div>
        </div>
    `;
}

function createSecondaryNewsHTML(news) {
    return `
        <div class="position-relative">
            <div class="social-share-icons position-absolute top-0 end-0 m-2 z-1">
                <a href="https://facebook.com/share.php?u=${window.location.origin}/news/${news.id}" class="btn btn-light btn-sm rounded-circle me-1" target="_blank">
                    <i class="bi bi-facebook"></i>
                </a>
                <a href="https://twitter.com/intent/tweet?url=${window.location.origin}/news/${news.id}&text=${encodeURIComponent(news.title)}" class="btn btn-light btn-sm rounded-circle me-1" target="_blank">
                    <i class="bi bi-twitter"></i>
                </a>
                <a href="https://api.whatsapp.com/send?text=${encodeURIComponent(news.title + ' ' + window.location.origin + '/news/' + news.id)}" class="btn btn-light btn-sm rounded-circle" target="_blank">
                    <i class="bi bi-whatsapp"></i>
                </a>
            </div>
            <img src="${resolveImagePath(news.imageUrl || news.imagePath)}" alt="${news.title}">
            <div class="news-overlay">
                <span class="news-category badge bg-primary mb-2">${news.category}</span>
                <h5 class="mb-2">${news.title}</h5>
                <p class="content-preview small mb-2">${news.content.substring(0, 100)}...</p>
                <div class="d-flex justify-content-between align-items-center">
                    <span class="small">${formatDate(news.createdAt)}</span>
                    <a href="${news.url || ('news-detail.html?id=' + news.id)}" class="btn btn-light btn-sm" ${news.url ? 'target="_blank" rel="noopener"' : ''}>Read More</a>
                </div>
            </div>
        </div>
    `;
}

async function loadSectionNews(section, containerId, itemLimit = 4) {
    try {
        let conditions = [
            where('approvalStatus', '==', 'approved'),
            where('section', '==', section)
        ];

        // Add 24-hour filter for recent section
        if (section === 'recent') {
            const last24Hours = new Date();
            last24Hours.setHours(last24Hours.getHours() - 24);
            conditions.push(where('createdAt', '>=', last24Hours));
        }

        const baseCollection = collection(db, 'news');
        let snapshot;
        try {
            const newsQuery = query(baseCollection, ...conditions, orderBy('createdAt', 'desc'), limit(itemLimit));
            snapshot = await getDocs(newsQuery);
        } catch (e) {
            const newsQueryNoOrder = query(baseCollection, ...conditions, limit(itemLimit));
            snapshot = await getDocs(newsQueryNoOrder);
        }

        if (snapshot.empty) {
            const cap = section.charAt(0).toUpperCase() + section.slice(1);
            const catQueries = [
                query(baseCollection, where('approvalStatus', '==', 'approved'), where('category', '==', section), orderBy('createdAt','desc'), limit(itemLimit)),
                query(baseCollection, where('approvalStatus', '==', 'approved'), where('category', '==', cap), orderBy('createdAt','desc'), limit(itemLimit)),
                query(baseCollection, where('approvalStatus', '==', 'approved'), where('category', '==', section), limit(itemLimit)),
                query(baseCollection, where('approvalStatus', '==', 'approved'), where('category', '==', cap), limit(itemLimit)),
                // Accept 'Approved' capitalization
                query(baseCollection, where('approvalStatus', '==', 'Approved'), where('category', '==', section), orderBy('createdAt','desc'), limit(itemLimit)),
                query(baseCollection, where('approvalStatus', '==', 'Approved'), where('category', '==', cap), orderBy('createdAt','desc'), limit(itemLimit)),
                query(baseCollection, where('approvalStatus', '==', 'Approved'), where('category', '==', section), limit(itemLimit)),
                query(baseCollection, where('approvalStatus', '==', 'Approved'), where('category', '==', cap), limit(itemLimit)),
                // As a final fallback, ignore approvalStatus
                query(baseCollection, where('category', '==', section), orderBy('createdAt','desc'), limit(itemLimit)),
                query(baseCollection, where('category', '==', cap), orderBy('createdAt','desc'), limit(itemLimit)),
                query(baseCollection, where('category', '==', section), limit(itemLimit)),
                query(baseCollection, where('category', '==', cap), limit(itemLimit))
            ];
            for (const q of catQueries) {
                try {
                    const s = await getDocs(q);
                    if (!s.empty) { snapshot = s; break; }
                } catch (_) { continue; }
            }
        }
        const container = document.getElementById(containerId);

        if (container && !snapshot.empty) {
            container.innerHTML = snapshot.docs.map((doc, index) => {
                const news = doc.data();
                const link = news.url || `news-detail.html?id=${doc.id}`;
                return `
                    <article class="news-article" data-aos="fade-up" data-aos-delay="${index * 100}">
                        <div class="article-image">
                            <img src="${resolveImagePath(news.imageUrl || news.imagePath)}" alt="${news.title}" loading="lazy">
                            <span class="category-tag">${news.category.charAt(0).toUpperCase() + news.category.slice(1)}</span>
                        </div>
                        <div class="article-content">
                            <div class="article-meta">
                                <span><i class="bi bi-clock"></i> ${formatDate(news.createdAt)}</span>
                                <span><i class="bi bi-person"></i> ${news.authorName}</span>
                            </div>
                            <h3 class="article-title">${news.title}</h3>
                            <p class="article-excerpt">${news.content.substring(0, 120)}...</p>
                            <div class="article-footer">
                                <div class="article-stats">
                                    <span class="stat-item"><i class="bi bi-eye"></i> ${formatNumber(news.views || 0)}</span>
                                    <span class="stat-item"><i class="bi bi-heart"></i> ${formatNumber(news.likes || 0)}</span>
                                </div>
                                <div class="share-buttons">
                                    <a href="https://facebook.com/share.php?u=${window.location.href}?id=${doc.id}" 
                                       class="share-btn facebook" target="_blank">
                                        <i class="bi bi-facebook"></i>
                                    </a>
                                    <a href="https://twitter.com/intent/tweet?url=${window.location.href}?id=${doc.id}&text=${encodeURIComponent(news.title)}" 
                                       class="share-btn twitter" target="_blank">
                                        <i class="bi bi-twitter"></i>
                                    </a>
                                    <a href="https://wa.me/?text=${encodeURIComponent(news.title + ' ' + window.location.href + '?id=' + doc.id)}" 
                                       class="share-btn whatsapp" target="_blank">
                                        <i class="bi bi-whatsapp"></i>
                                    </a>
                                </div>
                                ${news.url ? `<a href="${link}" class="read-more-btn" target="_blank" rel="noopener">` : `<a href="${link}" class="read-more-btn">`}
                                    Read More <i class="bi bi-arrow-right"></i>
                                </a>
                            </div>
                        </div>
                    </article>`;
            }).join('');
            
            // Initialize ads after section content is loaded
            setTimeout(() => {
                initializeAds();
                monitorAndHandleAds();
            }, 100);
        }
    } catch (error) {
        console.error(`Error loading ${section} news:`, error);
    }
}

// Helper function to format numbers
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num;
}

function formatDate(timestamp) {
    if (!timestamp) return '';
    let date;
    try {
        if (timestamp && typeof timestamp.toDate === 'function') {
            date = timestamp.toDate();
        } else if (timestamp instanceof Date) {
            date = timestamp;
        } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
            date = new Date(timestamp);
        } else {
            return '';
        }
        if (isNaN(date.getTime())) return '';
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (_) {
        return '';
    }
}

// Add auto-refresh interval (10 minutes in milliseconds)
const AUTO_REFRESH_INTERVAL = 10 * 60 * 1000;

// Modify the DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', () => {
    // Initial load
    loadAllSections();
    
    // Set up auto-refresh
    setInterval(loadAllSections, AUTO_REFRESH_INTERVAL);
});

// Add a function to load all sections
function loadAllSections() {
    loadSectionNews('general', 'generalNewsGrid');
    loadSectionNews('featured', 'featuredNewsSlider');
    loadSectionNews('recent', 'recentNewsList');
    loadSectionNews('entertainment', 'entertainmentGrid');
    loadSectionNews('tips', 'tipsGrid');
    loadSectionNews('stories', 'storiesGrid');
    loadSectionNews('technology', 'technologyGrid');
    loadBreakingNews();
}

// Export for global access
window.loadAllSections = loadAllSections;

// Enhanced ad refresh function
window.refreshAdsWithFallback = function() {
    console.log('🔄 Refreshing ads with fallback handling...');
    if (window.adsbygoogle) {
        (adsbygoogle = window.adsbygoogle || []).push({});
        setTimeout(monitorAndHandleAds, 3000);
    }
};
