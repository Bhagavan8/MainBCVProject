import { db } from './firebase-config.js';
import {
    collection,
    query,
    where,
    getDocs,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

class JobFollowPopup {
    constructor() {
        this.popupShown = false;
        this.popupInterval = 120000; // 2 minutes in milliseconds
        this.autoCloseTimeout = 60000; // 1 minute in milliseconds
        this.init();
    }

    async init() {
        await this.fetchStats();
        this.createPopupElement();
        this.showInitialPopup();
        this.setupIntervalPopup();
        this.setupCloseHandler();
    }

    async fetchStats() {
        try {
            // Get total jobs count
            const jobsSnapshot = await getDocs(collection(db, 'jobs'));
            const totalJobs = jobsSnapshot.size;

            // Get companies from companies collection
            const companiesSnapshot = await getDocs(collection(db, 'companies'));
            const companiesFromDb = companiesSnapshot.size;

            // Get unique companies from jobs collection (legacy data)
            const jobsWithoutCompanyId = jobsSnapshot.docs.filter(doc => !doc.data().companyId);
            const legacyCompanyNames = jobsWithoutCompanyId.map(doc => doc.data().companyName);
            const uniqueLegacyCompanies = [...new Set(legacyCompanyNames)];
            const legacyCompaniesCount = uniqueLegacyCompanies.length;

            // Total unique companies (combine both counts)
            const totalCompanies = companiesFromDb + legacyCompaniesCount;

            this.stats = {
                totalJobs,
                totalCompanies
            };
            
        } catch (error) {
            console.error('Error fetching stats:', error);
            this.stats = {
                totalJobs: 0,
                totalCompanies: 0
            };
        }
    }

    createPopupElement() {
        const popupHTML = `
            <div id="jobFollowPopup" class="job-follow-popup">
                <div class="popup-content">
                    <button class="close-btn-pop" id="popupCloseBtn">
                        <i class="bi bi-x-lg"></i>
                    </button>
                    <div class="popup-header">
                        <i class="bi bi-bell-fill pulse-icon"></i>
                        <h3>Stay Updated!</h3>
                    </div>
                    
                    <div class="social-stats">
                        <div class="stat-item">
                            <div class="stat-number">${this.stats.totalJobs}</div>
                            <div class="stat-label">Total Jobs</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number">${this.stats.totalCompanies}</div>
                            <div class="stat-label">Companies</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number">24/7</div>
                            <div class="stat-label">Support</div>
                        </div>
                    </div>

                    <p>Join our community for exclusive job updates and career opportunities!</p>
                    
                    <div class="social-buttons">
                        <a href="https://chat.whatsapp.com/HyIFJGSIBru1AmgQuRHwI8" target="_blank" class="social-btn whatsapp">
                            <i class="bi bi-whatsapp"></i>
                            WhatsApp Community
                        </a>
                        <a href="https://t.me/bcvworld" target="_blank" class="social-btn telegram">
                            <i class="bi bi-telegram"></i>
                            Telegram Channel
                        </a>
                        <a href="https://www.linkedin.com/company/bcvworld" target="_blank" class="social-btn linkedin">
                            <i class="bi bi-linkedin"></i>
                            LinkedIn Page
                        </a>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', popupHTML);
    }

    setupCloseHandler() {
        const closeBtn = document.getElementById('popupCloseBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hidePopup());
        }

        // Add touch event handler for mobile
        const popup = document.getElementById('jobFollowPopup');
        if (popup) {
            popup.addEventListener('touchstart', (e) => {
                if (e.target.closest('.close-btn')) {
                    e.preventDefault();
                    this.hidePopup();
                }
            });
        }
    }

    showInitialPopup() {
        setTimeout(() => {
            this.showPopup();
        }, 60000); // Changed from 1000 to 60000 (1 minute)
    }

    setupIntervalPopup() {
        setInterval(() => {
            if (!this.popupShown) {
                this.showPopup();
            }
        }, this.popupInterval);
    }

    showPopup() {
        if (!this.popupShown) {
            const popup = document.getElementById('jobFollowPopup');
            popup.classList.add('show');
            this.popupShown = true;

            // Auto-close after 1 minute
            setTimeout(() => {
                this.hidePopup();
            }, this.autoCloseTimeout);
        }
    }

    hidePopup() {
        const popup = document.getElementById('jobFollowPopup');
        popup.classList.remove('show');
        this.popupShown = false;
    }
}

// Initialize the popup
const jobFollowPopup = new JobFollowPopup();