import { db } from './firebase-config.js';
import {
    doc,
    getDoc,
    updateDoc,
    serverTimestamp,
    setDoc,
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs
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
        this.cache = new Map();
        this.adsInitialized = false;
        this.adContainersInitialized = new Set();

        this.loadCommonComponents();
        this.init();
        this.initializeCopyLink();

        return this;
    }

    async loadCommonComponents() {
        try {
            // Load header
            const headerResponse = await fetch('/components/header.html');
            const headerHtml = await headerResponse.text();
            document.getElementById('header-container').innerHTML = headerHtml;

            // Load footer
            const footerResponse = await fetch('/components/footer.html');
            const footerHtml = await footerResponse.text();
            document.getElementById('footer-container').innerHTML = footerHtml;

            console.log('Header and footer loaded successfully');
            
            this.initializeHeaderFooterScripts();
            
        } catch (error) {
            console.error('Error loading common components:', error);
            this.createFallbackHeaderFooter();
        }
    }

    initializeHeaderFooterScripts() {
        const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
        if (mobileMenuToggle) {
            mobileMenuToggle.addEventListener('click', () => {
                document.querySelector('.nav-menu')?.classList.toggle('active');
            });
        }
    }

    createFallbackHeaderFooter() {
        const headerContainer = document.getElementById('header-container');
        const footerContainer = document.getElementById('footer-container');
        
        if (headerContainer && !headerContainer.innerHTML.trim()) {
            headerContainer.innerHTML = `
                <nav class="navbar navbar-expand-lg navbar-light bg-light">
                    <div class="container">
                        <a class="navbar-brand" href="/">BCV World</a>
                        <a href="/html/jobs.html" class="btn btn-primary">Back to Jobs</a>
                    </div>
                </nav>
            `;
        }
        
        if (footerContainer && !footerContainer.innerHTML.trim()) {
            footerContainer.innerHTML = `
                <footer class="bg-dark text-light py-3 mt-5">
                    <div class="container text-center">
                        <p>&copy; 2024 BCV World. All rights reserved.</p>
                    </div>
                </footer>
            `;
        }
    }

    async init() {
        await this.loadJobDetails();
        if (this.currentJob) {
            this.setupEventListeners();
            this.initializeAds();
            this.setupNavigationScroll();
        }
    }

    async loadJobDetails() {
        try {
            if (!this.jobId || !this.jobType) {
                console.log('Missing job ID or type');
                window.location.href = '/html/jobs.html';
                return;
            }

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
                this.currentJob = { id: jobDoc.id, ...jobDoc.data() };

                this.cache.set(cacheKey, {
                    job: this.currentJob,
                    timestamp: Date.now()
                });

                this.updateViewCount(jobRef).catch(console.error);
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
        
        this.updateJobStats(this.currentJob);
        
        // UPDATE: Add meta tags update for social sharing
        this.updateMetaTagsForSharing(this.currentJob);
        
        // NEW: Load before/after jobs navigation
        await this.loadBeforeAfterJobs();
        
        this.initializeSocialShare();
        this.setupEventListeners();
        
        console.log('UI updated successfully');
    }

    // NEW METHOD: Update meta tags for social sharing
    updateMetaTagsForSharing(job) {
        const jobTitle = job.jobTitle || job.postName || 'Latest Job Opportunity';
        const companyName = job.companyName || job.bankName || 'Top Company';
        const jobDescription = job.description ? 
            job.description.substring(0, 160) + '...' : 
            'Apply for this amazing job opportunity with great benefits and career growth. Join now!';
        const currentUrl = window.location.href;
        
        // Generate OG Image URL
        const ogImageUrl = this.generateOGImageUrl(jobTitle, companyName);
        
        // Update Open Graph tags
        this.updateMetaTag('property', 'og:title', `${jobTitle} at ${companyName} | BCVWorld`);
        this.updateMetaTag('property', 'og:description', jobDescription);
        this.updateMetaTag('property', 'og:url', currentUrl);
        this.updateMetaTag('property', 'og:image', ogImageUrl);
        this.updateMetaTag('property', 'og:image:width', '1200');
        this.updateMetaTag('property', 'og:image:height', '630');
        this.updateMetaTag('property', 'og:site_name', 'BCVWorld');
        this.updateMetaTag('property', 'og:type', 'article');
        
        // Update Twitter tags
        this.updateMetaTag('property', 'twitter:card', 'summary_large_image');
        this.updateMetaTag('property', 'twitter:title', `${jobTitle} at ${companyName} | BCVWorld`);
        this.updateMetaTag('property', 'twitter:description', jobDescription);
        this.updateMetaTag('property', 'twitter:image', ogImageUrl);
        
        // Update page title
        document.title = `${jobTitle} at ${companyName} | BCVWorld`;
        
        console.log('Meta tags updated for sharing:', { jobTitle, companyName, ogImageUrl });
    }

    // NEW METHOD: Update individual meta tag
    updateMetaTag(attribute, name, content) {
        let metaTag = document.querySelector(`meta[${attribute}="${name}"]`);
        if (!metaTag) {
            metaTag = document.createElement('meta');
            metaTag.setAttribute(attribute, name);
            document.head.appendChild(metaTag);
        }
        metaTag.setAttribute('content', content);
    }

    // NEW METHOD: Generate OG Image URL
    generateOGImageUrl(jobTitle, companyName) {
        const baseImageUrl = 'https://bcvworld.com/assets/images/bcvworld-og.png';
        
        // If you want to add parameters for dynamic generation later
        const params = new URLSearchParams({
            title: encodeURIComponent(jobTitle.substring(0, 50)),
            company: encodeURIComponent(companyName.substring(0, 30)),
            v: '1.0'
        });
        
        return `${baseImageUrl}?${params.toString()}`;
    }

    // NEW METHOD: Load before/after jobs navigation
    async loadBeforeAfterJobs() {
        try {
            if (!this.currentJob) return;

            const previousJobCard = document.getElementById('previousJobCard');
            const nextJobCard = document.getElementById('nextJobCard');

            if (!previousJobCard || !nextJobCard) return;

            // Add loading state
            previousJobCard.classList.add('loading');
            nextJobCard.classList.add('loading');

            // Get current job's creation timestamp or use current time as fallback
            const currentJobTimestamp = this.currentJob.createdAt || new Date();
            const jobType = this.jobType || 'private';

            // Query for previous job (created before current job)
            const previousJobQuery = query(
                collection(db, this.getCollectionName()),
                where('createdAt', '<', currentJobTimestamp),
                orderBy('createdAt', 'desc'),
                limit(1)
            );

            // Query for next job (created after current job)
            const nextJobQuery = query(
                collection(db, this.getCollectionName()),
                where('createdAt', '>', currentJobTimestamp),
                orderBy('createdAt', 'asc'),
                limit(1)
            );

            // Execute both queries with timeout protection
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Navigation query timeout')), 5000)
            );

            const navigationPromise = Promise.all([
                getDocs(previousJobQuery),
                getDocs(nextJobQuery)
            ]);

            const [previousSnapshot, nextSnapshot] = await Promise.race([
                navigationPromise,
                timeoutPromise
            ]);

            // Handle previous job
            if (!previousSnapshot.empty) {
                const previousJobDoc = previousSnapshot.docs[0];
                const previousJob = { id: previousJobDoc.id, ...previousJobDoc.data() };
                await this.populateNavigationCard(previousJobCard, previousJob, 'previous', jobType);
            } else {
                // Fallback: try to get the most recent job if no previous job found
                const fallbackQuery = query(
                    collection(db, this.getCollectionName()),
                    orderBy('createdAt', 'desc'),
                    limit(2)
                );
                const fallbackSnapshot = await getDocs(fallbackQuery);
                
                if (fallbackSnapshot.docs.length > 1) {
                    const fallbackJob = fallbackSnapshot.docs[1];
                    const fallbackJobData = { id: fallbackJob.id, ...fallbackJob.data() };
                    await this.populateNavigationCard(previousJobCard, fallbackJobData, 'previous', jobType);
                } else {
                    this.showEmptyNavigationCard(previousJobCard, 'No previous job available');
                }
            }

            // Handle next job
            if (!nextSnapshot.empty) {
                const nextJobDoc = nextSnapshot.docs[0];
                const nextJob = { id: nextJobDoc.id, ...nextJobDoc.data() };
                await this.populateNavigationCard(nextJobCard, nextJob, 'next', jobType);
            } else {
                // Fallback: try to get the oldest job if no next job found
                const fallbackQuery = query(
                    collection(db, this.getCollectionName()),
                    orderBy('createdAt', 'asc'),
                    limit(2)
                );
                const fallbackSnapshot = await getDocs(fallbackQuery);
                
                if (fallbackSnapshot.docs.length > 1) {
                    const fallbackJob = fallbackSnapshot.docs[1];
                    const fallbackJobData = { id: fallbackJob.id, ...fallbackJob.data() };
                    await this.populateNavigationCard(nextJobCard, fallbackJobData, 'next', jobType);
                } else {
                    this.showEmptyNavigationCard(nextJobCard, 'No next job available');
                }
            }

        } catch (error) {
            console.error('Error loading before/after jobs:', error);
            
            // Show user-friendly error messages
            const errorMessage = error.message === 'Navigation query timeout' 
                ? 'Loading timeout - please refresh' 
                : 'Unable to load navigation';
                
            this.showEmptyNavigationCard(document.getElementById('previousJobCard'), errorMessage);
            this.showEmptyNavigationCard(document.getElementById('nextJobCard'), errorMessage);
        } finally {
            // Remove loading state
            const previousJobCard = document.getElementById('previousJobCard');
            const nextJobCard = document.getElementById('nextJobCard');
            if (previousJobCard) previousJobCard.classList.remove('loading');
            if (nextJobCard) nextJobCard.classList.remove('loading');
        }
    }

    // NEW METHOD: Populate navigation card with job data
    async populateNavigationCard(cardElement, job, direction, jobType) {
        try {
            // Get company data if available
            let companyData = {};
            if (job.companyId) {
                const companyDocRef = doc(db, 'companies', job.companyId);
                const companyDoc = await getDoc(companyDocRef);
                if (companyDoc.exists()) {
                    companyData = companyDoc.data();
                }
            }

            // Update card elements
            const jobTitle = job.jobTitle || job.postName || 'Job Title';
            const companyName = companyData.name || job.companyName || job.bankName || 'Company Name';
            const education = job.educationLevel || job.qualification || 'Education requirements not specified';
            const companyLogo = companyData.logo || job.companyLogo;

            // Update job title
            const jobTitleEl = cardElement.querySelector('.nav-job-title');
            if (jobTitleEl) jobTitleEl.textContent = jobTitle;

            // Update company name
            const companyNameEl = cardElement.querySelector('.nav-company-name');
            if (companyNameEl) companyNameEl.textContent = companyName;

            // Update education
            const educationEl = cardElement.querySelector('.nav-education');
            if (educationEl) {
                const formattedEducation = this.capitalizeEducationFirstLetter(education);
                educationEl.textContent = formattedEducation;
            }

            // Update company logo
            const logoImg = cardElement.querySelector('.nav-logo-img');
            if (logoImg) {
                const logoSrc = companyLogo?.startsWith('http') 
                    ? companyLogo 
                    : `/assets/images/companies/${companyLogo || 'default-company.webp'}`;
                logoImg.src = logoSrc;
                logoImg.alt = `${companyName} Logo`;
                
                // Add error handling for logo
                logoImg.onerror = function() {
                    this.src = '/assets/images/companies/default-company.webp';
                };
            }

            // Update view button link
            const viewBtn = cardElement.querySelector('.nav-view-btn');
            if (viewBtn) {
                const jobUrl = `/html/job-details.html?id=${job.id}&type=${jobType}`;
                viewBtn.setAttribute('onclick', `window.location.href='${jobUrl}'`);
            }

            // Add click handler to entire card
            cardElement.addEventListener('click', (e) => {
                if (!e.target.closest('.nav-view-btn')) {
                    const jobUrl = `/html/job-details.html?id=${job.id}&type=${jobType}`;
                    window.location.href = jobUrl;
                }
            });

            // Remove any empty state classes
            cardElement.classList.remove('empty', 'hidden');

        } catch (error) {
            console.error(`Error populating ${direction} navigation card:`, error);
            this.showEmptyNavigationCard(cardElement, 'Error loading job details');
        }
    }

    // NEW METHOD: Show empty navigation card
    showEmptyNavigationCard(cardElement, message) {
        cardElement.classList.add('empty');
        
        const jobTitleEl = cardElement.querySelector('.nav-job-title');
        const companyNameEl = cardElement.querySelector('.nav-company-name');
        const educationEl = cardElement.querySelector('.nav-education');
        const viewBtn = cardElement.querySelector('.nav-view-btn');
        const logoImg = cardElement.querySelector('.nav-logo-img');

        if (jobTitleEl) jobTitleEl.textContent = message;
        if (companyNameEl) companyNameEl.textContent = '';
        if (educationEl) educationEl.textContent = '';
        if (viewBtn) {
            viewBtn.style.display = 'none';
        }
        if (logoImg) {
            logoImg.src = '/assets/images/default-company.webp';
            logoImg.alt = 'No company logo';
        }
    }

    initializeSocialShare() {
        const shareButtons = document.querySelectorAll('.social-share-btn');
        
        console.log(`Found ${shareButtons.length} social share buttons`);
        
        if (shareButtons.length === 0) {
            console.error('No social share buttons found in DOM');
            return;
        }
        
        shareButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const platform = button.getAttribute('data-platform');
                console.log(`Share button clicked: ${platform}`);
                this.handleSocialShare(platform);
            });
        });

        shareButtons.forEach(button => {
            button.addEventListener('touchstart', function() {
                this.style.transform = 'scale(0.95)';
            });
            
            button.addEventListener('touchend', function() {
                this.style.transform = 'scale(1)';
            });
        });
    }

    handleSocialShare(platform) {
        console.log(`Starting share process for: ${platform}`);
        
        const jobTitle = this.currentJob?.jobTitle || this.currentJob?.postName || 'Amazing Job Opportunity';
        const jobUrl = window.location.href;
        const jobCompany = this.currentJob?.companyName || this.currentJob?.bankName || 'Great Company';
        const referralCode = this.currentJob?.referralCode || '';
        
        console.log('Share data:', { jobTitle, jobUrl, jobCompany, referralCode });
        
        const shareText = `🚀 ${jobTitle} at ${jobCompany}${referralCode ? ` (Referral Code: ${referralCode})` : ''}\n\nCheck out this opportunity: ${jobUrl}\n\n#JobOpportunity #Hiring #Careers`;
        
        const encodedText = encodeURIComponent(shareText);
        const encodedUrl = encodeURIComponent(jobUrl);

        let shareUrl = '';

        switch (platform) {
            case 'whatsapp':
                shareUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
                break;
                
            case 'linkedin':
                shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
                break;
                
            case 'telegram':
                shareUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
                break;
                
            case 'facebook':
                shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
                break;
                
            case 'twitter':
                const twitterText = encodeURIComponent(`${jobTitle} at ${jobCompany} - ${jobUrl}`);
                shareUrl = `https://twitter.com/intent/tweet?text=${twitterText}`;
                break;
                
            case 'copy':
                console.log('Copy to clipboard requested');
                navigator.clipboard.writeText(shareText).then(() => {
                    this.showToast('📋 Link copied to clipboard!', 'success');
                }).catch(error => {
                    console.error('Failed to copy:', error);
                    this.fallbackCopyToClipboard(shareText);
                });
                return;
                
            default:
                console.warn('Unknown platform:', platform);
                this.showToast('Unknown platform', 'error');
                return;
        }

        console.log(`Share URL for ${platform}:`, shareUrl);

        if (shareUrl && platform !== 'copy') {
            const isMobile = window.innerWidth <= 768;
            const width = isMobile ? Math.min(400, window.screen.width - 20) : 600;
            const height = isMobile ? Math.min(600, window.screen.height - 100) : 400;
            
            const left = (window.screen.width - width) / 2;
            const top = (window.screen.height - height) / 2;
            
            console.log(`Opening share window: ${width}x${height}`);
            
            const shareWindow = window.open(
                shareUrl,
                'share',
                `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
            );
            
            if (shareWindow) {
                this.showToast(`📤 Sharing via ${platform.charAt(0).toUpperCase() + platform.slice(1)}`, 'success');
            } else {
                console.error('Share window blocked by popup blocker');
                this.showToast('❌ Popup blocked! Please allow popups to share.', 'error');
            }
        }
    }

    fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showToast('📋 Link copied to clipboard!', 'success');
        } catch (err) {
            console.error('Fallback copy failed:', err);
            this.showToast('❌ Failed to copy link', 'error');
        }
        
        document.body.removeChild(textArea);
    }

    initializeAds() {
        console.log('Initializing ads...');
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => {
                    this.initializeAdsOnce();
                }, 1000);
            });
        } else {
            setTimeout(() => {
                this.initializeAdsOnce();
            }, 1000);
        }
    }

    initializeAdsOnce() {
        console.log('Starting ad initialization...');
        
        try {
            const adContainers = document.querySelectorAll('.adsbygoogle:not([data-initialized])');
            console.log(`Found ${adContainers.length} ad containers to initialize`);

            if (adContainers.length === 0) {
                console.log('No uninitialized ad containers found');
                return;
            }

            adContainers.forEach((container, index) => {
                const containerId = container.id || `ad-${index}`;
                
                if (this.adContainersInitialized.has(containerId)) {
                    console.log(`Ad container ${containerId} already initialized, skipping`);
                    return;
                }

                const rect = container.getBoundingClientRect();
                const isVisible = rect.width > 0 && rect.height > 0;
                
                if (!isVisible) {
                    console.warn(`Ad container ${containerId} has zero width/height, skipping`);
                    return;
                }

                console.log(`Initializing ad container ${containerId} with width: ${rect.width}px`);

                try {
                    container.setAttribute('data-initialized', 'true');
                    this.adContainersInitialized.add(containerId);
                    
                    (window.adsbygoogle = window.adsbygoogle || []).push({});
                    
                    console.log(`Ad container ${containerId} initialization requested`);
                    
                } catch (error) {
                    console.error(`Error initializing ad container ${containerId}:`, error);
                    container.removeAttribute('data-initialized');
                    this.adContainersInitialized.delete(containerId);
                }
            });

        } catch (error) {
            console.error('Error in ad initialization process:', error);
        }
    }

    updateJobStats(job) {
        try {
            console.log('=== DEBUG: updateJobStats started ===');
            console.log('Full job object:', job);
            
            const jobCodeEl = document.getElementById('jobCode');
            if (jobCodeEl) {
                console.log('Job code element found');
                
                const possibleJobCodeFields = [
                    'referralCode', 'referralcode', 'refCode', 'refcode', 'referenceCode',
                    'jobCode', 'jobcode', 'code', 'postShortName', 'postshortname',
                    'jobId', 'jobid', 'reference', 'ref', 'postCode', 'postcode',
                    'jobReference', 'job_reference', 'job_ref'
                ];
                
                let foundJobCode = 'N/A';
                let foundField = null;
                
                for (const field of possibleJobCodeFields) {
                    if (job[field]) {
                        foundJobCode = job[field];
                        foundField = field;
                        break;
                    }
                }
                
                console.log('Job code search results:', {
                    foundJobCode,
                    foundField,
                    referralCode: job.referralCode
                });
                
                jobCodeEl.textContent = foundJobCode;
                console.log('Job code set to:', foundJobCode);
                
            } else {
                console.error('Job code element NOT FOUND in DOM');
            }

            const viewCountEl = document.getElementById('viewCount');
            if (viewCountEl) {
                const views = job.views || 0;
                viewCountEl.textContent = views.toLocaleString();
                console.log('View count set to:', views);
            }

            const likeCountEl = document.getElementById('likeCount');
            const likeButton = document.getElementById('likeButton');
            
            if (likeCountEl) {
                const likes = job.likes || 0;
                likeCountEl.textContent = likes.toLocaleString();
                console.log('Like count set to:', likes);
            }

            if (likeButton) {
                this.setupLikeButton(likeButton, job);
            }

            console.log('=== DEBUG: updateJobStats completed ===');

        } catch (error) {
            console.error('Error updating job stats:', error);
        }
    }

    setupLikeButton(likeButton, job) {
        const jobId = this.jobId;
        const likeKey = `job_like_${jobId}`;
        const hasLiked = localStorage.getItem(likeKey);
        const currentLikes = job.likes || 0;
        
        if (hasLiked) {
            likeButton.classList.add('liked');
            likeButton.innerHTML = '<i class="bi bi-heart-fill"></i> <span id="likeCount">' + currentLikes + '</span>';
        } else {
            likeButton.classList.remove('liked');
            likeButton.innerHTML = '<i class="bi bi-heart"></i> <span id="likeCount">' + currentLikes + '</span>';
        }

        likeButton.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            try {
                const hasLiked = localStorage.getItem(likeKey);
                const currentLikes = job.likes || 0;
                let newLikes;

                if (hasLiked) {
                    newLikes = Math.max(0, currentLikes - 1);
                    localStorage.removeItem(likeKey);
                    likeButton.classList.remove('liked');
                    likeButton.innerHTML = '<i class="bi bi-heart"></i> <span id="likeCount">' + newLikes + '</span>';
                } else {
                    newLikes = currentLikes + 1;
                    localStorage.setItem(likeKey, 'true');
                    likeButton.classList.add('liked');
                    likeButton.innerHTML = '<i class="bi bi-heart-fill"></i> <span id="likeCount">' + newLikes + '</span>';
                }

                const jobRef = doc(db, this.getCollectionName(), jobId);
                await updateDoc(jobRef, {
                    likes: newLikes,
                    lastLikedAt: serverTimestamp()
                });

                job.likes = newLikes;

                const likeCountEl = document.getElementById('likeCount');
                if (likeCountEl) {
                    likeCountEl.textContent = newLikes;
                }

                this.showToast(hasLiked ? 'Like removed' : 'Job liked!', 'success');

            } catch (error) {
                console.error('Error updating likes:', error);
                this.showToast('Failed to update likes', 'error');
            }
        });
    }

    async fetchAndMergeCompanyData() {
        const companyId = this.currentJob.companyId;
        if (!companyId) {
            this.currentCompany = this.createDefaultCompanyObject();
            return;
        }

        try {
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

            this.cache.set(companyCacheKey, this.currentCompany);

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

        const combinedCases = {
            'be/b.tech/any graduation/m.tech': 'B.E/B.Tech/Any Graduation/M.Tech',
            'b.e, btech or similar': 'B.E, B.Tech or Similar',
            'b.e/b.tech or similar': 'B.E/B.Tech or Similar',
            'b.e, btech or similar': 'B.E, B.Tech or Similar'
        };

        const normalizedInput = string.toLowerCase().trim();

        for (const [pattern, replacement] of Object.entries(combinedCases)) {
            if (normalizedInput === pattern.toLowerCase()) {
                return replacement;
            }
        }

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

        return string.split(/(\s+|\/|,)/).map(part => {
            if (/^\s+$|\/|,/.test(part)) {
                return part;
            }

            const lowerPart = part.toLowerCase();

            if (educationPatterns.hasOwnProperty(lowerPart)) {
                return educationPatterns[lowerPart];
            }

            if (lowerPart === 'or') {
                return 'or';
            }

            return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
        }).join('');
    }

    capitalizeFirstLetter(string) {
        if (!string) return '';

        if (string.toLowerCase().includes('year')) {
            return string.replace(/([0-9]+)\s*years?/i, '$1 Years');
        }

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
        const descriptionContent = document.getElementById('descriptionContent');
        if (descriptionContent) {
            descriptionContent.innerHTML = this.formatDescription(job.description);
        }

        this.updateJobDetailsSection(job);

        const skillsSection = document.getElementById('skillsSection');
        const qualificationsSection = document.getElementById('qualificationsSection');
        
        if (skillsSection) skillsSection.style.display = 'none';
        if (qualificationsSection) qualificationsSection.style.display = 'none';

        const applyButtons = document.querySelectorAll('.action-btn.apply-now');
        applyButtons.forEach(button => {
            button.onclick = () => window.open(this.ensureHttp(job.applicationLink), '_blank');
        });
    }

    updatePrivateJobContent(job) {
        const descriptionContent = document.getElementById('descriptionContent');
        if (descriptionContent) {
            descriptionContent.innerHTML = this.formatDescription(job.description);
        }

        this.updateJobDetailsSection(job);
        this.updateSkillsSection(job);
        this.updateQualificationsSection(job);

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

        const techKeywords = [
            'JavaScript', 'Python', 'Java', 'C\\+\\+', 'React', 'Angular', 'Vue', 'Node.js',
            'AWS', 'Azure', 'Docker', 'Kubernetes', 'SQL', 'MongoDB', 'Express', 'TypeScript',
            'HTML', 'CSS', 'Git', 'REST', 'API', 'DevOps', 'CI/CD', 'Machine Learning',
            'AI', 'Cloud', 'Microservices', 'Spring Boot', '.NET', 'PHP', 'Ruby', 'Swift',
            'Kotlin', 'Android', 'iOS', 'Flutter', 'React Native', 'GraphQL', 'Redux',
            'Bootstrap', 'Sass', 'Less', 'jQuery', 'webpack', 'Babel', 'Jenkins', 'CRM', 'Agile', 'GitLab', 'OOP', 'Apache Kafka',
            'Confluent Kafka', 'Helm', 'NodeJS', 'APIs', 'JUnit', 'Selenium', 'TestNG',
            'Bachelor', "Bachelor's", 'Bachelors', 'B\\.E', 'B\\.Tech', 'Computer Science', 'Engineering',
            'Masters', "Master's", 'M\\.Tech', 'M\\.E', 'Information Technology', 'IT',
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
                        <li class="qualification-point">
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
                        <li class="qualification-point">
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

    // NEW METHOD: Smooth scroll to top when navigating between jobs
    setupNavigationScroll() {
        // Add smooth scrolling behavior for navigation
        document.addEventListener('click', (e) => {
            if (e.target.closest('.nav-job-card') && !e.target.closest('.nav-view-btn')) {
                // Scroll to top with smooth behavior
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new JobDetailsManager();

    // Side ads close buttons (persist via localStorage)
    try {
        const leftAd = document.querySelector('.ad-left');
        const rightAd = document.querySelector('.ad-right');
        const leftClose = leftAd ? leftAd.querySelector('.ad-close') : null;
        const rightClose = rightAd ? rightAd.querySelector('.ad-close') : null;

        const LEFT_KEY = 'jd_hide_left_ad';
        const RIGHT_KEY = 'jd_hide_right_ad';

        if (localStorage.getItem(LEFT_KEY) === '1' && leftAd) leftAd.style.display = 'none';
        if (localStorage.getItem(RIGHT_KEY) === '1' && rightAd) rightAd.style.display = 'none';

        function ensureRestoreButton() {
            let restore = document.querySelector('.ad-restore');
            if (!restore) {
                restore = document.createElement('button');
                restore.className = 'ad-restore';
                restore.type = 'button';
                restore.setAttribute('aria-label', 'Show ads');
                restore.textContent = 'Show Ads';
                document.body.appendChild(restore);
                restore.addEventListener('click', () => {
                    try {
                        localStorage.removeItem(LEFT_KEY);
                        localStorage.removeItem(RIGHT_KEY);
                    } catch(e) {}
                    if (leftAd) leftAd.style.display = '';
                    if (rightAd) rightAd.style.display = '';
                    restore.remove();
                    try { (adsbygoogle = window.adsbygoogle || []).push({}); } catch(_) {}
                });
            }
        }

        function isMobile() {
            return window.matchMedia('(max-width: 767px)').matches;
        }

        function updateRestoreVisibility() {
            const restore = document.querySelector('.ad-restore');
            if (isMobile()) {
                if (restore) restore.remove();
                return;
            }
            const anyHidden = (leftAd && leftAd.style.display === 'none') || (rightAd && rightAd.style.display === 'none');
            if (anyHidden) {
                ensureRestoreButton();
            } else if (restore) {
                restore.remove();
            }
        }

        function hideAd(container, key) {
            if (!container) return;
            container.style.display = 'none';
            try { localStorage.setItem(key, '1'); } catch (e) {}
            updateRestoreVisibility();
        }

        if (leftClose && leftAd) {
            leftClose.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                hideAd(leftAd, LEFT_KEY);
            });
        }

        if (rightClose && rightAd) {
            rightClose.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                hideAd(rightAd, RIGHT_KEY);
            });
        }

        // At load, show restore button if ads are hidden
        updateRestoreVisibility();

        const progressEl = document.getElementById('readingProgress');
        const scrollTopBtn = document.getElementById('scrollTopBtn');

        function updateProgress() {
            const doc = document.documentElement;
            const scrolled = doc.scrollTop || document.body.scrollTop;
            const height = doc.scrollHeight - doc.clientHeight;
            const pct = height > 0 ? (scrolled / height) * 100 : 0;
            if (progressEl) progressEl.style.width = pct + '%';
            if (scrollTopBtn) scrollTopBtn.classList.toggle('show', scrolled > 300);
        }

        window.addEventListener('scroll', updateProgress);
        updateProgress();

        if (scrollTopBtn) {
            scrollTopBtn.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }

        const footer = document.getElementById('footer-container');
        if (footer) {
            const obs = new IntersectionObserver((entries) => {
                const entry = entries[0];
                const isAtFooter = entry && entry.isIntersecting;
                const leftHiddenFlag = localStorage.getItem(LEFT_KEY) === '1';
                const rightHiddenFlag = localStorage.getItem(RIGHT_KEY) === '1';
                if (isAtFooter) {
                    if (leftAd) leftAd.style.display = 'none';
                    if (rightAd) rightAd.style.display = 'none';
                    if (scrollTopBtn) scrollTopBtn.classList.add('show');
                } else {
                    if (!leftHiddenFlag && leftAd) leftAd.style.display = '';
                    if (!rightHiddenFlag && rightAd) rightAd.style.display = '';
                    updateRestoreVisibility();
                }
            }, { rootMargin: '0px', threshold: 0.01 });
            obs.observe(footer);
        }
    } catch (e) {
        console.warn('Side ad close setup error', e);
    }

    // Reading progress and scroll-top should work regardless of ad setup
    try {
        const progressEl = document.getElementById('readingProgress');
        const scrollTopBtn = document.getElementById('scrollTopBtn');

        function updateProgress() {
            const doc = document.documentElement;
            const scrolled = doc.scrollTop || document.body.scrollTop;
            const height = doc.scrollHeight - doc.clientHeight;
            const pct = height > 0 ? (scrolled / height) * 100 : 0;
            if (progressEl) progressEl.style.width = pct + '%';
            if (scrollTopBtn) scrollTopBtn.classList.toggle('show', scrolled > 150);
        }

        window.addEventListener('scroll', updateProgress);
        updateProgress();

        if (scrollTopBtn) {
            scrollTopBtn.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
    } catch (e) {
        console.warn('Progress/scroll-top setup error', e);
    }

    // Openings popup
    try {
        const fab = document.getElementById('openingsFab');
        const popup = document.getElementById('openingsPopup');
        const closeBtn = document.getElementById('openingsClose');
        const updatedEl = document.getElementById('snapshotUpdated');
        const cToday = document.getElementById('countToday');
        const cWeek = document.getElementById('countWeek');
        const cMonth = document.getElementById('countMonth');

        function openPopup() {
            if (!popup) return;
            popup.classList.add('active');
            if (updatedEl) updatedEl.textContent = 'Updating…';
            // Perceived performance: show placeholders immediately
            if (cToday) cToday.textContent = '—';
            if (cWeek) cWeek.textContent = '—';
            if (cMonth) cMonth.textContent = '—';
            updateOpeningsCounts();
        }

        function closePopup() { if (popup) popup.classList.remove('active'); }

        if (fab) fab.addEventListener('click', openPopup);
        if (closeBtn) closeBtn.addEventListener('click', closePopup);

        async function updateOpeningsCounts() {
            try {
                // If Firestore is available, attempt simple counts; otherwise, skip
                if (typeof window.db === 'undefined') {
                    if (updatedEl) updatedEl.textContent = 'Updated just now';
                    return;
                }
                const { collection, query, where, getDocs, Timestamp } = window.firebase || {};
                const db = window.db;
                const now = new Date();
                const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                const ts = (d) => Timestamp ? Timestamp.fromDate(d) : d;

                async function countSince(start) {
                    try {
                        const q = query(collection(db, 'jobs'), where('createdAt', '>=', ts(start)), where('isActive', '==', true));
                        const snap = await getDocs(q);
                        return snap.size || 0;
                    } catch (e) { return 0; }
                }

                const [t, w, m] = await Promise.all([
                    countSince(todayStart),
                    countSince(weekStart),
                    countSince(monthStart)
                ]);

                if (cToday) cToday.textContent = String(t);
                if (cWeek) cWeek.textContent = String(w);
                if (cMonth) cMonth.textContent = String(m);
                if (updatedEl) updatedEl.textContent = 'Updated just now';
            } catch (e) {
                if (updatedEl) updatedEl.textContent = 'Could not load stats';
            }
        }
    } catch (e) {
        console.warn('Openings popup setup error', e);
    }
});

export { JobDetailsManager };
