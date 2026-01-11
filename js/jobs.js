import { db } from './firebase-config.js';
import {
    collection,
    query,
    where,
    getDocs,
    orderBy,
    getDoc,
    doc, 
    serverTimestamp,
    addDoc,
    onSnapshot,
    limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
let currentJobsList = [];
let currentPaginationState = {
    page: 1,
    filterType: 'default',
    filterValue: null
};

    // Main initialization
    async function initializePage() {
        try {
            // Set date picker to today's date (IST)
            const todayIST = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
            const todayDate = new Date(todayIST);
            const dateStr = formatDateForInput(todayDate);
    
            const datePicker = document.getElementById('dateFilter');
            if (datePicker) {
                datePicker.value = dateStr;
            }
    
            // Range override via URL params
            const urlParams = new URLSearchParams(window.location.search);
            const range = urlParams.get('range');
            
            if (range === 'today' || range === 'week' || range === 'month') {
                // Fetch all jobs first
                const [bankJobs, govJobs, pvtJobs] = await Promise.all([
                    getJobs('bank'),
                    getJobs('government'),
                    getJobs('private')
                ]);
                
                const allJobs = {
                    bank: bankJobs,
                    government: govJobs,
                    private: pvtJobs
                };

                let filteredJobs = { bank: [], government: [], private: [] };
                
                if (range === 'today') {
                    // Filter for today
                    const isToday = (date) => {
                        if (!date) return false;
                        const d = new Date(date);
                        return d.getDate() === todayDate.getDate() && 
                               d.getMonth() === todayDate.getMonth() && 
                               d.getFullYear() === todayDate.getFullYear();
                    };
                    
                    filteredJobs.bank = bankJobs.filter(j => isToday(j.createdAt));
                    filteredJobs.government = govJobs.filter(j => isToday(j.createdAt));
                    filteredJobs.private = pvtJobs.filter(j => isToday(j.createdAt));
                    
                    displayJobs(filteredJobs, 'date', dateStr);
                } else {
                    // Filter for range (week/month)
                    const now = new Date();
                    const start = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
                    if (range === 'week') start.setDate(start.getDate() - 7);
                    else start.setDate(start.getDate() - 30);
                    
                    const isAfter = (date) => {
                        if (!date) return false;
                        return new Date(date) >= start;
                    };

                    filteredJobs.bank = bankJobs.filter(j => isAfter(j.createdAt));
                    filteredJobs.government = govJobs.filter(j => isAfter(j.createdAt));
                    filteredJobs.private = pvtJobs.filter(j => isAfter(j.createdAt));

                    displayJobs(filteredJobs, 'range', range);
                }
            } else {
                // Load ALL recent jobs by default
                await initializeJobs();
            }
            
            // Setup other components
            populateLocationFilter();
            updateCategoryCounts();
            loadSidebarJobs();
            loadCompanyWiseJobs();
            setupRealtimeJobNotifications();
            
            // Event listeners
            document.getElementById('clearFilterBtn').addEventListener('click', clearDateFilter);
            
            // Setup pagination handlers
            setupPagination();
    
        } catch (error) {
            console.error("Initialization error:", error);
            showToast('Error initializing page. Please try again.', false);
        }
    }

function setupRealtimeJobNotifications(){
    const notify = (job, type) => {
        if (Notification.permission !== 'granted') return;
        const title = (job.jobTitle || job.postName || 'New Job') + ' • ' + (job.companyName || job.bankName || '');
        const body = (job.location || job.state || 'New opening');
        const link = `/html/job-details.html?type=${type}&id=${job.id}&t=${Date.now()}`;
        const n = new Notification(title, { body, icon: '/assets/icons/icon-192.png' });
        n.onclick = () => { window.open(link, '_blank'); };
    };
    const ensurePermission = async () => {
        if (Notification.permission === 'default') {
            try { await Notification.requestPermission(); } catch {}
        }
    };
    ensurePermission();
    const setups = [
        { col: 'jobs', type: 'private' },
        { col: 'bankJobs', type: 'bank' },
        { col: 'governmentJobs', type: 'government' }
    ];
    setups.forEach(({col, type}) => {
        let initialized = false;
        const qRef = query(collection(db, col), where('isActive','==',true), orderBy('createdAt','desc'), limit(10));
        onSnapshot(qRef, (snap) => {
            if (!initialized) { initialized = true; return; }
            snap.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const job = { id: change.doc.id, ...change.doc.data() };
                    notify(job, type);
                }
            });
        }, (err) => {
            console.warn('Realtime notifications error', err?.message || err);
        });
    });
}
// Initialize jobs with proper pagination
async function initializeJobs() {
    try {
        // Fetch only the latest 10 jobs for each category to speed up initial load
        // Pagination or "Load More" will handle the rest
        const jobs = {
            bank: await getJobs('bank', 10),
            government: await getJobs('government', 10),
            private: await getJobs('private', 10)
        };
        displayJobs(jobs, 'default');
    } catch (error) {
        console.error('Error initializing jobs:', error);
    }
}


async function getJobs(jobType, limitCount = 20) {
    try {
        let jobsRef;
        let q;

        // Get current date and 1 month ago date in IST
        const nowIST = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
        const currentDate = new Date(nowIST);
        
        // Use simpler query logic: just get the latest N active jobs
        // We will trust the database 'isActive' flag and 'createdAt' sort
        
        switch (jobType) {
            case 'private':
                jobsRef = collection(db, 'jobs');
                break;
            case 'government':
                jobsRef = collection(db, 'governmentJobs');
                break;
            case 'bank':
                jobsRef = collection(db, 'bankJobs');
                break;
            default:
                jobsRef = collection(db, 'jobs');
        }

        // Optimized Query: Active jobs, sorted by date, LIMITED
        q = query(
            jobsRef,
            where('isActive', '==', true),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );

        const snapshot = await getDocs(q);
        console.log(`Query executed for ${jobType} jobs. Results:`, snapshot.size);

        // Process jobs
        const jobs = await Promise.all(snapshot.docs.map(async (docItem) => {
            const jobData = {
                id: docItem.id,
                type: jobType,
                ...docItem.data(),
                createdAt: docItem.data().createdAt?.toDate
                    ? docItem.data().createdAt.toDate()
                    : new Date(docItem.data().createdAt || currentDate)
            };

            // Optimization: Skip company/user fetch if data exists on the job document
            // Only fetch if absolutely necessary (or just rely on denormalized data)
            
            // Fetch company details if available
            let companyDetails = {};
            // Use existing data if available to avoid extra reads
            if (jobData.companyName && jobData.companyLogo) {
                 companyDetails = {
                    companyName: jobData.companyName,
                    companyLogo: jobData.companyLogo,
                    companyWebsite: jobData.companyWebsite || '',
                    companyAbout: jobData.companyAbout || ''
                };
            } else if (jobData.companyId) {
                try {
                    const companyRef = doc(db, 'companies', jobData.companyId);
                    const companyDoc = await getDoc(companyRef);

                    if (companyDoc.exists()) {
                        const companyData = companyDoc.data();
                        companyDetails = {
                            companyName: companyData.name || jobData.companyName || '',
                            companyLogo: companyData.logoURL || jobData.companyLogo || '',
                            companyWebsite: companyData.website || jobData.companyWebsite || '',
                            companyAbout: companyData.about || jobData.companyAbout || ''
                        };
                    }
                } catch (error) {
                    console.error(`Error fetching company details for job ${jobData.id}:`, error);
                }
            }

            // Fetch user details (posted by) - Optimization: Skip if not critical or use default
            let postedByName = 'bcvworld';
            if (jobData.postedByName) {
                postedByName = jobData.postedByName;
            } else if (jobData.userId) {
                try {
                    const userRef = doc(db, 'users', jobData.userId);
                    const userDoc = await getDoc(userRef);
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        postedByName = userData.firstName || userData.displayName || userData.name || 'bcvworld';
                    }
                } catch (error) {
                    // console.error(`Error fetching user details for job ${jobData.id}:`, error);
                }
            }

            return {
                ...jobData,
                ...companyDetails,
                postedByName
            };
        }));

        return jobs;

    } catch (error) {
        console.error(`Error getting ${jobType} jobs:`, error);
        if (error.code) {
            console.error('Firestore error code:', error.code);
            console.error('Firestore error message:', error.message);
        }
        return [];
    }
}


function createJobCard(job, type) {
  const getValue = (value, defaultValue = 'Not specified') => value || defaultValue;
  const trimText = (text, maxLength) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };
  const slugify = (s) => (s || '')
    .toString()
    .toLowerCase()
    .replace(/[\s/|_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const buildJobSlug = (title, company, loc, id) => {
    const t = slugify(title);
    const c = slugify(company);
    const l = slugify(loc);
    const parts = [t, c, l].filter(Boolean);
    return `${parts.join('-')}~${id}`;
  };
    
    const formatDateDisplay = (dateInput) => {
        if (!dateInput) return '';
        try {
             const date = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
             return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        } catch (e) {
            return '';
        }
    };

    // Determine Logo
    let logoSrc = '/assets/images/companies/default-company.webp';
    if (type === 'private' && job.companyLogo) logoSrc = job.companyLogo;
    
    // Determine Titles and Location
    let companyName = getValue(job.companyName);
    let jobTitle = getValue(job.jobTitle);
    let location = getValue(job.location || job.state);
    
    if (type === 'bank') {
        companyName = getValue(job.bankName);
        jobTitle = getValue(job.postName);
    } else if (type === 'government') {
        companyName = getValue(job.department);
        jobTitle = getValue(job.postName);
    }

  // Construct Header Title
  const headerTitle = `${jobTitle} | ${companyName} | ${location}`;

    // Description (Strip HTML)
    let description = job.description || job.about || '';
    const tmp = document.createElement("DIV");
    tmp.innerHTML = description;
    let plainTextDesc = tmp.textContent || tmp.innerText || "";
    plainTextDesc = trimText(plainTextDesc, 180);

  const jobSlug = buildJobSlug(jobTitle, companyName, location, job.id);
  const jobLink = `/html/job-details.html?type=${type}&id=${job.id}&slug=${encodeURIComponent(jobSlug)}&t=${Date.now()}`;
  const dateStr = formatDateDisplay(job.createdAt || job.postedAt);

    return `
        <div class="job-list-card">
            <div class="job-card-body">
                <div class="job-logo-wrapper">
                    ${type === 'private' ? `
                        <img src="${logoSrc}" alt="${companyName}" class="job-logo-img" onerror="this.src='/assets/images/companies/default-company.webp'">
                    ` : type === 'bank' ? `
                        <i class="bi bi-bank2 text-primary" style="font-size: 32px;"></i>
                    ` : `
                        <i class="bi bi-building-fill text-danger" style="font-size: 32px;"></i>
                    `}
                </div>
                <div class="job-content-wrapper">
                    <h3 class="job-title-heading">
                        <a href="${jobLink}" class="job-link">
                            ${headerTitle}
                        </a>
                    </h3>
                    <div class="job-meta-info">
                        <span class="meta-entry">
                            <i class="bi bi-person"></i> <span class="meta-text">${job.postedByName || 'bcvworld'}</span>
                        </span>
                        <span class="meta-entry">
                            <i class="bi bi-clock"></i> <span class="meta-text">${dateStr}</span>
                        </span>
                        <span class="meta-entry">
                            <i class="bi bi-folder"></i> <span class="meta-text">${location}</span>
                        </span>
                    </div>
                    <div class="job-excerpt">
                        ${plainTextDesc}
                    </div>
                    <div class="job-action">
                        <a href="${jobLink}" class="btn-continue-reading">Continue Reading</a>
                    </div>
                </div>
            </div>
        </div>
    `;
}
function displayJobs(jobs, filterType = 'default', filterValue = null) {
    const jobsGrid = document.getElementById('jobsGrid');
    if (!jobsGrid) return;

    // Combine all jobs into a single array
    currentJobsList = Object.entries(jobs).reduce((acc, [type, jobsList]) => {
        return acc.concat(jobsList.map(job => ({ ...job, type })));
    }, []);

    // Update job count in all cases
    const jobCountElement = document.getElementById('jobCount');
    if (jobCountElement) {
        jobCountElement.textContent = currentJobsList.length;
    }

    // Handle empty state
    if (!currentJobsList || currentJobsList.length === 0) {
        jobsGrid.innerHTML = '<div class="alert alert-info">No jobs found for the selected date</div>';
        return;
    }

    // Update pagination state and UI
    currentPaginationState = {
        ...currentPaginationState,
        filterType,
        filterValue,
        page: 1 // Reset to first page on new filter
    };

    updatePaginationUI();
}

// Update pagination UI
function updatePaginationUI() {
    const jobsGrid = document.getElementById('jobsGrid');
    if (!jobsGrid) return;

    // Check if we have jobs to display
    if (!currentJobsList || currentJobsList.length === 0) {
        const jobCountElement = document.getElementById('jobCount');
        if (jobCountElement) jobCountElement.textContent = '0';
        jobsGrid.innerHTML = `
            <div class="alert alert-info text-center p-4">
                <h4>No Jobs Found</h4>
                <p class="mb-0">We couldn't find any jobs matching your criteria at this time. Please check back later or try a different search.</p>
            </div>`;
        return;
    }

    // Pagination configuration
    const jobsPerPage = 10;
    const totalPages = Math.ceil(currentJobsList.length / jobsPerPage);
    const startIndex = (currentPaginationState.page - 1) * jobsPerPage;
    const endIndex = startIndex + jobsPerPage;
    const paginatedJobs = currentJobsList.slice(startIndex, endIndex);

    // Create jobs HTML
    const jobsHTML = `
        <div class="jobs-container">
            ${paginatedJobs.map(job => `
                    ${createJobCard(job, job.type)}
            `).join('')}
        </div>
        ${totalPages > 1 ? createPaginationControls(currentPaginationState.page, totalPages) : ''}
    `;

    jobsGrid.innerHTML = jobsHTML;

    // Update job count
    const jobCountElement = document.getElementById('jobCount');
    if (jobCountElement) {
        jobCountElement.textContent = currentJobsList.length;
    }

    // Update URL
    updateUrlWithPagination();
    
    // Inject ItemList JSON-LD for SEO
    injectItemListSchema(paginatedJobs);
}

// Add these new functions for pagination
function createPaginationControls(currentPage, totalPages) {
    let paginationHTML = `
        <div class="pagination-container mt-4">
            <nav aria-label="Job listings pagination">
                <ul class="pagination justify-content-center">
                    <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                        <a class="page-link" href="#" data-page="${currentPage - 1}">
                            <i class="bi bi-chevron-left"></i>
                        </a>
                    </li>`;

    // Add page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            paginationHTML += `
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            paginationHTML += `
                <li class="page-item disabled">
                    <span class="page-link">...</span>
                </li>`;
        }
    }

    paginationHTML += `
                <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                    <a class="page-link" href="#" data-page="${currentPage + 1}">
                        <i class="bi bi-chevron-right"></i>
                    </a>
                </li>
            </ul>
        </nav>
    </div>`;

    return paginationHTML;
}
function setupPagination() {
    document.addEventListener('click', (e) => {
        const pageLink = e.target.closest('.page-link');
        if (pageLink) {
            e.preventDefault();
            const page = parseInt(pageLink.dataset.page);
            if (page) {
                currentPaginationState.page = page;
                updatePaginationUI();
                
                // Save scroll position
                sessionStorage.setItem('scrollPosition', window.scrollY);
            }
        }
    });
}
// Update URL with current pagination state
function updateUrlWithPagination() {
    const url = new URL(window.location);
    
    // Remove existing page parameter
    url.searchParams.delete('page');
    
    // Add page parameter if not on first page
    if (currentPaginationState.page > 1) {
        url.searchParams.set('page', currentPaginationState.page);
    }
    
    // Update URL without reload
    window.history.replaceState({}, '', url);
}

function injectItemListSchema(jobs) {
    try {
        const items = jobs.map((job, idx) => {
            const title = job.jobTitle || job.postName || job.title || 'Job';
            const company = job.companyName || job.bankName || job.company || '';
            const loc = job.location || job.state || '';
            const slugify = (s) => (s || '').toLowerCase().replace(/[\s/|_]+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,'');
            const slug = `${slugify(title)}-${slugify(company)}-${slugify(loc)}~${job.id}`;
            const url = `${location.origin}/html/job-details.html?type=${encodeURIComponent(job.type)}&id=${encodeURIComponent(job.id)}&slug=${encodeURIComponent(slug)}&t=${Date.now()}`;
            return {
                "@type": "ListItem",
                "position": idx + 1 + ((currentPaginationState.page - 1) * 10),
                "name": `${title} at ${company}`,
                "url": url
            };
        });
        const schema = {
            "@context": "https://schema.org",
            "@type": "ItemList",
            "itemListElement": items
        };
        let script = document.getElementById('jobs-itemlist-jsonld');
        if (!script) {
            script = document.createElement('script');
            script.type = 'application/ld+json';
            script.id = 'jobs-itemlist-jsonld';
            document.head.appendChild(script);
        }
        script.textContent = JSON.stringify(schema);
    } catch (_) {}
}


async function filterByCategory(category) {
    try {
        const jobs = {};
        const categoryLower = category.toLowerCase();

        if (categoryLower === 'all') {
            // Get all types of jobs with company details
            jobs.bank = await getJobs('bank');
            jobs.government = await getJobs('government');
            jobs.private = await getJobs('private');
        } else if (categoryLower === 'bank') {
            jobs.bank = await getJobs('bank');
        } else if (categoryLower === 'government') {
            jobs.government = await getJobs('government');
        } else {
            // For private job categories (IT, marketing, finance, sales, hr)
            const jobsRef = collection(db, 'jobs');
            const q = query(
                jobsRef,
                where('isActive', '==', true),
                where('jobCategory', '==', category)
            );
            const snapshot = await getDocs(q);
            
            // Process jobs with company details
            jobs.private = await Promise.all(snapshot.docs.map(async (docItem) => {
                const jobData = {
                    id: docItem.id,
                    type: 'private',
                    ...docItem.data()
                };

                // If job has companyId, fetch company details
                let companyDetails = {};
                if (jobData.companyId) {
                    try {
                        const companyRef = doc(db, 'companies', jobData.companyId);
                        const companyDoc = await getDoc(companyRef);

                        if (companyDoc.exists()) {
                            const companyData = companyDoc.data();
                            companyDetails = {
                                companyName: companyData.name || jobData.companyName || '',
                                companyLogo: companyData.logoURL || jobData.companyLogo || '',
                                companyWebsite: companyData.website || jobData.companyWebsite || '',
                                companyAbout: companyData.about || jobData.companyAbout || ''
                            };
                        }
                    } catch (error) {
                        console.error('Error fetching company details:', error);
                    }
                }

                // Fetch user details (posted by)
                let postedByName = 'bcvworld';
                if (jobData.userId) {
                    try {
                        const userRef = doc(db, 'users', jobData.userId);
                        const userDoc = await getDoc(userRef);
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            postedByName = userData.firstName || userData.displayName || userData.name || 'bcvworld';
                        }
                    } catch (error) {
                        console.error(`Error fetching user details for job ${jobData.id}:`, error);
                    }
                }

                return {
                    ...jobData,
                    ...companyDetails,
                    postedByName
                };
            }));
        }
        displayJobs(jobs);
    } catch (error) {
        console.error('Error filtering by category:', error);
        // Show error to user if needed
        showToast('Error filtering jobs. Please try again.', false);
    }
}

// Make function globally available
window.filterByCategory = filterByCategory;

window.filterByJobType = (type) => {
    // Redirect to filterByCategory for consistent behavior
    window.filterByCategory(type);
};

window.filterByLocation = (location) => {
    const locationSelect = document.getElementById('locationFilter');
    if (!locationSelect) return;

    // Normalization helper (matching populateLocationFilter logic)
    const normalize = (loc) => {
        if (!loc) return '';
        let normalized = loc.toLowerCase().trim();
        
        if (normalized.includes('bangalore') || normalized.includes('bengaluru')) return 'Bengaluru';
        if (normalized.includes('hyderabad')) return 'Hyderabad';
        if (normalized.includes('pune')) return 'Pune';
        if (normalized.includes('mumbai')) return 'Mumbai';
        if (normalized.includes('chennai')) return 'Chennai';
        if (normalized.includes('delhi') || normalized.includes('noida') || normalized.includes('gurgaon') || normalized.includes('gurugram') || normalized.includes('ncr')) return 'Delhi NCR';
        
        // Fallback: try to match exactly or case-insensitive
        return loc;
    };

    const targetVal = normalize(location);
    
    // Find option with this value
    let found = false;
    for (let i = 0; i < locationSelect.options.length; i++) {
        if (locationSelect.options[i].value === targetVal) {
            locationSelect.selectedIndex = i;
            found = true;
            break;
        }
    }
    
    if (found) {
        window.handleFilters();
        // Scroll to jobs grid
        document.getElementById('jobsGrid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        console.warn('Location not found in filter:', targetVal);
        // Optional: show a toast or alert that no jobs found for this location
    }
};


async function updateCategoryCounts() {
    try {
        // Get total count for all jobs
        const [bankSnapshot, govSnapshot, privateSnapshot] = await Promise.all([
            getDocs(query(collection(db, 'bankJobs'), where('isActive', '==', true))),
            getDocs(query(collection(db, 'governmentJobs'), where('isActive', '==', true))),
            getDocs(query(collection(db, 'jobs'), where('isActive', '==', true)))
        ]);

        const totalCount = bankSnapshot.size + govSnapshot.size + privateSnapshot.size;
        const allCountElement = document.getElementById('allCount');
        if (allCountElement) {
            allCountElement.textContent = totalCount;
        }

        const allCountHeader = document.getElementById('totalJobCount');
        if (allCountHeader) {
            allCountHeader.textContent = totalCount;
        }

        // For private job categories
        const categories = ['IT', 'marketing', 'finance', 'sales', 'hr'];
        for (const category of categories) {
            const q = query(
                collection(db, 'jobs'),
                where('jobCategory', '==', category),
                where('jobType', '==', 'private')
            );

            const snapshot = await getDocs(q);
            const countElement = document.getElementById(`${category.toLowerCase()}Count`);
            if (countElement) {
                countElement.textContent = snapshot.size || '0';
            }
        }

        // For bank jobs
        const bankQ = query(
            collection(db, 'bankJobs'),
            where('isActive', '==', true),
            where('jobType', '==', 'bank')  // Added type check
        );
        const bankCount = document.getElementById('bankCount');
        if (bankCount) {
            bankCount.textContent = bankSnapshot.size || '0';
        }

        // For government jobs
        const govQ = query(
            collection(db, 'governmentJobs'),
            where('jobType', '==', 'government')  // Added type check
        );
        const govCount = document.getElementById('govCount');
        if (govCount) {
            govCount.textContent = govSnapshot.size || '0';
        }

    } catch (error) {
        console.error('Error updating category counts:', error);
        // Set all counts to 0 if there's an error
        const categories = ['it', 'marketing', 'finance', 'sales', 'hr', 'bank', 'gov'];
        categories.forEach(cat => {
            const element = document.getElementById(`${cat}Count`);
            if (element) element.textContent = '0';
        });
    }
}





// Handle job type filter changes
document.getElementById('jobTypeFilter')?.addEventListener('change', async (e) => {
    const selectedType = e.target.value;
    try {
        const jobs = {};
        if (selectedType === 'all') {
            jobs.bank = await getJobs('bank');
            jobs.government = await getJobs('government');
            jobs.private = await getJobs('private');
        } else {
            jobs[selectedType] = await getJobs(selectedType);
        }
        displayJobs(jobs);
    } catch (error) {
        console.error('Error filtering jobs:', error);
    }
});


function formatDate(dateInput) {
    if (!dateInput) return 'N/A';

    // Handle Firestore Timestamp
    let date;
    if (dateInput && dateInput.seconds) {
        date = new Date(dateInput.seconds * 1000);
    } else {
        date = new Date(dateInput);
    }

    // Keep the original UTC date and just format it
    return date.toLocaleString('en-IN', {
        timeZone: 'UTC',  // Use UTC to prevent double timezone conversion
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}
// In your displayJobs function, after setting the jobsGrid innerHTML
jobsGrid.addEventListener('click', (e) => {
  const applyButton = e.target.closest('.apply-btn');
  if (applyButton) {
    const jobId = applyButton.dataset.jobId;
    const jobType = applyButton.dataset.jobType;
    if (jobId && jobType) {
      const card = applyButton.closest('.job-list-card');
      const titleEl = card?.querySelector('.job-title-heading');
      const headerTitle = titleEl?.textContent || '';
      const parts = headerTitle.split('|').map(s => s.trim());
      const jobTitle = parts[0] || '';
      const companyName = parts[1] || '';
      const location = parts[2] || '';
      const slugify = (s) => (s || '').toLowerCase().replace(/[\s/|_]+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const jobSlug = `${slugify(jobTitle)}-${slugify(companyName)}-${slugify(location)}~${jobId}`;
      window.location.href = `/html/job-details.html?type=${jobType}&id=${jobId}&slug=${encodeURIComponent(jobSlug)}`;
    }
  }
});

// Add missing export statement if needed
export { getJobs, filterByCategory, updateCategoryCounts, initializeJobs };

window.handleFilters = debounce(() => {
    applyFilters();
}, 300);

window.applyFilters = async () => {
    const jobTypeEl = document.getElementById('jobTypeFilter');
    const jobType = jobTypeEl ? jobTypeEl.value : 'all';
    const location = document.getElementById('locationFilter').value;
    const isFresher = document.getElementById('fresherCheck').checked;
    const isExperienced = document.getElementById('experiencedCheck').checked;
    const searchInput = document.getElementById('jobSearch');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    try {
        let jobs = {};
        
        // Helper to check if a job matches search term
        const matchesSearch = (job) => {
            if (!searchTerm) return true;
            const title = job.title || job.jobTitle || job.postName || '';
            const company = job.company || job.companyName || job.department || job.bankName || '';
            const loc = job.location || job.state || '';
            const skills = job.skills || [];
            const referralCode = job.referralCode ? String(job.referralCode) : '';
            
            const searchableText = `
                ${title.toLowerCase()} 
                ${company.toLowerCase()} 
                ${loc.toLowerCase()} 
                ${skills.join(' ').toLowerCase()}
                ${referralCode.toLowerCase()}
                ref: ${referralCode.toLowerCase()}
                ref:${referralCode.toLowerCase()}
            `;
            return searchableText.includes(searchTerm);
        };
        
        // Helper to normalize location for comparison
        const normalizeLocation = (loc) => {
            if (!loc) return '';
            let normalized = loc.toLowerCase().trim();
            if (normalized.includes('bangalore') || normalized.includes('bengaluru') || normalized.includes('bangaluru')) return 'Bengaluru';
            if (normalized.includes('hyderabad')) return 'Hyderabad';
            if (normalized.includes('pune')) return 'Pune';
            if (normalized.includes('mumbai')) return 'Mumbai';
            if (normalized.includes('chennai')) return 'Chennai';
            if (normalized.includes('delhi') || normalized.includes('noida') || normalized.includes('gurgaon') || normalized.includes('gurugram')) return 'Delhi NCR';
            return loc; // Fallback to original if no match
        };

        const filterByLocation = (jobLoc) => {
             if (location === 'all') return true;
             
             // Normalize both the job location and the selected filter location
             const jobNorm = normalizeLocation(jobLoc || '').toLowerCase();
             const filterNorm = location.toLowerCase(); // The location filter value is already normalized by populateLocationFilter
             
             return jobNorm === filterNorm;
        };

        if (jobType === 'all' || jobType === 'bank') {
            const bankRef = collection(db, 'bankJobs');
            const conditions = [where('isActive', '==', true)];
            // Don't filter by location in query anymore, do it in memory
            // if (location !== 'all') conditions.push(where('location', '==', location));
            const bankSnapshot = await getDocs(query(bankRef, ...conditions));
            jobs.bank = bankSnapshot.docs
                .map(doc => ({ id: doc.id, type: 'bank', ...doc.data() }))
                .filter(job => matchesSearch(job) && filterByLocation(job.location || job.state));
        }

        if (jobType === 'all' || jobType === 'government') {
            const govRef = collection(db, 'governmentJobs');
            const conditions = [where('isActive', '==', true)];
            // Don't filter by location in query anymore, do it in memory
            // if (location !== 'all') conditions.push(where('location', '==', location));
            const govSnapshot = await getDocs(query(govRef, ...conditions));
            jobs.government = govSnapshot.docs
                .map(doc => ({ id: doc.id, type: 'government', ...doc.data() }))
                .filter(job => matchesSearch(job) && filterByLocation(job.location || job.state));
        }

        if (jobType === 'all' || jobType === 'private') {
            const privateRef = collection(db, 'jobs');
            const conditions = [where('isActive', '==', true)];
            // Don't filter by location in query anymore, do it in memory
            // if (location !== 'all') conditions.push(where('location', '==', location));
            if (isFresher && !isExperienced) conditions.push(where('experience', '==', 'fresher'));
            else if (!isFresher && isExperienced) conditions.push(where('experience', '!=', 'fresher'));
            
            const privateSnapshot = await getDocs(query(privateRef, ...conditions));
            jobs.private = await Promise.all(privateSnapshot.docs.map(async docItem => {
                let jobData = { id: docItem.id, type: 'private', ...docItem.data() };
                
                // Fetch user details (posted by)
                let postedByName = 'bcvworld';
                if (jobData.userId) {
                    try {
                        const userRef = doc(db, 'users', jobData.userId);
                        const userDoc = await getDoc(userRef);
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            postedByName = userData.firstName || userData.displayName || userData.name || 'bcvworld';
                        }
                    } catch (error) {
                        console.error(`Error fetching user details for job ${jobData.id}:`, error);
                    }
                }
                jobData.postedByName = postedByName;

                if (jobData.companyId) {
                    try {
                        const companyRef = doc(db, 'companies', jobData.companyId);
                        const companyDoc = await getDoc(companyRef);
                        if (companyDoc.exists()) {
                            const companyData = companyDoc.data();
                            jobData = {
                                ...jobData,
                                companyName: companyData.name || jobData.companyName || '',
                                companyLogo: companyData.logoURL || jobData.companyLogo || '',
                                companyWebsite: companyData.website || jobData.companyWebsite || '',
                                companyAbout: companyData.about || jobData.companyAbout || ''
                            };
                        }
                    } catch (error) {
                        console.error('Error fetching company details:', error);
                    }
                }

                if (!matchesSearch(jobData)) return null;
                if (!filterByLocation(jobData.location)) return null;
                
                return jobData;
            }));
            // Filter out nulls
            jobs.private = jobs.private.filter(j => j !== null);
        }

        displayJobs(jobs, 'filter', { jobType, location, isFresher, isExperienced, searchTerm });
    } catch (error) {
        console.error('Error applying filters:', error);
        showToast('Error applying filters. Please try again.', false);
    }
};
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function enrichJobsWithCompanyDetails(jobs) {
    return Promise.all(jobs.map(async (job) => {
        // Use existing company name if available to skip fetch if detail not critical
        // But for consistency we fetch if we have ID
        if (job.companyId) {
            try {
                // Check if we already have company name and logo (denormalized)
                // If so, maybe skip? For now, let's just fetch to be safe but cache could be better
                const companyRef = doc(db, 'companies', job.companyId);
                const companyDoc = await getDoc(companyRef);

                if (companyDoc.exists()) {
                    const companyData = companyDoc.data();
                    return {
                        ...job,
                        company: companyData.name || job.company,
                        companyLogo: companyData.logoURL || null,
                        companyWebsite: companyData.website || null,
                        companyAbout: companyData.about || null
                    };
                }
            } catch (error) {
                console.error('Error fetching company details:', error);
            }
        }
        return job;
    }));
}


async function getRecentJobs(limitCount = 4) {
    try {
        const jobsRef = collection(db, 'jobs');
        const q = query(
            jobsRef,
            where('isActive', '==', true),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );

        const snapshot = await getDocs(q);
        
        // Initial map to basic structure
        const basicJobs = snapshot.docs.map(docItem => ({
            id: docItem.id,
            type: 'private',
            title: docItem.data().jobTitle,
            company: docItem.data().companyName,
            location: docItem.data().location,
            createdAt: docItem.data().createdAt,
            postedAt: formatDate(docItem.data().createdAt),
            companyId: docItem.data().companyId
        }));

        // Enrich with company details
        return await enrichJobsWithCompanyDetails(basicJobs);
    } catch (error) {
        console.error('Error fetching recent jobs:', error);
        return [];
    }
}


async function getMostViewedJobs(limitCount = 4) {
    try {
        const jobsRef = collection(db, 'jobs');
        // Fetch more jobs to find the most viewed ones effectively without a specific index
        // We fetch 20 recent active jobs to find the "trending" ones
        const q = query(
            jobsRef,
            where('isActive', '==', true),
            orderBy('createdAt', 'desc'),
            limit(20)
        );

        const snapshot = await getDocs(q);
        
        // Map to basic structure first
        let jobs = snapshot.docs.map(docItem => ({
            id: docItem.id,
            type: 'private',
            title: docItem.data().jobTitle,
            company: docItem.data().companyName,
            location: docItem.data().location,
            createdAt: docItem.data().createdAt,
            postedAt: formatDate(docItem.data().createdAt),
            views: docItem.data().views || 0,
            companyId: docItem.data().companyId
        }));

        // Sort by views and apply limit BEFORE fetching company details
        jobs = jobs
            .sort((a, b) => (b.views || 0) - (a.views || 0))
            .slice(0, limitCount);

        // Now enrich only the top jobs
        return await enrichJobsWithCompanyDetails(jobs);
    } catch (error) {
        console.error('Error fetching most viewed jobs:', error);
        return [];
    }
}


const loadSidebarJobs = async () => {
    try {
        const [recentJobs, mostViewedJobs] = await Promise.all([
            getRecentJobs(4),
            getMostViewedJobs(4)
        ]);

        // Update counts in the headers
        const recentCount = document.getElementById('recentJobsCount');
        const viewedCount = document.getElementById('mostViewedJobsCount');
        if (recentCount) recentCount.textContent = recentJobs.length;
        if (viewedCount) viewedCount.textContent = mostViewedJobs.length;

        ['recentJobs', 'mostViewedJobs'].forEach((containerId) => {
            const container = document.getElementById(containerId);
            if (!container) return;

            const jobs = containerId === 'recentJobs' ? recentJobs : mostViewedJobs;

            container.innerHTML = jobs.map((job, index) => `
                <a href="/html/job-details.html?type=${job.type}&id=${job.id}&slug=${encodeURIComponent(
                    [(job.title||job.jobTitle||'').toLowerCase().replace(/[\s/|_]+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,''),
                     (job.company||job.companyName||'').toLowerCase().replace(/[\s/|_]+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,''),
                     (job.location||'').toLowerCase().replace(/[\s/|_]+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,'')
                    ].filter(Boolean).join('-') + '~' + job.id)}" 
                   class="list-group-item list-group-item-action py-2 fade-in"
                   style="animation-delay: ${index * 0.1}s">
                    <div class="d-flex justify-content-between align-items-start">
                        <h6 class="mb-1 text-truncate" style="max-width: 80%;">${job.title}</h6>
                        ${containerId === 'mostViewedJobs' ?
                    `<span class="badge bg-primary rounded-pill">#${index + 1}</span>` : ''}
                    </div>
                    <p class="mb-1 small text-muted text-truncate company-name hover-effect">${job.company}</p>
                    <div class="d-flex justify-content-between align-items-center content-container">
                        <small class="text-truncate" style="max-width: 60%;">${job.location}</small>
                        ${containerId === 'mostViewedJobs' ?
                    `<small class="text-muted"><i class="bi bi-eye-fill"></i> ${job.views}</small>` :
                    `<small class="text-muted"><i class="bi bi-calendar"></i> ${job.postedAt}</small>`}
                    </div>
                </a>
            `).join('');
        });
    } catch (error) {
        console.error('Error loading sidebar jobs:', error);
    }
};

window.handleSearchWithSuggestions = debounce(async (event) => {
    const searchTerm = event.target.value.toLowerCase().trim();
    const suggestionsBox = document.getElementById('searchSuggestions');
    
    // Update main list via applyFilters which now handles search
    applyFilters();

    if (!searchTerm || searchTerm.length < 3) {
        if (suggestionsBox) suggestionsBox.classList.add('d-none');
        return;
    }

    try {
        if (!window.allJobsCache) {
             const [bank, gov, pvt, companiesSnap] = await Promise.all([
                getDocs(query(collection(db, 'bankJobs'), where('isActive', '==', true))),
                getDocs(query(collection(db, 'governmentJobs'), where('isActive', '==', true))),
                getDocs(query(collection(db, 'jobs'), where('isActive', '==', true))),
                getDocs(query(collection(db, 'companies')))
             ]);

             const companiesMap = new Map();
             companiesSnap.docs.forEach(doc => {
                 companiesMap.set(doc.id, doc.data());
             });

             window.allJobsCache = [
                 ...bank.docs.map(d => ({...d.data(), type: 'bank'})),
                 ...gov.docs.map(d => ({...d.data(), type: 'government'})),
                 ...pvt.docs.map(d => {
                     const data = d.data();
                     let companyName = data.companyName;
                     if (data.companyId && companiesMap.has(data.companyId)) {
                         const company = companiesMap.get(data.companyId);
                         companyName = company.name || companyName;
                     }
                     return {...data, companyName, type: 'private'};
                 })
             ];
        }
        
        const jobs = window.allJobsCache;
        const suggestions = new Set();
        
        jobs.forEach(job => {
            const title = job.title || job.jobTitle || job.postName || '';
            const company = job.company || job.companyName || job.department || job.bankName || '';
            const loc = job.location || job.state || '';
            const referralCode = job.referralCode ? String(job.referralCode) : '';
            
            if (title.toLowerCase().includes(searchTerm)) suggestions.add(title);
            if (company.toLowerCase().includes(searchTerm)) suggestions.add(company);
            if (loc.toLowerCase().includes(searchTerm)) suggestions.add(loc);
            
            if (referralCode) {
                if (referralCode.toLowerCase().includes(searchTerm)) suggestions.add(referralCode);
                const refString = `Ref: ${referralCode}`;
                if (refString.toLowerCase().includes(searchTerm)) suggestions.add(refString);
            }

            if (job.skills) {
                job.skills.forEach(s => {
                    if (s.toLowerCase().includes(searchTerm)) suggestions.add(s);
                });
            }
        });
        
        const uniqueSuggestions = Array.from(suggestions).slice(0, 5);
        
        if (suggestionsBox && uniqueSuggestions.length > 0) {
            suggestionsBox.innerHTML = uniqueSuggestions.map(s => `
                <div class="p-2 border-bottom suggestion-item" style="cursor: pointer; transition: background-color 0.2s;" 
                    onmouseover="this.style.backgroundColor='#f8f9fa'" onmouseout="this.style.backgroundColor='white'"
                    onclick="selectSuggestion('${s.replace(/'/g, "\\'")}')">
                    <i class="bi bi-search me-2 text-muted small"></i><span class="small">${s}</span>
                </div>
            `).join('');
            suggestionsBox.classList.remove('d-none');
        } else if (suggestionsBox) {
            suggestionsBox.classList.add('d-none');
        }
        
    } catch (e) {
        console.error("Error fetching suggestions", e);
    }

}, 300);

window.selectSuggestion = (value) => {
    const input = document.getElementById('jobSearch');
    if (input) {
        input.value = value;
        document.getElementById('searchSuggestions').classList.add('d-none');
        applyFilters(); 
    }
};

document.addEventListener('click', (e) => {
    const suggestionsBox = document.getElementById('searchSuggestions');
    const searchInput = document.getElementById('jobSearch');
    if (suggestionsBox && searchInput && !searchInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
        suggestionsBox.classList.add('d-none');
    }
});

// Alias for backward compatibility if needed, though we use handleSearchWithSuggestions in HTML
window.handleSearch = window.handleSearchWithSuggestions;



// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Parse initial page from URL
    const urlParams = new URLSearchParams(window.location.search);
    currentPaginationState.page = parseInt(urlParams.get('page')) || 1;
    
    // Restore scroll position if needed
    const scrollPosition = sessionStorage.getItem('scrollPosition');
    if (scrollPosition) {
        window.scrollTo(0, parseInt(scrollPosition));
        sessionStorage.removeItem('scrollPosition');
    }
    
    initializePage();
});

// Handle cases where page might be partially loaded
if (document.readyState === 'interactive' || document.readyState === 'complete') {
    initializePage();
}



async function loadCompanyWiseJobs() {
    try {
        const jobsRef = collection(db, 'jobs');
        const q = query(jobsRef, where('isActive', '==', true));
        const snapshot = await getDocs(q);

        // Get current date in IST
        const nowIST = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
        const currentDate = new Date(nowIST);
        
        // Calculate 1 month ago in IST
        const oneMonthAgoIST = new Date(currentDate);
        oneMonthAgoIST.setMonth(oneMonthAgoIST.getMonth() - 1);

        // Object to store companies
        const companies = {};
        let validJobsCount = 0;
        const companyPromises = [];

        // Process each job
        for (const docItem of snapshot.docs) {
            const job = docItem.data();
            
            // Convert Firestore timestamps or strings to Date objects
            const createdAt = job.createdAt?.toDate 
                ? job.createdAt.toDate() 
                : new Date(job.createdAt || currentDate);
            
            const lastDate = job.lastDate?.toDate 
                ? job.lastDate.toDate() 
                : job.lastDate ? new Date(job.lastDate) : null;

            // Apply date filters
            const isRecent = createdAt >= oneMonthAgoIST;
            const isNotExpired = !lastDate || lastDate >= currentDate;
            
            if (!isRecent || !isNotExpired) continue;
            
            validJobsCount++;

            // Handle company grouping (both old and new format)
            const companyKey = job.companyId || `old_${job.companyName || 'unknown'}`;
            
            if (!companies[companyKey]) {
                companies[companyKey] = {
                    id: companyKey,
                    name: job.companyName || 'Unknown Company',
                    logo: job.companyLogo 
                        ? (job.companyLogo.startsWith('http') 
                            ? job.companyLogo 
                            : `/assets/images/companies/${job.companyLogo}`)
                        : '/assets/images/companies/default-company.webp',
                    jobs: [],
                    isOldFormat: !job.companyId
                };
                
                // For new format, try to fetch company details
                if (job.companyId) {
                    const promise = (async () => {
                        try {
                            const companyRef = doc(db, 'companies', job.companyId);
                            const companyDoc = await getDoc(companyRef);
                            if (companyDoc.exists()) {
                                const companyData = companyDoc.data();
                                companies[companyKey].name = companyData.name || companies[companyKey].name;
                                companies[companyKey].logo = companyData.logoURL || companies[companyKey].logo;
                            }
                        } catch (error) {
                            console.error(`Error fetching company ${job.companyId}:`, error);
                        }
                    })();
                    companyPromises.push(promise);
                }
            }
            
            companies[companyKey].jobs.push({
                id: docItem.id,
                ...job,
                createdAt,
                lastDate
            });
        }

        // Wait for all company details to be fetched
        await Promise.all(companyPromises);

        // Prepare final company list
        const companyArray = Object.values(companies)
            .filter(company => company.jobs.length > 0)
            .sort((a, b) => b.jobs.length - a.jobs.length)
            .slice(0, 5);

        // Update UI with counts
        const companyCountElement = document.getElementById('companyCount');
        
        if (companyCountElement) companyCountElement.textContent = companyArray.length;

        // Render companies
        const companyJobsContainer = document.getElementById('companyJobs');
        if (companyJobsContainer) {
            companyJobsContainer.innerHTML = companyArray.map(company => `
                <div class="list-group-item company-item py-3" 
                     onclick="showCompanyRoles('${company.id}', ${company.isOldFormat})">
                    <div class="d-flex align-items-center">
                        <div class="company-logo me-3">
                            <img src="${company.logo}" 
                                 alt="${company.name}" 
                                 class="rounded-circle"
                                 style="width: 40px; height: 40px; object-fit: cover;"
                                 onerror="this.src='/assets/images/companies/default-company.webp'">
                        </div>
                        <div>
                            <h6 class="mb-1 company-name">${company.name}</h6>
                            <small class="job-count">${company.jobs.length} active position${company.jobs.length !== 1 ? 's' : ''}</small>
                        </div>
                    </div>
                </div>
            `).join('');
        }

    } catch (error) {
        console.error('Error loading company wise jobs:', error);
        showToast('Error loading company listings. Please try again.', false);
    }
}

// Updated showCompanyRoles to handle both old and new format
window.showCompanyRoles = async function(companyIdentifier, isOldFormat) {
    try {
        const companyJobs = document.getElementById('companyJobs');
        const companyRoles = document.getElementById('companyRoles');
        
        let jobs = [];
        let companyName = '';
        let companyLogo = '/assets/images/companies/default-company.webp';

        // Get current date in IST for filtering
        const nowIST = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
        const currentDate = new Date(nowIST);
        const oneMonthAgo = new Date(currentDate);
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        if (isOldFormat) {
            // Handle old format (company name-based)
            const companyNameParam = companyIdentifier.replace('old_', '');
            const jobsRef = collection(db, 'jobs');
            const q = query(
                jobsRef,
                where('isActive', '==', true),
                where('companyName', '==', companyNameParam)
            );
            const snapshot = await getDocs(q);
            
            jobs = snapshot.docs.map(docItem => {
                const job = docItem.data();
                const createdAt = job.createdAt?.toDate ? job.createdAt.toDate() : new Date(job.createdAt);
                const lastDate = job.lastDate?.toDate ? job.lastDate.toDate() : job.lastDate ? new Date(job.lastDate) : null;
                
                return {
                    id: docItem.id,
                    ...job,
                    createdAt,
                    lastDate,
                    companyLogo: job.companyLogo || companyLogo
                };
            }).filter(job => {
                return job.createdAt >= oneMonthAgo && (!job.lastDate || job.lastDate >= currentDate);
            });
            
            if (jobs.length > 0) {
                companyName = jobs[0].companyName;
                companyLogo = jobs[0].companyLogo || companyLogo;
            }
        } else {
            // Handle new format (company ID-based)
            const companyRef = doc(db, 'companies', companyIdentifier);
            const companyDoc = await getDoc(companyRef);
            const companyData = companyDoc.exists() ? companyDoc.data() : null;
            
            const jobsRef = collection(db, 'jobs');
            const q = query(
                jobsRef,
                where('isActive', '==', true),
                where('companyId', '==', companyIdentifier)
            );
            const snapshot = await getDocs(q);
            
            jobs = snapshot.docs.map(docItem => {
                const job = docItem.data();
                const createdAt = job.createdAt?.toDate ? job.createdAt.toDate() : new Date(job.createdAt);
                const lastDate = job.lastDate?.toDate ? job.lastDate.toDate() : job.lastDate ? new Date(job.lastDate) : null;
                
                return {
                    id: docItem.id,
                    ...job,
                    createdAt,
                    lastDate
                };
            }).filter(job => {
                return job.createdAt >= oneMonthAgo && (!job.lastDate || job.lastDate >= currentDate);
            });
            
            if (companyData) {
                companyName = companyData.name;
                companyLogo = companyData.logoURL || companyLogo;
            } else if (jobs.length > 0) {
                companyName = jobs[0].companyName;
            }
        }

        // Render the company roles
        companyRoles.innerHTML = `
            <div class="p-2 border-bottom d-flex justify-content-between align-items-center">
                <button class="btn btn-link btn-sm text-decoration-none p-0" onclick="showCompanyList()">
                    <i class="bi bi-arrow-left"></i> Back to Companies
                </button>
                <div class="company-header-info">
                    <img src="${companyLogo}" 
                         alt="${companyName}" 
                         class="rounded-circle me-2"
                         style="width: 30px; height: 30px; object-fit: cover;"
                         onerror="this.src='/assets/images/companies/default-company.webp'">
                    <span class="fw-bold">${companyName}</span>
                </div>
            </div>
            ${jobs.map(job => `
                <a href="/html/job-details.html?type=private&id=${job.id}&slug=${encodeURIComponent(
                    [(job.jobTitle||'').toLowerCase().replace(/[\s/|_]+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,''),
                     (job.companyName||companyName||'').toLowerCase().replace(/[\s/|_]+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,''),
                     (job.location||'').toLowerCase().replace(/[\s/|_]+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,'')
                    ].filter(Boolean).join('-') + '~' + job.id)}" 
                   class="list-group-item list-group-item-action role-item py-3">
                    <h6 class="mb-1">${job.jobTitle}</h6>
                    <div class="d-flex align-items-center justify-content-between">
                        <small class="text-muted">
                            <i class="bi bi-geo-alt"></i> ${job.location}
                        </small>
                        <small class="text-muted">
                            <i class="bi bi-clock"></i> ${formatDate(job.createdAt)}
                        </small>
                    </div>
                </a>
            `).join('')}
        `;

        companyJobs.classList.add('d-none');
        companyRoles.classList.remove('d-none');

    } catch (error) {
        console.error('Error showing company roles:', error);
        showToast('Error loading company details. Please try again.', false);
    }
};





window.showCompanyList = () => {
    const companyJobs = document.getElementById('companyJobs');
    const companyRoles = document.getElementById('companyRoles');

    companyRoles.classList.add('d-none');
    companyJobs.classList.remove('d-none');
};

async function populateLocationFilter() {
    try {
        const locations = new Set();

        // Get locations from private jobs
        const privateRef = collection(db, 'jobs');
        const privateSnapshot = await getDocs(privateRef);
        privateSnapshot.docs.forEach(doc => {
            const location = doc.data().location;
            if (location) locations.add(location.trim());
        });

        // Get locations from bank jobs
        const bankRef = collection(db, 'bankJobs');
        const bankSnapshot = await getDocs(bankRef);
        bankSnapshot.docs.forEach(doc => {
            const state = doc.data().state;
            if (state) locations.add(state.trim());
        });

        // Get locations from government jobs
        const govRef = collection(db, 'governmentJobs');
        const govSnapshot = await getDocs(govRef);
        govSnapshot.docs.forEach(doc => {
            const state = doc.data().state;
            if (state) locations.add(state.trim());
        });

        // Sort locations alphabetically
        const sortedLocations = Array.from(locations).sort();

        // Populate the select element
        const locationFilter = document.getElementById('locationFilter');
        if (locationFilter) {
            // Clear existing options except the first one (if any)
            while (locationFilter.options.length > 1) {
                locationFilter.remove(1);
            }

            // Normalization helper function
            const normalizeLocation = (loc) => {
                if (!loc) return '';
                // Common normalizations
                let normalized = loc.toLowerCase().trim();
                
                // Handle various Bengaluru formats
                if (normalized.includes('bangalore') || 
                    normalized.includes('bengaluru') || 
                    normalized.includes('bangaluru')) {
                    return 'Bengaluru';
                }
                
                // Handle Hyderabad
                if (normalized.includes('hyderabad')) {
                    return 'Hyderabad';
                }
                
                // Handle Pune
                if (normalized.includes('pune')) {
                    return 'Pune';
                }
                
                // Handle Mumbai
                if (normalized.includes('mumbai')) {
                    return 'Mumbai';
                }
                
                // Handle Chennai
                if (normalized.includes('chennai')) {
                    return 'Chennai';
                }
                
                // Handle Delhi/NCR
                if (normalized.includes('delhi') || normalized.includes('noida') || normalized.includes('gurgaon') || normalized.includes('gurugram')) {
                    return 'Delhi NCR';
                }
                
                // Return capitalized first letter for others
                return loc.split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');
            };

            // Process and normalize locations
            const uniqueLocations = new Set();
            sortedLocations.forEach(loc => {
                const normalized = normalizeLocation(loc);
                if (normalized) uniqueLocations.add(normalized);
            });

            // Add sorted unique locations
            Array.from(uniqueLocations).sort().forEach(location => {
                const option = document.createElement('option');
                option.value = location;
                option.textContent = location;
                option.title = location;
                locationFilter.appendChild(option);
            });
        }

    } catch (error) {
        console.error('Error populating location filter:', error);
    }
}
window.clearFilters = async () => {
    // Reset all filters to default values
    const jobTypeEl = document.getElementById('jobTypeFilter');
    if (jobTypeEl) jobTypeEl.value = 'all';
    
    document.getElementById('locationFilter').value = 'all';
    document.getElementById('fresherCheck').checked = false;
    document.getElementById('experiencedCheck').checked = false;
    
    const searchInput = document.getElementById('jobSearch');
    if (searchInput) searchInput.value = '';

    const suggestionsBox = document.getElementById('searchSuggestions');
    if (suggestionsBox) suggestionsBox.classList.add('d-none');

    // Fetch and display all jobs
    try {
        let jobs = {};
        jobs.bank = await getJobs('bank');
        jobs.government = await getJobs('government');
        jobs.private = await getJobs('private');
        displayJobs(jobs);
    } catch (error) {
        console.error('Error clearing filters:', error);
    }
};




async function getJobsByDate(selectedDate) {
    try {
        const [privateSnapshot, govSnapshot, bankSnapshot] = await Promise.all([
            getDocs(query(collection(db, 'jobs'), where('isActive', '==', true))),
            getDocs(query(collection(db, 'governmentJobs'), where('isActive', '==', true))),
            getDocs(query(collection(db, 'bankJobs'), where('isActive', '==', true)))
        ]);

        const dayStr = selectedDate;

        const inSelectedIndianDay = (data) => {
            const raw = data.createdAt || data.postedAt;
            let d = null;
            if (raw && raw.seconds) { d = new Date(raw.seconds * 1000); }
            else if (typeof raw === 'string') { d = new Date(raw); }
            else if (raw instanceof Date) { d = raw; }
            if (!d) return false;
            const indian = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
            const s = formatDateForInput(indian);
            return s === dayStr;
        };

        const processJobsWithCompany = async (docs, type) => {
            const filtered = docs.filter(docItem => inSelectedIndianDay(docItem.data()));
            return await Promise.all(filtered.map(async (docItem) => {
                const jobData = { id: docItem.id, type, ...docItem.data() };
                if (jobData.companyId) {
                    try {
                        const companyRef = doc(db, 'companies', jobData.companyId);
                        const companyDoc = await getDoc(companyRef);
                        if (companyDoc.exists()) {
                            const companyData = companyDoc.data();
                            return {
                                ...jobData,
                                companyName: companyData.name || jobData.companyName || '',
                                companyLogo: companyData.logoURL || jobData.companyLogo || '',
                                companyWebsite: companyData.website || jobData.companyWebsite || '',
                                companyAbout: companyData.about || jobData.companyAbout || ''
                            };
                        }
                    } catch (error) {
                        console.error('Error fetching company details:', error);
                        return jobData;
                    }
                }
                return jobData;
            }));
        };

        return {
            private: await processJobsWithCompany(privateSnapshot.docs, 'private'),
            government: await processJobsWithCompany(govSnapshot.docs, 'government'),
            bank: await processJobsWithCompany(bankSnapshot.docs, 'bank')
        };
    } catch (error) {
        console.error('Error getting jobs by date:', error);
        return { private: [], government: [], bank: [] };
    }
}


// Initialize with proper date handling
async function initializeJobsbyDateFilter() {
    try {
        // Get current date in Indian timezone
        const today = new Date();
        const indianDate = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const todayStr = formatDateForInput(indianDate);

        // Set date picker value (in Indian time format)
        const datePicker = document.getElementById('dateFilter');
        if (datePicker) {
            datePicker.value = todayStr; // Shows current Indian date
        }

        // Load jobs for today
        const jobs = await getJobsByDate(todayStr);
        displayJobs(jobs);
        updateCategoryCounts();
    } catch (error) {
        console.error("Initialization error:", error);
    }
}




window.filterJobsByDate = async function(selectedDate) {
    if (!selectedDate) return;
    try {
        const jobs = await getJobsByDate(selectedDate);
        
        // Update the job count display
        const totalJobs = Object.values(jobs).reduce((sum, jobsList) => sum + jobsList.length, 0);
        const jobCountElement = document.getElementById('jobCount');
        if (jobCountElement) {
            jobCountElement.textContent = totalJobs;
        }
        
        displayJobs(jobs, 'date', selectedDate);
    } catch (error) {
        console.error('Error filtering by date:', error);
        showToast('Error filtering by date. Please try again.', false);
    }
};

function formatDateForInput(date) {
    const indianDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const year = indianDate.getFullYear();
    const month = String(indianDate.getMonth() + 1).padStart(2, '0');
    const day = String(indianDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}



// Call initializePage when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
    setupPagination();
});

// Handle cases where page might be partially loaded
if (document.readyState === 'interactive' || document.readyState === 'complete') {
    initializePage();
    setupPagination();
}

document.addEventListener('DOMContentLoaded', initializePage);

function clearDateFilter() {
    console.log("Clearing date filter");
    const dateInput = document.getElementById('dateFilter');
    dateInput.value = '';

    const today = new Date();
    const todayFormatted = formatDateForInput(today);
    dateInput.value = todayFormatted;
    initializeJobsbyDateFilter(todayFormatted);
}
window.handleNewsletterSubmit = async (event) => {
    event.preventDefault();

    const emailInput = document.getElementById('newsletterEmail');
    const submitButton = event.target.querySelector('button[type="submit"]');
    const email = emailInput.value.trim();

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('Please enter a valid email address', false);
        return;
    }

    // Disable button during submission
    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Checking...';

    try {
        // Check if email already exists
        const q = query(collection(db, "subscriptions"), where("email", "==", email));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            showToast('You are already subscribed! Thank you.', false);
            return;
        }

        // Add email to Firebase if not exists
        submitButton.textContent = 'Subscribing...';
        await addDoc(collection(db, "subscriptions"), {
            email: email,
            subscriptionDate: serverTimestamp(),
            active: true,
            source: 'website'
        });

        // Clear input and show success
        emailInput.value = '';
        showToast('Thank you for subscribing! You will receive our latest updates.');
    } catch (error) {
        console.error("Error processing subscription: ", error);
        showToast('Subscription failed. Please try again.', false);
    } finally {
        // Re-enable button
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
    }
};


// Replace your error handling code with this:
function showToast(message, isSuccess = true) {
    const toast = document.createElement('div');
    toast.className = `custom-toast ${isSuccess ? 'success' : 'error'}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

async function getJobsByRange(startStr, endStr) {
    try {
        const [privateSnapshot, govSnapshot, bankSnapshot] = await Promise.all([
            getDocs(query(collection(db, 'jobs'), where('isActive', '==', true))),
            getDocs(query(collection(db, 'governmentJobs'), where('isActive', '==', true))),
            getDocs(query(collection(db, 'bankJobs'), where('isActive', '==', true)))
        ]);

        const start = new Date(startStr);
        const end = new Date(endStr);

        const processJobsWithCompany = async (docs, type) => {
            return await Promise.all(docs.map(async (docItem) => {
                const data = docItem.data();
                const jobData = { id: docItem.id, type, ...data };
                const rawDate = data.createdAt || data.postedAt;
                const dt = parseJobDate(rawDate);
                if (!dt) return null;
                // Compare in Indian timezone by converting to millis range
                const dtIndian = new Date(dt.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
                if (dtIndian < start || dtIndian > end) return null;
                if (jobData.companyId) {
                    try {
                        const companyRef = doc(db, 'companies', jobData.companyId);
                        const companyDoc = await getDoc(companyRef);
                        if (companyDoc.exists()) {
                            const companyData = companyDoc.data();
                            return {
                                ...jobData,
                                companyName: companyData.name || jobData.companyName || '',
                                companyLogo: companyData.logoURL || jobData.companyLogo || '',
                                companyWebsite: companyData.website || jobData.companyWebsite || '',
                                companyAbout: companyData.about || jobData.companyAbout || ''
                            };
                        }
                    } catch (error) {
                        console.error('Error fetching company details:', error);
                        return jobData;
                    }
                }
                return jobData;
            }));
        };

        const priv = (await processJobsWithCompany(privateSnapshot.docs, 'private')).filter(Boolean);
        const gov = (await processJobsWithCompany(govSnapshot.docs, 'government')).filter(Boolean);
        const bank = (await processJobsWithCompany(bankSnapshot.docs, 'bank')).filter(Boolean);
        return { private: priv, government: gov, bank: bank };
    } catch (error) {
        console.error('Error getting jobs by range:', error);
        return { private: [], government: [], bank: [] };
    }
}

function parseJobDate(raw) {
    try {
        if (!raw) return null;
        if (raw.seconds) return new Date(raw.seconds * 1000);
        if (typeof raw === 'string') {
            const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD
            const dmyDateOnly = /^\d{2}-\d{2}-\d{4}$/; // DD-MM-YYYY
            if (isoDateOnly.test(raw)) {
                const [y, m, d] = raw.split('-').map(Number);
                return new Date(y, m - 1, d);
            }
            if (dmyDateOnly.test(raw)) {
                const [d, m, y] = raw.split('-').map(Number);
                return new Date(y, m - 1, d);
            }
            return new Date(raw);
        }
        if (raw instanceof Date) return raw;
        return null;
    } catch (e) { return null; }
}
