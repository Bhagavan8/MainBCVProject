// Import Firebase modules
import { auth, db } from './firebase-config.js';
import { collection, query, where, limit, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Check user authentication status and get recommended jobs
async function initializeRecommendedJobs() {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.log('No user logged in');
            return;
        }

        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();

        if (!userDoc.exists() || !userData.skills || !Array.isArray(userData.skills) || userData.skills.length === 0) {
            console.log('No skills found for user or skills array is empty');
            const recommendedJobsContainer = document.getElementById('recommendedJobs');
            if (recommendedJobsContainer) {
                recommendedJobsContainer.classList.add('d-none');
            }
            return;
        }

        const userSkills = userData.skills;
        await loadRecommendedJobs(userSkills);
    } catch (error) {
        console.error('Error initializing recommended jobs:', error);
        const recommendedJobsContainer = document.getElementById('recommendedJobs');
        if (recommendedJobsContainer) {
            recommendedJobsContainer.classList.add('d-none');
        }
    }
}

// Load jobs based on user skills
async function loadRecommendedJobs(userSkills) {
    try {
        if (!Array.isArray(userSkills) || userSkills.length === 0) {
            console.log('Invalid or empty skills array');
            return;
        }

        const recommendedJobsContainer = document.getElementById('recommendedJobs');
        const recommendedJobsList = document.getElementById('recommendedJobsList');
        const recommendedJobsCount = document.getElementById('recommendedJobsCount');

        if (!recommendedJobsContainer || !recommendedJobsList || !recommendedJobsCount) {
            console.error('Required DOM elements not found');
            return;
        }

        // Show the container
        recommendedJobsContainer.classList.remove('d-none');

        // Get jobs that match user skills
        const jobsQuery = query(
            collection(db, 'jobs'),
            where('skills', 'array-contains-any', userSkills),
            limit(5)
        );
        const jobsSnapshot = await getDocs(jobsQuery);

        let jobsHTML = '';
        for (const jobDoc of jobsSnapshot.docs) {
            const job = jobDoc.data();
            let company = null;
            
            // Only fetch company details if companyId exists
            if (job.companyId) {
                try {
                    const companyRef = doc(db, 'companies', job.companyId);
                    const companyDoc = await getDoc(companyRef);
                    company = companyDoc.exists() ? companyDoc.data() : null;
                } catch (error) {
                    console.error('Error fetching company details:', error);
                }
            }
            
            jobsHTML += `
                <a href="/html/job-details.html?id=${jobDoc.id}&type=private" class="list-group-item list-group-item-action">
                    <div class="job-content">
                        <h3 class="job-title-reco">${job.jobTitle || job.title}</h3>
                        <p class="small text-muted mb-2">${company?.name || job.companyName}</p>
                        <div class="skills-container-reco">
                            ${job.skills 
                                ? job.skills.slice(0, 5).map(skill => 
                                    `<span class="skill-item" title="${skill}">${skill.length > 11 ? skill.substring(0, 11) + '...' : skill}</span>`
                                ).join('')
                                : '<span class="text-muted">No skills specified</span>'
                            }
                        </div>
                    </div>
                </a>
            `;
        }

        recommendedJobsList.innerHTML = jobsHTML || '<div class="p-3 text-center text-muted">No matching jobs found</div>';
        recommendedJobsCount.textContent = jobsSnapshot.size;

    } catch (error) {
        console.error('Error loading recommended jobs:', error);
        const recommendedJobsContainer = document.getElementById('recommendedJobs');
        if (recommendedJobsContainer) {
            recommendedJobsContainer.classList.add('d-none');
        }
    }
}


// Listen for auth state changes
auth.onAuthStateChanged((user) => {
    if (user) {
        initializeRecommendedJobs();
    } else {
        const recommendedJobsContainer = document.getElementById('recommendedJobs');
        if (recommendedJobsContainer) {
            recommendedJobsContainer.classList.add('d-none');
        }
    }
});

// Add styles to document
const styles = `
    .recommended-jobs-container {
        margin-bottom: 2rem;
    }

    .job-card {
        transition: transform 0.2s, box-shadow 0.2s;
    }

    .job-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    @media (max-width: 768px) {
        .recommended-jobs-container {
            margin-bottom: 1rem;
        }

        .job-card {
            padding: 0.75rem !important;
        }

        .job-card h3 {
            font-size: 0.9rem;
        }
    }
`;

// Add styles to document
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', initializeRecommendedJobs);