import { db, storage, ref, getDownloadURL } from './firebase-config.js';
import { 
    collection, query, where, orderBy, 
    limit, getDocs, doc, getDoc 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

export class RelatedArticles {
    constructor() {
        this.db = db;
        this.initialize();
    }

    async initialize() {
        // Get the current article ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const articleId = urlParams.get('id');
        
        if (articleId) {
            // Get the current article data first
            const articleDoc = await getDoc(doc(this.db, 'news', articleId));
            if (articleDoc.exists()) {
                const newsData = articleDoc.data();
                await this.loadRelatedArticles(newsData);
            }
        }
    }

    async loadRelatedArticles(newsData) {
        try {
            if (!newsData || !newsData.category) {
                console.warn('Invalid news data for related articles');
                return;
            }

            console.log(newsData.category);
            const relatedQuery = query(
                collection(this.db, 'news'),
                where('category', '==', newsData.category),
                orderBy('createdAt', 'desc'),
                limit(4)
            );

            const snapshot = await getDocs(relatedQuery);
            const container = document.getElementById('relatedArticlesContainer');
            
            if (container && !snapshot.empty) {
                container.innerHTML = snapshot.docs
                    .filter(d => d.id !== newsData.id)
                    .map(d => {
                        const news = d.data();
                        return `
                            <div class="col-md-6 col-lg-3 mb-4">
                                <a href="news-detail.html?id=${d.id}" class="text-decoration-none article-link">
                                    <div class="d-flex flex-column">
                                        <div class="image-wrapper position-relative mb-3">
                                            <img id="related-img-${d.id}" src="" 
                                                 alt="${news.title}" 
                                                 class="img-fluid w-100"
                                                 style="height: 200px; object-fit: cover;">
                                            <span class="category-label position-absolute top-0 start-0 m-2 px-2 py-1 bg-primary text-white small">
                                                ${news.category}
                                            </span>
                                        </div>
                                        <div class="article-info">
                                            <h5 class="article-title fw-semibold text-dark mb-2 line-clamp-2" 
                                                style="font-size: 1.1rem; line-height: 1.5;">
                                                ${news.title}
                                            </h5>
                                            <div class="meta-info d-flex align-items-center">
                                                <span class="text-muted small">
                                                    <i class="bi bi-calendar-event me-1"></i>
                                                    ${(() => { 
                                                        const ts = news.createdAt; 
                                                        let d = null; 
                                                        try { 
                                                            if (ts && typeof ts.toDate === 'function') d = ts.toDate(); 
                                                            else if (ts instanceof Date) d = ts; 
                                                            else if (typeof ts === 'number' || typeof ts === 'string') d = new Date(ts); 
                                                        } catch(_) {}
                                                        return d ? d.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }) : '';
                                                    })()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </a>
                            </div>`;
                    }).join('');

                const docs = snapshot.docs.filter(d => d.id !== newsData.id);
                for (const d of docs) {
                    const news = d.data();
                    const img = document.getElementById(`related-img-${d.id}`);
                    if (!img) continue;

                    const candidates = [
                        news.imageUrl,
                        news.imageURL,
                        news.featuredImageUrl,
                        news.featuredImage,
                        news.image,
                        news.imagePath
                    ].filter(Boolean);

                    let src = '';
                    for (const cand of candidates) {
                        const s = String(cand).trim();
                        if (/^https?:\/\//i.test(s) || s.startsWith('/')) { src = resolveImagePath(s); break; }
                        if (s.startsWith('assets/') || s.startsWith('images/')) { src = resolveImagePath(s); break; }
                    }
                    if (!src) {
                        const storagePath = news.imageStoragePath || news.storagePath || '';
                        if (storagePath) {
                            try { src = await getDownloadURL(ref(storage, storagePath)); } catch(e) {}
                        }
                    }
                    if (!src) src = '/assets/images/logo.png';
                    img.src = src;
                }
            } else {
                console.log('No related articles found or container missing'); // Debug log
            }
        } catch (error) {
            console.error('Error loading related articles:', error);
        }
    }
}

// Create and export a single instance
export const relatedArticles = new RelatedArticles();

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
