import { db, auth } from './firebase-config.js';
import { 
    collection, 
    addDoc, 
    serverTimestamp,
    doc,
    getDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// DOM Elements
const pageLoader = document.getElementById('pageLoader');
const authCheckContainer = document.getElementById('auth-check-container');
const suggestionFormContainer = document.getElementById('suggestion-form-container');
const suggestionForm = document.getElementById('suggestionForm');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check Auth State
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is logged in
            console.log('User logged in:', user.email);
            
            // Populate hidden fields
            document.getElementById('userId').value = user.uid;
            document.getElementById('userEmail').value = user.email;
            document.getElementById('userName').value = user.displayName || 'Anonymous';
            
            // Try to get more user details from Firestore users collection
            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    if (userData.firstName && userData.lastName) {
                        document.getElementById('userName').value = `${userData.firstName} ${userData.lastName}`;
                    }
                }
            } catch (error) {
                console.error("Error fetching user details:", error);
            }

            // Show form
            authCheckContainer.classList.add('d-none');
            suggestionFormContainer.classList.remove('d-none');
        } else {
            // User is not logged in
            console.log('User not logged in');
            authCheckContainer.classList.remove('d-none');
            suggestionFormContainer.classList.add('d-none');
        }
        
        // Hide loader
        pageLoader.classList.add('hidden');
    });
    // QR Code Visibility Logic
    const jobPreference = document.getElementById('jobPreference');
    const helpType = document.getElementById('helpType');
    const qrCodeContainer = document.getElementById('qrCodeContainer');
    const qrTitle = document.getElementById('qrTitle');
    const qrDescription = document.getElementById('qrDescription');

    function checkQrVisibility() {
        const jobVal = jobPreference.value;
        const helpVal = helpType.value;
        let showQr = false;
        let title = 'Connect with us on WhatsApp';
        let desc = 'Scan the QR code to reach us directly.';

        if (helpVal === 'guidance' || helpVal === 'referral_help') {
            showQr = true;
            if (helpVal === 'guidance') {
                title = 'Get Career Guidance';
                desc = 'Scan to chat directly with our career counselors on WhatsApp.';
            } else if (helpVal === 'referral_help') {
                title = 'Referral Assistance';
                desc = 'Scan to connect for direct referral opportunities.';
            }
        } else if (jobVal === 'referral') {
            showQr = true;
            title = 'Referral Network';
            desc = 'Scan to join our referral network on WhatsApp.';
        }

        if (showQr) {
            qrCodeContainer.classList.remove('d-none');
            qrTitle.textContent = title;
            qrDescription.textContent = desc;
            // Add fade-in animation
            qrCodeContainer.classList.add('animate-fade-in');
        } else {
            qrCodeContainer.classList.add('d-none');
        }
    }

    if (jobPreference) jobPreference.addEventListener('change', checkQrVisibility);
    if (helpType) helpType.addEventListener('change', checkQrVisibility);
});

// Handle Form Submission
if (suggestionForm) {
    suggestionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = suggestionForm.querySelector('button[type="submit"]');
        const spinner = submitBtn.querySelector('.spinner-border');
        
        // Show loading state
        submitBtn.disabled = true;
        spinner.classList.remove('d-none');
        
        try {
            // Collect form data
            const formData = {
                userId: document.getElementById('userId').value,
                userEmail: document.getElementById('userEmail').value,
                userName: document.getElementById('userName').value,
                jobPreference: document.getElementById('jobPreference').value,
                helpType: document.getElementById('helpType').value,
                suggestion: document.getElementById('suggestionText').value,
                emailConsent: document.getElementById('emailConsent').checked,
                status: 'new', // new, reviewed, implemented
                createdAt: serverTimestamp(),
                userAgent: navigator.userAgent
            };

            // Save to Firestore
            await addDoc(collection(db, 'suggestions'), formData);
            
            // Show success message (using toastr if available, else alert)
            if (window.toastr) {
                toastr.success('Thank you! Your suggestion has been submitted successfully.', 'Submission Received');
            } else {
                alert('Thank you! Your suggestion has been submitted successfully.');
            }
            
            // Reset form
            suggestionForm.reset();
            
        } catch (error) {
            console.error('Error submitting suggestion:', error);
            if (window.toastr) {
                toastr.error('Something went wrong. Please try again later.', 'Error');
            } else {
                alert('Something went wrong. Please try again later.');
            }
        } finally {
            // Reset loading state
            submitBtn.disabled = false;
            spinner.classList.add('d-none');
        }
    });
}
