import { db } from './firebase-config.js';
import { collection, query, where, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

class NotificationManager {
    constructor() {
        this.container = document.querySelector('.notification-container');
        this.initialize();
    }

    async initialize() {
        // Initial load
        await this.showJobNotification();
        
        // Refresh every 3 minutes
        setInterval(() => {
            this.showJobNotification();
        }, 3 * 60 * 1000);
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

        return date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }

    async showJobNotification() {
        try {
            const jobsQuery = query(
                collection(db, 'jobs'),
                where('jobType', '==', 'private'),
                where('isActive', '==', true),
                orderBy('createdAt', 'desc'),
                limit(1)
            );

            const querySnapshot = await getDocs(jobsQuery);
            if (!querySnapshot.empty) {
                const jobData = querySnapshot.docs[0].data();
                const jobId = querySnapshot.docs[0].id;
                
                this.createNotification({
                    icon: '💼',
                    title: 'New Job Opening',
                    message: `${jobData.jobTitle} at ${jobData.companyName}`,
                    actionText: 'View Job',
                    actionUrl: `/html/job-details.html?id=${jobId}&type=private`,
                    theme: 'job',
                    createdAt: this.formatDate(jobData.createdAt)
                });
            }
        } catch (error) {
            console.error('Error fetching job:', error);
        }
    }

    createNotification({ icon, title, message, actionText, actionUrl, theme, createdAt }) {
        const existingNotif = document.querySelector('.notification');
        if (existingNotif) {
            existingNotif.remove();
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
        }, 3 * 60 * 1000);
    }
}

// Initialize notification manager
const notificationManager = new NotificationManager();