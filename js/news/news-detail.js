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

    const tryNativeShare = () => {
        if (navigator.share) {
            navigator.share({ title: shareTitle, url: shareUrl }).catch(() => {});
            return true;
        }
        return false;
    };
    if (fb) {
        fb.onclick = () => {
            if (!tryNativeShare()) {
                window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
            }
        };
    }
    if (tw) {
        tw.onclick = () => {
            if (!tryNativeShare()) {
                window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`, '_blank');
            }
        };
    }
    if (wa) {
        wa.onclick = () => {
            if (!tryNativeShare()) {
                window.open(`https://wa.me/?text=${encodeURIComponent(shareTitle + ' ' + shareUrl)}`, '_blank');
            }
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
        const breadcrumbTitleEl = document.querySelector('.breadcrumb .truncate-text');
        const breadcrumbEllipsisEl = document.querySelector('.breadcrumb .ellipsis');
        function truncateTitle(t, max){
            const s = String(t || '').trim();
            if (s.length > max) return s.slice(0, max) + '...';
            return s;
        }
        if (breadcrumbTitleEl) breadcrumbTitleEl.textContent = truncateTitle(newsData.title, 40);
        if (breadcrumbEllipsisEl) breadcrumbEllipsisEl.style.display = 'none';
        if (newsData.title) {
            try { document.title = `${newsData.title} - News Portal`; } catch(_) {}
        }
        const articleMetaEl = document.querySelector('.article-meta');
        if (articleMetaEl) {
            if (newsData.url) {
                let hostname = '';
                try { hostname = new URL(newsData.url).hostname.replace(/^www\./,''); } catch(_) {}
                const srcContainer = document.getElementById('articleSourceContainer');
                if (srcContainer) {
                    const a = document.createElement('a');
                    a.href = newsData.url;
                    a.target = '_blank';
                    a.rel = 'noopener';
                    a.className = 'source-link';
                    a.innerHTML = `<i class="bi bi-link-45deg me-1"></i>Source ${hostname || ''}`.trim();
                    srcContainer.innerHTML = '';
                    srcContainer.appendChild(a);
                }
            }
        }

        const authorEl = document.querySelector('.author');
        if (authorEl) authorEl.textContent = `By ${newsData.authorName || 'Anonymous'}`;

        const dateElement = document.querySelector('.date');
        if (dateElement && newsData.createdAt) {
            dateElement.textContent = formatDate(newsData.createdAt);
        }

        const readingTimeEl = document.querySelector('.reading-time');
        if (readingTimeEl) {
            let start = Date.now();
            function fmt(ms){
                const totalSec = Math.floor(ms / 1000);
                const m = Math.floor(totalSec / 60);
                const s = totalSec % 60;
                return `${m}m ${String(s).padStart(2,'0')}s`;
            }
            readingTimeEl.textContent = fmt(0);
            if (window.__readingTimer) clearInterval(window.__readingTimer);
            window.__readingTimer = setInterval(() => {
                const elapsed = Date.now() - start;
                readingTimeEl.textContent = fmt(elapsed);
            }, 1000);
        }

        function toPlainText(val){
            if (!val) return '';
            if (typeof val === 'string') return val.trim();
            if (typeof val === 'number' || typeof val === 'boolean') return String(val).trim();
            if (typeof val === 'object') {
                const t = val.text || val.title || val.heading || val.description || val.content || val.value;
                if (typeof t === 'string') return t.trim();
                if (Array.isArray(val)) return val.map(toPlainText).join(' ').trim();
            }
            return '';
        }
        function normalizeParagraphs(data){
            const p = data.paragraphs;
            if (Array.isArray(p)) {
                if (p.length && typeof p[0] === 'object' && p[0] !== null) {
                    return p.map(item => {
                        const introCandidates = [item.title, item.heading, item.text, item.intro, item.description];
                        let intro = introCandidates.map(toPlainText).find(s => s);
                        let bullets = Array.isArray(item.points) ? item.points
                            .map(pt => {
                                if (typeof pt === 'string') return pt.trim();
                                const t = toPlainText(pt);
                                return (pt && typeof pt === 'object' && pt.bold) ? { text: t, bold: true } : t;
                            })
                            .filter(b => (typeof b === 'string' ? b : (b && b.text)))
                            : [];
                        function pointText(pt){
                            if (typeof pt === 'string') return pt.trim();
                            return toPlainText(pt);
                        }
                        if (!intro && bullets.length) {
                            intro = pointText(bullets[0]);
                            bullets = bullets.slice(1);
                        }
                        const tail = toPlainText(item.description);
                        return { intro: toPlainText(intro), bullets, tail, bold: !!item.bold };
                    }).filter(x => x.intro || (x.bullets && x.bullets.length) || x.tail);
                } else {
                    return p.map(s => ({ intro: String(s).trim(), bullets: [], tail: '', bold: false })).filter(x => x.intro);
                }
            }
            const raw = String(data.content || '').trim();
            if (!raw) return [];
            const parts = raw.split(/\r?\n\r?\n/).map(s => s.trim()).filter(Boolean);
            return parts.map(s => ({ intro: s, bullets: [], tail: '', bold: false }));
        }
        const paragraphs = normalizeParagraphs(newsData);
        const contentContainer = document.querySelector('.article-content');
        if (!contentContainer) return;

        

        function sanitizeForDisplay(input){
            let s = String(input || '');
            s = s.replace(/\(\/[^)]*\)/g, '');
            s = s.replace(/\(\s*\/\s*\)/g, '');
            s = s.replace(/\(\s*\)/g, '');
            s = s.replace(/\/\)/g, '');
            s = s.replace(/\s{2,}/g, ' ').trim();
            return s;
        }
        function buildEmphasisNodes(text) {
            const s = sanitizeForDisplay(String(text || '').trim());
            const frag = document.createDocumentFragment();
            if (!s) return frag;
            function emphasizeSegment(seg){
                const f = document.createDocumentFragment();
                const md = /\*\*(.+?)\*\*/g;
                let last = 0, m, used = false;
                while ((m = md.exec(seg)) !== null) {
                    const pre = seg.slice(last, m.index);
                    if (pre) f.appendChild(document.createTextNode(pre));
                    const st = document.createElement('strong');
                    st.textContent = m[1];
                    f.appendChild(st);
                    last = md.lastIndex;
                    used = true;
                }
                if (last < seg.length) f.appendChild(document.createTextNode(seg.slice(last)));
                if (used) return f;
                const colonIdx = seg.indexOf(':');
                if (colonIdx > 0) {
                    const prefix = seg.slice(0, colonIdx).trim();
                    const rest = seg.slice(colonIdx + 1).trim();
                    if (prefix.length >= 2 && prefix.length <= 60) {
                        const st = document.createElement('strong');
                        st.textContent = prefix;
                        f.appendChild(st);
                        if (rest) f.appendChild(document.createTextNode(': ' + rest));
                        return f;
                    }
                }
                const dashIdx = seg.indexOf(' - ');
                const emIdx = dashIdx >= 0 ? dashIdx : (seg.indexOf('—') >= 0 ? seg.indexOf('—') : seg.indexOf('–'));
                if (emIdx > 0) {
                    const sepLen = (dashIdx >= 0) ? 3 : 1;
                    const prefix = seg.slice(0, emIdx).trim();
                    const rest = seg.slice(emIdx + sepLen).trim();
                    if (prefix.length >= 2 && prefix.length <= 60) {
                        const st = document.createElement('strong');
                        st.textContent = prefix;
                        f.appendChild(st);
                        if (rest) f.appendChild(document.createTextNode((dashIdx >= 0 ? ' - ' : ' ') + rest));
                        return f;
                    }
                }
                f.appendChild(document.createTextNode(seg));
                return f;
            }
            const urlRe = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
            let last = 0, m;
            while ((m = urlRe.exec(s)) !== null) {
                const pre = s.slice(last, m.index);
                if (pre) frag.appendChild(emphasizeSegment(pre));
                const url = m[0];
                const a = document.createElement('a');
                a.href = url.startsWith('http') ? url : ('https://' + url);
                a.target = '_blank';
                a.rel = 'noopener nofollow';
                a.textContent = url;
                a.classList.add('text-primary');
                frag.appendChild(a);
                last = urlRe.lastIndex;
            }
            if (last < s.length) frag.appendChild(emphasizeSegment(s.slice(last)));
            return frag;
        }
        function appendStructuredParagraph(container, paraObj){
            const { intro, bullets, tail, bold } = paraObj;
            if (intro) {
                const p = document.createElement('p');
                if (bold) {
                    const st = document.createElement('strong');
                    st.appendChild(buildEmphasisNodes(intro));
                    p.appendChild(st);
                } else {
                    p.appendChild(buildEmphasisNodes(intro));
                }
                container.appendChild(p);
            }
            if (Array.isArray(bullets) && bullets.length) {
                const ul = document.createElement('ul');
                ul.className = 'paragraph-subpoints';
                bullets.forEach(txt => {
                    const li = document.createElement('li');
                    const t = typeof txt === 'string' ? txt : (txt && (txt.text || ''));
                    const isBold = typeof txt === 'object' && !!txt.bold;
                    if (isBold) {
                        const st = document.createElement('strong');
                        st.appendChild(buildEmphasisNodes(t));
                        li.appendChild(st);
                    } else {
                        li.appendChild(buildEmphasisNodes(t));
                    }
                    ul.appendChild(li);
                });
                container.appendChild(ul);
            }
            if (tail) {
                const p2 = document.createElement('p');
                p2.appendChild(buildEmphasisNodes(tail));
                container.appendChild(p2);
            }
        }
        const manualNodes = contentContainer.querySelectorAll('[data-paragraph]');
        if (manualNodes.length) {
            const slotsAttr = contentContainer.getAttribute('data-ad-slots') || '';
            const slots = slotsAttr.split(',').map(s => s.trim()).filter(Boolean);
            let slotIdx = 0;
            manualNodes.forEach(node => {
                const idx = Number(node.getAttribute('data-paragraph')) || 0;
                const paraObj = paragraphs[idx] || { intro: '', bullets: [], tail: '' };
                node.innerHTML = '';
                if (paraObj.intro) {
                    node.appendChild(buildEmphasisNodes(paraObj.intro));
                }
                if (Array.isArray(paraObj.bullets) && paraObj.bullets.length) {
                    const ul = document.createElement('ul');
                    ul.className = 'paragraph-subpoints';
                    paraObj.bullets.forEach(pt => {
                        const li = document.createElement('li');
                        const t = typeof pt === 'string' ? pt : (pt && (pt.text || ''));
                        const isBold = typeof pt === 'object' && !!pt.bold;
                        if (isBold) {
                            const st = document.createElement('strong');
                            st.appendChild(buildEmphasisNodes(t));
                            li.appendChild(st);
                        } else {
                            li.appendChild(buildEmphasisNodes(t));
                        }
                        ul.appendChild(li);
                    });
                    node.parentNode.insertBefore(ul, node.nextSibling);
                }
                if (paraObj.tail) {
                    const p2 = document.createElement('p');
                    p2.appendChild(buildEmphasisNodes(paraObj.tail));
                    node.parentNode.insertBefore(p2, node.nextSibling);
                }
                if (slots.length) {
                    let anchor = node.nextSibling;
                    if (paraObj.tail && anchor && anchor.nextSibling) anchor = anchor.nextSibling; // p2 is after ul
                    const adSection = document.createElement('div');
                    adSection.className = 'ad-section-responsive my-4';
                    const adBanner = document.createElement('div');
                    adBanner.className = 'ad-banner-horizontal';
                    const ins = document.createElement('ins');
                    ins.className = 'adsbygoogle';
                    ins.style.display = 'block';
                    ins.setAttribute('data-ad-client', 'ca-pub-6284022198338659');
                    const slot = slots[slotIdx % slots.length];
                    slotIdx++;
                    ins.setAttribute('data-ad-slot', String(slot));
                    ins.setAttribute('data-ad-format', 'auto');
                    ins.setAttribute('data-full-width-responsive', 'true');
                    adBanner.appendChild(ins);
                    adSection.appendChild(adBanner);
                    if (anchor) {
                        anchor.parentNode.insertBefore(adSection, anchor.nextSibling);
                    } else {
                        node.parentNode.appendChild(adSection);
                    }
                    try { (adsbygoogle = window.adsbygoogle || []).push({}); } catch(_) {}
                }
            });
            for (let i = manualNodes.length; i < paragraphs.length; i++) {
                const block = document.createElement('div');
                appendStructuredParagraph(block, paragraphs[i]);
                contentContainer.appendChild(block);
                const slotsAttr2 = contentContainer.getAttribute('data-ad-slots') || '';
                const slots2 = slotsAttr2.split(',').map(s => s.trim()).filter(Boolean);
                if (slots2.length) {
                    const adSection = document.createElement('div');
                    adSection.className = 'ad-section-responsive my-4';
                    const adBanner = document.createElement('div');
                    adBanner.className = 'ad-banner-horizontal';
                    const ins = document.createElement('ins');
                    ins.className = 'adsbygoogle';
                    ins.style.display = 'block';
                    ins.setAttribute('data-ad-client', 'ca-pub-6284022198338659');
                    const slot = slots2[(slotIdx++) % slots2.length];
                    ins.setAttribute('data-ad-slot', String(slot));
                    ins.setAttribute('data-ad-format', 'auto');
                    ins.setAttribute('data-full-width-responsive', 'true');
                    adBanner.appendChild(ins);
                    adSection.appendChild(adBanner);
                    contentContainer.appendChild(adSection);
                    try { (adsbygoogle = window.adsbygoogle || []).push({}); } catch(_) {}
                }
            }
        } else {
            contentContainer.innerHTML = '';
            const slotsAttr = contentContainer.getAttribute('data-ad-slots') || '';
            const slots = slotsAttr.split(',').map(s => s.trim()).filter(Boolean);
            let slotIdx = 0;
            paragraphs.forEach((paraObj) => {
                const block = document.createElement('div');
                appendStructuredParagraph(block, paraObj);
                contentContainer.appendChild(block);
                if (slots.length) {
                    const adSection = document.createElement('div');
                    adSection.className = 'ad-section-responsive my-4';
                    const adBanner = document.createElement('div');
                    adBanner.className = 'ad-banner-horizontal';
                    const ins = document.createElement('ins');
                    ins.className = 'adsbygoogle';
                    ins.style.display = 'block';
                    ins.setAttribute('data-ad-client', 'ca-pub-6284022198338659');
                    const slot = slots[(slotIdx++) % slots.length];
                    ins.setAttribute('data-ad-slot', String(slot));
                    ins.setAttribute('data-ad-format', 'auto');
                    ins.setAttribute('data-full-width-responsive', 'true');
                    adBanner.appendChild(ins);
                    adSection.appendChild(adBanner);
                    contentContainer.appendChild(adSection);
                    try { (adsbygoogle = window.adsbygoogle || []).push({}); } catch(_) {}
                }
            });
        }
        

        setTimeout(() => {
            try { if (window.fixAdContainers) window.fixAdContainers(); } catch(e) {}
            initPageAds();
        }, 800);

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

            // Set social meta tags (best-effort; some platforms ignore dynamic changes)
            function setMeta(selector, attr, value){
                let el = document.querySelector(selector);
                if (!el) {
                    el = document.createElement('meta');
                    if (attr === 'property') el.setAttribute('property', selector.replace('meta[property="','').replace('"]',''));
                    if (attr === 'name') el.setAttribute('name', selector.replace('meta[name="','').replace('"]',''));
                    document.head.appendChild(el);
                }
                el.setAttribute('content', value);
            }
            const desc = (newsData.excerpt || newsData.description || (paragraphs[0] && paragraphs[0].intro) || '').toString().slice(0, 160);
            const url = window.location.href;
            const absImg = (src && !/^https?:\/\//.test(src)) ? (new URL(src, location.origin)).href : src;
            setMeta('meta[property="og:title"]','property', newsData.title || 'News Detail');
            setMeta('meta[property="og:description"]','property', desc || 'Read the latest story on BCVWorld.');
            setMeta('meta[property="og:image"]','property', absImg);
            setMeta('meta[property="og:url"]','property', url);
            setMeta('meta[name="twitter:title"]','name', newsData.title || 'News Detail');
            setMeta('meta[name="twitter:description"]','name', desc || 'Read the latest story on BCVWorld.');
            setMeta('meta[name="twitter:image"]','name', absImg);
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

        const latestQuery = query(
            collection(db, 'news'),
            where('createdAt', '>=', last24Hours),
            orderBy('createdAt', 'desc'),
            limit(2)
        );
        const snapshot = await getDocs(latestQuery);
        const modalBody = document.getElementById('latestNewsModalBody');
        const badge = document.getElementById('latestNewsBadge');

        if (modalBody) {
            if (!snapshot.empty) {
                modalBody.innerHTML = snapshot.docs.map(d => {
                    const news = d.data();
                    const img = resolveImagePath(news.imageUrl || news.imagePath || '/assets/images/logo.png');
                    return `
                        <a href="news-detail.html?id=${d.id}" class="d-flex align-items-center text-decoration-none mb-2">
                            <img src="${img}" alt="${news.title}" class="latest-thumb-img me-2" />
                            <div class="flex-grow-1">
                                <div class="text-dark" style="font-size:0.9rem;line-height:1.2">${news.title}</div>
                                <small class="text-muted"><i class="bi bi-clock"></i> ${formatDate(news.createdAt)}</small>
                            </div>
                        </a>`;
                }).join('');
                if (badge) badge.classList.remove('d-none');
            } else {
                modalBody.innerHTML = `<p class="text-muted mb-0">No recent news available</p>`;
                if (badge) badge.classList.add('d-none');
            }
        }
    } catch (error) {
        console.error('Error loading latest news:', error);
    }
}

async function loadPopularNews() {
    try {
        const popularQuery = query(collection(db, 'news'), limit(50));
        const snapshot = await getDocs(popularQuery);
        const container = document.getElementById('popularNewsContainer');

        if (container && !snapshot.empty) {
            function isApproved(data){
                const s = String(data.approvalStatus || data.status || '').toLowerCase();
                return s === 'approved';
            }
            let sortedDocs = snapshot.docs
                .filter(d => isApproved(d.data()))
                .sort((a, b) => (b.data().views || 0) - (a.data().views || 0));
            if (sortedDocs.length === 0) {
                sortedDocs = snapshot.docs
                    .sort((a, b) => (b.data().views || 0) - (a.data().views || 0));
            }
            sortedDocs = sortedDocs.slice(0,5);

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

// Category news removed

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

function setupStickySidebarAdsHide(){
    const ads = Array.from(document.querySelectorAll('.sticky-sidebar-ad'));
    const footer = document.getElementById('footer-container');
    if (!ads.length || !footer) return;
    const hideAll = () => ads.forEach(el => { el.style.display = 'none'; });
    try {
        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    hideAll();
                    io.disconnect();
                }
            });
        }, { root: null, threshold: 0 });
        io.observe(footer);
    } catch (_) {
        const onScroll = () => {
            const r = footer.getBoundingClientRect();
            if (r.top <= window.innerHeight) {
                hideAll();
                window.removeEventListener('scroll', onScroll, { passive: true });
            }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
    }
}

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
    setupStickySidebarAdsHide();
}, 1200);

// export for debug
window.newsDetailHelpers = {
    initPageAds,
    fixAdContainers: window.fixAdContainers || function(){}
};
