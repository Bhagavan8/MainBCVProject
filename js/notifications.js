import { auth, db } from './firebase-config.js';
import { collection, query, where, orderBy, limit, getDocs, doc, updateDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

class NotificationManager {
    constructor() {
        this.userId = null;
        this.notifications = [];
        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            // Change the selector to match the notifications link in settings
            const notificationBtn = document.querySelector('.accordion-content a[href="#"]');
            if (notificationBtn) {
                notificationBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.toggleNotifications();
                });
            }
            
            // Initialize Firebase Auth listener
            auth.onAuthStateChanged((user) => {
                if (user) {
                    this.setUserId(user.uid);
                } else {
                    this.userId = null;
                    this.notifications = [];
                    this.updateNotificationUI();
                }
            });
        });
    }

    setUserId(userId) {
        this.userId = userId;
        this.loadNotifications();
    }

    async loadNotifications() {
        try {
            // Use the correct Firestore v9 syntax
            const notificationsRef = collection(db, 'notifications');
            const q = query(
                notificationsRef,
                where('userId', '==', this.userId),
                orderBy('timestamp', 'desc'),
                limit(1)
            );

            const snapshot = await getDocs(q);
            this.notifications = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            this.updateNotificationUI();
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    }

    toggleNotifications() {
        const notificationPanel = document.querySelector('.notification-panel');
        if (!notificationPanel) {
            this.createNotificationPanel();
        } else {
            notificationPanel.classList.toggle('hidden');
        }
    }

    createNotificationPanel() {
        const accordionContent = document.querySelector('.accordion-content');
        const panel = document.createElement('div');
        panel.className = 'notification-panel mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700';
        
        const header = document.createElement('div');
        header.className = 'flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 rounded-t-lg';
        header.innerHTML = `
            <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Recent Notifications</h3>
            <button class="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-200" onclick="notificationManager.markAllAsRead()">
                Mark all as read
            </button>
        `;
        
        const content = document.createElement('div');
        content.className = 'notifications-container max-h-[300px] overflow-y-auto p-2 space-y-2';
        
        if (this.notifications.length === 0) {
            content.innerHTML = `
                <div class="text-center py-4 text-gray-500 dark:text-gray-400">
                    <i class="bi bi-bell text-2xl mb-2"></i>
                    <p class="text-sm">No notifications yet</p>
                </div>
            `;
        } else {
            this.notifications.forEach(notification => {
                content.appendChild(this.createNotificationItem(notification));
            });
        }
        
        panel.appendChild(header);
        panel.appendChild(content);
        accordionContent.appendChild(panel);
    }

    createNotificationItem(notification) {
        const item = document.createElement('div');
        item.className = `notification-item rounded-lg p-3 ${notification.read ? 'bg-gray-50 dark:bg-gray-700' : 'bg-blue-50 dark:bg-gray-600'} hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-200 cursor-pointer`;
        
        const timeAgo = this.getTimeAgo(new Date(notification.timestamp));
        
        item.innerHTML = `
            <div class="flex items-start gap-3">
                <div class="notification-icon shrink-0 ${this.getNotificationIconClass(notification.type)}">
                    <i class="${this.getNotificationIcon(notification.type)}"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm text-gray-900 dark:text-gray-100 font-medium mb-1">${notification.title || 'Notification'}</p>
                    <p class="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">${notification.message}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${timeAgo}</p>
                </div>
                ${!notification.read ? '<span class="shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></span>' : ''}
            </div>
        `;
        
        item.addEventListener('click', () => this.markAsRead(notification.id));
        return item;
    }

    getNotificationIcon(type) {
        const icons = {
            'account_created': 'bi bi-person-plus',
            'profile_view': 'bi bi-eye',
            'job_match': 'bi bi-briefcase',
            'message': 'bi bi-chat',
            'application_status': 'bi bi-file-earmark-text'
        };
        return icons[type] || 'bi bi-bell';
    }

    getNotificationIconClass(type) {
        const classes = {
            'account_created': 'bg-green-100 text-green-600',
            'profile_view': 'bg-blue-100 text-blue-600',
            'job_match': 'bg-purple-100 text-purple-600',
            'message': 'bg-yellow-100 text-yellow-600',
            'application_status': 'bg-red-100 text-red-600'
        };
        return `w-8 h-8 rounded-full flex items-center justify-center ${classes[type] || 'bg-gray-100 text-gray-600'}`;
    }

    async markAsRead(notificationId) {
        try {
            // Use the correct Firestore v9 syntax
            const notificationRef = doc(db, 'notifications', notificationId);
            await updateDoc(notificationRef, {
                read: true
            });
            
            const notification = this.notifications.find(n => n.id === notificationId);
            if (notification) {
                notification.read = true;
                this.updateNotificationUI();
            }
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }

    async markAllAsRead() {
        try {
            // Use the correct Firestore v9 syntax
            const batch = writeBatch(db);
            
            this.notifications.forEach(notification => {
                if (!notification.read) {
                    const notificationRef = doc(db, 'notifications', notification.id);
                    batch.update(notificationRef, { read: true });
                }
            });
            
            await batch.commit();
            this.notifications.forEach(n => n.read = true);
            this.updateNotificationUI();
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    }

    getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + ' years ago';
        
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + ' months ago';
        
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + ' days ago';
        
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + ' hours ago';
        
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + ' minutes ago';
        
        return Math.floor(seconds) + ' seconds ago';
    }

    updateNotificationUI() {
        const panel = document.querySelector('.notification-panel');
        if (panel) {
            const content = panel.querySelector('.notifications-container');
            if (content) {
                content.innerHTML = '';
                if (this.notifications.length === 0) {
                    content.innerHTML = `
                        <div class="text-center py-4 text-gray-500 dark:text-gray-400">
                            <i class="bi bi-bell text-2xl mb-2"></i>
                            <p class="text-sm">No notifications yet</p>
                        </div>
                    `;
                } else {
                    this.notifications.forEach(notification => {
                        content.appendChild(this.createNotificationItem(notification));
                    });
                }
            }
        }
    }
}

// Initialize the notification manager
const notificationManager = new NotificationManager();

// Export for use in other files
export default notificationManager;