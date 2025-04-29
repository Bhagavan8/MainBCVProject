import { db,auth } from './firebase-config.js';
import { 
    doc, 
    updateDoc, 
    setDoc,
    increment,
    collection,
    query,
    orderBy ,
    getDocs,
    getDoc,addDoc 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

async function updateViewCount() {
    // Get the current page URL to determine which job fair
    const currentPage = window.location.pathname;
    const pageId = currentPage.includes('chennai') ? 'job-fair-chennai-may2025' : 'job-fair-bangalore-may2025';
    const viewsRef = doc(db, 'pageViews', pageId);
    
    try {
        // First check if document exists
        const docSnap = await getDoc(viewsRef);
        
        if (!docSnap.exists()) {
            // Create document if it doesn't exist
            await setDoc(viewsRef, {
                id: pageId,
                views: 1
            });
        } else {
            // Update existing document
            await updateDoc(viewsRef, {
                views: increment(1)
            });
        }
        
        // Get updated view count
        const updatedDoc = await getDoc(viewsRef);
        if (updatedDoc.exists()) {
            document.getElementById('viewCount').textContent = updatedDoc.data().views;
        }
    } catch (error) {
        // Handle permission error gracefully
        console.error("Error updating view count:", error);
        const currentCount = document.getElementById('viewCount').textContent;
        // Keep the current count or set to 1 if no count exists
        document.getElementById('viewCount').textContent = currentCount || '1';
    }
}

// Function to get last updated time
function updateLastUpdated() {
    const now = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('lastUpdated').textContent = now.toLocaleDateString('en-US', options);
}

// Function to fetch comments count
async function fetchCommentsCount() {
    // Get the current page URL to determine which job fair
    const currentPage = window.location.pathname;
    const collectionName = currentPage.includes('chennai') ? 'jobfaircomments_chennai' : 'jobfaircomments_bangalore';
    
    try {
        const q = query(collection(db, collectionName));
        const snapshot = await getDocs(q);
        document.getElementById('commentCount').textContent = snapshot.size;
    } catch (error) {
        console.error("Error fetching comments count:", error);
        document.getElementById('commentCount').textContent = '0';
    }
}

// Function to handle comments
async function setupComments() {
    const commentInput = document.getElementById('commentInput');
    const commentForm = document.getElementById('commentForm');
    const loginPrompt = document.getElementById('loginPrompt');
    const commentFormContent = document.getElementById('commentFormContent');
    const commentsList = document.getElementById('commentsList');
    
    // Determine which collection to use based on the current page
    const currentPage = window.location.pathname;
    const collectionName = currentPage.includes('chennai') ? 'jobfaircomments_chennai' : 'jobfaircomments_bangalore';

    // Check if required elements exist before proceeding
    if (!commentsList) {
        console.warn('Comments list element not found');
        return;
    }

    // Check auth state
    auth.onAuthStateChanged(user => {
        if (user) {
            if (loginPrompt) loginPrompt.style.display = 'none';
            if (commentFormContent) commentFormContent.style.display = 'block';
        } else {
            if (loginPrompt) loginPrompt.style.display = 'block';
            if (commentFormContent) commentFormContent.style.display = 'none';
        }
    });

    // Handle character count
    if (commentInput) {
        commentInput.addEventListener('input', () => {
            const length = commentInput.value.length;
            const charCount = document.querySelector('.char-count');
            if (charCount) {
                charCount.textContent = `${length}/500`;
            }
        });
    }

    // Handle form submission
    if (commentForm) {
        commentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!auth.currentUser) {
                alert('Please login to post a comment');
                return;
            }

            if (!commentInput || !commentInput.value.trim()) {
                alert('Please enter a comment');
                return;
            }

            const content = commentInput.value.trim();

            try {
                // Add comment to Firebase using the appropriate collection
                await addDoc(collection(db, collectionName), {
                    userId: auth.currentUser.uid,
                    userName: auth.currentUser.displayName || 'Anonymous',
                    content: content,
                    timestamp: new Date()
                });

                // Clear input
                commentInput.value = '';
                const charCount = document.querySelector('.char-count');
                if (charCount) {
                    charCount.textContent = '0/500';
                }
                
                // Refresh comments
                loadComments();
                
            } catch (error) {
                console.error('Error posting comment:', error);
                alert('Failed to post comment. Please try again.');
            }
        });
    }

    // Initial load of comments
    loadComments();
}

// Function to load comments
async function loadComments() {
    const commentsList = document.getElementById('commentsList');
    if (!commentsList) return;

    // Determine which collection to use based on the current page
    const currentPage = window.location.pathname;
    const collectionName = currentPage.includes('chennai') ? 'jobfaircomments_chennai' : 'jobfaircomments_bangalore';

    try {
        const commentsQuery = query(
            collection(db, collectionName),
            orderBy('timestamp', 'desc')
        );

        const snapshot = await getDocs(commentsQuery);
        
        if (snapshot.empty) {
            commentsList.innerHTML = '<p class="text-center text-muted">No comments yet. Be the first to comment!</p>';
            return;
        }

        const commentsHTML = await Promise.all(snapshot.docs.map(async doc => {
            const comment = doc.data();
            const timestamp = comment.timestamp?.toDate() || new Date();
            
            return `
                <div class="comment-item mb-3">
                    <div class="d-flex justify-content-between">
                        <strong>${comment.userName}</strong>
                        <small class="text-muted">${formatDate(timestamp)}</small>
                    </div>
                    <p class="mb-0 mt-1">${escapeHtml(comment.content)}</p>
                </div>
            `;
        }));

        commentsList.innerHTML = commentsHTML.join('');

    } catch (error) {
        console.error('Error loading comments:', error);
        commentsList.innerHTML = '<p class="text-center text-danger">Error loading comments</p>';
    }
}

// Helper function to format date
function formatDate(date) {
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 7) {
        return date.toLocaleDateString();
    } else if (days > 0) {
        return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
        return 'Just now';
    }
}

// Helper function to escape HTML
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function handleAuthStateUI() {
    const commentFormWrapper = document.getElementById('commentFormWrapper');
    const loginPrompt = document.getElementById('loginPrompt');

    auth.onAuthStateChanged(user => {
        if (user) {
            // User is logged in
            commentFormWrapper.style.display = 'block';
            loginPrompt.style.display = 'none';
        } else {
            // User is not logged in
            commentFormWrapper.style.display = 'none';
            loginPrompt.style.display = 'block';
        }
    });
}

// Initialize everything when page loads
document.addEventListener('DOMContentLoaded', () => {
    updateViewCount();
    updateLastUpdated();
    fetchCommentsCount();
    handleAuthStateUI();
    
    // Add event listener for venue directions download
    const downloadBtn = document.getElementById('downloadVenueDirections');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Check which page we're on and call appropriate function
            if (window.location.pathname.includes('job-fair-bangalore')) {
                downloadBangaloreVenueDirections();
            } else if (window.location.pathname.includes('job-fair-chennai')) {
                downloadChennaiVenueDirections();
            }
        });
    }
});
setupComments();


export function downloadBangaloreVenueDirections() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });
    
    const venueInfo = {
        name: 'BTI Engineering College',
        address: 'Kodathi, Near Wipro, Sarjapur Road\nBangalore East Taluk, Chikkanayakanahalli\nBangalore, Karnataka 560035',
        directions: {
            metro: 'Nearest metro station is Silk Institute (10km away)',
            bus: 'BMTC buses 500A, 500B, 500C stop near the college',
            car: 'Ample parking space available within campus'
        },
        event: {
            date: 'Saturday, May 17, 2025',
            time: '8:00 AM to 2:00 PM',
            type: 'Freshers Job Fair'
        }
    };

    // Add header with styling
    doc.setFillColor(0, 123, 255);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text('Job Fair Venue Directions', 105, 20, { align: 'center' });
    doc.setFontSize(16);
    doc.text('BTI Engineering College', 105, 30, { align: 'center' });

    // Reset text color for content
    doc.setTextColor(0, 0, 0);

    // Add event details section
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Event Details', 20, 50);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(12);
    doc.text(`Date: ${venueInfo.event.date}`, 20, 60);
    doc.text(`Time: ${venueInfo.event.time}`, 20, 70);
    doc.text(`Event Type: ${venueInfo.event.type}`, 20, 80);

    // Add divider
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 90, 190, 90);

    // Add address section with styling
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Venue Address', 20, 105);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(12);
    const addressLines = venueInfo.address.split('\n');
    addressLines.forEach((line, index) => {
        doc.text(line, 20, 115 + (index * 7));
    });

    // Add divider
    doc.line(20, 140, 190, 140);

    // Add directions section with proper symbols
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('How to Reach', 20, 155);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(12);

    // Metro section with proper symbol
    doc.text('Metro:', 20, 170);
    doc.setFont(undefined, 'normal');
    doc.text(venueInfo.directions.metro, 35, 180);

    // Bus section
    doc.text('Bus:', 20, 195);
    doc.text(venueInfo.directions.bus, 35, 205);

    // Car section
    doc.text('Car:', 20, 220);
    doc.text(venueInfo.directions.car, 35, 230);

    // Add Google Maps link with better styling
    doc.setDrawColor(0, 123, 255);
    doc.setFillColor(0, 123, 255);
    doc.rect(20, 245, 170, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.text('Google Maps Location:', 30, 256);
    
    // Make the link clickable
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'normal');
    doc.textWithLink('Click here to view on Google Maps', 85, 256, {
        url: 'https://goo.gl/maps/KbYPp2xpFpZaTZVW9'
    });

    // Add footer
    doc.setTextColor(128, 128, 128);
    doc.setFontSize(10);
    doc.text('Generated by BCVWorld.com', 105, 285, { align: 'center' });

    // Save the PDF
    doc.save('BTI_College_Job_Fair_Directions.pdf');
}

export function downloadChennaiVenueDirections() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });
    
    const venueInfo = {
        name: 'Loyola Institute of Technology',
        address: 'NH4, Palanchur, Opp. Queens Land Amusement Park\nKuthambakkam, Nazareth Pet Post\nChennai – 600123',
        directions: {
            train: 'Nearest railway station is Avadi (15km away)',
            bus: 'MTC buses 70, 70A, 70C stop near the college',
            car: 'Ample parking space available within campus'
        },
        event: {
            date: 'Saturday, May 10, 2025',
            time: '8:00 AM to 2:00 PM',
            type: 'Freshers Job Fair'
        }
    };

    // Add header with styling
    doc.setFillColor(0, 123, 255);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text('Job Fair Venue Directions', 105, 20, { align: 'center' });
    doc.setFontSize(16);
    doc.text('Loyola Institute of Technology', 105, 30, { align: 'center' });

    // Reset text color for content
    doc.setTextColor(0, 0, 0);

    // Add event details section
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Event Details', 20, 50);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(12);
    doc.text(`Date: ${venueInfo.event.date}`, 20, 60);
    doc.text(`Time: ${venueInfo.event.time}`, 20, 70);
    doc.text(`Event Type: ${venueInfo.event.type}`, 20, 80);

    // Add divider
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 90, 190, 90);

    // Add address section with styling
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Venue Address', 20, 105);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(12);
    const addressLines = venueInfo.address.split('\n');
    addressLines.forEach((line, index) => {
        doc.text(line, 20, 115 + (index * 7));
    });

    // Add divider
    doc.line(20, 140, 190, 140);

    // Add directions section
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('How to Reach', 20, 155);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(12);

    // Train section
    doc.text('By Train:', 20, 170);
    doc.text(venueInfo.directions.train, 35, 180);

    // Bus section
    doc.text('By Bus:', 20, 195);
    doc.text(venueInfo.directions.bus, 35, 205);

    // Car section
    doc.text('By Car:', 20, 220);
    doc.text(venueInfo.directions.car, 35, 230);

    // Add Google Maps link with styling
    doc.setDrawColor(0, 123, 255);
    doc.setFillColor(0, 123, 255);
    doc.rect(20, 245, 170, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.text('Google Maps Location:', 30, 256);
    doc.setFont(undefined, 'normal');
    doc.textWithLink('Click here to view on Google Maps', 85, 256, {
        url: 'https://g.co/kgs/7gxn2Tb'
    });

    // Add footer
    doc.setTextColor(128, 128, 128);
    doc.setFontSize(10);
    doc.text('Generated by BCVWorld.com', 105, 285, { align: 'center' });

    // Save the PDF
    doc.save('Loyola_Institute_Job_Fair_Directions.pdf');
}
