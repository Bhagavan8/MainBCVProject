import { db } from './firebase-config.js';
import { collection, query, where, orderBy, doc,limit, getDocs, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

class NotificationManager {
    constructor() {
        this.container = document.querySelector('.notification-container');
        this.jobIndex = 0;
        this.jobs = [];
        this.initialize();
    }

    async initialize() {
        // Initial load with 1.5 minutes delay
        await this.fetchJobs();
        setTimeout(() => {
            this.showNextJob();
            
            // Set up the regular interval after the initial delay
            setInterval(async () => {
                await this.fetchJobs();
                this.showNextJob();
            }, 60 * 1000); // Changed to 1 minute interval
        }, 90000); // 1.5 minutes = 90000 milliseconds
    }

    async fetchJobs() {
        try {
            const jobsQuery = query(
                collection(db, 'jobs'),
                where('jobType', '==', 'private'),
                where('isActive', '==', true),
                orderBy('createdAt', 'desc'),
                limit(3)
            );

            const querySnapshot = await getDocs(jobsQuery);
            if (!querySnapshot.empty) {
                this.jobs = await Promise.all(querySnapshot.docs.map(async (docSnapshot) => {  // Changed variable name
                    const jobData = docSnapshot.data();
                    const jobId = docSnapshot.id;
                    
                    // Initialize companyName before the if block
                    let companyName = jobData.companyName || 'Unknown Company';
                    
                    if (jobData.companyId) {
                        try {
                            const companyRef = doc(db, 'companies', jobData.companyId);  // Now doc function works
                            const companyDoc = await getDoc(companyRef);
                            if (companyDoc.exists()) {
                                const companyData = companyDoc.data();
                                companyName = companyData.name || companyName;
                            }
                        } catch (error) {
                            console.error('Error fetching company details:', error);
                        }
                    }
                    
                    return {
                        id: jobId,
                        title: jobData.jobTitle,
                        companyName: companyName,
                        createdAt: jobData.createdAt
                    };
                }));
            }
        } catch (error) {
            console.error('Error fetching jobs:', error);
        }
    }

    showNextJob() {
        if (this.jobs.length === 0) return;

        // Remove existing notification if any
        const existingNotif = document.querySelector('.notification');
        if (existingNotif) {
            existingNotif.style.animation = 'slideOut 0.4s forwards';
            setTimeout(() => existingNotif.remove(), 400);
        }

        // Get next job in rotation
        const job = this.jobs[this.jobIndex];
        this.jobIndex = (this.jobIndex + 1) % this.jobs.length;

        // Create new notification after a small delay
        setTimeout(() => {
            this.createNotification({
                icon: '💼',
                title: 'New Job Opening',
                message: `${job.title} at ${job.companyName}`,
                actionText: 'View Job',
                actionUrl: `/html/job-details.html?id=${job.id}&type=private`,
                theme: 'job',
                createdAt: this.formatDate(job.createdAt)
            });
        }, 500);
    }

    formatDate(timestamp) {
        if (!timestamp) return 'Date not available';

        let date;
        if (timestamp.toDate && typeof timestamp.toDate === 'function') {
            date = timestamp.toDate();
        } else if (timestamp.seconds) {
            date = new Date(timestamp.seconds * 1000);
        } else {
            date = new Date(timestamp);
        }

        // Format the date directly in IST timezone
        const options = {
            timeZone: 'Asia/Kolkata',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
           
        };

        return date.toLocaleString('en-US', options);
    }

    createNotification({ icon, title, message, actionText, actionUrl, theme, createdAt }) {
        const existingNotifs = document.querySelectorAll('.notification');
        // Keep only the 3 most recent notifications
        if (existingNotifs.length >= 3) {
            existingNotifs[0].remove(); // Remove the oldest notification
        }

        const notification = document.createElement('div');
        notification.className = `notification ${theme}-theme`;
        notification.innerHTML = `
            <div class="notification-header">
                <h3 class="notification-title">
                    <span class="notification-icon">${icon}</span>
                    ${title}
                </h3>
                <button class="close-btn">×</button>
            </div>
            <div class="notification-body">
                ${message}
            </div>
            <div class="notification-footer">
                <a href="${actionUrl}" class="action-btn-banner">${actionText}</a>
                <span class="timestamp">${createdAt}</span>
            </div>
            <div class="progress-bar">
                <div class="progress"></div>
            </div>
        `;

        this.container.appendChild(notification);
        
        notification.querySelector('.close-btn').addEventListener('click', () => {
            notification.style.animation = 'slideOut 0.4s forwards';
            setTimeout(() => notification.remove(), 400);
        });

        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOut 0.4s forwards';
                setTimeout(() => notification.remove(), 400);
            }
        }, 60 * 1000); // Changed to 1 minute auto-close
    }
}

// Initialize notification manager
const notificationManager = new NotificationManager();