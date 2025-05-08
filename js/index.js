import { db, auth } from './firebase-config.js';
import { collection, getDocs, query, where, orderBy, limit,addDoc,serverTimestamp,getDoc, doc} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function formatNumber(num) {
    return num.toLocaleString() + '+';
}
const categoryEmojis = {
    "IT": "💻",
    "finance": "📊",
    "marketing": "🛒",
    "Healthcare": "🏥",
    "Construction": "🏗️",
    "Education": "🎓",
    "Hospitality": "🍽️",
    "Retail": "🛍️",
    "Design": "🎨",
    "Engineering": "⚙️",
    "Customer Service": "📞",
    "hr": "👥"
};

// Default emoji if category not found
const DEFAULT_EMOJI = "🔍";

async function fetchStats() {
    try {

        // Get jobs count
        const jobsSnapshot = await getDocs(collection(db, "jobs"));
        const jobsCount = jobsSnapshot.size;
        document.getElementById('jobsCount').textContent = formatNumber(jobsCount);

        const allCompanyNames = jobsSnapshot.docs.map(doc => doc.data().companyName);
        const uniqueCompanyNames = [...new Set(allCompanyNames)];
        const uniqueCompaniesCount = uniqueCompanyNames.length;
        document.getElementById('companiesCount').textContent = formatNumber(uniqueCompaniesCount);

        // Get users count
        const usersSnapshot = await getDocs(collection(db, "users"));
        const usersCount = usersSnapshot.size;
        document.getElementById('usersCount').textContent = formatNumber(usersCount);
        try {
            const categoriesContainer = document.getElementById('categoriesContainer');

            // Count jobs by category
            const categoryCounts = {};
            jobsSnapshot.forEach(doc => {
                const category = doc.data().jobCategory;
                if (category) {
                    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
                }
            });

            // Clear loading message
            categoriesContainer.innerHTML = '';

            // Create category cards
            for (const [category, count] of Object.entries(categoryCounts)) {
                const emoji = categoryEmojis[category] || DEFAULT_EMOJI;

                const categoryCard = document.createElement('div');
                categoryCard.className = 'category-card';
                categoryCard.innerHTML = `
                <div class="category-icon">
                    <i>${emoji}</i>
                </div>
                <h3>${category.toUpperCase()}</h3>
                <p>${formatNumber(count)} jobs available</p>
            `; 

                categoriesContainer.appendChild(categoryCard);
            }

            // If no categories found
            if (Object.keys(categoryCounts).length === 0) {
                categoriesContainer.innerHTML = '<p>No job categories found</p>';
            }

        } catch (error) {
            console.error("Error loading job categories:", error);
            document.getElementById('categoriesContainer').innerHTML = `
            <p class="error-message">Unable to load job categories. Please try again later.</p>
        `;
        }


    } catch (error) {
        console.error("Error fetching stats:", error);
        // Set fallback values in case of error
        document.getElementById('jobsCount').textContent = "25,000+";
        document.getElementById('companiesCount').textContent = "8,500+";
        document.getElementById('usersCount').textContent = "1.2M+";
    }
}

// Call the function when the document loads
document.addEventListener('DOMContentLoaded', fetchStats);
document.addEventListener('DOMContentLoaded', function() {
    // Stats fetching
    const fetchStats = async () => {
        try {
            const jobsCountElement = document.getElementById('jobsCount');
            const companiesCountElement = document.getElementById('companiesCount');
            const usersCountElement = document.getElementById('usersCount');
            
            if (jobsCountElement) jobsCountElement.textContent = '100+';
            if (companiesCountElement) companiesCountElement.textContent = '50+';
            if (usersCountElement) usersCountElement.textContent = '10+';
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    // Featured jobs loading
    const loadFeaturedJobs = async () => {
        try {
            const jobsContainer = document.getElementById('jobsContainer');
            if (jobsContainer) {
                // Your jobs loading logic here
                jobsContainer.innerHTML = ''; // Clear loading message
                // Add your jobs content
            }
        } catch (error) {
            console.error('Error loading featured jobs:', error);
        }
    };

    // Event listeners
    const element = document.getElementById('yourElementId');
    if (element) {
        element.addEventListener('click', function() {
            // Your event handler code
        });
    }

    // Auth state changes
    const handleAuthStateChange = (user) => {
        const userProfile = document.getElementById('userProfile');
        const authButtons = document.getElementById('authButtons');
        
        if (userProfile && authButtons) {
            if (user) {
                userProfile.style.display = 'block';
                authButtons.style.display = 'none';
            } else {
                userProfile.style.display = 'none';
                authButtons.style.display = 'flex';
            }
        }
    };

    // Initialize your features
    fetchStats();
    loadFeaturedJobs();
});
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Query to get featured jobs (active and public)
        const jobsQuery = query(
            collection(db, "jobs"),
            where("isActive", "==", true),
            orderBy("createdAt", "desc"),
            limit(6) // Limit to 6 featured jobs
        );

        const jobsSnapshot = await getDocs(jobsQuery);
        const jobsContainer = document.getElementById('jobsContainer');

        // Clear loading message
        jobsContainer.innerHTML = '';

        if (jobsSnapshot.empty) {
            jobsContainer.innerHTML = '<p class="no-jobs">No featured jobs available at the moment.</p>';
            return;
        }

        // Process jobs with company details
        const jobs = await Promise.all(jobsSnapshot.docs.map(async (docSnapshot) => {
            const jobData = docSnapshot.data();
            const jobId = docSnapshot.id;
            
            // Initialize company details before the if block
            let companyName = jobData.companyName || 'Unknown Company';
            let companyLogo = jobData.companyLogo || 'default-company.webp';
            
            if (jobData.companyId) {
                try {
                    const companyRef = doc(db, 'companies', jobData.companyId);
                    const companyDoc = await getDoc(companyRef);
                    if (companyDoc.exists()) {
                        const companyData = companyDoc.data();
                        companyName = companyData.name || companyName;
                        companyLogo = companyData.logoURL || companyLogo;
                    }
                } catch (error) {
                    console.error('Error fetching company details:', error);
                }
            }
            
            return {
                ...jobData,
                id: jobId,
                companyName: companyName,
                companyLogo: companyLogo
            };
        }));

        // Create job cards
        jobs.forEach(jobData => {
            const jobCard = document.createElement('div');
            jobCard.className = 'job-card';
            jobCard.innerHTML = `
            <div class="job-card-inner">
                <div class="job-header">
                    <img src="${jobData.companyLogo?.startsWith('http') ? jobData.companyLogo : `/assets/images/companies/${jobData.companyLogo}`}" 
                        alt="${jobData.companyName} Logo" 
                        class="company-logo" 
                        width="50" 
                        height="50"
                        onerror="this.src='/assets/images/companies/default-company.webp'">
                    <div class="job-info">
                        <h3>${jobData.jobTitle}</h3>
                        <p class="company">${jobData.companyName}</p>
                        <div class="job-meta">
                            <span title="${jobData.location?.trim() || 'Location not specified'}"><i>📍</i> ${(jobData.location?.trim() || '').length > 28 ? (jobData.location?.trim() || '').substring(0, 28) + '...' : jobData.location?.trim() || 'Location not specified'}</span>
                            ${jobData.experience ? `<span><i>📅</i> ${formatExperience(jobData.experience)}</span>` : ''}
                            <span class="employment-type"><i>📄</i> ${formatEmploymentType(jobData.employmentType)}</span>
                        </div>
                    </div>
                </div>
                <div class="job-content">
                    <div class="job-skills">
                        ${formatSkills(jobData.skills)}
                    </div>
                    <div class="job-footer">
                        <a href="/html/job-details.html?id=${jobData.id}&type=private" class="btn btn-primary">View Details</a>
                    </div>
                </div>
            </div>
            `;
            jobsContainer.appendChild(jobCard);
        });

    } catch (error) {
        console.error("Error loading featured jobs:", error);
        document.getElementById('jobsContainer').innerHTML = `
            <p class="error-message">Unable to load featured jobs. Please try again later.</p>
        `;
    }
});

// Format skills as chips/tags
function formatSkills(skillsArray) {
    if (!skillsArray || skillsArray.length === 0) return '<p>No specific skills mentioned</p>';

    // Filter out empty skills and take first 5
    const validSkills = skillsArray.filter(skill => skill.trim() !== '').slice(0, 8);

    return `
        <div class="skills-container">
            ${validSkills.map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
        </div>
    `;
}

// Format experience range
// Format experience range
function formatExperience(experience) {
    if (experience === "0-1" || experience.toLowerCase() === "fresher") {
        return "Fresher";
    }
    return experience + " years";
}

// In the job card template, update the experience display:
// Format employment type
function formatEmploymentType(type) {
    const types = {
        "fulltime": "Full-time",
        "parttime": "Part-time",
        "contract": "Contract",
        "internship": "Internship",
        "temporary": "Temporary"
    };
    return types[type] || type;
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



  auth.onAuthStateChanged(async (user) => {
    const authButtons = document.getElementById('authButtons');
    const userProfile = document.getElementById('userProfile');
    
    if (user) {
        // User is signed in
        authButtons.style.display = 'none';
        userProfile.style.display = 'flex';
        
        try {
            // Get user data from Firestore
            const userDoc = await getDoc(doc(db, "users", user.uid));
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                
                // Determine display name (priority: Firestore firstName > Auth displayName)
                const firstName = userData.firstName || 
                                 (user.displayName ? user.displayName.split(' ')[0] : 'User');
                                 const userEmail = user.email || 'No email';
                
                // Update UI
                document.getElementById('userName').textContent = firstName;
                document.getElementById('userAvatar').textContent = firstName.charAt(0).toUpperCase();
                // Update dropdown header UI
                document.getElementById('dropdownName').textContent = firstName;
                document.getElementById('dropdownEmail').textContent = userEmail;
                const dropdownAvatar = document.getElementById('dropdownAvatar');
                dropdownAvatar.textContent = firstName.charAt(0).toUpperCase();

                // Set profile picture if available
                if (userData.profilePicture) {
                    document.getElementById('userAvatar').style.backgroundImage = `url(${userData.profilePicture})`;
                    document.getElementById('userAvatar').textContent = '';
                }
                
                // Update session storage
                const sessionData = {
                    ...userData,
                    uid: user.uid,
                    firstName: firstName,
                    displayName: firstName
                };
                sessionStorage.setItem('userData', JSON.stringify(sessionData));
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        }
    } else {
        // User is signed out
        authButtons.style.display = 'flex';
        userProfile.style.display = 'none';
        sessionStorage.removeItem('userData');
    }
});



// Enhanced logout handler
document.getElementById('logoutBtn').addEventListener('click', function(e) {
    e.preventDefault();
    auth.signOut().then(() => {
        Toastify({
            text: "Logged out successfully",
            duration: 3000,
            gravity: "top",
            position: "right",
            style: { background: "linear-gradient(to right, #00b09b, #96c93d)" }
        }).showToast();
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    }).catch((error) => {
        Toastify({
            text: "Logout failed. Please try again.",
            duration: 3000,
            gravity: "top",
            position: "right",
            style: { background: "linear-gradient(to right, #ff416c, #ff4b2b)" }
        }).showToast();
    });
});

// Toggle dropdown
document.getElementById('profileToggle')?.addEventListener('click', function(e) {
    e.stopPropagation();
    document.getElementById('userProfile').classList.toggle('active');
});

// Close dropdown when clicking outside
document.addEventListener('click', function() {
    document.getElementById('userProfile').classList.remove('active');
});

async function displayTestimonialsIfExist() {
    try {
        const testimonialsSection = document.querySelector('.testimonials');
        const querySnapshot = await getDocs(collection(db, "jobComments"));
        
        if (querySnapshot.empty) {
            // No comments found - hide the section
            testimonialsSection.style.display = 'none';
            return;
        }
        
        // Comments exist - show the section and populate testimonials
        testimonialsSection.style.display = 'block';
        populateTestimonials(querySnapshot.docs);
    } catch (error) {
        console.error("Error checking for testimonials:", error);
        document.querySelector('.testimonials').style.display = 'none';
    }
}

// Function to populate testimonials from Firestore data
function populateTestimonials(comments) {
    const testimonialsContainer = document.querySelector('.testimonials-container');
    testimonialsContainer.innerHTML = ''; // Clear existing content
    
    // Limit to 3 most recent testimonials
    const recentComments = comments
        .filter(doc => doc.data().approved === true) // Only show approved comments
        .sort((a, b) => b.data().timestamp?.toMillis() - a.data().timestamp?.toMillis())
        .slice(0, 3);
    
    if (recentComments.length === 0) {
        document.querySelector('.testimonials').style.display = 'none';
        return;
    }
    
    recentComments.forEach(doc => {
        const commentData = doc.data();
        const testimonialCard = document.createElement('div');
        testimonialCard.className = 'testimonial-card';
        testimonialCard.innerHTML = `
            <div class="testimonial-content">
                "${commentData.commentText}"
            </div>
            <div class="testimonial-author">
                <img src="${commentData.userPhotoURL || 'images/default-avatar.jpg'}" 
                     alt="${commentData.userName}" 
                     class="author-avatar" 
                     width="50" 
                     height="50">
                <div class="author-info">
                    <h4>${commentData.userName}</h4>
                    <p>${commentData.userPosition || 'Job Seeker'} at ${commentData.userCompany || 'BCVWorld'}</p>
                </div>
            </div>
        `;
        testimonialsContainer.appendChild(testimonialCard);
    });
}

// Call this when the page loads
document.addEventListener('DOMContentLoaded', displayTestimonialsIfExist);

// Update CTA button based on auth state
auth.onAuthStateChanged((user) => {
    const ctaButton = document.getElementById('ctaButton');
    if (ctaButton) {
        if (user) {
            ctaButton.href = '/html/jobs.html';
            ctaButton.textContent = 'Browse Jobs';
        } else {
            ctaButton.href = '/pages/register.html';
            ctaButton.textContent = 'Find a Job';
        }
    }
});
  