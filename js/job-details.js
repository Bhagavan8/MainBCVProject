import { db } from './firebase-config.js';
import {
    doc,
    getDoc,
    setDoc,
    collection,
    query,
    where,
    getDocs,
    limit,
    serverTimestamp,
    updateDoc,
    orderBy,
    addDoc
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
        this.initializeRatingSystem();

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
                const averageRating = this.currentJob.averageRating || 0;
                const totalRatings = this.currentJob.totalRatings || 0;

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
            this.updateRatingDisplay(this.currentJob.averageRating || 0, this.currentJob.totalRatings || 0),
            this.renderJobDetails(this.currentJob),
            this.updateDetailsSection(this.currentJob)
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

    renderJobDetailsSection(job) {
        return `
            <div class="overview-section">
                <h4 class="section-title">
                    <i class="bi bi-briefcase"></i> 
                    <span>Job Details</span>
                </h4>
                <div class="job-details-container">
                    ${job.experience ? `
                        <div class="detail-item">
                            <i class="bi bi-briefcase"></i>
                            <span class="detail-label">Experience:</span>
                            <span class="detail-value">${this.capitalizeFirstLetter(job.experience)}</span>
                        </div>` : ''}
                    ${job.educationLevel ? `
                        <div class="detail-item">
                            <i class="bi bi-mortarboard"></i>
                            <span class="detail-label">Education:</span>
                            <span class="detail-value">${this.capitalizeEducationFirstLetter(job.educationLevel)}</span>
                        </div>` : ''}
                    ${job.location ? `
                        <div class="detail-item">
                            <i class="bi bi-geo-alt"></i>
                            <span class="detail-label">Location:</span>
                            <span class="detail-value">${this.formatLocation(job.location)}</span>
                        </div>` : ''}
                    ${job.lastDate ? `
                        <div class="detail-item">
                            <i class="bi bi-calendar"></i>
                            <span class="detail-label">Last Date:</span>
                            <span class="detail-value">${this.capitalizeFirstLetter(job.lastDate)}</span>
                        </div>` : ''}
                    ${job.salary ? `
                        <div class="detail-item">
                            <i class="bi bi-currency-rupee"></i>
                            <span class="detail-label">Salary:</span>
                            <span class="detail-value">${this.capitalizeFirstLetter(job.salary)}</span>
                        </div>` : ''}
                </div>
            </div>
        `;
    }

    initializeRatingSystem() {
        const ratingStars = document.querySelectorAll('#ratingInput .bi-star');
        ratingStars.forEach(star => {
            star.addEventListener('click', (e) => this.handleRating(e));
            star.addEventListener('mouseover', (e) => this.handleStarHover(e));
            star.addEventListener('mouseout', () => this.handleStarHoverOut());
        });
    }

    initializeCopyLink() {
        const copyLinkBtn = document.getElementById('copyLink');
        if (copyLinkBtn) {
            copyLinkBtn.addEventListener('click', () => this.handleCopyLink());
        }
    }

    handleStarHover(e) {
        const rating = parseInt(e.target.dataset.rating);
        const stars = document.querySelectorAll('#ratingInput .bi-star');
        stars.forEach((star, index) => {
            star.classList.toggle('bi-star-fill', index < rating);
            star.classList.toggle('bi-star', index >= rating);
        });
    }

    handleStarHoverOut() {
        const stars = document.querySelectorAll('#ratingInput i');
        stars.forEach(star => {
            star.classList.remove('bi-star-fill');
            star.classList.add('bi-star');
        });
    }

    async loadJobStats() {
        try {
            const ratingsQuery = query(
                collection(db, 'jobRatings'),
                where('jobId', '==', this.jobId)
            );
            const ratingsSnapshot = await getDocs(ratingsQuery);

            let totalRating = 0;
            let ratingCount = 0;

            ratingsSnapshot.forEach(doc => {
                totalRating += doc.data().rating;
                ratingCount++;
            });

            const averageRating = ratingCount > 0 ? totalRating / ratingCount : 0;

            const jobRef = doc(db, this.getCollectionName(), this.jobId);
            await updateDoc(jobRef, {
                averageRating: averageRating,
                totalRatings: ratingCount
            });

            document.getElementById('avgRating').textContent = averageRating.toFixed(1);
            document.getElementById('ratingCount').textContent = ratingCount;
            this.updateRatingDisplay(averageRating, ratingCount);

            if (auth.currentUser) {
                const userRatingDoc = await getDoc(doc(db, 'jobRatings', `${this.jobId}_${auth.currentUser.uid}`));
                if (userRatingDoc.exists()) {
                    this.disableRating();
                }
            }
        } catch (error) {
            console.error('Error loading job stats:', error);
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
        document.querySelectorAll('.tab-btn').forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.getAttribute('data-tab');
                this.switchTab(tabId);
            });
        });

        document.querySelectorAll('.share-buttons button').forEach(button => {
            button.addEventListener('click', (e) => {
                const platform = e.currentTarget.getAttribute('data-platform');
                this.handleShare(platform);
            });
        });

        document.getElementById('commentForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleComment();
        });
    }

    switchTab(tabId) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
        document.getElementById(tabId).classList.add('active');

        // Update company details when switching to company tab
        if (tabId === 'company' && this.currentJob) {
            this.updateCompanyTabContent(this.currentJob);
        }
    }

    updateCompanyTabContent(job) {
        const companyDetailLogo = document.getElementById('companyDetailLogo');
        const companyDetailName = document.getElementById('companyDetailName');
        const companyDetailAbout = document.getElementById('companyDetailAbout');
        const companyWebsite = document.getElementById('companyWebsite');

        if (this.jobType === 'bank') {
            companyDetailLogo.innerHTML = '<i class="bi bi-bank2 fs-1 text-primary"></i>';
        } else {
            const logoUrl = job.companyLogo?.startsWith('http') ?
                job.companyLogo :
                `/assets/images/companies/${job.companyLogo || 'default-company.webp'}`;
            companyDetailLogo.src = logoUrl;
            companyDetailLogo.onerror = () => {
                companyDetailLogo.src = '/assets/images/companies/default-company.webp';
            };
        }

        companyDetailName.textContent = job.companyName || job.bankName;
        companyDetailName.textContent = job.companyName || job.bankName;
        companyDetailAbout.textContent = job.aboutCompany || job.companyAbout || 'No company description available';

        if (job.companyWebsite) {
            companyWebsite.href = this.ensureHttp(job.companyWebsite);
            companyWebsite.style.display = 'inline-flex';
        } else {
            companyWebsite.style.display = 'none';
        }
    }

    getCollectionName() {
        return this.jobType === 'private' ? 'jobs' : `${this.jobType}Jobs`;
    }

    renderJobDetails(job) {
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

        const jobDescriptionEl = document.querySelector('.job-description');
        if (jobDescriptionEl) {
            const overviewContent = this.jobType === 'bank' ?
                this.renderBankOverview(job) :
                this.renderPrivateJobOverview(job).then(content => {
                    jobDescriptionEl.innerHTML = content;
                }).catch(error => {
                    console.error('Error rendering job overview:', error);
                    jobDescriptionEl.innerHTML = '<p class="text-danger">Error loading job details</p>';
                });
        }

        document.querySelectorAll('.action-btn.apply-now').forEach(button => {
            button.onclick = () => this.handleApplyClick(job);
        });
    }

    renderBankOverview(job) {
        return `
            <div class="job-overview-container">
                <div class="quick-actions">
                    <button class="action-btn apply-now" onclick="window.open('${job.applicationLink}', '_blank')">
                        <i class="bi bi-box-arrow-up-right"></i>
                        Apply Now
                    </button>
                </div>

                <div class="overview-section">
                    <h4><i class="bi bi-info-circle"></i> Key Details</h4>
                    <div class="details-grid">
                        ${this.renderDetailItem('Age Limit', job.ageLimit)}
                        ${this.renderDetailItem('Qualification', job.qualification)}
                        ${this.renderDetailItem('Vacancies', job.vacancies)}
                        ${this.renderDetailItem('Bank Type', job.bankType)}
                        ${this.renderDetailItem('Exam Date', job.examDate)}
                        ${this.renderDetailItem('Last Date', job.lastDate)}
                        ${this.renderDetailItem('State', this.formatLocation(job.location || job.state), 'bi-geo-alt', job.location || job.state)}
                    </div>
                </div>

                <div class="overview-section">
                    <h4><i class="bi bi-file-text"></i> Description</h4>
                    <div class="description-content">
                        ${this.formatDescription(job.description)}
                    </div>
                </div>

                <div class="overview-section">
                    <h4><i class="bi bi-link-45deg"></i> Important Links</h4>
                    <div class="links-container">
                        ${job.notificationFile ? `
                            <a href="${job.notificationFile}" class="important-link" target="_blank">
                                <i class="bi bi-file-pdf"></i>
                                Download Notification
                            </a>
                        ` : ''}
                        <a href="${job.applicationLink}" class="important-link" target="_blank">
                            <i class="bi bi-box-arrow-up-right"></i>
                            Apply Online
                        </a>
                    </div>
                </div>
            </div>
        `;
    }


    async renderPrivateJobOverview(job) {
        const descriptionPoints = job.description ? job.description.split('\n').filter(point => point.trim()) : [];
        const qualificationPoints = job.qualifications ?
            (Array.isArray(job.qualifications) ? job.qualifications : job.qualifications.split('\n')).filter(point => point.trim()) : [];
    
        const descriptionContent = descriptionPoints.join('\n');
        const qualificationContent = qualificationPoints.join('\n');
        const showDescription = descriptionContent !== qualificationContent;
    
        // HTML content
        const html = `
            <div class="job-overview-container animate-fade-in">
                <div class="quick-actions">
                    <button class="action-btn apply-now pulse-animation" onclick="window.open('${job.applicationLink}', '_blank')">
                        <i class="bi bi-box-arrow-up-right"></i>
                        Apply Now
                    </button>
                </div>
    
                ${showDescription ? `
                <div class="overview-section slide-in-left">
                    <h4 class="section-title">
                        <i class="bi bi-file-text gradient-icon"></i>
                        <span class="gradient-text">Job Description</span>
                    </h4>
                    <div class="description-content">
                        ${this.formatDescription(job.description)}
                    </div>
                </div>` : ''}
    
                ${this.renderJobDetailsSection(job)}
                ${this.renderSkillsSection(job)}
                ${this.renderQualificationsSection(job)}
    
                <!-- Inline AdSense ad -->
                <div class="ad-section-responsive">
                    <div class="ad-container">
                        <span class="ad-label">Sponsored</span>
                        <ins class="adsbygoogle"
                             style="display:block; text-align:center;"
                             data-ad-layout="in-article"
                             data-ad-format="fluid"
                             data-ad-client="ca-pub-6284022198338659"
                             data-ad-slot="1592614775"></ins>
                    </div>
                </div>
    
                <div class="quick-actions mt-4 text-center">
                    <button class="action-btn apply-now pulse-animation" onclick="window.open('${job.applicationLink}', '_blank')">
                        <i class="bi bi-box-arrow-up-right"></i>
                        Apply Now
                    </button>
                </div>
            </div>
        `;
    
        // Trigger ad render after DOM update
        setTimeout(() => {
            if (window.adsbygoogle && Array.isArray(window.adsbygoogle)) {
                try {
                    (adsbygoogle = window.adsbygoogle || []).push({});
                } catch (e) {
                    console.error('AdSense load failed in job overview:', e);
                }
            }
        }, 0);
    
        return html;
    }
    

    renderJobDetailsSection(job) {
        const adHtml = `
            <div class="ad-section">
                <div class="ad-box-job">
                    <strong class="ad-label">Sponsored</strong>
                    <ins class="adsbygoogle"
                        style="display:block; text-align:center;"
                        data-ad-layout="in-article"
                        data-ad-format="fluid"
                        data-ad-client="ca-pub-6284022198338659"
                        data-ad-slot="2693943458"></ins>
                </div>
            </div>
        `;
    
        const html = `
            ${adHtml}
            <div class="overview-section slide-in-left">
                <h4 class="section-title">
                    <i class="bi bi-briefcase gradient-icon"></i> 
                    <span class="gradient-text">Job Details</span>
                </h4>
                <div class="details-grid">
                    <div class="details-column">
                        ${job.experience ? this.renderDetailItem('Experience', this.capitalizeFirstLetter(job.experience), 'bi-briefcase') : ''}
                        ${job.educationLevel ? this.renderDetailItem('Education', this.capitalizeEducationFirstLetter(job.educationLevel), 'bi-mortarboard') : ''}
                        ${job.location ? this.renderDetailItem('Location', this.formatLocation(job.location), 'bi-geo-alt', job.location) : ''}
                    </div>
                    <div class="details-column">
                        ${job.lastDate ? this.renderDetailItem('Last Date', this.capitalizeFirstLetter(job.lastDate), 'bi-calendar') : ''}
                        ${job.salary ? this.renderDetailItem('Salary', this.capitalizeFirstLetter(job.salary), 'bi-currency-rupee') : ''}
                    </div>
                </div>
            </div>
        `;
    
        // Defer pushing ads into the DOM – call this AFTER injecting HTML
        setTimeout(() => {
            if (window.adsbygoogle && Array.isArray(window.adsbygoogle)) {
                try {
                    (adsbygoogle = window.adsbygoogle || []).push({});
                } catch (e) {
                    console.error('AdSense error:', e);
                }
            }
        }, 0);
    
        return html;
    }
    
   

    renderSkillsSection(job) {
        if (!job.skills) return '';
    
        // Generate the HTML
        const html = `
            <div class="community-section content-section">
                <h4 class="section-title">
                    <i class="bi bi-people-fill gradient-icon"></i> 
                    <span class="gradient-text">Join Our Community</span>
                </h4>
                <div class="community-links">
                    <a href="https://www.whatsapp.com/channel/0029VasadwXLikgEikBhWE1o" target="_blank" class="community-btn whatsapp-btn">
                        <i class="bi bi-whatsapp"></i> Join WhatsApp Group
                    </a>
                    <a href="https://t.me/bcvworld" target="_blank" class="community-btn telegram-btn">
                        <i class="bi bi-telegram"></i> Join Telegram Channel
                    </a>
                </div>
            </div>
    
            <div class="overview-section content-section">
                <h4 class="section-title">
                    <i class="bi bi-tools gradient-icon"></i> 
                    <span class="gradient-text">Required Skills</span>
                </h4>
                <div class="skills-container">
                    ${job.skills.map(skill => `
                        <span class="skill-tag">
                            <i class="bi bi-check-circle-fill text-success"></i>
                            ${this.capitalizeFirstLetter(skill)}
                        </span>
                    `).join('')}
                </div>
            </div>
    
            <div class="bottom-inline-ad">
                <div class="ad-box-skills">
                    <strong>Sponsored</strong><br>
                    <ins class="adsbygoogle"
                         style="display:block; text-align:center;"
                         data-ad-layout="in-article"
                         data-ad-format="fluid"
                         data-ad-client="ca-pub-6284022198338659"
                         data-ad-slot="6058473396"></ins>
                </div>
            </div>
        `;
    
        // Activate AdSense after DOM is updated
        setTimeout(() => {
            if (window.adsbygoogle && Array.isArray(window.adsbygoogle)) {
                try {
                    (adsbygoogle = window.adsbygoogle || []).push({});
                } catch (e) {
                    console.error('AdSense error in skills section:', e);
                }
            }
        }, 0);
    
        return html;
    }

    renderQualificationsSection(job) {
        if (!job.qualifications) return '';
        return `
            <div class="overview-section content-section">
                <h4 class="section-title">
                    <i class="bi bi-award gradient-icon"></i> 
                    <span class="gradient-text">Desired Qualifications</span>
                </h4>
                <div class="qualifications-content">
                    ${this.formatQualifications(job.qualifications)}
                </div>
            </div>
        `;
    }

    formatLocation(location) {
        if (!location) return 'Location N/A';
        const formatted = this.capitalizeFirstLetter(location);
        return formatted.length > 28 ? formatted.substring(0, 28) + '...' : formatted;
    }

    renderDetailItem(label, value, iconClass, fullText) {
        if (!value) return '';

        if (label === 'Experience') {
            value = value.toLowerCase() === 'fresher' ? 'Fresher' : `${value} Years`;
        }

        return `
            <div class="detail-item">
                <i class="bi ${iconClass}"></i>
                <div class="detail-content">
                    <span class="detail-label fw-bold">${label} <span class="separator">⟫</span></span>
                    <span class="detail-value" title="${fullText || value}">${value}</span>
                </div>
            </div>
        `;
    }

    updateJobMetaInfo(job) {
        const experienceElement = document.getElementById('experience');
        if (experienceElement && job.experience) {
            experienceElement.textContent = job.experience.toLowerCase() === 'fresher' ?
                'Fresher' :
                `${job.experience} Years`;
        }
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

            if (job.applicationLink) {
                window.open(job.applicationLink, '_blank');
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

    handleRating(e) {
        if (!e?.target) return;

        const ratingValue = parseInt(e.target.dataset.rating);
        if (!ratingValue) return;

        const stars = document.querySelectorAll('#ratingInput i');
        stars.forEach((star, index) => {
            star.classList.toggle('bi-star-fill', index < ratingValue);
            star.classList.toggle('bi-star', index >= ratingValue);
        });

        this.submitRating(ratingValue);
    }

    async submitRating(rating) {
        try {
            const user = auth.currentUser;
            if (!user) {
                this.showToast('Please login to rate this job', 'warning');
                return;
            }

            const ratingRef = doc(db, 'jobRatings', `${this.jobId}_${user.uid}`);
            await setDoc(ratingRef, {
                jobId: this.jobId,
                userId: user.uid,
                rating: Number(rating),
                timestamp: serverTimestamp()
            });

            this.showToast('Rating submitted successfully!', 'success');
            await this.loadJobStats(this.jobId);
        } catch (error) {
            console.error('Error submitting rating:', error);
            this.showToast('Failed to submit rating', 'error');
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

    disableRating() {
        const ratingContainer = document.getElementById('ratingContainer');
        if (ratingContainer) {
            ratingContainer.innerHTML = '<p class="text-success">Thank you for rating this job!</p>';
        }
    }

    updateRatingDisplay(average, total) {
        const starsContainer = document.getElementById('averageRatingStars');
        const ratingValue = document.getElementById('averageRatingValue');
        const totalRatings = document.getElementById('totalRatings');

        if (!starsContainer || !ratingValue || !totalRatings) return;

        starsContainer.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
            const star = document.createElement('i');
            star.className = `bi ${i <= average ? 'bi-star-fill' : 'bi-star'}`;
            starsContainer.appendChild(star);
        }

        ratingValue.textContent = average.toFixed(1);
        totalRatings.textContent = `(${total} ${total === 1 ? 'rating' : 'ratings'})`;
    }

    updateDetailsSection(job) {
        const detailsContainer = document.querySelector('.job-details-container');
        if (!detailsContainer) return;

        if (job.companyWebsite) {
            const websiteLink = detailsContainer.querySelector('.company-website');
            if (websiteLink) {
                websiteLink.href = job.companyWebsite;
            }
        }

        if (job.lastDate) {
            const deadlineElement = detailsContainer.querySelector('.application-deadline');
            if (deadlineElement) {
                deadlineElement.textContent = new Date(job.lastDate).toLocaleDateString();
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

    getAnonymousViewerId() {
        let anonymousId = localStorage.getItem('anonymousViewerId');
        if (!anonymousId) {
            anonymousId = 'anonymous_' + Date.now() + '_' + Math.random().toString(36).substring(2);
            localStorage.setItem('anonymousViewerId', anonymousId);
        }
        return anonymousId;
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

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const jobId = urlParams.get('id');
    if (!jobId) {
        window.location.href = '/html/jobs.html';
        return;
    }
    new JobDetailsManager();
});

window.handleNewsletterSubmit = async (event) => {
    event.preventDefault();
    const emailInput = document.getElementById('newsletterEmail');
    const submitButton = event.target.querySelector('button[type="submit"]');
    const email = emailInput.value.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('Please enter a valid email address', false);
        return;
    }

    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Checking...';

    try {
        const q = query(collection(db, "subscriptions"), where("email", "==", email));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            showToast('You are already subscribed! Thank you.', false);
            return;
        }

        submitButton.textContent = 'Subscribing...';
        await addDoc(collection(db, "subscriptions"), {
            email: email,
            subscriptionDate: serverTimestamp(),
            active: true,
            source: 'website'
        });

        emailInput.value = '';
        showToast('Thank you for subscribing! You will receive our latest updates.');
    } catch (error) {
        console.error("Error processing subscription: ", error);
        showToast('Subscription failed. Please try again.', false);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
    }
};

function showToast(message, isSuccess = true) {
    const toast = document.createElement('div');
    toast.className = `custom-toast ${isSuccess ? 'success' : 'error'}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

window.toggleCompanyJobs = function (companyName) {
    const elementId = `jobs-${companyName.replace(/\s+/g, '-')}`;
    const jobsContainer = document.getElementById(elementId);
    const toggleIcon = jobsContainer.previousElementSibling.querySelector('.toggle-icon');

    if (jobsContainer.style.display === 'none') {
        jobsContainer.style.display = 'block';
        toggleIcon.classList.replace('bi-chevron-down', 'bi-chevron-up');
    } else {
        jobsContainer.style.display = 'none';
        toggleIcon.classList.replace('bi-chevron-up', 'bi-chevron-down');
    }
};
