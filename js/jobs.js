import { db } from './firebase-config.js';
import {
    collection,
    query,
    where,
    getDocs,
    orderBy,
    getDoc,
    doc, // Make sure this is imported
    serverTimestamp,
    addDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// Global state for pagination
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

        // Load today's jobs by default
        const jobs = await getJobsByDate(dateStr);
        displayJobs(jobs, 'date', dateStr);
        
        // Setup other components
        populateLocationFilter();
        updateCategoryCounts();
        loadSidebarJobs();
        loadCompanyWiseJobs();
        
        // Event listeners
        document.getElementById('clearFilterBtn').addEventListener('click', clearDateFilter);
        document.getElementById('searchForm').addEventListener('submit', (e) => e.preventDefault());
        
        // Setup pagination handlers
        setupPagination();

    } catch (error) {
        console.error("Initialization error:", error);
        showToast('Error initializing page. Please try again.', false);
    }
}

// Initialize jobs with proper pagination
async function initializeJobs() {
    try {
        const jobs = {
            bank: await getJobs('bank'),
            government: await getJobs('government'),
            private: await getJobs('private')
        };
        displayJobs(jobs, 'default');
    } catch (error) {
        console.error('Error initializing jobs:', error);
    }
}


async function getJobs(jobType) {
    try {
        let jobsRef;
        let q;

        // Get current date and 1 month ago date in IST
        const nowIST = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
        const currentDate = new Date(nowIST);
        const oneMonthAgo = new Date(currentDate);
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        switch (jobType) {
            case 'private':
                jobsRef = collection(db, 'jobs');
                q = query(
                    jobsRef,
                    where('isActive', '==', true),
                    orderBy('createdAt', 'desc')
                );
                break;
            case 'government':
                jobsRef = collection(db, 'governmentJobs');
                q = query(
                    jobsRef,
                    where('isActive', '==', true),
                    orderBy('createdAt', 'desc')
                );
                break;
            case 'bank':
                jobsRef = collection(db, 'bankJobs');
                q = query(
                    jobsRef,
                    where('isActive', '==', true),
                    orderBy('createdAt', 'desc')
                );
                break;
            default:
                jobsRef = collection(db, 'jobs');
                q = query(
                    jobsRef,
                    where('isActive', '==', true),
                    orderBy('createdAt', 'desc')
                );
        }

        const snapshot = await getDocs(q);
        console.log(`Query executed for ${jobType} jobs. Results:`, snapshot.size);

        // Process jobs with date filtering and company details
        const jobs = await Promise.all(snapshot.docs.map(async (docItem) => {
            const jobData = {
                id: docItem.id,
                type: jobType,
                ...docItem.data()
            };

            // Convert dates to IST
            const createdAt = jobData.createdAt?.toDate 
                ? jobData.createdAt.toDate() 
                : new Date(jobData.createdAt || currentDate);
            const lastDate = jobData.lastDate?.toDate 
                ? jobData.lastDate.toDate() 
                : jobData.lastDate ? new Date(jobData.lastDate) : null;

            // Apply date filters
            const isRecent = createdAt >= oneMonthAgo;
            const isNotExpired = !lastDate || lastDate >= currentDate;
            
            if (!isRecent || !isNotExpired) return null;

            // Fetch company details if available
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
                            companyAbout: companyData.about || jobData.companyAbout || '',
                            createdAt,
                            lastDate
                        };
                    }
                } catch (error) {
                    console.error(`Error fetching company details for job ${jobData.id}:`, error);
                }
            }

            return {
                ...jobData,
                createdAt,
                lastDate
            };
        }));

        // Filter out null jobs (those that didn't meet date criteria)
        const filteredJobs = jobs.filter(job => job !== null);
        
        console.log(`Filtered ${jobType} jobs count:`, filteredJobs.length);
        return filteredJobs;

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

    const headerSection = `
        <div class="card-header-section">
            <div class="card-header-content">
                <div class="logo-container">
                    ${type === 'private' ? `
                        <img src="${job.companyLogo || '/assets/images/companies/default-company.webp'}" 
                            alt="${getValue(job.companyName)} Logo" 
                            class="company-logo"
                            loading="lazy"
                            width="48"
                            height="48"
                            onerror="this.src='/assets/images/companies/default-company.webp'">
                    ` : type === 'bank' ? `
                        <i class="bi bi-bank2 icon-large text-primary" aria-hidden="true"></i>
                    ` : `
                        <i class="bi bi-building-fill icon-large text-danger" aria-hidden="true"></i>
                    `}
                </div>
                <div class="header-info">
                    <h3 class="company-title text-truncate" title="${getValue(job.companyName || (type === 'bank' ? job.bankName : job.department))}">
                        ${trimText(getValue(job.companyName || (type === 'bank' ? job.bankName : job.department)), 40)}
                    </h3>
                    <p class="job-title text-truncate" title="${getValue(type === 'private' ? job.jobTitle : job.postName)}">
                        ${trimText(getValue(type === 'private' ? job.jobTitle : job.postName), 50)}
                    </p>
                </div>
            </div>
        </div>`;

    const detailsSection = `
        <div class="job-details">
            <div class="details-flex">
                <div class="details-item d-inline-flex align-items-center me-3" title="${getValue(job.state || job.location)}">
                    <i class="bi bi-geo-alt me-1" aria-hidden="true"></i>
                    <span class="details-text text-truncate">${trimText(getValue(job.state || job.location), 20)}</span>
                </div>
                ${type === 'private' ? `
                    <div class="details-item d-inline-flex align-items-center me-3">
                        <i class="bi bi-briefcase me-1" aria-hidden="true"></i>
                        <span class="details-text">${getValue(job.experience) === 'fresher' ? 'Fresher' : `${getValue(job.experience)} Years`}</span>
                    </div>
                    <div class="details-item d-inline-flex align-items-center me-3" title="${getValue(job.educationLevel)}">
                        <i class="bi bi-mortarboard me-1" aria-hidden="true"></i>
                        <span class="details-text text-truncate">${trimText(getValue(job.educationLevel), 18)}</span>
                    </div>
                ` : `
                    <div class="details-item d-inline-flex align-items-center me-3">
                        <i class="bi bi-people me-1" aria-hidden="true"></i>
                        <span class="details-text">${getValue(job.vacancies)} Vacancies</span>
                    </div>
                    <div class="details-item d-inline-flex align-items-center me-3" title="${getValue(job.qualification)}">
                        <i class="bi bi-mortarboard me-1" aria-hidden="true"></i>
                        <span class="details-text text-truncate">${trimText(getValue(job.qualification), 15)}</span>
                    </div>
                    ${job.ageLimit ? `
                        <div class="details-item d-inline-flex align-items-center me-3">
                            <i class="bi bi-person me-1" aria-hidden="true"></i>
                            <span class="details-text">Age: ${job.ageLimit}y</span>
                        </div>
                    ` : ''}
                `}
            </div>
        </div>`;

    const footerSection = `
        <div class="card-footer p-2">
            ${type === 'private' && job.skills ? `
                <div class="skills-info mb-2 overflow-hidden">
                    <div class="skills-list d-flex flex-nowrap gap-2 overflow-x-auto py-1">
                        ${job.skills.slice(0, 4).map(skill => `
                            <span class="badge bg-light text-dark text-nowrap">${trimText(skill, 12)}</span>
                        `).join('')}
                        ${job.skills.length > 4 ? `
                            <span class="badge bg-light text-dark text-nowrap">+${job.skills.length - 4}</span>
                        ` : ''}
                    </div>
                </div>
            ` : ''}
            <div class="d-flex align-items-center justify-content-between footer-actions">
                <div class="date-info d-inline-flex align-items-center" style="margin-right: 90px; min-width: fit-content;">
                    <span class="post-date d-inline-flex align-items-center">
                        <i class="bi bi-clock me-1" aria-hidden="true"></i>
                        <span class="small">${type === 'bank' ? formatTimeAgo(job.postedAt) : formatDate(job.createdAt)}</span>
                    </span>
                    ${(type === 'bank' || type === 'government') && job.lastDate ? `
                        <span class="deadline d-inline-flex align-items-center ms-2">
                            <i class="bi bi-calendar-event me-1" aria-hidden="true"></i>
                            <span class="small">Last: ${formatDate(job.lastDate)}</span>
                        </span>
                    ` : ''}
                </div>
                ${type === 'private' && job.referralCode ? `
                    <div class="referral-code d-inline-flex" style="margin-right: 125px; min-width: fit-content;">
                        <span class="badge bg-info d-inline-flex align-items-center">
                            <i class="bi bi-ticket-perforated me-1" aria-hidden="true"></i>
                            <span>Ref: ${job.referralCode}</span>
                        </span>
                    </div>
                ` : ''}
               <div class="d-inline-flex apply-btn-container">
                <button class="btn btn-primary btn-sm apply-btn">
                    <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i>
                    <span>Apply</span>
                </button>
            </div>
            </div>
        </div>`;

    return `
        <div class="job-card ${type}-job" data-job-id="${job.id}" data-job-type="${type}">
            ${headerSection}
            ${detailsSection}
            ${footerSection}
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

    // Show loading state
    jobsGrid.innerHTML = '<div class="text-center"><div class="spinner-border text-primary"></div></div>';

    // Check if we have jobs to display
    if (!currentJobsList || currentJobsList.length === 0) {
        const jobCountElement = document.getElementById('jobCount');
        if (jobCountElement) jobCountElement.textContent = '0';
        jobsGrid.innerHTML = '<div class="alert alert-info">No jobs found</div>';
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
                <div class="job-item">
                    ${createJobCard(job, job.type)}
                </div>
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
                    }
                }
                return jobData;
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

function formatTimeAgo(timestamp) {
    if (!timestamp) return '';

    const now = Date.now();
    const timeStampMs = timestamp.seconds * 1000;
    const diffInSeconds = Math.floor((now - timeStampMs) / 1000);

    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
    };

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(diffInSeconds / secondsInUnit);
        if (interval >= 1) {
            return `${interval}${unit.charAt(0)} ago`;
        }
    }

    return 'Just now';
}

function formatDate(dateInput) {
    if (!dateInput) return 'N/A';

    // Handle Firestore Timestamp
    let date;
    if (dateInput && dateInput.seconds) {
        date = new Date(dateInput.seconds * 1000);
    } else {
        date = new Date(dateInput);
    }

    return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}
jobsGrid.addEventListener('click', handleJobCardClick);
function handleJobCardClick(e) {
    const jobCard = e.target.closest('.job-card');
    if (!jobCard) return;

    e.preventDefault();
    const { jobId, jobType } = jobCard.dataset;
    
    // Always navigate to job details page
    window.location.href = `/html/job-details.html?id=${jobId}&type=${jobType}`;
}

// Add missing export statement if needed
export { getJobs, filterByCategory, updateCategoryCounts, initializeJobs };

window.handleFilters = debounce(() => {
    applyFilters();
}, 300);

window.applyFilters = async () => {
    const jobType = document.getElementById('jobTypeFilter').value;
    const location = document.getElementById('locationFilter').value;
    const isFresher = document.getElementById('fresherCheck').checked;
    const isExperienced = document.getElementById('experiencedCheck').checked;

    try {
        let jobs = {};
        
        if (jobType === 'all' || jobType === 'bank') {
            const bankRef = collection(db, 'bankJobs');
            const conditions = [where('isActive', '==', true)];
            if (location !== 'all') conditions.push(where('location', '==', location));
            const bankSnapshot = await getDocs(query(bankRef, ...conditions));
            jobs.bank = bankSnapshot.docs.map(doc => ({ id: doc.id, type: 'bank', ...doc.data() }));
        }

        if (jobType === 'all' || jobType === 'government') {
            const govRef = collection(db, 'governmentJobs');
            const conditions = [where('isActive', '==', true)];
            if (location !== 'all') conditions.push(where('location', '==', location));
            const govSnapshot = await getDocs(query(govRef, ...conditions));
            jobs.government = govSnapshot.docs.map(doc => ({ id: doc.id, type: 'government', ...doc.data() }));
        }

        if (jobType === 'all' || jobType === 'private') {
            const privateRef = collection(db, 'jobs');
            const conditions = [where('isActive', '==', true)];
            if (location !== 'all') conditions.push(where('location', '==', location));
            if (isFresher && !isExperienced) conditions.push(where('experience', '==', 'fresher'));
            else if (!isFresher && isExperienced) conditions.push(where('experience', '!=', 'fresher'));
            
            const privateSnapshot = await getDocs(query(privateRef, ...conditions));
            jobs.private = await Promise.all(privateSnapshot.docs.map(async docItem => {
                const jobData = { id: docItem.id, type: 'private', ...docItem.data() };
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
                    }
                }
                return jobData;
            }));
        }

        displayJobs(jobs, 'filter', { jobType, location, isFresher, isExperienced });
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


async function getRecentJobs(limit = 4) {
    try {
        const jobsRef = collection(db, 'jobs');
        const q = query(
            jobsRef,
            where('isActive', '==', true),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        
        // Process jobs with company details
        const jobs = await Promise.all(snapshot.docs.map(async (docItem) => {
            const jobData = {
                id: docItem.id,
                type: 'private',
                title: docItem.data().jobTitle,
                company: docItem.data().companyName,
                location: docItem.data().location,
                createdAt: docItem.data().createdAt,
                postedAt: formatDate(docItem.data().createdAt),
                companyId: docItem.data().companyId  // Include companyId
            };

            // Fetch company details if companyId exists
            if (jobData.companyId) {
                try {
                    const companyRef = doc(db, 'companies', jobData.companyId);
                    const companyDoc = await getDoc(companyRef);

                    if (companyDoc.exists()) {
                        const companyData = companyDoc.data();
                        return {
                            ...jobData,
                            company: companyData.name || jobData.company,
                            companyLogo: companyData.logoURL || null,
                            companyWebsite: companyData.website || null,
                            companyAbout: companyData.about || null
                        };
                    }
                } catch (error) {
                    console.error('Error fetching company details:', error);
                }
            }
            return jobData;
        }));

        // Sort by date and apply limit
        return jobs
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
            .slice(0, limit);
    } catch (error) {
        console.error('Error fetching recent jobs:', error);
        return [];
    }
}

async function getMostViewedJobs(limit = 4) {
    try {
        const allJobs = [];
        const jobTypes = ['bank', 'government', 'private'];

        for (const type of jobTypes) {
            const jobsRef = collection(db, type === 'private' ? 'jobs' : `${type}Jobs`);
            const q = query(jobsRef, where('isActive', '==', true));
            const snapshot = await getDocs(q);
            
            // Process jobs with company details (for private jobs)
            const jobs = await Promise.all(snapshot.docs.map(async (docItem) => {
                const data = docItem.data();
                const baseJob = {
                    id: docItem.id,
                    type,
                    title: type === 'private' ? data.jobTitle : data.postName,
                    company: type === 'private' ? data.companyName :
                            type === 'bank' ? data.bankName :
                            data.department,
                    location: data.location || data.state,
                    views: data.views || 0,
                    companyId: type === 'private' ? data.companyId : null
                };

                // Only fetch company details for private jobs with companyId
                if (type === 'private' && baseJob.companyId) {
                    try {
                        const companyRef = doc(db, 'companies', baseJob.companyId);
                        const companyDoc = await getDoc(companyRef);

                        if (companyDoc.exists()) {
                            const companyData = companyDoc.data();
                            return {
                                ...baseJob,
                                company: companyData.name || baseJob.company || '',
                                companyLogo: companyData.logoURL || '',
                                companyWebsite: companyData.website || ''
                            };
                        }
                    } catch (error) {
                        console.error('Error fetching company details:', error);
                    }
                }
                return baseJob;
            }));

            allJobs.push(...jobs);
        }

        return allJobs
            .sort((a, b) => (b.views || 0) - (a.views || 0))
            .slice(0, limit);
    } catch (error) {
        console.error('Error fetching most viewed jobs:', error);
        return [];
    }
}

const loadSidebarJobs = async () => {
    try {
        const recentJobs = await getRecentJobs(4);
        const mostViewedJobs = await getMostViewedJobs(4);

        // Update counts in the headers
        const recentCount = document.getElementById('recentJobsCount');
        const viewedCount = document.getElementById('mostViewedJobsCount');
        if (recentCount) recentCount.textContent = recentJobs.length;
        if (viewedCount) viewedCount.textContent = mostViewedJobs.length;

        ['recentJobs', 'mostViewedJobs'].forEach((containerId, containerIndex) => {
            const container = document.getElementById(containerId);
            if (!container) return;

            const jobs = containerId === 'recentJobs' ? recentJobs : mostViewedJobs;

            container.innerHTML = jobs.map((job, index) => `
                <a href="/html/job-details.html?id=${job.id}&type=${job.type}" 
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

window.handleSearch = debounce(async (event) => {
    const searchTerm = event.target.value.toLowerCase().trim();
    if (!searchTerm) return initializeJobs();
    
    try {
        const jobs = {
            bank: await getJobs('bank'),
            government: await getJobs('government'),
            private: await getJobs('private')
        };

        // Filter jobs based on search term
        const filteredJobs = {};
        Object.entries(jobs).forEach(([type, jobsList]) => {
            filteredJobs[type] = jobsList.filter(job => {
                const searchableText = `
                    ${job.title?.toLowerCase() || ''} 
                    ${job.company ? job.company.charAt(0).toUpperCase() + job.company.slice(1).toLowerCase() : ''} 
                    ${job.location?.toLowerCase() || ''} 
                    ${job.description?.toLowerCase() || ''} 
                    ${job.skills?.join(' ').toLowerCase() || ''}
                    ${job.referralCode?.toLowerCase() || ''}
                `;
                return searchableText.includes(searchTerm);
            });
        });

        displayJobs(filteredJobs, 'search', searchTerm);
    } catch (error) {
        console.error('Search error:', error);
        showToast('Error searching jobs. Please try again.', false);
    }
}, 300);

// Prevent form submission
document.getElementById('searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
});

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
                <a href="/html/job-details.html?id=${job.id}&type=private" 
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

            // Add sorted unique locations
            sortedLocations.forEach(location => {
                const option = document.createElement('option');
                option.value = location;
                option.textContent = location;
                locationFilter.appendChild(option);
            });
        }

    } catch (error) {
        console.error('Error populating location filter:', error);
    }
}
window.clearFilters = async () => {
    // Reset all filters to default values
    document.getElementById('jobTypeFilter').value = 'all';
    document.getElementById('locationFilter').value = 'all';
    document.getElementById('fresherCheck').checked = false;
    document.getElementById('experiencedCheck').checked = false;
   

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
        // 1. Create ISO date strings for the full day (UTC)
        const startStr = `${selectedDate}T00:00:00.000Z`;
        const endStr = `${selectedDate}T23:59:59.999Z`;


        // 2. Create queries with string comparison
        const [privateSnapshot, govSnapshot, bankSnapshot] = await Promise.all([
            getDocs(query(
                collection(db, 'jobs'),
                where('isActive', '==', true),
                where('createdAt', '>=', startStr),
                where('createdAt', '<=', endStr),
                orderBy('createdAt', 'desc')
            )),
            getDocs(query(
                collection(db, 'governmentJobs'),
                where('isActive', '==', true),
                where('createdAt', '>=', startStr),
                where('createdAt', '<=', endStr),
                orderBy('createdAt', 'desc')
            )),
            getDocs(query(
                collection(db, 'bankJobs'),
                where('isActive', '==', true),
                where('createdAt', '>=', startStr),
                where('createdAt', '<=', endStr),
                orderBy('createdAt', 'desc')
            ))
        ]);

        // 3. Process results
        const processJobsWithCompany = async (docs, type) => {
            return await Promise.all(docs.map(async (docItem) => {
                const jobData = {
                    id: docItem.id,
                    type: type,
                    ...docItem.data()
                };

                // If job has companyId, fetch company details
                if (jobData.companyId) {
                    try {
                        console.log('Fetching company details for ID:', jobData.companyId);
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

