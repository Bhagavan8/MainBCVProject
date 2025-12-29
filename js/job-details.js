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
    getDocs,
    increment
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
const auth = getAuth();

class JobDetailsManager {
    constructor() {
        if (typeof JobDetailsManager.instance === 'object') {
            return JobDetailsManager.instance;
        }

        JobDetailsManager.instance = this;
        const params = new URLSearchParams(window.location.search);
        this.jobId = params.get('id');
        this.jobType = params.get('type');
        this.slug = params.get('slug');
        if (!this.jobId || !this.jobType) {
            const path = window.location.pathname;
            const m = path.match(/^\/jobs\/([^/]+)\/(.+)$/);
            if (m) {
                this.jobType = decodeURIComponent(m[1]);
                const slugStr = decodeURIComponent(m[2]);
                const idFromSlug = slugStr.split('~').pop();
                if (idFromSlug) {
                    this.jobId = idFromSlug;
                    this.slug = slugStr;
                }
            }
        }
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
            this.updatePrettyUrl();
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

    updatePrettyUrl() {
        try {
            const title = this.currentJob?.jobTitle || this.currentJob?.postName || '';
            const company = this.currentJob?.companyName || this.currentJob?.bankName || '';
            const loc = this.currentJob?.location || this.currentJob?.state || '';
            const slugify = (s) => (s || '').toLowerCase().replace(/[\s/|_]+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,'');
            const slug = `${slugify(title)}-${slugify(company)}-${slugify(loc)}~${this.jobId}`;
            const canonical = `${location.origin}/html/job-details.html?type=${encodeURIComponent(this.jobType)}&id=${encodeURIComponent(this.jobId)}&slug=${encodeURIComponent(slug)}`;
            if (window.history && window.history.replaceState) {
                window.history.replaceState({}, document.title, canonical);
            }
            this.updateCanonicalLink(canonical);
        } catch (_) {}
    }

    updateCanonicalLink(url) {
        let link = document.querySelector('link[rel="canonical"]');
        if (!link) {
            link = document.createElement('link');
            link.setAttribute('rel', 'canonical');
            document.head.appendChild(link);
        }
        link.setAttribute('href', url);
    }

    async updateUI() {
        // Ensure company data is fetched and merged before updating UI components
        await this.fetchAndMergeCompanyData();

        await Promise.all([
            this.updateJobHeaderDetails(this.currentJob),
            this.updateJobContentSections(this.currentJob)
        ]);

        if (this.currentCompany) {
            this.updateCompanyDisplay(this.currentCompany);
        }
        
        this.updateJobStats(this.currentJob);
        
        // UPDATE: Add meta tags update for social sharing
        this.updateMetaTagsForSharing(this.currentJob);
        this.injectJobPostingSchema(this.currentJob);
        
        // NEW: Load before/after jobs navigation deferred
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => this.loadBeforeAfterJobs());
        } else {
            setTimeout(() => this.loadBeforeAfterJobs(), 0);
        }
        
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
        const ogUrl = currentUrl; 
        
        // Generate OG Image URL
        const ogImageUrl = this.generateOGImageUrl(jobTitle, companyName);
        
        // Update Open Graph tags
        this.updateMetaTag('property', 'og:title', `${jobTitle} at ${companyName} | BCVWorld`);
        this.updateMetaTag('property', 'og:description', jobDescription);
        this.updateMetaTag('property', 'og:url', ogUrl);
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

    injectJobPostingSchema(job) {
        const title = job.jobTitle || job.postName || 'Job';
        const company = job.companyName || job.bankName || 'Company';
        const descriptionHtml = job.description || job.about || '';
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = descriptionHtml;
        const description = (tempDiv.textContent || tempDiv.innerText || '').trim().slice(0, 500);
        const datePosted = (job.createdAt?.toDate ? job.createdAt.toDate() : (job.createdAt || new Date()));
        const validThrough = job.lastDate?.toDate ? job.lastDate.toDate() : (job.lastDate || null);
        const location = job.location || job.state || '';
        const schema = {
            "@context": "https://schema.org",
            "@type": "JobPosting",
            "title": title,
            "description": description,
            "datePosted": new Date(datePosted).toISOString(),
            ...(validThrough ? {"validThrough": new Date(validThrough).toISOString()} : {}),
            "employmentType": job.employmentType || "FULL_TIME",
            "hiringOrganization": {
                "@type": "Organization",
                "name": company
            },
            "jobLocation": {
                "@type": "Place",
                "address": {
                    "@type": "PostalAddress",
                    "addressCountry": "IN",
                    "addressLocality": location
                }
            },
            "identifier": {
                "@type": "PropertyValue",
                "name": "BCVWorld",
                "value": this.jobId
            },
            "url": window.location.href
        };
        let script = document.getElementById('jobposting-jsonld');
        if (!script) {
            script = document.createElement('script');
            script.type = 'application/ld+json';
            script.id = 'jobposting-jsonld';
            document.head.appendChild(script);
        }
        script.textContent = JSON.stringify(schema);
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

            // Initialize cursors if not already set
            if (!this.previousJobCursor) {
                this.previousJobCursor = this.currentJob.createdAt || new Date();
            }
            if (!this.nextJobCursor) {
                this.nextJobCursor = this.currentJob.createdAt || new Date();
            }

            // Initial load
            await Promise.all([
                this.loadMoreJobs('previous'),
                this.loadMoreJobs('next')
            ]);

        } catch (error) {
            console.error('Error loading before/after jobs:', error);
        }
    }

    // NEW METHOD: Load more jobs for pagination
    async loadMoreJobs(direction) {
        const cardId = direction === 'previous' ? 'previousJobCard' : 'nextJobCard';
        const cardElement = document.getElementById(cardId);
        if (!cardElement) return;

        try {
            cardElement.classList.add('loading');
            const jobType = this.jobType || 'private';
            
            // Determine query based on direction
            let jobQuery;
            if (direction === 'previous') {
                jobQuery = query(
                    collection(db, this.getCollectionName()),
                    where('createdAt', '<', this.previousJobCursor),
                    orderBy('createdAt', 'desc'),
                    limit(1)
                );
            } else {
                jobQuery = query(
                    collection(db, this.getCollectionName()),
                    where('createdAt', '>', this.nextJobCursor),
                    orderBy('createdAt', 'asc'),
                    limit(1)
                );
            }

            const snapshot = await getDocs(jobQuery);

            if (!snapshot.empty) {
                const jobDoc = snapshot.docs[0];
                const jobData = { id: jobDoc.id, ...jobDoc.data() };
                
                // Update cursor
                if (direction === 'previous') {
                    this.previousJobCursor = jobData.createdAt;
                } else {
                    this.nextJobCursor = jobData.createdAt;
                }

                await this.populateNavigationCard(cardElement, jobData, direction, jobType);
            } else {
                // Circular navigation logic: If end of list reached, loop back
                let loopQuery;
                if (direction === 'previous') {
                    // If no older jobs (we are at oldest), loop to newest
                    loopQuery = query(
                        collection(db, this.getCollectionName()),
                        orderBy('createdAt', 'desc'),
                        limit(1)
                    );
                } else {
                    // If no newer jobs (we are at newest), loop to oldest
                    loopQuery = query(
                        collection(db, this.getCollectionName()),
                        orderBy('createdAt', 'asc'),
                        limit(1)
                    );
                }

                const loopSnapshot = await getDocs(loopQuery);
                
                if (!loopSnapshot.empty) {
                    const jobDoc = loopSnapshot.docs[0];
                    // Don't show if it's the same as current (only 1 job in DB)
                    if (jobDoc.id === this.currentJob.id) {
                         this.showEmptyNavigationCard(cardElement, direction === 'previous' ? 'No previous jobs' : 'No next jobs');
                         return;
                    }

                    const jobData = { id: jobDoc.id, ...jobDoc.data() };
                    
                    // Update cursor to this new looped job's date so subsequent clicks continue from here
                    if (direction === 'previous') {
                        this.previousJobCursor = jobData.createdAt;
                    } else {
                        this.nextJobCursor = jobData.createdAt;
                    }

                    await this.populateNavigationCard(cardElement, jobData, direction, jobType);
                } else {
                    this.showEmptyNavigationCard(cardElement, direction === 'previous' ? 'No previous jobs' : 'No next jobs');
                }
            }

        } catch (error) {
            console.error(`Error loading ${direction} job:`, error);
            this.showEmptyNavigationCard(cardElement, 'Error loading job');
        } finally {
            cardElement.classList.remove('loading');
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
            const companyLogo = companyData.logo || companyData.logoURL || job.companyLogo;

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
            logoImg.setAttribute('loading', 'lazy');
            logoImg.setAttribute('decoding', 'async');
            logoImg.setAttribute('width', '48');
            logoImg.setAttribute('height', '48');
            
            // Add error handling for logo
            logoImg.onerror = function() {
                this.src = '/assets/images/companies/default-company.webp';
            };
        }

            // SETUP CLICK LISTENERS
            
            // 1. Arrow Click (Load More)
            const arrowEl = cardElement.querySelector('.nav-arrow-circle');
            // Remove old listener if any (cloning node is a quick way to clear listeners)
            const newArrowEl = arrowEl.cloneNode(true);
            arrowEl.parentNode.replaceChild(newArrowEl, arrowEl);
            
            newArrowEl.addEventListener('click', (e) => {
                e.stopPropagation();
                this.loadMoreJobs(direction);
            });

            // 2. Content Click (Redirect) - Logo and Details
            const logoWrapper = cardElement.querySelector('.nav-logo-wrapper');
            const detailsWrapper = cardElement.querySelector('.nav-job-details');
            const jobUrl = `/html/job-details.html?id=${job.id}&type=${jobType}`;
            
            const redirectHandler = (e) => {
                e.stopPropagation();
                window.location.href = jobUrl;
            };

            // Reset listeners
            if (logoWrapper) {
                const newLogoWrapper = logoWrapper.cloneNode(true);
                logoWrapper.parentNode.replaceChild(newLogoWrapper, logoWrapper);
                newLogoWrapper.addEventListener('click', redirectHandler);
                // Also re-attach the logo error handler if we cloned the image inside
                const newLogoImg = newLogoWrapper.querySelector('.nav-logo-img');
                if (newLogoImg) {
                    newLogoImg.onerror = function() {
                        this.src = '/assets/images/companies/default-company.webp';
                    };
                }
            }
            
            if (detailsWrapper) {
                 const newDetailsWrapper = detailsWrapper.cloneNode(true);
                 detailsWrapper.parentNode.replaceChild(newDetailsWrapper, detailsWrapper);
                 newDetailsWrapper.addEventListener('click', redirectHandler);
            }

            // Remove any generic click listeners on the card itself (by cloning if necessary, but we can just not add one)
            // The previous implementation added a listener to cardElement. We just don't add it here.
            // If there were existing listeners on cardElement from previous calls, they might persist if we don't clear them.
            // However, populateNavigationCard is called on the SAME element.
            // To be safe, we can clone the card element inner content? No, that breaks references.
            // Best way is to NOT add the listener to cardElement.
            // But wait, if we call this function multiple times on the same element, the OLD listener on cardElement (from previous code run) might still be there if we didn't refresh page?
            // Since we are editing the code, the user will reload the page. So it's fine.
            
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
            logoImg.src = '/assets/images/companies/default-company.webp';
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
        const init = () => this.initializeAdsOnce();
        if ('requestIdleCallback' in window) {
            requestIdleCallback(init, { timeout: 1500 });
        } else {
            setTimeout(init, 800);
        }
    }

    initializeAdsOnce() {
        try {
            const adContainers = document.querySelectorAll('.adsbygoogle:not([data-initialized])');

            if (adContainers.length === 0) {
                return;
            }

            const initContainer = (container, index) => {
                const containerId = container.id || `ad-${index}`;
                
                if (this.adContainersInitialized.has(containerId)) {
                    return;
                }

                const rect = container.getBoundingClientRect();
                const isVisible = rect.width > 0 && rect.height > 0;
                
                if (!isVisible) {
                    return;
                }

                try {
                    container.setAttribute('data-initialized', 'true');
                    this.adContainersInitialized.add(containerId);
                    
                    (window.adsbygoogle = window.adsbygoogle || []).push({});
                    
                } catch (error) {
                    container.removeAttribute('data-initialized');
                    this.adContainersInitialized.delete(containerId);
                }
            };

            const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const el = entry.target;
                        observer.unobserve(el);
                        initContainer(el, Array.from(adContainers).indexOf(el));
                    }
                });
            }, { rootMargin: '200px 0px' });

            adContainers.forEach((container) => observer.observe(container));

        } catch (error) {
        }
    }

    updateJobStats(job) {
        try {
            const jobCodeEl = document.getElementById('jobCode');
            if (jobCodeEl) {
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
                jobCodeEl.textContent = foundJobCode;
            } else {
            }

            const viewCountEl = document.getElementById('viewCount');
            if (viewCountEl) {
                const views = job.views || 0;
                viewCountEl.textContent = views.toLocaleString();
            }

            const likeCountEl = document.getElementById('likeCount');
            const likeButton = document.getElementById('likeButton');
            
            if (likeCountEl) {
                const likes = job.likes || 0;
                likeCountEl.textContent = likes.toLocaleString();
            }

            if (likeButton) {
                this.setupLikeButton(likeButton, job);
            }

        } catch (error) {
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
            'me': 'M.E',
            'cs': 'CS',
            'it': 'IT',
            'eee': 'EEE',
            'ece': 'ECE',
            'mca': 'MCA'
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

    formatExperience(exp) {
        if (!exp) return 'Not specified';
        const trimmed = exp.trim();
        
        if (trimmed.toLowerCase() === 'fresher') {
            return 'Fresher';
        }
        
        // If it contains only numbers, spaces, dots, or hyphens, append "Years"
        if (/^[\d\s\.\-]+$/.test(trimmed)) {
            return `${trimmed} Years`;
        }
        
        // Otherwise display exactly what is in Firebase
        return trimmed;
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
            experienceEl.textContent = this.formatExperience(job.experience);
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
                     width="64" height="64"
                     loading="eager"
                     decoding="async"
                     fetchpriority="high"
                     onerror="this.src='/assets/images/companies/default-company.webp'">`;
        }
    }

    async updateJobContentSections(job) {
        if (this.jobType === 'bank') {
            this.updateBankJobContent(job);
        } else {
            this.updatePrivateJobContent(job);
        }
        this.updateWalkinDetails(job);
    }

    updateWalkinDetails(job) {
        const section = document.getElementById('walkinDetailsSection');
        const content = document.getElementById('walkinDetailsContent');

        if (!section || !content) return;

        if (job.walkinDetails) {
            let formatted = job.walkinDetails;

            // 1. Extract "View on map" links to prevent double processing
            const mapLinks = [];
            formatted = formatted.replace(/(https?:\/\/[^\s]+)\s*\(?(View on map)\)?/gi, (match, url) => {
                mapLinks.push(`<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary">View on map</a>`);
                return `__MAP_LINK_${mapLinks.length - 1}__`;
            });

            // 2. Linkify standard URLs
            formatted = formatted.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary text-break">$1</a>');

            // 3. Restore "View on map" links
            formatted = formatted.replace(/__MAP_LINK_(\d+)__/g, (match, index) => mapLinks[index]);

            // 4. Bold Date and Time patterns (e.g. "29 December - 31st December , 10.00 AM - 2.00 PM")
            const dateTimeRegex = /(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*-\s*\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(?:\s*,?\s*\d{1,2}[\.:]\d{2}\s*(?:AM|PM)\s*-\s*\d{1,2}[\.:]\d{2}\s*(?:AM|PM))?)/gi;
            formatted = formatted.replace(dateTimeRegex, '<strong>$1</strong>');

            // 5. Bold common labels (Time and Venue, Address, Contact) - handles optional colons/hyphens
            formatted = formatted.replace(/\b(Time and Venue|Address|Contact)\b/gi, '<strong>$1</strong>');
            
            content.innerHTML = formatted;
            section.style.display = 'block';
        } else {
            section.style.display = 'none';
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
                    <span class="detail-value">${this.formatExperience(job.experience)}</span>
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

        // Process skills to split combined entries (e.g. "Java, Python" or "Java or Python")
        const processedSkills = [];
        job.skills.forEach(skillStr => {
            if (!skillStr) return;
            // Split by comma or " or " (case insensitive) to create separate tags
            // Also handle " / " if it implies separate skills, but be careful with "CI/CD"
            // For now, split by comma and " or "
            const parts = skillStr.split(/,| or /i);
            parts.forEach(p => {
                const trimmed = p.trim();
                // Remove trailing punctuation like dots or commas that might have remained
                const clean = trimmed.replace(/[.,;]+$/, '');
                if (clean) processedSkills.push(clean);
            });
        });
        
        if (processedSkills.length === 0) {
            skillsSection.style.display = 'none';
            return;
        }
        
        skillsContainer.innerHTML = processedSkills.map(skill => `
            <span class="skill-tag">
                ${this.formatSkillText(skill)}
            </span>
        `).join('');
        skillsSection.style.display = 'block';
    }

    formatSkillText(skill) {
        if (!skill) return '';
        
        // List of words to force uppercase (Acronyms & Tech Stack)
        const forceUppercase = new Set([
            'api', 'wcf', 'rest', 'linq', 'xml', 'json', 'ajax', 'sql', 'css', 'html', 
            'aws', 'mvc', 'asp', 'net', 'j2ee', 'php', 'qa', 'ui', 'ux', 'seo', 'sem', 
            'saas', 'paas', 'iaas', 'crm', 'erp', 'cms', 'jwt', 'sdk', 'ide', 'git', 
            'svn', 'tfs', 'npm', 'yarn', 'spa', 'pwa', 'ssr', 'csr', 'ssg', 'udp', 
            'tcp', 'ip', 'dns', 'http', 'https', 'ftp', 'ssh', 'ssl', 'tls', 'vm', 
            'os', 'ios', 'mcsa', 'mcsd', 'ocjp', 'aws', 'gcp', 'azure', 'ci', 'cd',
            'oop', 'dbms', 'rdbms', 'nosql', 'jdbc', 'odbc', 'orm', 'dom', 'bom',
            'url', 'uri', 'gui', 'cli', 'crud', 'soap', 'mvvm', 'iot', 'ml', 'ai', 'sdlc', 'stlc',
            'vhdl', 'soc', 'tcl', 'cpu', 'dft', 'fpga', 'rf', 'cad', 'rtl', 'asic'
        ]);

        // List of words to force lowercase (unless they are the first word)
        const forceLowercase = new Set([
            'or', 'and', 'of', 'in', 'with', 'a', 'an', 'the', 'to', 'for', 'any', 'etc', 'via', 'by'
        ]);

        // Special casing map
        const specialCases = {
            'jquery': 'jQuery',
            'javascript': 'JavaScript',
            'typescript': 'TypeScript',
            'nodejs': 'Node.js',
            'node.js': 'Node.js',
            'angularjs': 'AngularJS',
            'reactjs': 'React.js',
            'vuejs': 'Vue.js',
            'nextjs': 'Next.js',
            'nuxtjs': 'Nuxt.js',
            'expressjs': 'Express.js',
            'mongodb': 'MongoDB',
            'mysql': 'MySQL',
            'postgresql': 'PostgreSQL',
            'dotnet': '.NET',
            '.net': '.NET',
            'c#': 'C#',
            'f#': 'F#',
            'c++': 'C++',
            'github': 'GitHub',
            'gitlab': 'GitLab',
            'bitbucket': 'Bitbucket',
            'wordpress': 'WordPress',
            'powerbi': 'Power BI',
            'sharepoint': 'SharePoint',
            'photoshop': 'Photoshop',
            'illustrator': 'Illustrator',
            'indesign': 'InDesign',
            'premiere': 'Premiere',
            'aftereffects': 'After Effects',
            'microservices': 'Microservices',
            'devops': 'DevOps',
            'fullstack': 'Full Stack',
            'frontend': 'Frontend',
            'backend': 'Backend',
            'html5': 'HTML5',
            'css3': 'CSS3'
        };

        // Split by space first
        const words = skill.trim().split(/\s+/);
        
        return words.map((word, index) => {
            // Handle slashed terms like Api/wcf/rest
            if (word.includes('/')) {
                return word.split('/').map(subWord => this.processSingleWord(subWord, forceUppercase, forceLowercase, specialCases, false)).join('/');
            }
            return this.processSingleWord(word, forceUppercase, forceLowercase, specialCases, index === 0);
        }).join(' ');
    }

    processSingleWord(word, forceUppercase, forceLowercase, specialCases, isFirstWord) {
        // Remove common punctuation for checking but preserve it in output if needed?
        // For simplicity, let's just clean the word for checking
        const cleanWord = word.replace(/[^a-zA-Z0-9\+\#\.]/g, ''); 
        const lowerWord = cleanWord.toLowerCase();
        
        // Check uppercase list
        if (forceUppercase.has(lowerWord)) {
            return `<strong>${word.toUpperCase()}</strong>`;
        }
        
        // Check special cases (always bold these too as they are tech terms)
        if (specialCases[lowerWord]) {
             // Preserve punctuation if any, but bold the term
             return word.replace(cleanWord, `<strong>${specialCases[lowerWord]}</strong>`);
        }

        // Additional bold keywords (Tech terms that might not be in forceUppercase but should be bold)
        const boldKeywords = new Set([
            // Languages
            'java', 'python', 'c', 'c++', 'c#', 'ruby', 'perl', 'swift', 'kotlin', 'go', 'golang', 'rust', 'scala', 
            'php', 'dart', 'r', 'matlab', 'assembly', 'haskell', 'lua', 'julia', 'vba', 'cobol', 'fortran',
            'typescript', 'ts', 'javascript', 'js', 'html', 'css', 'bash', 'shell', 'powershell',
            
            // Frameworks & Libraries
            'spring', 'boot', 'django', 'flask', 'rails', 'laravel', 'symfony', 'express', 'node.js', 'nodejs',
            'angular', 'react', 'vue', 'svelte', 'ember', 'backbone', 'jquery', 'bootstrap', 'tailwind', 'sass', 'less',
            'next.js', 'nuxt.js', 'gatsby', 'redux', 'mobx', 'rxjs', 'graphql',
            'tensorflow', 'pytorch', 'keras', 'pandas', 'numpy', 'scikit-learn', 'opencv',
            
            // Databases
            'mysql', 'postgresql', 'postgres', 'sqlite', 'oracle', 'mssql', 'sql', 'pl/sql', 't-sql', 'nosql',
            'redis', 'cassandra', 'mongo', 'mongodb', 'mariadb', 'couchdb', 'dynamodb', 'firestore', 'firebase', 'supabase',
            'elasticsearch', 'solr',
            
            // DevOps & Tools
            'git', 'svn', 'mercurial', 'docker', 'kubernetes', 'k8s', 'jenkins', 'gitlab', 'bitbucket', 'jira',
            'aws', 'azure', 'gcp', 'heroku', 'netlify', 'vercel', 'digitalocean',
            'linux', 'unix', 'windows', 'macos', 'android', 'ios',
            'terraform', 'ansible', 'puppet', 'chef', 'vagrant', 'prometheus', 'grafana', 'elk',
            
            // Concepts & Architecture
            'microservices', 'rest', 'restful', 'soap', 'grpc', 'websocket',
            'agile', 'scrum', 'kanban', 'devops', 'ci/cd', 'tdd', 'bdd',
            'mvc', 'mvvm', 'oop', 'solid', 'dry',
            'data', 'structures', 'algorithms', 'dsa', 'system', 'design',
            'machine', 'learning', 'deep', 'artificial', 'intelligence', 'neural', 'networks',
            'computer', 'vision', 'natural', 'language', 'processing', 'nlp',
            'cloud', 'distributed', 'computing', 'serverless',
            'blockchain', 'crypto', 'web3', 'smart', 'contracts',
            'security', 'cryptography', 'encryption', 'auth', 'oauth', 'jwt'
        ]);

        if (boldKeywords.has(lowerWord)) {
            // Capitalize first letter if it's not already handled
            const capitalized = isFirstWord ? 
                word.substring(0, 1).toUpperCase() + word.substring(1) : 
                word;
            return `<strong>${capitalized}</strong>`;
        }
        
        // Check lowercase list (only if not first word)
        if (!isFirstWord && forceLowercase.has(lowerWord)) {
            return word.toLowerCase();
        }
        
        // Default: Capitalize first letter
        // Handle words like "content", "management" -> "Content", "Management"
        // Also handle "web" -> "Web" (not WEB unless in uppercase list)
        
        // Re-construct the word with capitalized first letter of the clean part
        // This is a bit complex if there's punctuation.
        // Simple approach:
        if (word.length === 0) return word;
        
        // Find the first letter index
        const firstLetterMatch = word.match(/[a-zA-Z]/);
        if (firstLetterMatch) {
            const index = firstLetterMatch.index;
            return word.substring(0, index) + 
                   word.charAt(index).toUpperCase() + 
                   word.substring(index + 1).toLowerCase();
        }
        
        return word;
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

        const boldImportantTerms = (text) => {
            // Regex for numbers, keywords, and important terms
            const patterns = [
                // Numbers (including percentages, years, etc.)
                /(\d+(?:\.\d+)?(?:%|\+)?)/g,
                // Specific locations
                /\b(Bengaluru|Bangalore|Hyderabad|Chennai|Mumbai|Pune|Delhi|Noida|Gurgaon|Kolkata)\b/gi,
                // Job/Education related keywords
                /\b(Fresher|Freshers|Experience|Education|Degree|Graduate|Graduation)\b/gi,
                /\b(B\.?E\.?|B\.?Tech|M\.?Tech|MCA|MBA|BCA|B\.?Sc|M\.?Sc)\b/gi
            ];

            let processedText = text;
            patterns.forEach(pattern => {
                processedText = processedText.replace(pattern, '<strong>$1</strong>');
            });
            return processedText;
        };

        return `
            <ul class="description-list">
                ${points.map(point => `
                    <li class="description-point">
                        ${boldImportantTerms(point.trim())}
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
            
            // Existing tech keywords bolding
            techKeywords.forEach(keyword => {
                const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                processedText = processedText.replace(regex, '<strong>$&</strong>');
            });

            // NEW: Additional bolding for numbers and specific keywords requested by user
            const additionalPatterns = [
                // Numbers
                /(\d+(?:\.\d+)?(?:%|\+)?)/g,
                // Locations
                /\b(Bengaluru|Bangalore|Hyderabad|Chennai|Mumbai|Pune|Delhi|Noida|Gurgaon|Kolkata)\b/gi,
                // Important Keywords
                /\b(Fresher|Freshers|Experience|Education|Degree|Graduate|Graduation)\b/gi
            ];

            additionalPatterns.forEach(pattern => {
                // Avoid double bolding if already bolded by techKeywords (simple check)
                processedText = processedText.replace(pattern, (match) => {
                    if (match.includes('<strong>')) return match;
                    return `<strong>${match}</strong>`;
                });
            });

            return processedText;
        };

        if (Array.isArray(qualifications)) {
            return `
                <ul class="qualifications-list">
                    ${qualifications.map(point => `
                        <li class="qualification-point">${boldTechTerms(point.trim())}</li>
                    `).join('')}
                </ul>
            `;
        }

        if (typeof qualifications === 'string') {
            const points = qualifications.split('\n').filter(point => point.trim());
            return `
                <ul class="qualifications-list">
                    ${points.map(point => `
                        <li class="qualification-point">${boldTechTerms(point.trim())}</li>
                    `).join('')}
                </ul>
            `;
        }

        return 'Qualifications format not supported';
    }

    async handleApplyClick(job) {
        // Debounce to prevent multiple increments from duplicate listeners or rapid clicks
        const now = Date.now();
        if (this.lastApplyClick && (now - this.lastApplyClick < 1000)) {
            console.log('Debounced apply click');
            return;
        }
        this.lastApplyClick = now;

        try {
            // Increment apply count in Firebase
            const jobRef = doc(db, this.getCollectionName(), this.jobId);
            await updateDoc(jobRef, {
                applyCount: increment(1),
                lastAppliedAt: serverTimestamp()
            }).catch((error) => {
                if (error.code === 'permission-denied') {
                    console.warn('Apply count increment skipped: Firestore Security Rules require authentication.');
                } else {
                    console.warn('Could not increment apply count:', error);
                }
            });

            const user = auth.currentUser;
    
            if (user) {
                // Use currentJob if available to ensure we have the latest merged data (e.g. company info)
                const jobData = this.currentJob || job;
                const applicationRef = doc(db, 'jobApplications', `${this.jobId}_${user.uid}`);
                
                await setDoc(applicationRef, {
                    userId: user.uid,
                    jobId: this.jobId,
                    jobType: this.jobType,
                    jobTitle: jobData.jobTitle || jobData.postName || 'Untitled Job',
                    companyName: jobData.companyName || jobData.bankName || 'Unknown Company',
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

        // Removed duplicate updateProgress from here to avoid dependency on ad logic success

        // const footer = document.getElementById('footer-container');
        // if (footer) {
        //     const obs = new IntersectionObserver((entries) => {
        //         const entry = entries[0];
        //         const isAtFooter = entry && entry.isIntersecting;
        //         const leftHiddenFlag = localStorage.getItem(LEFT_KEY) === '1';
        //         const rightHiddenFlag = localStorage.getItem(RIGHT_KEY) === '1';
        //         if (isAtFooter) {
        //             if (leftAd) leftAd.style.display = 'none';
        //             if (rightAd) rightAd.style.display = 'none';
        //         } else {
        //             if (!leftHiddenFlag && leftAd) leftAd.style.display = '';
        //             if (!rightHiddenFlag && rightAd) rightAd.style.display = '';
        //             updateRestoreVisibility();
        //         }
        //     }, { rootMargin: '0px', threshold: 0.01 });
        //     obs.observe(footer);
        // }
    } catch (e) {
        console.warn('Side ad close setup error', e);
    }

    // Reading progress and scroll-top should work regardless of ad setup
    try {
        function updateProgress() {
            const bar = document.getElementById('readingProgress');
            if (bar) {
                const docEl = document.documentElement;
                const body = document.body || document.documentElement;
                const scrolled = window.pageYOffset || docEl.scrollTop || body.scrollTop || 0;
                const scrollHeight = Math.max(docEl.scrollHeight, body.scrollHeight);
                const clientHeight = docEl.clientHeight;
                const height = scrollHeight - clientHeight;
                const pct = height > 0 ? (scrolled / height) * 100 : 0;
                bar.style.width = pct + '%';
            }
        }

        window.addEventListener('scroll', updateProgress, { passive: true });
        window.addEventListener('resize', updateProgress, { passive: true });
        // Initial call
        updateProgress();
        setTimeout(updateProgress, 100);
        setTimeout(updateProgress, 500);
        
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
        const ptToday = document.getElementById('ptToday');
        const ptWeek = document.getElementById('ptWeek');
        const ptMonth = document.getElementById('ptMonth');
        const areaPath = document.getElementById('areaPath');
        const linePath = document.getElementById('linePath');
        const pieToday = document.getElementById('pieToday');
        const pieWeek = document.getElementById('pieWeek');
        const pieMonth = document.getElementById('pieMonth');
        const pieTotal = document.getElementById('pieTotal');
        const legendToday = document.getElementById('legendToday');
        const legendWeek = document.getElementById('legendWeek');
        const legendMonth = document.getElementById('legendMonth');

        const ChartState = { today: null, week: null, month: null };
        let countsObserver = null;

        function openPopup() {
            if (!popup) return;
            popup.classList.add('active');
            popup.style.display = 'flex';
            popup.setAttribute('aria-hidden', 'false');
            if (updatedEl) updatedEl.textContent = 'Updating…';
            if (ChartState.today != null) {
                // Use prefetched values
                if (cToday) cToday.textContent = String(ChartState.today);
                if (cWeek) cWeek.textContent = String(ChartState.week);
                if (cMonth) cMonth.textContent = String(ChartState.month);
                updateChart(ChartState.today, ChartState.week, ChartState.month);
                updatePie(ChartState.today, ChartState.week, ChartState.month);
                if (updatedEl) updatedEl.textContent = 'Updated';
            } else {
                // Show placeholders immediately
                if (cToday) cToday.textContent = '—';
                if (cWeek) cWeek.textContent = '—';
                if (cMonth) cMonth.textContent = '—';
                updateOpeningsCounts();
                // Ensure some chart is visible even before counts arrive
                updateChartFallback();
                // Fallback: if counts already exist in DOM from another source, paint chart
                setTimeout(() => {
                    updateChartFromCounts();
                }, 200);
            }
            startCountsObserver();
        }

        function closePopup() {
            if (!popup) return;
            popup.classList.remove('active');
            popup.style.display = 'none';
            popup.setAttribute('aria-hidden', 'true');
            stopCountsObserver();
        }

        // Close when clicking outside the card
        if (popup) {
            popup.addEventListener('click', (e) => {
                const card = e.target.closest('.openings-card');
                if (!card) closePopup();
            });
        }

        if (fab && !window.openOpenings) fab.addEventListener('click', openPopup);
        if (closeBtn && !window.closeOpenings) closeBtn.addEventListener('click', closePopup);

        async function updateOpeningsCounts() {
            try {
                // If Firestore is available, attempt simple counts; otherwise, skip
                if (typeof window.db === 'undefined') {
                    if (updatedEl) updatedEl.textContent = 'Offline';
                    const now = new Date();
                    setMeta(undefined, now);
                    return;
                }
                const { collection, query, where, getDocs, orderBy, limit, Timestamp } = window.firebase || {};
                const db = window.db;
                const nowUtc = new Date();
                const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
                const toISTLocal = (d) => new Date(d.getTime() + IST_OFFSET_MS);
                const toUTCfromIST = (d) => new Date(d.getTime() - IST_OFFSET_MS);
                const istNow = toISTLocal(nowUtc);
                const istStartToday = new Date(istNow.getFullYear(), istNow.getMonth(), istNow.getDate());
                const istStart7 = new Date(istStartToday.getTime() - 7 * 24 * 60 * 60 * 1000);
                const istStart30 = new Date(istStartToday.getTime() - 30 * 24 * 60 * 60 * 1000);
                const todayStart = toUTCfromIST(istStartToday);
                const weekStart = toUTCfromIST(istStart7);
                const monthStart = toUTCfromIST(istStart30);
                const ts = (d) => Timestamp ? Timestamp.fromDate(d) : d;

                async function countSince(start) {
                    try {
                        const q = query(collection(db, 'jobs'), where('createdAt', '>=', ts(start)), where('isActive', '==', true));
                        const snap = await getDocs(q);
                        return snap.size || 0;
                    } catch (e) { return 0; }
                }

                const [t, wTotal, mTotal] = await Promise.all([
                    countSince(todayStart),
                    countSince(weekStart),
                    countSince(monthStart)
                ]);
                const w = Math.max(0, wTotal - t);
                const m = Math.max(0, mTotal - wTotal);

                if (legendToday) legendToday.textContent = String(t);
                if (legendWeek) legendWeek.textContent = String(w);
                if (legendMonth) legendMonth.textContent = String(m);
                ChartState.today = t; ChartState.week = w; ChartState.month = m;
                updateChart(t, w, m);
                updatePie(t, w, m);
                if (updatedEl) updatedEl.textContent = 'Updated';
                await updateLatestPosted(db, { collection, query, orderBy, limit, getDocs });
                const latestDate = getLatestPostedTime();
                setMeta(latestDate, nowUtc);
            } catch (e) {
                if (updatedEl) updatedEl.textContent = 'Could not load stats';
                // Fallback to DOM counts if available
                updateChartFromCounts();
                const now = new Date();
                setMeta(undefined, now);
            }
        }

        function updateChart(t, w, m) {
            const max = Math.max(1, t, w, m);
            const baseY = 110; // baseline
            const maxH = 90;   // max height
            const scale = maxH / max;
            const yt = baseY - Math.round(t * scale);
            const yw = baseY - Math.round(w * scale);
            const ym = baseY - Math.round(m * scale);
            const x1 = 40, x2 = 160, x3 = 280;

            if (ptToday) { ptToday.setAttribute('cy', String(yt)); }
            if (ptWeek) { ptWeek.setAttribute('cy', String(yw)); }
            if (ptMonth) { ptMonth.setAttribute('cy', String(ym)); }

            const dLine = `M${x1} ${yt} L${x2} ${yw} L${x3} ${ym}`;
            const dArea = `M${x1} ${baseY} L${x1} ${yt} L${x2} ${yw} L${x3} ${ym} L${x3} ${baseY} Z`;
            if (linePath) { linePath.setAttribute('d', dLine); }
            if (areaPath) { areaPath.setAttribute('d', dArea); }
        }

        function updateChartFromCounts() {
            const toNum = (el) => {
                if (!el) return null;
                const s = (el.textContent || '').replace(/[^0-9]/g, '');
                return s ? parseInt(s, 10) : null;
            };
            const t = toNum(legendToday);
            const w = toNum(legendWeek);
            const m = toNum(legendMonth);
            if (t != null && w != null && m != null) {
                updateChart(t, w, m);
                updatePie(t, w, m);
                if (updatedEl) updatedEl.textContent = 'Updated';
                const now = new Date();
                setMeta(undefined, now);
            }
        }

        function updateChartFallback() {
            // Friendly placeholder trend so chart isn't empty
            const t = 8, w = 24, m = 56;
            updateChart(t, w, m);
            updatePie(t, w, m);
        }

        function updatePie(t, w, m) {
            const r = 50;
            const c = 2 * Math.PI * r;
            const values = [Math.max(0, t), Math.max(0, w), Math.max(0, m)];
            const sum = values.reduce((a, b) => a + b, 0) || 1; // avoid zero sum
            const segs = values.map(v => (v / sum) * c);
            let offset = 0;
            const apply = (el, len) => {
                if (!el) return;
                el.setAttribute('stroke-dasharray', `${len} ${c - len}`);
                el.setAttribute('stroke-dashoffset', String(offset));
                offset -= len; // accumulate backwards due to rotate(-90)
            };
            apply(pieToday, segs[0]);
            apply(pieWeek, segs[1]);
            apply(pieMonth, segs[2]);
            if (pieTotal) pieTotal.textContent = String(values[0] + values[1] + values[2]);
            if (legendToday) legendToday.textContent = String(values[0]);
            if (legendWeek) legendWeek.textContent = String(values[1]);
            if (legendMonth) legendMonth.textContent = String(values[2]);
        }

        let latestPostedCache = null;
        async function updateLatestPosted(db, api) {
            try {
                const { collection, query, orderBy, limit, getDocs } = api;
                const q = query(collection(db, 'jobs'), orderBy('createdAt', 'desc'), limit(1));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const doc = snap.docs[0].data();
                    latestPostedCache = doc.createdAt;
                }
            } catch (_) {}
        }

        function getLatestPostedTime() {
            const ts = latestPostedCache;
            if (!ts) return undefined;
            if (ts && typeof ts.toDate === 'function') return ts.toDate();
            return ts;
        }

        function setMeta(latestDate, refreshedDate) {
            try {
                const latestEl = document.getElementById('latestPosted');
                const refEl = document.getElementById('lastRefreshed');
                const fmt = (d) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(d);
                if (latestEl) latestEl.textContent = latestDate ? `Latest: ${fmt(latestDate)}` : 'Offline';
                if (refEl) refEl.textContent = refreshedDate ? `Refreshed: ${fmt(refreshedDate)}` : '';
            } catch (_) {}
        }

        function startCountsObserver() {
            try {
                if (countsObserver) return;
                const els = [cToday, cWeek, cMonth].filter(Boolean);
                if (els.length === 0) return;
                countsObserver = new MutationObserver(() => {
                    updateChartFromCounts();
                });
                els.forEach(el => countsObserver.observe(el, { childList: true, characterData: true, subtree: true }));
            } catch (_) {}
        }

        function stopCountsObserver() {
            try { if (countsObserver) { countsObserver.disconnect(); countsObserver = null; } } catch(_) {}
        }

        // Prefetch counts shortly after page becomes idle
        try {
            const prefetch = () => updateOpeningsCounts();
            if ('requestIdleCallback' in window) {
                requestIdleCallback(prefetch, { timeout: 1500 });
            } else {
                setTimeout(prefetch, 1200);
            }
        } catch (_) {}
    } catch (e) {
        console.warn('Openings popup setup error', e);
    }
});

export { JobDetailsManager };
