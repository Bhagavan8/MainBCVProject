import { auth, db, storage, ref, getDownloadURL } from './firebase-config.js';
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

// Utility functions
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

    // Handle Firestore Timestamp
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



// Initialize ads for existing slots (safe)
function initPageAds() {
    if (window.adsHelper && typeof window.adsHelper.safeInitAndMonitor === 'function') {
        window.adsHelper.safeInitAndMonitor();
    } else {
        // fallback: attempt to initialize after a short delay
        setTimeout(() => {
            if (window.adsHelper && typeof window.adsHelper.safeInitAndMonitor === 'function') {
                window.adsHelper.safeInitAndMonitor();
            }
        }, 1000);
    }
}


async function incrementViewCount(newsId) {
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

async function displayNewsDetail(newsData) {
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
        const articleMetaEl = document.querySelector('.article-meta');
        if (articleMetaEl && newsData.url) {
            const sourceLink = document.createElement('a');
            sourceLink.href = newsData.url;
            sourceLink.textContent = 'Source';
            sourceLink.target = '_blank';
            sourceLink.rel = 'noopener';
            sourceLink.className = 'ms-3';
            articleMetaEl.appendChild(sourceLink);
        }

        const authorEl = document.querySelector('.author');
        if (authorEl) authorEl.textContent = `By ${newsData.authorName || 'Anonymous'}`;

        const dateElement = document.querySelector('.date');
        if (dateElement && newsData.createdAt) {
            dateElement.textContent = formatDate(newsData.createdAt);
        }

        const paragraphs = (newsData.content || '').split('\n\n');
        const contentContainer = document.querySelector('.article-content');
        if (!contentContainer) return;

        const adSlotsAttr = contentContainer.getAttribute('data-ad-slots') || '';
        const adSlots = adSlotsAttr.split(',').map(s => s.trim()).filter(Boolean);
        const fallbackSlots = ['3297555670','3963785998','7711459312','2542893115'];
        const slots = adSlots.length ? adSlots : fallbackSlots;

        const manualNodes = contentContainer.querySelectorAll('[data-paragraph]');
        if (manualNodes.length) {
            const used = new Set();
            manualNodes.forEach(node => {
                const idx = Number(node.getAttribute('data-paragraph')) || 0;
                used.add(idx);
                node.textContent = paragraphs[idx] || '';
            });
            contentContainer.querySelectorAll('ins.adsbygoogle').forEach(ins => {
                try { queueAdPush(ins); } catch(e) { try { (adsbygoogle = window.adsbygoogle || []).push({}); } catch(_){} }
            });
            let appended = 0;
            for (let i = 0; i < paragraphs.length; i++) {
                if (!used.has(i)) {
                    const p = document.createElement('p');
                    p.textContent = paragraphs[i];
                    contentContainer.appendChild(p);
                    appended++;
                    if (appended % 3 === 0 && i < paragraphs.length - 1) {
                        const adSection = document.createElement('div');
                        adSection.className = 'ad-section-responsive my-4';
                        const adBanner = document.createElement('div');
                        adBanner.className = 'ad-banner-horizontal';
                        adBanner.id = `in-content-ad-${Date.now()}-${i}`;
                        const ins = document.createElement('ins');
                        ins.className = 'adsbygoogle';
                        ins.style.display = 'block';
                        ins.setAttribute('data-ad-client', 'ca-pub-6284022198338659');
                        const slot = slots[Math.floor(appended/3) % slots.length];
                        ins.setAttribute('data-ad-slot', String(slot));
                        ins.setAttribute('data-ad-format', 'auto');
                        ins.setAttribute('data-full-width-responsive', 'true');
                        adBanner.appendChild(ins);
                        adSection.appendChild(adBanner);
                        contentContainer.appendChild(adSection);
                        try { queueAdPush(ins); } catch(e) { try { (adsbygoogle = window.adsbygoogle || []).push({}); } catch(_){} }
                    }
                }
            }
            setTimeout(() => {
                try { if (window.fixAdContainers) window.fixAdContainers(); } catch(e) {}
                initPageAds();
            }, 800);
        } else {
            contentContainer.innerHTML = '';

            paragraphs.forEach((paragraph, index) => {
                const p = document.createElement('p');
                p.textContent = paragraph;
                contentContainer.appendChild(p);

                if ((index + 1) % 3 === 0 && index < paragraphs.length - 1) {
                    const adSection = document.createElement('div');
                    adSection.className = 'ad-section-responsive my-4';

                    const adBanner = document.createElement('div');
                    adBanner.className = 'ad-banner-horizontal';
                    adBanner.id = `in-content-ad-${index}`;

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

                    try { (adsbygoogle = window.adsbygoogle || []).push({}); } catch(e) {}
                }
            });

            setTimeout(() => {
                try { if (window.fixAdContainers) window.fixAdContainers(); } catch(e) {}
                initPageAds();
            }, 800);
        }

        const imageContainer = document.querySelector('.featured-image-container');
        if (imageContainer) {
            const imgCandidates = [
                newsData.imageUrl,
                newsData.imageURL,
                newsData.featuredImageUrl,
                newsData.featuredImage,
                newsData.image,
                newsData.imagePath
            ].filter(Boolean);
            let src = '';
            for (const cand of imgCandidates) {
                const s = String(cand).trim();
                if (/^https?:\/\//i.test(s) || s.startsWith('/')) { src = resolveImagePath(s); break; }
            }
            if (!src) {
                const storagePath = newsData.imageStoragePath || newsData.storagePath || '';
                if (storagePath) {
                    try { src = await getDownloadURL(ref(storage, storagePath)); } catch(e) {}
                }
            }
            if (!src) { src = '/assets/images/logo.png'; }

            imageContainer.innerHTML = `
                <img src="${src}" 
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
                                <img src="${resolveImagePath(news.imageUrl || news.imagePath || '')}" alt="${news.title}" 
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
                                    <img src="${resolveImagePath(news.imageUrl || news.imagePath || '/assets/images/logo.png')}" 
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
    setTimeout(() => { if (window.fixAdContainers) window.fixAdContainers(); }, 500);
});

// init page ad call (best-effort; adsissue auto-runs too)
setTimeout(() => {
    initPageAds();
}, 1200);

// export for debug
window.newsDetailHelpers = {
    initPageAds,
    fixAdContainers: window.fixAdContainers || function(){}
};
