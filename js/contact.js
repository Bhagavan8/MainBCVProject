import { db } from './firebase-config.js';
import { collection, addDoc, serverTimestamp, query,where,getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    try {
        initializeEventListeners();
    } catch (error) {
        console.error('Initialization error:', error);
    }
});

// Initialize event listeners
function initializeEventListeners() {
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', handleContactSubmit);
    }
}

// Handle contact form submission
async function handleContactSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const subject = document.getElementById('subject').value;
    const message = document.getElementById('message').value;

    try {
        const contactRef = collection(db, 'contact_messages');
        await addDoc(contactRef, {
            name,
            email,
            subject,
            message,
            timestamp: serverTimestamp()
        });

        // Show success message using toast
        showToast('Thank you for your message. We will get back to you soon!');
        e.target.reset();
    } catch (error) {
        console.error('Error submitting contact form:', error);
        showToast('There was an error sending your message. Please try again.', false);
    }
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


