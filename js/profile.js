import { db, auth, storage, getDownloadURL } from './firebase-config.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, deleteObject } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";



// Load user data
auth.onAuthStateChanged(async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            document.getElementById('firstName').value = userData.firstName || '';
            document.getElementById('lastName').value = userData.lastName || '';
            document.getElementById('email').value = userData.email || '';
            document.getElementById('phone').value = userData.phone?.replace('+91', '') || '';
            document.getElementById('dob').value = userData.dob || '';

            if (userData.profileImageUrl) {
                document.getElementById('userProfileImage').src = userData.profileImageUrl;
            }

            // Display existing resume if available
            if (userData.resumeURL) {
                document.getElementById('currentResume').style.display = 'block';
                document.getElementById('resumeFileName').textContent = userData.resumePath.split('/').pop();
                const resumeLink = document.createElement('a');
                resumeLink.href = userData.resumeURL;
                resumeLink.target = '_blank';
                resumeLink.className = 'btn btn-sm btn-primary mt-2';
                resumeLink.innerHTML = '<i class="bi bi-file-earmark-pdf"></i> View Resume';
                document.getElementById('currentResume').appendChild(resumeLink);
            }
        }
    } else {
        window.location.href = '/pages/login.html';
    }
});

// Handle form submission
document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const user = auth.currentUser;
        if (!user) throw new Error('Not authenticated');

        // Get current user data first
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.exists() ? userDoc.data() : {};

        const resumeFile = document.getElementById('resumeUpload').files[0];
        
        const formData = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            phone: '+91' + document.getElementById('phone').value,
            dob: document.getElementById('dob').value,
            skills: Array.from(skills),
            hasResume: !!resumeFile,
            updatedAt: new Date()
        };

        // Update user document
        await updateDoc(doc(db, "users", user.uid), formData);

        // Handle resume upload if present
        if (resumeFile) {
            try {
                const storageRef = ref(storage, `resumes/${user.uid}/${resumeFile.name}`);
                const metadata = {
                    contentType: resumeFile.type,
                    customMetadata: {
                        'uploaded-by': user.uid
                    }
                };
                
                // Delete existing resume if any
                if (userData.resumePath) {
                    const oldResumeRef = ref(storage, userData.resumePath);
                    try {
                        await deleteObject(oldResumeRef);
                    } catch (error) {
                        console.error("Error deleting old resume:", error);
                    }
                }
                
                // Upload the file
                const uploadResult = await uploadBytes(storageRef, resumeFile, metadata);
                
                // Get the download URL
                const downloadURL = await getDownloadURL(uploadResult.ref);

                // Update the user document with the resume URL and path
                await updateDoc(doc(db, "users", user.uid), {
                    resumeURL: downloadURL,
                    resumePath: `resumes/${user.uid}/${resumeFile.name}`,
                    hasResume: true,
                    updatedAt: new Date()
                });
            } catch (error) {
                console.error("Error uploading file:", error);
                throw new Error("Failed to upload resume");
            }
        }

        Toastify({
            text: "Profile updated successfully!",
            duration: 3000,
            gravity: "top",
            position: "right",
            style: { background: "linear-gradient(to right, #00b09b, #96c93d)" }
        }).showToast();

        // Update session storage
        const sessionUserData = JSON.parse(sessionStorage.getItem('userData') || '{}');
        sessionStorage.setItem('userData', JSON.stringify({
            ...sessionUserData,
            ...formData
        }));

    } catch (error) {
        console.error("Error updating profile:", error);
        Toastify({
            text: error.message,
            duration: 3000,
            gravity: "top",
            position: "right",
            style: { background: "linear-gradient(to right, #ff416c, #ff4b2b)" }
        }).showToast();
    }
});

// Load existing skills if any
auth.onAuthStateChanged(async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            document.getElementById('firstName').value = userData.firstName || '';
            document.getElementById('lastName').value = userData.lastName || '';
            document.getElementById('email').value = userData.email || '';
            document.getElementById('phone').value = userData.phone?.replace('+91', '') || '';
            document.getElementById('dob').value = userData.dob || '';
            
            // Load skills
            if (userData.skills) {
                skills = new Set(userData.skills);
                updateSkillsDisplay();
            }
        }
    }
});
// Resume handling
document.getElementById('resumeUpload').addEventListener('change', (e) => {
const file = e.target.files[0];
if (!file) return;

// Validate file size (5MB max)
if (file.size > 5 * 1024 * 1024) {
Toastify({
    text: "File size should not exceed 5MB",
    style: { background: "linear-gradient(to right, #ff416c, #ff4b2b)" }
}).showToast();
return;
}

// Display the selected file
document.getElementById('currentResume').style.display = 'block';
document.getElementById('resumeFileName').textContent = file.name;
document.getElementById('resumeFileSize').textContent = `Size: ${(file.size / (1024 * 1024)).toFixed(2)} MB`;
});

// Make functions available to window object
window.removeResume = async function() {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error('Not authenticated');

        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.data();

        if (userData.resumePath) {
            const resumeRef = ref(storage, userData.resumePath);
            await deleteObject(resumeRef);

            await updateDoc(doc(db, "users", user.uid), {
                resumeURL: null,
                resumePath: null,
                hasResume: false,
                updatedAt: new Date()
            });
        }

        document.getElementById('resumeUpload').value = '';
        document.getElementById('currentResume').style.display = 'none';
        document.getElementById('currentResume').innerHTML = '';

        Toastify({
            text: "Resume removed successfully!",
            duration: 3000,
            gravity: "top",
            position: "right",
            style: { background: "linear-gradient(to right, #00b09b, #96c93d)" }
        }).showToast();
    } catch (error) {
        console.error("Error removing resume:", error);
        Toastify({
            text: "Failed to remove resume. Please try again.",
            duration: 3000,
            gravity: "top",
            position: "right",
            style: { background: "linear-gradient(to right, #ff416c, #ff4b2b)" }
        }).showToast();
    }
}

// Remove the simple window.removeSkill function and use the async version directly
window.removeSkill = async function(skill) {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error('Not authenticated');

        // Remove skill from Set
        skills.delete(skill);

        // Get current user data first
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.data();

        // Update Firebase with the complete user data
        await updateDoc(doc(db, "users", user.uid), {
            ...userData,
            skills: Array.from(skills),
            updatedAt: new Date()
        });

        // Update display
        updateSkillsDisplay();

        Toastify({
            text: "Skill removed successfully!",
            duration: 3000,
            gravity: "top",
            position: "right",
            style: { background: "linear-gradient(to right, #00b09b, #96c93d)" }
        }).showToast();

    } catch (error) {
        console.error("Error removing skill:", error);
        Toastify({
            text: "Failed to remove skill. Please try again.",
            duration: 3000,
            gravity: "top",
            position: "right",
            style: { background: "linear-gradient(to right, #ff416c, #ff4b2b)" }
        }).showToast();
    }
};

window.addSkill = addSkill; // Add this line to expose addSkill function

// Skills handling
let skills = new Set();

// Single updateSkillsDisplay function
function updateSkillsDisplay() {
    const skillsContainer = document.getElementById('skillsContainer');
    if (!skillsContainer) return;
    
    skillsContainer.innerHTML = '';
    skills.forEach(skill => {
        const skillBadge = document.createElement('span');
        skillBadge.className = 'badge bg-primary me-2 mb-2';
        skillBadge.innerHTML = `${skill} <button type="button" class="btn-close btn-close-white" aria-label="Close" onclick="removeSkill('${skill.replace(/'/g, "\\'")}')"></button>`;
        skillsContainer.appendChild(skillBadge);
    });
}

// Function to add skills
async function addSkill() {
    const skillInput = document.getElementById('skillInput');
    if (!skillInput.value.trim()) {
        Toastify({
            text: "Please enter a skill",
            duration: 3000,
            gravity: "top",
            position: "right",
            style: { background: "linear-gradient(to right, #ff416c, #ff4b2b)" }
        }).showToast();
        return;
    }

    try {
        const user = auth.currentUser;
        if (!user) throw new Error('Not authenticated');

        // Split input by commas and clean up skills
        const newSkills = skillInput.value.split(',')
            .map(skill => skill.trim())
            .filter(skill => skill && !skills.has(skill));

        if (newSkills.length === 0) {
            Toastify({
                text: "Skill already exists!",
                duration: 3000,
                gravity: "top",
                position: "right",
                style: { background: "linear-gradient(to right, #ff416c, #ff4b2b)" }
            }).showToast();
            return;
        }

        // Add new skills to the Set
        newSkills.forEach(skill => skills.add(skill));

        // Update Firebase
        await updateDoc(doc(db, "users", user.uid), {
            skills: Array.from(skills),
            updatedAt: new Date()
        });
        
        // Update display
        updateSkillsDisplay();
        
        // Clear input after adding
        skillInput.value = '';

        Toastify({
            text: newSkills.length > 1 ? "Skills added successfully!" : "Skill added successfully!",
            duration: 3000,
            gravity: "top",
            position: "right",
            style: { background: "linear-gradient(to right, #00b09b, #96c93d)" }
        }).showToast();

    } catch (error) {
        console.error("Error adding skills:", error);
        Toastify({
            text: "Failed to add skills. Please try again.",
            duration: 3000,
            gravity: "top",
            position: "right",
            style: { background: "linear-gradient(to right, #ff416c, #ff4b2b)" }
        }).showToast();
    }
}

document.getElementById('avatarUpload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const user = auth.currentUser;
        if (!user) throw new Error('User not authenticated');

        // Create a reference to the storage location
        const storageRef = ref(storage, `profile_images/${user.uid}`);
        
        // Upload the file
        await uploadBytes(storageRef, file);
        
        // Get the download URL
        const downloadURL = await getDownloadURL(storageRef);
        
        // Update the image in the UI
        document.getElementById('userProfileImage').src = downloadURL;
        
        // Update the user's profile in Firestore
        await updateDoc(doc(db, "users", user.uid), {
            profileImageUrl: downloadURL
        });

        // Show success message
        Toastify({
            text: "Profile picture updated successfully!",
            duration: 3000,
            gravity: "top",
            position: "right",
            style: {
                background: "linear-gradient(to right, #00b09b, #96c93d)",
            }
        }).showToast();

    } catch (error) {
        console.error('Error uploading image:', error);
        Toastify({
            text: "Failed to update profile picture. Please try again.",
            duration: 3000,
            gravity: "top",
            position: "right",
            style: {
                background: "linear-gradient(to right, #ff5f6d, #ffc371)",
            }
        }).showToast();
    }
});