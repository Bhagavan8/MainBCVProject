import { db } from './firebase-config.js';
import { collection, query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'new-job-notification';
    notification.innerHTML = `
        <span class="notification-dot"></span>
        <i class="bi bi-arrow-up-circle-fill"></i>
        <span>New Job Posted</span>
    `;
    document.body.appendChild(notification);

    let latestJobTimestamp = null;
    let initialLoad = true;
    let newJobLink = '';
    let unsubscribeFuncs = [];

    // Collections mapping to URL type parameter
    const collections = {
        'jobs': 'private',
        'governmentJobs': 'government',
        'bankJobs': 'bank'
    };
    
    // Helper to setup listener
    const setupListener = (collectionName, typeParam) => {
        try {
            const q = query(
                collection(db, collectionName),
                orderBy('createdAt', 'desc'),
                limit(1)
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                if (!snapshot.empty) {
                    const doc = snapshot.docs[0];
                    const data = doc.data();
                    
                    // Handle timestamp (Firestore timestamp or Date)
                    let createdAt;
                    if (data.createdAt && typeof data.createdAt.toDate === 'function') {
                        createdAt = data.createdAt.toDate();
                    } else if (data.createdAt) {
                        createdAt = new Date(data.createdAt);
                    } else {
                        createdAt = new Date();
                    }

                    if (initialLoad) {
                        // On first load, just establish the baseline
                         if (!latestJobTimestamp || createdAt > latestJobTimestamp) {
                            latestJobTimestamp = createdAt;
                        }
                    } else {
                        // Real-time update
                        if (latestJobTimestamp && createdAt > latestJobTimestamp) {
                            console.log('New job detected:', collectionName, doc.id);
                            latestJobTimestamp = createdAt;
                            
                            // Construct link
                            newJobLink = `/html/job-details.html?id=${doc.id}&type=${typeParam}`;
                            
                            // Update text based on type? Optional.
                            // notification.querySelector('span:last-child').textContent = `New ${typeParam} Job`;

                            showNotification();
                        }
                    }
                }
            }, (error) => {
                console.error(`Error listening to ${collectionName}:`, error);
            });
            
            unsubscribeFuncs.push(unsubscribe);

        } catch (err) {
            console.error(`Setup failed for ${collectionName}:`, err);
        }
    };

    // Start listeners for all collections
    Object.entries(collections).forEach(([col, type]) => setupListener(col, type));

    // Disable initial load flag after a short delay (allow initial snapshots to fire)
    setTimeout(() => {
        initialLoad = false;
        console.log('Notification system armed. Latest timestamp:', latestJobTimestamp);
    }, 2500);

    // Click handler
    notification.addEventListener('click', () => {
        if (newJobLink) {
            window.location.href = newJobLink;
        }
    });

    function showNotification() {
        notification.classList.add('show');
        
        // Auto-hide after 10 seconds? Maybe keep it until clicked.
        // setTimeout(() => notification.classList.remove('show'), 10000);
    }
    
    // Cleanup on unload (optional for single page, good for SPA)
    window.addEventListener('unload', () => {
        unsubscribeFuncs.forEach(unsub => unsub());
    });
});
