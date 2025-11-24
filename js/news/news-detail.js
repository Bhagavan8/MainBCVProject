// news-detail.js (patched & improved)
// Assumes adsissue.js is loaded (adsHelper global available)

import { auth, db } from './firebase-config.js';
import {
    doc,
    getDoc,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    collection,
    updateDoc,
    increment,
    arrayUnion,
    setDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

import { ArticleNavigation } from './article-navigation.js';
import { relatedArticles } from './related-articles.js';
import { CommentsManager } from './comments.js';

// ---------------------- Utility functions ----------------------
function showLoader() {
    const loader = document.querySelector('.loader-container');
    if (loader) loader.classList.remove('loader-hidden');
}

function hideLoader() {
    const loader = document.querySelector('.loader-container');
    if (loader) loader.classList.add('loader-hidden');
}

function formatDate(timestamp) {
    if (!timestamp) return '';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function setupShareButtons(newsData) {
    const shareUrl = window.location.href;
    const shareTitle = newsData.title;

    const fb = document.querySelector('.share-btn.facebook');
    const tw = document.querySelector('.share-btn.twitter');
    const wa = document.querySelector('.share-btn.whatsapp');

    if (fb) {
        fb.onclick = () => {
            window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
        };
    }
    if (tw) {
        tw.onclick = () => {
            window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`, '_blank');
        };
    }
    if (wa) {
        wa.onclick = () => {
            window.open(`https://wa.me/?text=${encodeURIComponent(shareTitle + ' ' + shareUrl)}`, '_blank');
        };
    }
}

// ---------------------- Ads helpers ----------------------

// Ensure the AdSense script is loaded (only inject once). Returns Promise that resolves when window.adsbygoogle exists.
let _adsScriptPromise = null;
function ensureAdsScript() {
    if (window.adsbygoogle) return Promise.resolve();
    if (_adsScriptPromise) return _adsScriptPromise;

    _adsScriptPromise = new Promise((resolve, reject) => {
        // If script already on DOM, still wait a short time for it to initialize
        const existing = document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]');
        if (existing) {
            // wait until window.adsbygoogle appears
            const start = Date.now();
            const wait = setInterval(() => {
                if (window.adsbygoogle) {
                    clearInterval(wait);
                    resolve();
                } else if (Date.now() - start > 5000) {
                    clearInterval(wait);
                    // still resolve so site doesn't hang; pushes will be guarded
                    resolve();
                }
            }, 150);
            return;
        }

        const s = document.createElement('script');
        s.async = true;
        s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
        s.onerror = () => {
            // don't block; resolve so fallback behavior can run
            resolve();
        };
        s.onload = () => {
            // small delay for initialization
            setTimeout(() => resolve(), 100);
        };
        document.head.appendChild(s);
    });

    return _adsScriptPromise;
}

// Queue pushes so we don't call push before script is ready
const adPushQueue = [];
let adQueueRunning = false;
function queueAdPush(insElement) {
    adPushQueue.push(insElement);
    runAdQueue();
}
async function runAdQueue() {
    if (adQueueRunning) return;
    adQueueRunning = true;
    try {
        await ensureAdsScript();
        while (adPushQueue.length) {
            const el = adPushQueue.shift();
            try {
                // guard push in try/catch because AdSense will throw if called incorrectly
                (adsbygoogle = window.adsbygoogle || []).push({});
            } catch (err) {
                // ignore and continue; maybe the ins wasn't ready
                console.warn('adsbygoogle.push() failed for an ins element', err);
            }
            // small delay between pushes to avoid rate issues
            await new Promise(r => setTimeout(r, 150));
        }
    } finally {
        adQueueRunning = false;
    }
}

// Fix ad containers: remove fixed inline widths on generated iframes and hide "unfill-optimized" placeholders.
function fixAdContainers() {
    try {
        // Remove any inline width that forces the iframe to a fixed width (makes responsive behavior broken)
        document.querySelectorAll('.ad-section-responsive, .ad-banner-horizontal').forEach(wrapper => {
            wrapper.style.maxWidth = '100%';
            wrapper.style.width = '100%';
            wrapper.style.display = 'block';
        });

        // For any injected iframes with inline style attributes, normalize them
        document.querySelectorAll('iframe').forEach(iframe => {
            try {
                // Some iframes are cross-origin and style overrides may not apply to inner doc,
                // but we can adjust the iframe element's attributes to be responsive
                iframe.style.maxWidth = '100%';
                iframe.style.width = '100%';
                iframe.style.height = 'auto';
            } catch (e) {
                // ignore cross-origin issues
            }
        });

        // Hide ad containers that are explicitly marked as unfilled by AdSense
        document.querySelectorAll('ins.adsbygoogle').forEach(ins => {
            const adStatus = ins.getAttribute('data-ad-status') || ins.dataset.adStatus;
            // sometimes data-ad-status may be set on parent container or replaced after ad call; search parent
            const parent = ins.closest('.ad-section-responsive') || ins.parentElement;
            if (adStatus && adStatus.toLowerCase().includes('unfill')) {
                // hide or replace with fallback - here we hide to avoid the fixed-looking placeholder
                if (parent) parent.style.display = 'none';
            }
        });

        // Additionally detect some common "related content" placeholders inserted by AdSense
        document.querySelectorAll('.goog-rtopics, .google-anno-sc, .google-annotated-item').forEach(el => {
            // If these appear in your ad slot and you prefer hiding them, hide the wrapper
            const adWrapper = el.closest('.ad-section-responsive') || el.closest('.ad-banner-horizontal');
            if (adWrapper) adWrapper.style.display = 'none';
        });
    } catch (e) {
        console.warn('fixAdContainers error:', e);
    }
}

// Call adsHelper if exists (your existing helper)
function initPageAds() {
    if (window.adsHelper && typeof window.adsHelper.safeInitAndMonitor === 'function') {
        try {
            window.adsHelper.safeInitAndMonitor();
        } catch (e) {
            console.warn('adsHelper.safeInitAndMonitor error', e);
        }
    } else {
        // fallback: attempt after short delay
        setTimeout(() => {
            if (window.adsHelper && typeof window.adsHelper.safeInitAndMonitor === 'function') {
                try {
                    window.adsHelper.safeInitAndMonitor();
                } catch (e) {
                    console.warn('adsHelper.safeInitAndMonitor error', e);
                }
            }
        }, 1000);
    }
}

// ---------------------- Content display & dynamic ad insertion ----------------------

function incrementViewCount(newsId) {
    return (async () => {
        try {
            const isLoggedIn = auth.currentUser !== null;

            if (!isLoggedIn) {
                const viewedNews = sessionStorage.getItem('viewedNews') || '';
                const viewedNewsArray = viewedNews ? viewedNews.split(',') : [];

                if (viewedNewsArray.includes(newsId)) {
                    return;
                }

                viewedNewsArray.push(newsId);
                sessionStorage.setItem('viewedNews', viewedNewsArray.join(','));
            } else {
                const userViewsRef = doc(db, 'userViews', auth.currentUser.uid);
                const userViewsDoc = await getDoc(userViewsRef);

                if (!userViewsDoc.exists()) {
                    await setDoc(userViewsRef, { viewedNews: [newsId] });
                } else if (!userViewsDoc.data().viewedNews?.includes(newsId)) {
                    await updateDoc(userViewsRef, { viewedNews: arrayUnion(newsId) });
                } else {
                    return;
                }
            }

            const newsRef = doc(db, 'news', newsId);
            await updateDoc(newsRef, { views: increment(1) });
        } catch (error) {
            console.error('Error updating view count:', error);
        }
    })();
}

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

function displayNewsDetail(newsData) {
    try {
        const categoryLink = document.querySelector('.category-link');
        const newsTitle = document.querySelector('.news-title');

        if (newsTitle) {
            newsTitle.textContent = newsData.title.length > 50
                ? newsData.title.substring(0, 50) + '...'
                : newsData.title;
        }

        const categoryBadge = document.querySelector('.category-badge');
        if (categoryBadge) {
            if (newsData.category) {
                categoryBadge.textContent = newsData.category.charAt(0).toUpperCase() + newsData.category.slice(1);
            } else {
                categoryBadge.textContent = '';
            }
            categoryBadge.classList.add('animate-badge');
        }

        const articleTitleEl = document.querySelector('.article-title');
        if (articleTitleEl) articleTitleEl.textContent = newsData.title || '';

        const authorEl = document.querySelector('.author');
        if (authorEl) authorEl.textContent = `By ${newsData.authorName || 'Anonymous'}`;

        const dateElement = document.querySelector('.date');
        if (dateElement && newsData.createdAt) {
            dateElement.textContent = formatDate(newsData.createdAt);
        }

        const paragraphs = (newsData.content || '').split('\n\n');
        const contentContainer = document.querySelector('.article-content');
        if (!contentContainer) return;

        contentContainer.innerHTML = '';

        const adSlotsAttr = (contentContainer.getAttribute('data-ad-slots') || '').trim();
        const adSlots = adSlotsAttr
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
        const fallbackSlots = ['3297555670','3963785998','7711459312','2542893115'];
        const slots = adSlots.length ? adSlots : fallbackSlots;

        paragraphs.forEach((paragraph, index) => {
            const p = document.createElement('p');
            p.textContent = paragraph;
            contentContainer.appendChild(p);

            // insert ad every 3 paragraphs (you had this logic) - safe insertion
            if ((index + 1) % 3 === 0 && index < paragraphs.length - 1) {
                const adSection = document.createElement('div');
                adSection.className = 'ad-section-responsive my-4';

                const adBanner = document.createElement('div');
                adBanner.className = 'ad-banner-horizontal';
                // unique id to prevent duplication confusion
                adBanner.id = `in-content-ad-${Date.now()}-${index}`;

                const ins = document.createElement('ins');
                ins.className = 'adsbygoogle';
                ins.style.display = 'block';
                ins.setAttribute('data-ad-client', 'ca-pub-6284022198338659');
                const slot = slots[Math.floor(index/3) % slots.length];
                ins.setAttribute('data-ad-slot', String(slot));
                ins.setAttribute('data-ad-format', 'auto');
                ins.setAttribute('data-full-width-responsive', 'true');

                adBanner.appendChild(ins);
                adSection.appendChild(adBanner);
                contentContainer.appendChild(adSection);

                // queue the ad push once ads script is available
                queueAdPush(ins);
            }
        });

        // After dynamic insertion, run our ad helper and fix containers
        setTimeout(() => {
            fixAdContainers();
            initPageAds(); // triggers adsHelper.safeInitAndMonitor() when available
        }, 800);

        const imageContainer = document.querySelector('.featured-image-container');
        if (imageContainer && newsData.imagePath) {
            imageContainer.innerHTML = `
                <img src="${resolveImagePath(newsData.imagePath)}" 
                     alt="${newsData.title || ''}"
                     class="img-fluid rounded shadow-sm">
                <figcaption class="text-muted mt-2 text-center">
                    ${newsData.imageCaption || ''}
                </figcaption>`;
        }

        setupShareButtons(newsData);
    } catch (e) {
        console.error('displayNewsDetail error', e);
    }
}

// ---------------------- related / latest / popular / category loaders ----------------------
async function loadRelatedNews(category) {
    try {
        if (!category) {
            console.warn('Category is undefined, skipping related news load');
            return;
        }

        const relatedQuery = query(collection(db, 'news'), where('category', '==', category), limit(4));
        const snapshot = await getDocs(relatedQuery);
        const container = document.getElementById('categoryNewsContainer');

        if (container && !snapshot.empty) {
            container.innerHTML = snapshot.docs.map(d => {
                const news = d.data();
                return `
                    <div class="related-news-item mb-3">
                        <a href="news-detail.html?id=${d.id}" class="text-decoration-none">
                            <div class="d-flex align-items-center">
                                <img src="${resolveImagePath(news.imagePath || '')}" alt="${news.title}" 
                                     class="related-thumb me-3" 
                                     style="width: 100px; height: 60px; object-fit: cover;">
                                <h6 class="mb-0 text-dark">${news.title}</h6>
                            </div>
                        </a>
                    </div>`;
            }).join('');
        }
    } catch (error) {
        console.error('Error loading related news:', error);
    }
}

async function loadLatestNews() {
    try {
        const last24Hours = new Date();
        last24Hours.setHours(last24Hours.getHours() - 24);

        const latestQuery = query(collection(db, 'news'), where('createdAt', '>=', last24Hours), orderBy('createdAt', 'desc'), limit(5));
        const snapshot = await getDocs(latestQuery);
        const container = document.getElementById('latestNewsContainer');

        if (container && !snapshot.empty) {
            container.innerHTML = snapshot.docs.map(d => {
                const news = d.data();
                return `
                    <div class="latest-news-item mb-3 p-2 border-bottom">
                        <a href="news-detail.html?id=${d.id}" class="text-decoration-none">
                            <div class="d-flex align-items-start">
                                <div class="latest-thumb me-3 position-relative">
                                    <img src="${news.imagePath || '/assets/images/placeholder.jpg'}" 
                                         alt="${news.title}"
                                         style="width: 100px; height: 60px; object-fit: cover; border-radius: 4px;">
                                    <span class="badge bg-primary position-absolute" 
                                          style="font-size: 0.65rem; padding: 0.2rem 0.4rem; bottom: 4px; left: 4px;">
                                      ${news.category ? (news.category.charAt(0).toUpperCase() + news.category.slice(1)) : ''}
                                    </span>
                                </div>
                                <div class="flex-grow-1">
                                    <h6 class="mb-1 text-dark">${news.title.length > 30 ? news.title.substring(0, 30) + '...' : news.title}</h6>
                                    <small class="text-muted d-inline-block" style="font-size: 0.7rem; white-space: nowrap;">
                                        <i class="bi bi-clock"></i> ${formatDate(news.createdAt)}
                                    </small>
                                </div>
                            </div>
                        </a>
                    </div>`;
            }).join('');
        } else if (container) {
            container.innerHTML = `<p class="text-muted">No recent news available</p>`;
        }
    } catch (error) {
        console.error('Error loading latest news:', error);
    }
}

async function loadPopularNews() {
    try {
        const popularQuery = query(collection(db, 'news'), limit(10));
        const snapshot = await getDocs(popularQuery);
        const container = document.getElementById('popularNewsContainer');

        if (container && !snapshot.empty) {
            const sortedDocs = snapshot.docs
                .filter(d => {
                    const data = d.data();
                    return data.views && data.approvalStatus === 'approved';
                })
                .sort((a, b) => (b.data().views || 0) - (a.data().views || 0))
                .slice(0, 5);

            container.innerHTML = sortedDocs.map((d, index) => {
                const news = d.data();
                return `
                    <div class="popular-news-item mb-3">
                        <a href="news-detail.html?id=${d.id}" class="text-decoration-none">
                            <div class="d-flex align-items-center">
                                <div class="position-relative me-3">
                                    <span class="number-badge">${index + 1}</span>
                                </div>
                                <div>
                                    <h6 class="mb-1 text-dark">${news.title}</h6>
                                    <small class="text-muted">
                                        <i class="bi bi-eye"></i> ${news.views || 0} views
                                    </small>
                                </div>
                            </div>
                        </a>
                    </div>`;
            }).join('');
        }
    } catch (error) {
        console.error('Error loading popular news:', error);
    }
}

async function loadCategoryNews(category) {
    try {
        console.log('Category received:', category);
        if (!category) {
            console.warn('Category is undefined, skipping category news load');
            return;
        }

        const categoryQuery = query(collection(db, 'news'), where('category', '==', category), limit(5));
        const snapshot = await getDocs(categoryQuery);
        const container = document.getElementById('categoryNewsContainer');

        if (container && !snapshot.empty) {
            container.innerHTML = `
                <h5 class="mb-3">More from ${category.charAt(0).toUpperCase() + category.slice(1)}</h5>
                ${snapshot.docs.map(d => {
                    const news = d.data();
                    return `
                        <div class="category-news-item mb-3">
                            <a href="news-detail.html?id=${d.id}" class="text-decoration-none">
                                <div class="d-flex align-items-center">
                                    <img src="${news.imagePath || '/assets/images/placeholder.jpg'}" 
                                         alt="${news.title}" 
                                         class="category-thumb me-3" 
                                         style="width: 80px; height: 50px; object-fit: cover;">
                                    <div>
                                        <h6 class="mb-1 text-dark">${news.title}</h6>
                                        <small class="text-muted">${formatDate(news.createdAt)}</small>
                                    </div>
                                </div>
                            </a>
                        </div>`;
                }).join('')}`;
        }
    } catch (error) {
        console.error('Error loading category news:', error);
    }
}

// ---------------------- main loader ----------------------

async function loadNewsDetail() {
    try {
        showLoader();
        const urlParams = new URLSearchParams(window.location.search);
        const newsId = urlParams.get('id');

        if (!newsId) {
            console.warn('No news ID provided');
            window.location.href = 'index.html';
            return;
        }

        const docRef = doc(db, 'news', newsId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            console.warn('News document not found');
            window.location.href = 'index.html';
            return;
        }

        const newsData = {
            id: newsId,
            ...docSnap.data()
        };

        await displayNewsDetail(newsData);

        const commentsManager = new CommentsManager(newsId);
        const navigation = new ArticleNavigation();

        await relatedArticles.loadRelatedArticles(newsData);

        if (newsData.category) {
            await Promise.all([
                loadRelatedNews(newsData.category),
                loadCategoryNews(newsData.category),
                loadLatestNews(),
                loadPopularNews(),
                incrementViewCount(newsId)
            ]);

            await commentsManager.initialize();
        } else {
            console.warn('News category is undefined');
        }
    } catch (error) {
        console.error("Error loading news:", error);
        console.log('Error details:', error.message);
    } finally {
        hideLoader();
    }
}

document.addEventListener('DOMContentLoaded', loadNewsDetail);

// reading progress
window.addEventListener('scroll', () => {
    const docElement = document.documentElement;
    const percentScrolled = (docElement.scrollTop / (docElement.scrollHeight - docElement.clientHeight)) * 100;
    document.documentElement.style.setProperty('--scroll', `${percentScrolled}%`);
});

// on resize ensure ad containers are fixed
window.addEventListener('resize', () => {
    setTimeout(fixAdContainers, 500);
});

// init page ad call (best-effort; adsissue auto-runs too)
setTimeout(() => {
    initPageAds();
    // ensure we attempt to load the ads script early (non-blocking)
    ensureAdsScript().then(() => {
        // run a quick fix pass after script is ready
        setTimeout(() => fixAdContainers(), 500);
    });
}, 1200);

// export for debug
window.newsDetailHelpers = {
    initPageAds,
    fixAdContainers,
    ensureAdsScript,
    queueAdPush
};
