// Import Firebase functions
import { db } from './firebase-config.js';
import { collection, query, where, getDocs, doc, addDoc, limit, orderBy, getDoc, setDoc, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const auth = getAuth();
let unsubscribeApps;

async function loadCompanies() {
    const companySelect = document.getElementById('companySelect');
    if (!companySelect) return;
    companySelect.innerHTML = '<option value="">Loading...</option>';
    try {
        const companies = [];
        const companiesSnapshot = await getDocs(collection(db, 'companies'));
        for (const docSnap of companiesSnapshot.docs) {
            const data = docSnap.data();
            companies.push({ id: docSnap.id, name: data.name });
        }
        const jobsSnapshot = await getDocs(collection(db, 'jobs'));
        // Push legacy names (repeat as they appear)
        for (const docSnap of jobsSnapshot.docs) {
            const data = docSnap.data();
            if (!data.companyId && data.companyName) {
                companies.push({ id: `legacy:${data.companyName}`, name: data.companyName });
            }
        }
        companies.sort((a,b) => a.name.localeCompare(b.name));
        companySelect.innerHTML = '<option value="">Select Company</option>' + companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } catch (e) {
        companySelect.innerHTML = '<option value="">Failed to load companies</option>';
    }
}

async function loadRolesForCompany(companyId) {
    const roleSelect = document.getElementById('roleSelect');
    if (!roleSelect) return;
    roleSelect.disabled = true;
    roleSelect.innerHTML = '<option value="">Loading...</option>';
    try {
        let qRef;
        if (companyId.startsWith('legacy:')) {
            const name = companyId.replace('legacy:', '');
            qRef = query(collection(db, 'jobs'), where('companyName', '==', name));
        } else {
            qRef = query(collection(db, 'jobs'), where('companyId', '==', companyId));
        }
        const qs = await getDocs(qRef);
        const options = qs.docs.map(d => {
            const j = d.data();
            const title = j.jobTitle || j.title || 'Untitled';
            return `<option value="${d.id}" data-jobtype="${j.jobType || j.type || 'private'}" data-companyname="${j.companyName || ''}">${title}</option>`;
        });
        roleSelect.innerHTML = '<option value="">Select Role</option>' + options.join('');
        roleSelect.disabled = false;
    } catch (e) {
        roleSelect.innerHTML = '<option value="">No roles found</option>';
        roleSelect.disabled = false;
    }
}

async function saveApplication() {
    const user = auth.currentUser;
    if (!user) {
        window.location.href = '/pages/login.html';
        return;
    }
    const companySelect = document.getElementById('companySelect');
    const roleSelect = document.getElementById('roleSelect');
    const statusSelect = document.getElementById('statusSelect');
    const companyId = companySelect?.value || '';
    const jobId = roleSelect?.value || '';
    let status = (statusSelect?.value || 'applied').toLowerCase();
    const allowedInitial = ['applied', 'in progress'];
    if (!allowedInitial.includes(status)) status = 'applied';
    if (!companyId || !jobId) {
        showToast('Select company and role', false);
        return;
    }
    try {
        const jobDocRef = doc(db, 'jobs', jobId);
        const jobDocSnap = await getDoc(jobDocRef);
        const job = jobDocSnap.exists() ? jobDocSnap.data() : {};
        const jobType = job.jobType || job.type || 'private';
        const jobTitle = job.jobTitle || job.title || '';
        const companyName = job.companyName || companySelect.options[companySelect.selectedIndex].text;
        const applicationRef = doc(db, 'jobApplications', `${jobId}_${user.uid}`);
        await setDoc(applicationRef, {
            userId: user.uid,
            jobId,
            jobType,
            jobTitle,
            companyName,
            appliedAt: serverTimestamp(),
            status
        });
        showToast('Application saved');
        await loadAppliedJobs();
    } catch (e) {
        showToast('Failed to save', false);
    }
}

function statusOptionsHtml(current) {
    const options = ['applied','in progress','rejected','selected','withdrawn'];
    const cur = (current || '').toLowerCase();
    return options.map(o => `<option value="${o}" ${cur===o?'selected':''}>${o.replace(/\b\w/g,c=>c.toUpperCase())}</option>`).join('');
}

// Function to fetch and display applied jobs
async function loadAppliedJobs(startOverride, endOverride) {
    // In the loadAppliedJobs function, modify the applications data fetching:
    try {
        const user = auth.currentUser;
        if (!user) {
            console.log('No user logged in');
            window.location.href = '/pages/login.html';
            return;
        }

        const jobsRef = collection(db, 'jobApplications');
        const q = query(jobsRef, where('userId', '==', user.uid));
        const querySnapshot = await getDocs(q);

        const applications = (await Promise.all(querySnapshot.docs.map(async (docSnapshot) => {
            const applicationData = docSnapshot.data();
            const jobDoc = await getDoc(doc(db, 'jobs', applicationData.jobId));
            if (!jobDoc.exists()) return null;
            const jobData = jobDoc.data();
            let companyData = null;
            if (jobData.companyId) {
                const companyDoc = await getDoc(doc(db, 'companies', jobData.companyId));
                if (companyDoc.exists()) companyData = companyDoc.data();
            }
            return {
                id: docSnapshot.id,
                ...applicationData,
                jobTitle: jobData.jobTitle || jobData.title,
                companyName: companyData?.name || jobData.companyName,
                companyLogo: companyData?.logoURL || companyData?.logo || jobData.companyLogo || jobData.companyLogoURL || ''
            };
        }))).filter(Boolean);

        const jobsList = document.querySelector('.applied-jobs-list');
        if (!jobsList) return;

        // Remove old pagination instances to prevent duplicates
        document.querySelectorAll('nav[aria-label="Applications pagination"]').forEach(el => el.remove());

        if (applications.length === 0) {
            jobsList.innerHTML = `
                <div class="alert alert-info text-center p-4">
                    <i class="bi bi-inbox text-muted display-4 d-block mb-3"></i>
                    <h5>No Applications Yet</h5>
                    <p class="text-muted">Start exploring and applying for jobs to build your career!</p>
                    <a href="/html/jobs.html" class="btn btn-primary mt-2">Browse Jobs</a>
                </div>
            `;
            return;
        }

        // Pagination setup - Move this before using totalPages
        const itemsPerPage = 8;
        const totalPages = Math.ceil(applications.length / itemsPerPage);
        const startIndex = typeof startOverride === 'number' ? startOverride : 0;
        const endIndex = typeof endOverride === 'number' ? endOverride : startIndex + itemsPerPage;
        const currentPage = Math.floor(startIndex / itemsPerPage) + 1;
        const currentApplications = applications.slice(startIndex, endIndex);

        // Group applications by status
        const grouped = {
            applied: [],
            'in progress': [],
            rejected: [],
            selected: [],
            withdrawn: [],
            other: []
        };
        for (const job of currentApplications) {
            const s = (job.status || '').toLowerCase();
            if (s === 'applied') grouped.applied.push(job);
            else if (s === 'in progress' || s === 'in review') grouped['in progress'].push(job);
            else if (s === 'rejected') grouped.rejected.push(job);
            else if (s === 'selected') grouped.selected.push(job);
            else if (s === 'withdrawn') grouped.withdrawn.push(job);
            else grouped.other.push(job);
        }

        const section = (title, items) => items.length ? `
            <h4 class="mt-3 mb-2">${title}</h4>
            ${items.map(job => `
            <div class="job-card shadow-lg border rounded-lg p-4 mb-4 bg-white hover-effect">
                <div class="d-flex align-items-start gap-4">
                    <div class="company-logo-wrapper">
                        <div class="company-logo bg-light rounded-lg p-3" style="width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                            <img src="${(job.companyLogo && (job.companyLogo.startsWith('http') || job.companyLogo.startsWith('/') || job.companyLogo.startsWith('data:'))) ? job.companyLogo : `/assets/images/companies/${job.companyLogo || 'default-company.webp'}`}" 
                                 alt="${job.companyName} Logo" 
                                 class="img-fluid rounded"
                                 style="object-fit: contain; width: 100%; height: 100%;"
                                 onerror="this.src='/assets/images/companies/default-company.webp'">
                        </div>
                    </div>
                    <div class="flex-grow-1">
                        <div class="d-flex justify-content-between align-items-start flex-wrap">
                            <div class="mb-3">
                                <h5 class="fw-bold text-primary mb-2 job-title">
                                    ${job.jobTitle || 'Untitled Position'}
                                </h5>
                                <div class="company-info d-flex align-items-center gap-2 text-muted">
                                    <i class="bi bi-building"></i>
                                    <span class="company-name">${job.companyName || 'Company Name Not Available'}</span>
                                </div>
                            </div>
                            <span class="badge bg-${getStatusColor(job.status)} rounded-pill px-4 py-2 status-badge">
                                ${job.status?.toUpperCase() || 'PENDING'}
                            </span>
                        </div>
                        
                        <div class="job-meta border-top mt-3 pt-3">
                            <div class="d-flex flex-wrap gap-4">
                                <div class="d-flex align-items-center text-muted">
                                    <i class="bi bi-calendar-event me-2"></i>
                                    <span>Applied on ${formatDate(job.appliedAt)}</span>
                                </div>
                                <div class="mt-2" style="min-width:160px;">
                                    <select class="form-select form-select-sm application-status-select" ${['rejected','withdrawn'].includes((job.status||'').toLowerCase())?'disabled':''} onchange="window.updateApplicationStatus('${job.id}', this.value)">${statusOptionsHtml(job.status)}</select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            `).join('')}
        ` : '';

        jobsList.innerHTML = `
            ${section('Applied', grouped.applied)}
            ${section('In Progress', grouped['in progress'])}
            ${section('Rejected', grouped.rejected)}
            ${section('Selected', grouped.selected)}
            ${section('Withdrawn', grouped.withdrawn)}
            ${section('Other', grouped.other)}
        `;

        // One-time styles
        let styleSheet = document.getElementById('applied-jobs-styles');
        if (!styleSheet) {
            styleSheet = document.createElement('style');
            styleSheet.id = 'applied-jobs-styles';
            document.head.appendChild(styleSheet);
        }
        styleSheet.textContent = `
            .job-card {
                transition: transform 0.3s ease, box-shadow 0.3s ease;
                border: 1px solid rgba(0,0,0,0.08) !important;
            }

            .job-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 24px rgba(0,0,0,0.12) !important;
            }

            .company-logo-wrapper {
                position: relative;
            }

            .company-logo {
                transition: transform 0.3s ease;
                box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            }

            .job-card:hover .company-logo {
                transform: scale(1.05);
            }

            .job-title {
                font-size: 1.25rem;
                color: #2c3e50;
            }

            .company-name {
                font-size: 0.95rem;
            }

            .status-badge {
                font-weight: 500;
                letter-spacing: 0.5px;
            }

            @media (max-width: 768px) {
                .job-card {
                    padding: 1rem !important;
                }
                
                .company-logo {
                    width: 60px !important;
                    height: 60px !important;
                }
                
                .action-buttons {
                    flex-direction: column;
                    gap: 0.75rem;
                }
                
                .action-buttons .btn {
                    width: 100%;
                }
            }
        `;

        // Now we can safely use totalPages for pagination
        if (totalPages > 1) {
            const paginationHtml = `
                <nav aria-label="Applications pagination" class="mt-4">
                    <ul class="pagination justify-content-center">
                        ${Array.from({ length: totalPages }, (_, i) => `
                            <li class="page-item ${i + 1 === currentPage ? 'active' : ''}">
                                <a class="page-link" href="#" onclick="changePage(${i + 1})">${i + 1}</a>
                            </li>
                        `).join('')}
                    </ul>
                </nav>
            `;
            jobsList.insertAdjacentHTML('afterend', paginationHtml);
        }

        // Load recommended jobs
        await loadRelatedJobs();
    } catch (error) {
        console.error('Error loading applied jobs:', error);
        const jobsList = document.querySelector('.applied-jobs-list');
        if (jobsList) {
            jobsList.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    Error loading applications. Please try again later.
                </div>
            `;
        }
    }
}

function getStatusColor(status) {
    switch (status?.toLowerCase()) {
        case 'accepted':
            return 'success';
        case 'rejected':
            return 'danger';
        case 'in review':
            return 'info';
        case 'in progress':
            return 'info';
        case 'selected':
            return 'success';
        case 'withdrawn':
            return 'secondary';
        case 'applied':
            return 'primary';
        default:
            return 'warning';
    }
}

function formatDate(timestamp) {
    if (!timestamp) return 'Date not available';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }).format(date);
}



// Add pagination function
window.changePage = async (pageNumber) => {
    const itemsPerPage = 8;
    const startIndex = (pageNumber - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    await loadAppliedJobs(startIndex, endIndex);
    window.scrollTo(0, 0);
};

// Function to load related jobs from Firebase
async function loadRelatedJobs() {
    // In the loadRelatedJobs function, modify the jobs data fetching:
    try {
        const user = auth.currentUser;
        if (!user) return;

        const jobsRef = collection(db, 'jobs');
        const q = query(
            jobsRef,
            orderBy('createdAt', 'desc'),
            limit(5)
        );
        const querySnapshot = await getDocs(q);

        const jobs = [];
        for (const docSnapshot of querySnapshot.docs) {
            const jobData = docSnapshot.data();
            // Fetch company details if companyId exists
            let companyData = {};
            if (jobData.companyId) {
                const companyDocRef = doc(db, 'companies', jobData.companyId);
                const companyDoc = await getDoc(companyDocRef)
                if (companyDoc.exists()) {
                    companyData = companyDoc.data();
                }
            }
            jobs.push({
                id: docSnapshot.id,
                ...jobData,
                companyName: companyData.name || jobData.companyName,
                companyLogo: companyData.logoURL || companyData.logo || jobData.companyLogo || jobData.companyLogoURL || ''
            });
        }

        const relatedJobsList = document.querySelector('.related-jobs-list');
        if (!relatedJobsList) return;

        relatedJobsList.innerHTML = jobs.map(job => `
            <div class="job-card shadow-sm border rounded p-4 mb-3 bg-white hover-effect">
                <div class="d-flex align-items-start gap-3">
                    <div class="company-logo rounded bg-light p-2" style="width: 60px; height: 60px;">
                        <img src="${(job.companyLogo && (job.companyLogo.startsWith('http') || job.companyLogo.startsWith('/') || job.companyLogo.startsWith('data:'))) ? job.companyLogo : `/assets/images/companies/${job.companyLogo || 'default-company.webp'}`}" 
                             alt="${job.companyName} Logo" 
                             class="img-fluid rounded"
                             style="object-fit: contain; width: 100%; height: 100%;"
                             onerror="this.src='/assets/images/companies/default-company.webp'">
                    </div>
                    <div class="flex-grow-1">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div>
                                <h5 class="fw-bold text-primary mb-1">${job.title || job.jobTitle}</h5>
                                <p class="text-muted mb-2">
                                    <i class="bi bi-building me-2"></i>${job.company || job.companyName}
                                </p>
                                <p class="text-muted mb-0">
                                    <i class="bi bi-geo-alt me-2"></i>${job.location || 'Location not specified'}
                                </p>
                            </div>
                        </div>
                        <div class="d-flex justify-content-between align-items-center mt-3 pt-3 border-top">
                    <p class="text-muted small mb-0">
                        <i class="bi bi-calendar-event me-1"></i>
                        ${formatDate(job.createdAt)}
                    </p>
                    <button class="btn btn-sm btn-primary px-3" onclick="window.location.href='/html/job-details.html?id=${job.id}&type=private'">
                        <i class="bi bi-send me-1"></i>Apply Now
                    </button>
                </div>
                    </div>
                </div>
            </div>
        `).join('');

        // Add styles for related jobs
        const styleSheet = document.createElement('style');
        styleSheet.textContent = `
            .related-jobs-list .job-card {
                transition: all 0.3s ease;
                border: 1px solid rgba(0,0,0,0.08) !important;
            }

            .related-jobs-list .job-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 16px rgba(0,0,0,0.1) !important;
            }

            .related-jobs-list .company-logo {
                transition: transform 0.3s ease;
                overflow: hidden;
            }

            .related-jobs-list .job-card:hover .company-logo img {
                transform: scale(1.1);
            }

            .related-jobs-list .btn-primary {
                background: linear-gradient(135deg, #3498db, #2980b9);
                border: none;
                transition: all 0.3s ease;
            }

            .related-jobs-list .btn-primary:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            }

            @media (max-width: 768px) {
                .related-jobs-list .job-card {
                    padding: 1rem !important;
                }
                
                .related-jobs-list .company-logo {
                    width: 50px !important;
                    height: 50px !important;
                }
            }
        `;
        document.head.appendChild(styleSheet);

    } catch (error) {
        console.error('Error loading related jobs:', error);
    }
}

// Make functions available globally
window.viewJobDetails = async (jobId) => {
    window.location.href = `/html/job-details.html?id=${jobId}`;
};





// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            await loadCompanies();
            loadAppliedJobs();
            loadRelatedJobs();
            try {
                const appsRef = collection(db, 'jobApplications');
                const appsQuery = query(appsRef, where('userId', '==', user.uid));
                if (unsubscribeApps) unsubscribeApps();
                unsubscribeApps = onSnapshot(appsQuery, () => {
                    loadAppliedJobs();
                });
            } catch (_) {}
        } else {
            window.location.href = '/pages/login.html';
        }
    });
    const companySelect = document.getElementById('companySelect');
    const roleSelect = document.getElementById('roleSelect');
    const saveBtn = document.getElementById('saveApplicationBtn');
    companySelect?.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val) {
            loadRolesForCompany(val);
        } else {
            roleSelect.disabled = true;
            roleSelect.innerHTML = '<option value="">Select Role</option>';
        }
    });
    saveBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        saveApplication();
    });
    window.updateApplicationStatus = async (applicationId, newStatus) => {
        const user = auth.currentUser;
        if (!user) return;
        try {
            const ref = doc(db, 'jobApplications', applicationId);
            const snap = await getDoc(ref);
            const current = snap.exists() ? (snap.data().status || '').toLowerCase() : '';
            if (['rejected','withdrawn'].includes(current)) {
                showToast('Status is locked');
                return;
            }
            await setDoc(ref, { status: newStatus.toLowerCase(), updatedAt: serverTimestamp() }, { merge: true });
            showToast('Status updated');
            await loadAppliedJobs();
        } catch (e) {
            showToast('Update failed', false);
        }
    };
});

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
