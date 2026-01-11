import { db, auth } from './firebase-config.js';
import { 
    doc, 
    getDoc, 
    collection, 
    query, 
    where, 
    getDocs, 
    addDoc, 
    orderBy, 
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

export class GenericCommentsManager {
    constructor(pageId, collectionName = 'jobComments') {
        this.pageId = pageId;
        this.collectionName = collectionName;
        this.commentsPerPage = 5;
        this.currentPage = 1;
        this.totalComments = 0;
        this.init();
    }

    async init() {
        this.setupAuthStateListener();
        this.setupComments();
        this.updateCommentUIVisibility();
        await this.loadComments();
    }
    
    setupComments() {
        const commentInput = document.getElementById('commentInput');
        const charCount = document.querySelector('.char-count');
        const postButton = document.getElementById('postComment');

        if (commentInput && charCount) {
            commentInput.addEventListener('input', (e) => {
                const length = e.target.value.length;
                charCount.textContent = `${length}/500`;
            });
        }

        if (postButton) {
            postButton.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.handlePostComment();
            });
        }

        const loginLink = document.getElementById('loginRedirectLink');
        if (loginLink) {
            const returnUrl = window.location.pathname + window.location.search;
            loginLink.href = `/pages/login.html?redirect=${encodeURIComponent(returnUrl)}`;
        }
    }
    
    setupAuthStateListener() {
        auth.onAuthStateChanged(async (user) => {
            this.updateCommentUIVisibility();
            await this.loadComments();
        });
    }

    async handlePostComment() {
        if (!auth.currentUser) {
            // Toastify is assumed to be available globally or imported if module
            this.showToast('Please login to post a comment', 'error');
            return;
        }

        const commentInput = document.getElementById('commentInput');
        const content = commentInput.value.trim();

        if (!content) {
            this.showToast('Please enter a comment', 'error');
            return;
        }

        const postButton = document.getElementById('postComment');
        postButton.disabled = true;

        try {
            // Get user's first name from users collection
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            const userData = userDoc.data();
            const firstName = userData?.firstName || 'Anonymous';

            const commentsRef = collection(db, this.collectionName);
            await addDoc(commentsRef, {
                jobId: this.pageId, // Using jobId as the generic "page/content ID" field
                userId: auth.currentUser.uid,
                userName: firstName,
                content: content,
                timestamp: serverTimestamp(),
                userEmail: auth.currentUser.email
            });

            commentInput.value = '';
            document.querySelector('.char-count').textContent = '0/500';
            this.currentPage = 1;
            await this.loadComments();
            
            this.showToast("Comment posted successfully", 'success');

        } catch (error) {
            console.error('Error posting comment:', error);
            this.showToast("Failed to post comment", 'error');
        } finally {
            postButton.disabled = false;
        }
    }

    async loadComments() {
        try {
            if (!this.pageId) return;
            
            this.updateCommentUIVisibility();
            
            const commentsRef = collection(db, this.collectionName);
            
            // Get total comments count
            const countQuery = query(
                commentsRef,
                where('jobId', '==', this.pageId)
            );
            const countSnapshot = await getDocs(countQuery);
            this.totalComments = countSnapshot.size;

            // Get paginated comments
            const commentsQuery = query(
                commentsRef,
                where('jobId', '==', this.pageId),
                orderBy('timestamp', 'desc')
            );

            const commentsList = document.getElementById('commentsList');

            if (!commentsList) return;

            // Show loading state
            commentsList.innerHTML = `
                <div class="text-center p-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>`;

            const commentsSnapshot = await getDocs(commentsQuery);

            if (commentsSnapshot.empty) {
                commentsList.innerHTML = `
                    <div class="no-comments text-center text-muted p-4">
                        <i class="bi bi-chat-dots fs-4 mb-2 d-block"></i>
                        <p class="mb-0">No comments yet. ${auth.currentUser ? 'Be the first to comment!' : 'Login to comment.'}</p>
                    </div>`;
                return;
            }

            // Calculate pagination
            const startIndex = (this.currentPage - 1) * this.commentsPerPage;
            const endIndex = startIndex + this.commentsPerPage;
            const paginatedComments = commentsSnapshot.docs.slice(startIndex, endIndex);

            const commentsHTML = await Promise.all(paginatedComments.map(async docSnapshot => {
                const comment = docSnapshot.data();
                const timestamp = comment.timestamp?.toDate() || new Date();
                
                try {
                    // Get user's first name for each comment
                    const userRef = doc(db, 'users', comment.userId);
                    const userDoc = await getDoc(userRef);
                    const userData = userDoc.data();
                    const firstName = userData?.firstName || 'Anonymous';

                    const dateParts = this.formatDateParts(timestamp);
                    return `
                        <div class="comment-item animate__animated animate__fadeIn">
                            <div class="comment-row">
                                <div class="comment-content">
                                    ${this.escapeHTML(this.truncateText(String(comment.content || ''), 200))}
                                </div>
                                <div class="comment-meta">
                                    <div class="comment-author">
                                        <i class="bi bi-person-circle me-1"></i>${this.escapeHTML(firstName)}
                                    </div>
                                    <div class="comment-date">${this.escapeHTML(dateParts.relative)} • ${this.escapeHTML(dateParts.absolute)}</div>
                                </div>
                            </div>
                        </div>`;
                } catch (error) {
                    console.error('Error fetching user data:', error);
                    const dateParts = this.formatDateParts(timestamp);
                    return `
                        <div class="comment-item animate__animated animate__fadeIn">
                            <div class="comment-row">
                                <div class="comment-content">
                                    ${this.escapeHTML(this.truncateText(String(comment.content || ''), 200))}
                                </div>
                                <div class="comment-meta">
                                    <div class="comment-author">
                                        <i class="bi bi-person-circle me-1"></i>Anonymous
                                    </div>
                                    <div class="comment-date">${this.escapeHTML(dateParts.relative)} • ${this.escapeHTML(dateParts.absolute)}</div>
                                </div>
                            </div>
                        </div>`;
                }
            }));

            // Add pagination controls
            const totalPages = Math.ceil(this.totalComments / this.commentsPerPage);
            const paginationHTML = this.generatePaginationHTML(totalPages);

            commentsList.innerHTML = `
                ${commentsHTML.join('')}
                ${totalPages > 1 ? `
                    <div class="pagination-container mt-4 d-flex justify-content-center">
                        ${paginationHTML}
                    </div>
                ` : ''}
            `;

            // Add event listeners to pagination buttons
            this.setupPaginationListeners();

        } catch (error) {
            console.error('Error loading comments:', error);
            const commentsList = document.getElementById('commentsList');
            if (commentsList) {
                commentsList.innerHTML = `
                    <div class="error-message text-center text-danger p-3">
                        <i class="bi bi-exclamation-circle me-2"></i>
                        Failed to load comments. Please try again later.
                    </div>`;
            }
        }
    }

    setupPaginationListeners() {
        const paginationLinks = document.querySelectorAll('.page-link');
        paginationLinks.forEach(link => {
            link.addEventListener('click', async (e) => {
                e.preventDefault();
                const page = parseInt(link.getAttribute('data-page'));
                if (page && page !== this.currentPage) {
                    this.currentPage = page;
                    await this.loadComments();
                }
            });
        });
    }

    formatDateParts(date) {
        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        let relative;
        if (days > 0) {
            relative = `${days} day${days > 1 ? 's' : ''} ago`;
        } else if (hours > 0) {
            relative = `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else if (minutes > 0) {
            relative = `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else {
            relative = 'Just now';
        }

        const formatter = new Intl.DateTimeFormat('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata'
        });
        const parts = formatter.formatToParts(date);
        const get = (t) => parts.find(p => p.type === t)?.value || '';
        const day = get('day');
        const month = get('month');
        const year = get('year');
        const hour = get('hour');
        const minute = get('minute');
        const dayPeriod = (get('dayPeriod') || '').toUpperCase();
        const absolute = `${day} ${month} ${year}, ${hour}:${minute} ${dayPeriod}`;

        return { relative, absolute };
    }

    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    
    updateCommentUIVisibility() {
        const commentForm = document.querySelector('.comment-form');
        const loginPrompt = document.getElementById('loginPrompt');
        const isLoggedIn = !!(auth.currentUser || sessionStorage.getItem('userData'));
        if (commentForm) commentForm.style.display = isLoggedIn ? 'block' : 'none';
        if (loginPrompt) {
            if (isLoggedIn) {
                loginPrompt.remove();
            } else {
                loginPrompt.style.display = 'flex';
            }
        }
    }
    
    truncateText(str, maxLen = 200) {
        if (!str) return '';
        if (str.length <= maxLen) return str;
        return str.slice(0, maxLen).trim() + '...';
    }

    generatePaginationHTML(totalPages) {
        const maxVisible = 5;
        let start = Math.max(1, this.currentPage - 2);
        let end = Math.min(totalPages, start + maxVisible - 1);
        start = Math.max(1, end - maxVisible + 1);

        let html = '<nav aria-label="Comments pagination"><ul class="pagination pagination-sm flex-wrap justify-content-center">';
        
        // Previous button
        html += `
            <li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${this.currentPage - 1}" aria-label="Previous">
                    <i class="bi bi-chevron-left"></i>
                </a>
            </li>`;

        // First page and leading ellipsis
        if (start > 1) {
            html += `
                <li class="page-item">
                    <a class="page-link" href="#" data-page="1">1</a>
                </li>
                <li class="page-item disabled">
                    <span class="page-link">…</span>
                </li>`;
        }

        // Visible page numbers
        for (let i = start; i <= end; i++) {
            html += `
                <li class="page-item ${this.currentPage === i ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>`;
        }

        // Trailing ellipsis and last page
        if (end < totalPages) {
            html += `
                <li class="page-item disabled">
                    <span class="page-link">…</span>
                </li>
                <li class="page-item">
                    <a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a>
                </li>`;
        }

        // Next button
        html += `
            <li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${this.currentPage + 1}" aria-label="Next">
                    <i class="bi bi-chevron-right"></i>
                </a>
            </li>
        </ul></nav>`;
        return html;
    }

    showToast(message, type = 'info') {
        if (typeof Toastify !== 'undefined') {
            const bg = type === 'error' 
                ? "linear-gradient(to right, #ff5f6d, #ffc371)"
                : "linear-gradient(to right, #00b09b, #96c93d)";
            
            Toastify({
                text: message,
                duration: 3000,
                gravity: "top",
                position: "right",
                style: { background: bg }
            }).showToast();
        } else {
            console.log(`Toast: ${message} (${type})`);
        }
    }
}
