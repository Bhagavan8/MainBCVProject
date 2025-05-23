// Import Firebase functions
import { db } from './firebase-config.js';
import { collection, query, where, getDocs, doc, addDoc, limit, orderBy, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const auth = getAuth();

// Function to fetch and display applied jobs
async function loadAppliedJobs() {
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

        const applications = [];
        for (const docSnapshot of querySnapshot.docs) {
            const applicationData = docSnapshot.data();
            // Fetch job details
            const jobDocRef = doc(db, 'jobs', applicationData.jobId);
            const jobDoc = await getDoc(jobDocRef);
            if (jobDoc.exists()) {
                const jobData = jobDoc.data();
                // Fetch company details if companyId exists
                let companyData = {};
                if (jobData.companyId) {
                    const companyDocRef = doc(db, 'companies', jobData.companyId);
                    const companyDoc = await getDoc(companyDocRef);
                    if (companyDoc.exists()) {
                        companyData = companyDoc.data();
                    }
                }
                applications.push({
                    id: docSnapshot.id,
                    ...applicationData,
                    jobTitle: jobData.jobTitle,
                    companyName: companyData.name || jobData.companyName,
                    companyLogo: companyData.logo || jobData.companyLogo
                });
            }
        }

        const jobsList = document.querySelector('.applied-jobs-list');
        if (!jobsList) return;

        // Add back button and header
        const headerHtml = `
            <div class="d-flex align-items-center mb-4">
            </div>
        `;
        jobsList.insertAdjacentHTML('beforebegin', headerHtml);

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
        const currentPage = 1;
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const currentApplications = applications.slice(startIndex, endIndex);

        // Now render the job cards with currentApplications
        jobsList.innerHTML = currentApplications.map(job => `
            <div class="job-card shadow-lg border rounded-lg p-4 mb-4 bg-white hover-effect">
                <div class="d-flex align-items-start gap-4">
                    <div class="company-logo-wrapper">
                        <div class="company-logo bg-light rounded-lg p-3" style="width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                            <img src="${job.companyLogo?.startsWith('http') ? job.companyLogo : `/assets/images/companies/${job.companyLogo || 'default-company.webp'}`}" 
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
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        // Add these styles to your CSS
        const styleSheet = document.createElement('style');
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

        document.head.appendChild(styleSheet);

        // Add styles

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

            .action-buttons .btn {
                padding: 0.5rem 1.25rem;
                font-weight: 500;
                border-radius: 6px;
            }

            .action-buttons .btn-primary {
                background: linear-gradient(135deg, #3498db, #2980b9);
                border: none;
            }

            .action-buttons .btn-outline-secondary {
                border-color: #cbd5e1;
                color: #64748b;
            }

            .action-buttons .btn-outline-secondary:hover {
                background-color: #f8fafc;
                color: #334155;
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

        document.head.appendChild(styleSheet);

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
                companyLogo: companyData.logo || jobData.companyLogo
            });
        }

        const relatedJobsList = document.querySelector('.related-jobs-list');
        if (!relatedJobsList) return;

        relatedJobsList.innerHTML = jobs.map(job => `
            <div class="job-card shadow-sm border rounded p-4 mb-3 bg-white hover-effect">
                <div class="d-flex align-items-start gap-3">
                    <div class="company-logo rounded bg-light p-2" style="width: 60px; height: 60px;">
                        <img src="${job.companyLogo?.startsWith('http') ? job.companyLogo : `/assets/images/companies/${job.companyLogo || 'default-company.webp'}`}" 
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
    // Wait for auth state to be ready
    auth.onAuthStateChanged((user) => {
        if (user) {
            loadAppliedJobs();
            loadRelatedJobs();
        } else {
            console.log('No user logged in');
            window.location.href = '/pages/login.html';
        }
    });
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