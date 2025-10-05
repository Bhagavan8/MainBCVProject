import { db } from './firebase-config.js';
import {
    doc,
    getDoc,
    updateDoc,
    serverTimestamp,
    setDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
const auth = getAuth();

class JobDetailsManager {
    constructor() {
        if (typeof JobDetailsManager.instance === 'object') {
            return JobDetailsManager.instance;
        }

        JobDetailsManager.instance = this;
        this.jobId = new URLSearchParams(window.location.search).get('id');
        this.jobType = new URLSearchParams(window.location.search).get('type');
        this.currentJob = null;
        this.currentCompany = null;
        this.viewsTracked = false;
        this.cache = new Map(); // Add cache for job and company data

        this.init();
        this.initializeCopyLink();

        return this;
    }

    async init() {
        await this.loadJobDetails();
        if (this.currentJob) {
            this.setupEventListeners();
        }
    }

    async loadJobDetails() {
        try {
            if (!this.jobId || !this.jobType) {
                console.log('Missing job ID or type');
                window.location.href = '/html/jobs.html';
                return;
            }

            // Check cache first
            const cacheKey = `job_${this.jobId}`;
            if (this.cache.has(cacheKey)) {
                const cachedData = this.cache.get(cacheKey);
                this.currentJob = cachedData.job;
                this.currentCompany = cachedData.company;
                await this.updateUI();
                return;
            }

            const jobRef = doc(db, this.getCollectionName(), this.jobId);
            const jobDoc = await getDoc(jobRef);

            if (jobDoc.exists()) {
                this.currentJob = jobDoc.data();

                // Update cache
                this.cache.set(cacheKey, {
                    job: this.currentJob,
                    timestamp: Date.now()
                });

                // Parallel loading of non-critical data
                this.updateViewCount(jobRef).catch(console.error); // Non-blocking

                await this.updateUI();
            } else {
                console.log('Job not found');
                window.location.href = '/html/jobs.html';
            }
        } catch (error) {
            console.error('Error loading job details:', error);
            this.showToast('Failed to load job details', 'error');
        }
    }

    async updateUI() {
        await Promise.all([
            this.fetchAndMergeCompanyData(),
            this.updateJobHeaderDetails(this.currentJob),
            this.updateJobContentSections(this.currentJob)
        ]);

        if (this.currentCompany) {
            this.updateCompanyDisplay(this.currentCompany);
        }
        this.setupEventListeners();
    }

    async fetchAndMergeCompanyData() {
        const companyId = this.currentJob.companyId;
        if (!companyId) {
            this.currentCompany = this.createDefaultCompanyObject();
            return;
        }

        try {
            // Check company cache
            const companyCacheKey = `company_${companyId}`;
            if (this.cache.has(companyCacheKey)) {
                this.currentCompany = this.cache.get(companyCacheKey);
                return;
            }

            const companyRef = doc(db, 'companies', companyId);
            const companyDoc = await getDoc(companyRef);

            this.currentCompany = companyDoc.exists()
                ? { ...companyDoc.data(), about: companyDoc.data().about || '' }
                : this.createDefaultCompanyObject();

            // Cache company data
            this.cache.set(companyCacheKey, this.currentCompany);

            // Update job data with company info
            if (companyDoc.exists()) {
                this.updateJobWithCompanyInfo();
            }
        } catch (error) {
            console.error('Error loading company details:', error);
            this.currentCompany = this.createDefaultCompanyObject();
        }
    }

    createDefaultCompanyObject() {
        return {
            name: this.currentJob.companyName,
            logoURL: this.currentJob.companyLogo,
            website: this.currentJob.companyWebsite,
            about: this.currentJob.aboutCompany || this.currentJob.companyAbout || ''
        };
    }

    updateJobWithCompanyInfo() {
        this.currentJob = {
            ...this.currentJob,
            companyName: this.currentCompany.name,
            companyLogo: this.currentCompany.logoURL,
            companyWebsite: this.currentCompany.website,
            companyAbout: this.currentCompany.about
        };
    }

    updateCompanyDisplay(company) {
        const logoContainer = document.getElementById('companyLogo');
        if (logoContainer) {
            if (this.jobType === 'bank') {
                logoContainer.innerHTML = '<i class="bi bi-bank2 fs-1 text-primary"></i>';
            } else if (company.logoURL) {
                logoContainer.innerHTML = `
                    <img src="${company.logoURL}" 
                         alt="${company.name} Logo" 
                         class="company-logo"
                         onerror="this.src='/assets/images/companies/default-company.webp'">`;
            } else {
                logoContainer.innerHTML = '<i class="bi bi-building fs-1 text-secondary"></i>';
            }
        }

        const companyNameEl = document.getElementById('companyName');
        if (companyNameEl) {
            companyNameEl.textContent = company.name || 'Company Name Not Available';
            if (company.website) {
                companyNameEl.innerHTML = `
                    <a href="${this.ensureHttp(company.website)}" 
                       target="_blank" 
                       rel="noopener noreferrer">
                        ${company.name}
                    </a>`;
            }
        }

        const aboutSection = document.querySelector('.company-about-section');
        if (aboutSection && company.about) {
            aboutSection.innerHTML = `
                <h4>About ${company.name}</h4>
                <p>${company.about}</p>
                ${company.website ? `
                    <a href="${this.ensureHttp(company.website)}" 
                       class="company-website-link" 
                       target="_blank">
                        Visit Website <i class="bi bi-box-arrow-up-right"></i>
                    </a>
                ` : ''}
            `;
        }
    }

    ensureHttp(url) {
        if (!url) return '#';
        return url.startsWith('http') ? url : `https://${url}`;
    }

    async updateViewCount(jobRef) {
        const viewKey = `job_view_${this.jobId}`;
        const hasViewed = sessionStorage.getItem(viewKey);

        if (!hasViewed && !this.viewsTracked) {
            this.viewsTracked = true;
            sessionStorage.setItem(viewKey, 'true');
            const currentViews = this.currentJob.views || 0;

            try {
                await updateDoc(jobRef, {
                    views: currentViews + 1,
                    lastViewedAt: serverTimestamp()
                });
                this.currentJob.views = currentViews + 1;
            } catch (error) {
                console.error('Error updating view count:', error);
                sessionStorage.removeItem(viewKey);
                this.viewsTracked = false;
            }
        }
    }

    capitalizeEducationFirstLetter(string) {
        if (!string) return '';

        // First handle special combined cases with flexible matching
        const combinedCases = {
            'be/b.tech/any graduation/m.tech': 'B.E/B.Tech/Any Graduation/M.Tech',
            'b.e, btech or similar': 'B.E, B.Tech or Similar',
            'b.e/b.tech or similar': 'B.E/B.Tech or Similar',
            'b.e, btech or similar': 'B.E, B.Tech or Similar'
        };

        // Normalize the input string for comparison (lowercase and trim)
        const normalizedInput = string.toLowerCase().trim();

        // Check for combined cases first
        for (const [pattern, replacement] of Object.entries(combinedCases)) {
            if (normalizedInput === pattern.toLowerCase()) {
                return replacement;
            }
        }

        // Handle individual education levels
        const educationPatterns = {
            'master of engineering': 'Master of Engineering',
            'master of technology': 'Master of Technology',
            'bachelor of engineering': 'Bachelor of Engineering',
            'bachelor of technology': 'Bachelor of Technology',
            'b.tech': 'B.Tech',
            'b.e': 'B.E',
            'm.tech': 'M.Tech',
            'm.e': 'M.E',
            'btech': 'B.Tech',
            'mtech': 'M.Tech',
            'be': 'B.E',
            'me': 'M.E'
        };

        // Process each word separately
        return string.split(/(\s+|\/|,)/).map(part => {
            // Skip whitespace and separators
            if (/^\s+$|\/|,/.test(part)) {
                return part;
            }

            const lowerPart = part.toLowerCase();

            // Check for exact matches in education patterns
            if (educationPatterns.hasOwnProperty(lowerPart)) {
                return educationPatterns[lowerPart];
            }

            // Handle "OR" specifically
            if (lowerPart === 'or') {
                return 'or'; // keep it lowercase as it's a conjunction
            }

            // Default capitalization
            return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
        }).join('');
    }

    capitalizeFirstLetter(string) {
        if (!string) return '';

        // Handle experience format
        if (string.toLowerCase().includes('year')) {
            return string.replace(/([0-9]+)\s*years?/i, '$1 Years');
        }

        // Default capitalization
        return string.split(' ')
            .map(word => word.length === 2 ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    initializeCopyLink() {
        const copyLinkBtn = document.getElementById('copyLink');
        if (copyLinkBtn) {
            copyLinkBtn.addEventListener('click', () => this.handleCopyLink());
        }
    }

    formatDate(timestamp) {
        if (!timestamp) return 'Date not available';

        const istOffset = 5.5 * 60 * 60 * 1000;
        let date;

        if (typeof timestamp === 'string') {
            date = new Date(timestamp);
        } else if (timestamp.toDate) {
            date = timestamp.toDate();
        } else if (timestamp.seconds) {
            date = new Date(timestamp.seconds * 1000);
        } else {
            date = new Date(timestamp);
        }

        const istDate = new Date(date.getTime() + istOffset);
        const now = new Date();
        const istNow = new Date(now.getTime() + istOffset);

        const diffMs = istNow - istDate;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 60) return `${diffMins} minutes ago`;
        if (diffHours < 24) return `${diffHours} hours ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;

        return istDate.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata'
        });
    }

    setupEventListeners() {
        // Set up share buttons
        document.querySelectorAll('.share-buttons button').forEach(button => {
            button.addEventListener('click', (e) => {
                const platform = e.currentTarget.getAttribute('data-platform');
                this.handleShare(platform);
            });
        });

        // Set up apply buttons
        const applyButtons = document.querySelectorAll('.action-btn.apply-now');
        applyButtons.forEach(button => {
            button.addEventListener('click', () => this.handleApplyClick(this.currentJob));
        });
    }

    getCollectionName() {
        return this.jobType === 'private' ? 'jobs' : `${this.jobType}Jobs`;
    }

    updateJobHeaderDetails(job) {
        const jobTitleEl = document.getElementById('jobTitle');
        const companyNameEl = document.getElementById('companyName');
        const locationEl = document.getElementById('location');
        const experienceEl = document.getElementById('experience');
        const salaryEl = document.getElementById('salary');
        const salaryWrapper = document.getElementById('salaryWrapper');

        if (jobTitleEl) jobTitleEl.textContent = job.jobTitle || job.postName;

        if (companyNameEl) {
            if (job.companyWebsite) {
                companyNameEl.innerHTML = `
                    <a href="${this.ensureHttp(job.companyWebsite)}" 
                       target="_blank" 
                       rel="noopener noreferrer"
                       class="company-name-link">
                        ${job.companyName || job.bankName}
                    </a>`;
            } else {
                companyNameEl.textContent = job.companyName || job.bankName;
            }
        }

        if (locationEl) {
            const locationText = job.location || job.state;
            locationEl.textContent = locationText?.length > 28 ? locationText.substring(0, 28) + '...' : locationText;
            locationEl.title = locationText || 'Location N/A';
        }

        if (experienceEl) {
            if (job.experience?.toLowerCase() === 'fresher') {
                experienceEl.textContent = 'Fresher';
            } else if (job.experience) {
                experienceEl.textContent = `${job.experience} Years`;
            } else {
                experienceEl.textContent = 'Not specified';
            }
        }

        if (salaryEl && salaryWrapper) {
            if (job.salary?.trim()) {
                salaryEl.textContent = job.salary;
                salaryWrapper.style.display = 'inline-flex';
            } else {
                salaryWrapper.style.display = 'none';
            }
        }

        const logoContainer = document.getElementById('companyLogo');
        if (this.jobType === 'bank') {
            logoContainer.innerHTML = '<i class="bi bi-bank2 fs-1 text-primary"></i>';
        } else {
            const logoUrl = job.companyLogo?.startsWith('http') ?
                job.companyLogo :
                `/assets/images/companies/${job.companyLogo || 'default-company.webp'}`;

            logoContainer.innerHTML = `
                <img src="${logoUrl}" 
                     alt="${job.companyName} Logo" 
                     class="company-logo"
                     onerror="this.src='/assets/images/companies/default-company.webp'">`;
        }
    }

    async updateJobContentSections(job) {
        if (this.jobType === 'bank') {
            this.updateBankJobContent(job);
        } else {
            this.updatePrivateJobContent(job);
        }
    }

    updateBankJobContent(job) {
        // Update description content
        const descriptionContent = document.getElementById('descriptionContent');
        if (descriptionContent) {
            descriptionContent.innerHTML = this.formatDescription(job.description);
        }

        // Update job details
        this.updateJobDetailsSection(job);

        // Hide skills and qualifications sections for bank jobs
        const skillsSection = document.getElementById('skillsSection');
        const qualificationsSection = document.getElementById('qualificationsSection');
        
        if (skillsSection) skillsSection.style.display = 'none';
        if (qualificationsSection) qualificationsSection.style.display = 'none';

        // Update apply buttons - use ensureHttp method for consistent URL handling
        const applyButtons = document.querySelectorAll('.action-btn.apply-now');
        applyButtons.forEach(button => {
            button.onclick = () => window.open(this.ensureHttp(job.applicationLink), '_blank');
        });
    }

    updatePrivateJobContent(job) {
        // Update description content
        const descriptionContent = document.getElementById('descriptionContent');
        if (descriptionContent) {
            descriptionContent.innerHTML = this.formatDescription(job.description);
        }

        // Update job details section
        this.updateJobDetailsSection(job);

        // Update skills section
        this.updateSkillsSection(job);

        // Update qualifications section
        this.updateQualificationsSection(job);

        // Update apply buttons
        const applyButtons = document.querySelectorAll('.action-btn.apply-now');
        applyButtons.forEach(button => {
            button.onclick = () => this.handleApplyClick(job);
        });
    }

    updateJobDetailsSection(job) {
        const detailsContainer = document.getElementById('jobDetailsContainer');
        if (!detailsContainer) return;

        let html = '';
        
        if (job.experience) {
            html += `
                <div class="detail-item">
                    <span class="detail-label">Experience:</span>
                    <span class="detail-value">${this.capitalizeFirstLetter(job.experience)}</span>
                </div>`;
        }
        
        if (job.educationLevel) {
            html += `
                <div class="detail-item">
                    <span class="detail-label">Education:</span>
                    <span class="detail-value">${this.capitalizeEducationFirstLetter(job.educationLevel)}</span>
                </div>`;
        }
        
        if (job.location) {
            html += `
                <div class="detail-item">
                    <span class="detail-label">Location:</span>
                    <span class="detail-value">${this.formatLocation(job.location)}</span>
                </div>`;
        }
        
        if (job.lastDate) {
            html += `
                <div class="detail-item">
                    <span class="detail-label">Last Date:</span>
                    <span class="detail-value">${this.capitalizeFirstLetter(job.lastDate)}</span>
                </div>`;
        }
        
        if (job.salary) {
            html += `
                <div class="detail-item">
                    <span class="detail-label">Salary:</span>
                    <span class="detail-value">${this.capitalizeFirstLetter(job.salary)}</span>
                </div>`;
        }
        
        detailsContainer.innerHTML = html;
    }

    updateSkillsSection(job) {
        const skillsSection = document.getElementById('skillsSection');
        const skillsContainer = document.getElementById('skillsContainer');
        
        if (!skillsSection || !skillsContainer) return;
        
        if (!job.skills || !job.skills.length) {
            skillsSection.style.display = 'none';
            return;
        }
        
        skillsContainer.innerHTML = job.skills.map(skill => `
            <span class="skill-tag">
                ${this.capitalizeFirstLetter(skill)}
            </span>
        `).join('');
    }

    updateQualificationsSection(job) {
        const qualificationsSection = document.getElementById('qualificationsSection');
        const qualificationsContent = document.getElementById('qualificationsContent');
        
        if (!qualificationsSection || !qualificationsContent) return;
        
        if (!job.qualifications) {
            qualificationsSection.style.display = 'none';
            return;
        }
        
        qualificationsContent.innerHTML = this.formatQualifications(job.qualifications);
    }

    formatLocation(location) {
        if (!location) return 'Location N/A';
        const formatted = this.capitalizeFirstLetter(location);
        return formatted.length > 28 ? formatted.substring(0, 28) + '...' : formatted;
    }

    formatDescription(description) {
        if (!description) return '';
        const points = description.split('\n').filter(point => point.trim());
        return `
            <ul class="description-list">
                ${points.map(point => `
                    <li class="description-point">
                        ${point.trim()}
                    </li>
                `).join('')}
            </ul>
        `;
    }

    formatQualifications(qualifications) {
        if (!qualifications) return 'No specific qualifications mentioned';

        // Common technology and skill keywords to bold
        const techKeywords = [
            'JavaScript', 'Python', 'Java', 'C\\+\\+', 'React', 'Angular', 'Vue', 'Node.js',
            'AWS', 'Azure', 'Docker', 'Kubernetes', 'SQL', 'MongoDB', 'Express', 'TypeScript',
            'HTML', 'CSS', 'Git', 'REST', 'API', 'DevOps', 'CI/CD', 'Machine Learning',
            'AI', 'Cloud', 'Microservices', 'Spring Boot', '.NET', 'PHP', 'Ruby', 'Swift',
            'Kotlin', 'Android', 'iOS', 'Flutter', 'React Native', 'GraphQL', 'Redux',
            'Bootstrap', 'Sass', 'Less', 'jQuery', 'webpack', 'Babel', 'Jenkins', 'CRM', 'Agile', 'GitLab', 'OOP', 'Apache Kafka',
            'Confluent Kafka', 'Helm', 'NodeJS', 'APIs', 'JUnit', 'Selenium', 'TestNG',
            // Added education-related keywords
            'Bachelor', "Bachelor's", 'Bachelors', 'B\\.E', 'B\\.Tech', 'Computer Science', 'Engineering',
            'Masters', "Master's", 'M\\.Tech', 'M\\.E', 'Information Technology', 'IT',
            // Added role-related keywords
            'QA', 'Quality Assurance', 'Quality Analyst', 'Test Engineer', 'SDET',
            'Architect', 'Software Architect', 'Solutions Architect', 'Technical Architect',
            'Lead', 'Senior', 'Developer', 'Engineer', 'Analyst', 'Manager'
        ];

        const boldTechTerms = (text) => {
            let processedText = text;
            techKeywords.forEach(keyword => {
                const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                processedText = processedText.replace(regex, '<strong>$&</strong>');
            });
            return processedText;
        };

        if (Array.isArray(qualifications)) {
            return `
                <ul class="qualifications-list">
                    ${qualifications.map(point => `
                        <li class="qualification-point animate__animated animate__fadeIn">
                            <i class="bi bi-check2-circle text-success"></i>
                            ${boldTechTerms(point.trim())}
                        </li>
                    `).join('')}
                </ul>
            `;
        }

        if (typeof qualifications === 'string') {
            const points = qualifications.split('\n').filter(point => point.trim());
            return `
                <ul class="qualifications-list">
                    ${points.map(point => `
                        <li class="qualification-point animate__animated animate__fadeIn">
                            <i class="bi bi-check2-circle text-success"></i>
                            ${boldTechTerms(point.trim())}
                        </li>
                    `).join('')}
                </ul>
            `;
        }

        return 'Qualifications format not supported';
    }

    async handleApplyClick(job) {
        try {
            const user = auth.currentUser;
    
            if (user) {
                const applicationRef = doc(db, 'jobApplications', `${this.jobId}_${user.uid}`);
                await setDoc(applicationRef, {
                    userId: user.uid,
                    jobId: this.jobId,
                    jobType: this.jobType,
                    jobTitle: job.jobTitle || job.postName,
                    companyName: job.companyName || job.bankName,
                    appliedAt: serverTimestamp(),
                    status: 'applied'
                });
            }
    
            // Fix for Apply Now button - use ensureHttp method for consistent URL handling
            if (job.applicationLink) {
                window.open(this.ensureHttp(job.applicationLink), '_blank');
            } else {
                document.getElementById('applicationSection').classList.remove('d-none');
            }
        } catch (error) {
            console.error('Error recording application:', error);
            if (auth.currentUser) {
                this.showToast('Error recording application', 'error');
            }
        }
    }

    handleShare(platform) {
        const url = window.location.href;
        const title = document.getElementById('jobTitle').textContent;
        const shareText = `Check out this job: ${title}`;

        const shareUrls = {
            facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
            twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`,
            linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
            whatsapp: `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + url)}`
        };

        if (shareUrls[platform]) {
            window.open(shareUrls[platform], '_blank', 'width=600,height=400');
        }
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast-notification ${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="bi ${type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill'}"></i>
                <span>${message}</span>
            </div>
        `;
        document.body.appendChild(toast);

        setTimeout(() => toast.remove(), 3000);
    }

    handleCopyLink() {
        navigator.clipboard.writeText(window.location.href).then(() => {
            this.showToast('Link copied to clipboard!', 'success');
        }).catch(error => {
            console.error('Failed to copy link:', error);
            this.showToast('Failed to copy link', 'error');
        });
    }
}

// Initialize the job details manager
document.addEventListener('DOMContentLoaded', () => {
    new JobDetailsManager();
});

export { JobDetailsManager };
