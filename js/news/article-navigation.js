import { db } from './firebase-config.js';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

export class ArticleNavigation {
    static async loadAdjacentArticles() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const currentId = urlParams.get('id');
            
            if (!currentId) return;

            // Get current article's timestamp
            const currentArticleRef = doc(db, 'news', currentId);
            const currentArticleSnap = await getDoc(currentArticleRef);
            const currentArticle = currentArticleSnap.data();
            let currentTimestamp = currentArticle?.createdAt || null;
            try {
                if (currentTimestamp && typeof currentTimestamp.toDate === 'function') {
                    currentTimestamp = currentTimestamp;
                } else if (currentTimestamp) {
                    currentTimestamp = new Date(currentTimestamp);
                }
            } catch (_) {
                currentTimestamp = null;
            }

            async function tryQueries(qs){
                for (const q of qs) {
                    try {
                        const s = await getDocs(q);
                        if (!s.empty) return s;
                    } catch(_) { continue; }
                }
                return { empty: true, docs: [] };
            }

            const base = collection(db, 'news');
            const prevQueries = [];
            const nextQueries = [];

            if (currentTimestamp) {
                prevQueries.push(
                    query(base, where('approvalStatus','==','approved'), where('createdAt','<', currentTimestamp), orderBy('createdAt','desc'), limit(1))
                );
                nextQueries.push(
                    query(base, where('approvalStatus','==','approved'), where('createdAt','>', currentTimestamp), orderBy('createdAt','asc'), limit(1))
                );
            }
            // Fallback: status field
            if (currentTimestamp) {
                prevQueries.push(
                    query(base, where('status','==','approved'), where('createdAt','<', currentTimestamp), orderBy('createdAt','desc'), limit(1))
                );
                prevQueries.push(
                    query(base, where('status','==','Approved'), where('createdAt','<', currentTimestamp), orderBy('createdAt','desc'), limit(1))
                );
                nextQueries.push(
                    query(base, where('status','==','approved'), where('createdAt','>', currentTimestamp), orderBy('createdAt','asc'), limit(1))
                );
                nextQueries.push(
                    query(base, where('status','==','Approved'), where('createdAt','>', currentTimestamp), orderBy('createdAt','asc'), limit(1))
                );
            }
            // Fallback: ignore inequalities, pick adjacent by order and skip current
            prevQueries.push(query(base, where('approvalStatus','==','approved'), orderBy('createdAt','desc'), limit(2)));
            prevQueries.push(query(base, where('status','==','approved'), orderBy('createdAt','desc'), limit(2)));
            nextQueries.push(query(base, where('approvalStatus','==','approved'), orderBy('createdAt','asc'), limit(2)));
            nextQueries.push(query(base, where('status','==','approved'), orderBy('createdAt','asc'), limit(2)));
            // Final fallback: no approval filter
            prevQueries.push(query(base, orderBy('createdAt','desc'), limit(2)));
            nextQueries.push(query(base, orderBy('createdAt','asc'), limit(2)));

            let prevSnapshot = await tryQueries(prevQueries);
            let nextSnapshot = await tryQueries(nextQueries);

            this.updateNavigationUI(prevSnapshot, nextSnapshot, currentId);
        } catch (error) {
            console.error('Error loading adjacent articles:', error);
        }
    }

    static updateNavigationUI(prevSnapshot, nextSnapshot, currentId) {
        // Update Previous Article
        if (!prevSnapshot.empty) {
            const prevArticle = prevSnapshot.docs.find(d => d.id !== currentId) || prevSnapshot.docs[0];
            const prevData = prevArticle.data();
            const prevElement = document.getElementById('prevArticle');
            
            prevElement.href = `news-detail.html?id=${prevArticle.id}`;
            prevElement.querySelector('.nav-title').textContent = prevData.title;
            prevElement.querySelector('.nav-category').textContent = prevData.category;
            prevElement.style.display = 'block';
        }

        // Update Next Article
        if (!nextSnapshot.empty) {
            const nextArticle = nextSnapshot.docs.find(d => d.id !== currentId) || nextSnapshot.docs[0];
            const nextData = nextArticle.data();
            const nextElement = document.getElementById('nextArticle');
            
            nextElement.href = `news-detail.html?id=${nextArticle.id}`;
            nextElement.querySelector('.nav-title').textContent = nextData.title;
            nextElement.querySelector('.nav-category').textContent = nextData.category;
            nextElement.style.display = 'block';
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => ArticleNavigation.loadAdjacentArticles());
    
