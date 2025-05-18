import { db, auth } from './firebase-config.js';
import {
    collection,
    addDoc, getDoc, doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', function () {
    // Contact Form Submission Handler
    const contactForm = document.getElementById('contactForm');

    // Check if form exists before adding event listener
    if (contactForm) {
        const loadingDiv = contactForm.querySelector('.loading');
        const errorDiv = contactForm.querySelector('.error-message');
        const sentDiv = contactForm.querySelector('.sent-message');

        contactForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            // Show loading indicator
            if (loadingDiv) loadingDiv.classList.remove('d-none');
            if (errorDiv) errorDiv.style.display = 'none';
            if (sentDiv) sentDiv.style.display = 'none';

            // Get form data
            const formData = {
                name: contactForm.name.value,
                email: contactForm.email.value,
                subject: contactForm.subject.value,
                message: contactForm.message.value,
                timestamp: new Date().toISOString(),
                status: 'new'
            };

            try {
                // Save to Firebase using modular API
                await addDoc(collection(db, 'contact_messages'), formData);

                // Show success message
                if (loadingDiv) loadingDiv.classList.add('d-none');
                if (sentDiv) {
                    sentDiv.style.display = 'block';
                }

                // Reset form fields
                contactForm.reset();
                Array.from(contactForm.elements).forEach(element => {
                    if (element.type !== 'submit') {
                        element.value = '';
                    }
                });

                // Show success toaster
                showToast('✓ Success', 'Your message has been sent. We will contact you soon!', 'success');

            } catch (error) {
                console.error('Error submitting form:', error);
                if (loadingDiv) loadingDiv.classList.add('d-none');
                if (errorDiv) {
                    errorDiv.style.display = 'block';
                    errorDiv.textContent = 'An error occurred. Please try again later.';
                }

                showToast('⚠ Login Required', 'You need to be signed in to send us a message. This helps us prevent spam.', 'error');
            }
        });
    } else {
        console.warn('Contact form not found on this page');
    }
});

// Toaster function
function showToast(title, message, type = 'success') {
    const toastContainer = document.getElementById('toastContainer') || createToastContainer();

    const toast = document.createElement('div');
    toast.className = `toast ${type} fade show`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    toast.innerHTML = `
        <div class="toast-header ${type}">
            <strong class="me-auto">${title}</strong>
            <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">${message}</div>
    `;

    toastContainer.appendChild(toast);

    // Initialize Bootstrap toast with auto-hide after 3 seconds
    const bsToast = new bootstrap.Toast(toast, {
        animation: true,
        autohide: true,
        delay: 3000
    });

    bsToast.show();

    // Remove toast after it's hidden
    toast.addEventListener('hidden.bs.toast', () => {
        toast.remove();
    });
}

// Create toast container if it doesn't exist
function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    document.body.appendChild(container);
    return container;
}

// Enhanced logout handler
document.getElementById('logoutBtn').addEventListener('click', function (e) {
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


auth.onAuthStateChanged(async (user) => {
    const authButtons = document.getElementById('authDropdown');
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
document.addEventListener('DOMContentLoaded', function() {
    const authToggle = document.getElementById('authToggle');
    const authMenu = document.getElementById('authMenu');
    const authDropdown = document.getElementById('authDropdown');
    const profileToggle = document.getElementById('profileToggle');
    const profileDropdown = document.getElementById('profileDropdown');
    const dropdownOverlay = document.getElementById('dropdownOverlay');
    const userProfile = document.getElementById('userProfile');
  
    // Helper function to handle body scroll
    const toggleBodyScroll = (disable) => {
      document.body.classList.toggle('dropdown-open', disable);
    };
  
    // Helper function to close all dropdowns
    const closeAllDropdowns = () => {
      authMenu?.classList.remove('show');
      profileDropdown?.classList.remove('show');
      dropdownOverlay?.classList.remove('show');
      authDropdown?.classList.remove('show');
      userProfile?.classList.remove('show');
      toggleBodyScroll(false);
      
      // Update aria-expanded attributes
      authToggle?.setAttribute('aria-expanded', 'false');
      profileToggle?.setAttribute('aria-expanded', 'false');
    };
  
    // Helper function to toggle dropdown
    const toggleDropdown = (menu, toggle, container, e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const isOpen = menu.classList.contains('show');
      closeAllDropdowns();
      
      if (!isOpen) {
        menu.classList.add('show');
        container?.classList.add('show');
        dropdownOverlay.classList.add('show');
        toggleBodyScroll(true);
        toggle?.setAttribute('aria-expanded', 'true');
      }
    };
  
    // Auth dropdown events
    if (authToggle && authMenu) {
      authToggle.addEventListener('click', (e) => toggleDropdown(authMenu, authToggle, authDropdown, e));
      
      // Touch support for mobile
      authToggle.addEventListener('touchend', (e) => {
        e.preventDefault();
        toggleDropdown(authMenu, authToggle, authDropdown, e);
      });
  
      // Prevent dropdown from closing when clicking inside
      authMenu.addEventListener('click', (e) => e.stopPropagation());
    }
  
    // Profile dropdown events
    if (profileToggle && profileDropdown) {
      profileToggle.addEventListener('click', (e) => toggleDropdown(profileDropdown, profileToggle, userProfile, e));
      
      // Touch support for mobile
      profileToggle.addEventListener('touchend', (e) => {
        e.preventDefault();
        toggleDropdown(profileDropdown, profileToggle, userProfile, e);
      });
  
      // Prevent dropdown from closing when clicking inside
      profileDropdown.addEventListener('click', (e) => e.stopPropagation());
    }
  
    // Close dropdowns when clicking outside
    document.addEventListener('click', closeAllDropdowns);
    
    // Close dropdowns when tapping outside on mobile
    dropdownOverlay.addEventListener('click', closeAllDropdowns);
    dropdownOverlay.addEventListener('touchend', closeAllDropdowns);
  
    // Close dropdowns when pressing Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAllDropdowns();
      }
    });
  
    // Close dropdowns when scrolling on mobile
    window.addEventListener('scroll', () => {
      if (window.innerWidth <= 991) {
        closeAllDropdowns();
      }
    });
  
    // Better touch handling for mobile
    document.addEventListener('touchstart', (e) => {
      if (!authDropdown?.contains(e.target) && !userProfile?.contains(e.target)) {
        closeAllDropdowns();
      }
    }, { passive: true });
  });

