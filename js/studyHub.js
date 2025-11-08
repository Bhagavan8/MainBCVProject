// /js/studyHub.js
class StudyHubApp {
    constructor() {
        // Static study materials with file URLs
        this.studyMaterials = [
            {
                id: "java-fundamentals",
                title: "Java Fundamentals",
                description: "Comprehensive guide to Java programming basics with examples and exercises.",
                level: "beginner",
                domain: "java",
                fileSize: "2.4 MB",
                fileUrl: "/pdf/java-fundamentals.pdf", // Static file path
                tags: ["Java", "OOP", "Basics"],
                downloadCount: 0 // Will be updated from Firebase
            },
            {
                id: "advanced-java-patterns",
                title: "Advanced Java Patterns",
                description: "Deep dive into design patterns and advanced Java concepts for professional developers.",
                level: "advanced",
                domain: "java",
                fileSize: "3.7 MB",
                fileUrl: "/pdf/advanced-java-patterns.pdf",
                tags: ["Java", "Design Patterns", "Architecture"],
                downloadCount: 0
            },
            {
                id: "react-mastery",
                title: "React Mastery",
                description: "Complete guide to React development including hooks, context, and performance optimization.",
                level: "intermediate",
                domain: "web",
                fileSize: "4.2 MB",
                fileUrl: "/pdf/react-mastery.pdf",
                tags: ["React", "JavaScript", "Frontend"],
                downloadCount: 0
            },
            {
                id: "devops-essentials",
                title: "DevOps Essentials",
                description: "Introduction to DevOps practices, CI/CD pipelines, and containerization.",
                level: "beginner",
                domain: "devops",
                fileSize: "3.1 MB",
                fileUrl: "/pdf/devops-essentials.pdf",
                tags: ["DevOps", "CI/CD", "Docker"],
                downloadCount: 0
            },
            {
                id: "kubernetes-deep-dive",
                title: "Kubernetes Deep Dive",
                description: "Advanced Kubernetes concepts for managing containerized applications at scale.",
                level: "advanced",
                domain: "devops",
                fileSize: "5.2 MB",
                fileUrl: "/pdf/kubernetes-deep-dive.pdf",
                tags: ["Kubernetes", "Containers", "Orchestration"],
                downloadCount: 0
            },
            {
                id: "data-science-python",
                title: "Data Science with Python",
                description: "Practical guide to data analysis, visualization, and machine learning with Python.",
                level: "intermediate",
                domain: "data",
                fileSize: "4.8 MB",
                fileUrl: "/pdf/data-science-python.pdf",
                tags: ["Python", "Data Science", "ML"],
                downloadCount: 0
            }
        ];

        this.appState = {
            currentUser: null,
            isVerified: false,
            currentView: 'grid',
            filteredMaterials: [...this.studyMaterials],
            searchTerm: '',
            levelFilter: '',
            domainFilter: ''
        };

        this.initializeDOMElements();
    }

    initializeDOMElements() {
        this.materialsContainer = document.getElementById('materials-container');
        this.searchInput = document.getElementById('search-input');
        this.levelFilter = document.getElementById('level-filter');
        this.domainFilter = document.getElementById('domain-filter');
        this.gridViewBtn = document.getElementById('grid-view');
        this.listViewBtn = document.getElementById('list-view');
        this.loginBtn = document.getElementById('login-btn');
        this.registerBtn = document.getElementById('register-btn');
        this.logoutBtn = document.getElementById('logout-btn');
        this.userInfo = document.getElementById('user-info');
        this.userName = document.getElementById('user-name');
        this.userAvatar = document.getElementById('user-avatar');
        this.registerModal = document.getElementById('register-modal');
        this.loginModal = document.getElementById('login-modal');
        this.whatsappModal = document.getElementById('whatsapp-modal');
        this.registerForm = document.getElementById('register-form');
        this.loginForm = document.getElementById('login-form');
        this.verifyWhatsappBtn = document.getElementById('verify-whatsapp');
        this.closeModalBtns = document.querySelectorAll('.close-modal');
        this.exploreBtn = document.getElementById('explore-btn');
    }

    async loadCommonComponents() {
        try {
            // Load header
            const headerResponse = await fetch('/components/header.html');
            if (!headerResponse.ok) throw new Error('Header not found');
            const headerHtml = await headerResponse.text();
            document.getElementById('header-container').innerHTML = headerHtml;

            // Load footer
            const footerResponse = await fetch('/components/footer.html');
            if (!footerResponse.ok) throw new Error('Footer not found');
            const footerHtml = await footerResponse.text();
            document.getElementById('footer-container').innerHTML = footerHtml;

            console.log('Header and footer loaded successfully');
            
        } catch (error) {
            console.error('Error loading common components:', error);
            this.createFallbackHeaderFooter();
        }
    }

    createFallbackHeaderFooter() {
        const headerContainer = document.getElementById('header-container');
        const footerContainer = document.getElementById('footer-container');
        
        if (headerContainer) {
            headerContainer.innerHTML = `
                <header style="background: white; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 1rem 0;">
                    <div class="container">
                        <div class="header-content">
                            <div class="logo">StudyHub Pro</div>
                            <div class="user-actions">
                                <button class="btn btn-primary" id="fallback-login-btn">Login</button>
                                <button class="btn btn-secondary" id="fallback-register-btn">Register</button>
                            </div>
                        </div>
                    </div>
                </header>
            `;
        }
        
        if (footerContainer) {
            footerContainer.innerHTML = `
                <footer style="background: #333; color: white; padding: 2rem 0; margin-top: 3rem;">
                    <div class="container">
                        <p style="text-align: center;">&copy; 2023 StudyHub Pro. All rights reserved.</p>
                    </div>
                </footer>
            `;
        }
    }

    async initApp() {
        // Set up Firebase auth state listener
        this.setupAuthListener();
        
        // Load download counts from Firebase
        await this.loadDownloadCounts();
        
        // Set up real-time listener for download counts
        this.setupDownloadCountsListener();

        // Set up event listeners
        this.setupEventListeners();

        console.log('StudyHub App initialized successfully');
    }

    setupAuthListener() {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                this.appState.currentUser = {
                    uid: user.uid,
                    email: user.email,
                    name: user.displayName || user.email.split('@')[0]
                };
                
                // Check if user is verified in Firestore
                await this.checkUserVerification(user.uid);
            } else {
                this.appState.currentUser = null;
                this.appState.isVerified = false;
            }
            this.updateUserInterface();
        });
    }

    async checkUserVerification(uid) {
        try {
            const userDoc = await db.collection('users').doc(uid).get();
            if (userDoc.exists) {
                this.appState.isVerified = userDoc.data().whatsappVerified || false;
                this.updateUserInterface();
            }
        } catch (error) {
            console.error('Error checking user verification:', error);
        }
    }

    async loadDownloadCounts() {
        try {
            const snapshot = await db.collection('downloadCounts').get();
            const countsMap = {};
            
            snapshot.docs.forEach(doc => {
                countsMap[doc.id] = doc.data().count || 0;
            });

            // Update local materials with counts from Firebase
            this.studyMaterials.forEach(material => {
                material.downloadCount = countsMap[material.id] || 0;
            });

            this.appState.filteredMaterials = [...this.studyMaterials];
            this.renderMaterials();
            
        } catch (error) {
            console.error('Error loading download counts:', error);
            // Continue with default counts (0)
            this.renderMaterials();
        }
    }

    setupDownloadCountsListener() {
        // Real-time listener for download counts
        db.collection('downloadCounts').onSnapshot((snapshot) => {
            const countsMap = {};
            snapshot.docs.forEach(doc => {
                countsMap[doc.id] = doc.data().count || 0;
            });

            // Update local materials with new counts
            this.studyMaterials.forEach(material => {
                material.downloadCount = countsMap[material.id] || 0;
            });

            this.filterMaterials();
            
        }, (error) => {
            console.error('Error in download counts listener:', error);
        });
    }

    setupEventListeners() {
        // Search and filter
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => this.handleSearch(e));
        }
        if (this.levelFilter) {
            this.levelFilter.addEventListener('change', () => this.handleFilter());
        }
        if (this.domainFilter) {
            this.domainFilter.addEventListener('change', () => this.handleFilter());
        }

        // View toggle
        if (this.gridViewBtn) {
            this.gridViewBtn.addEventListener('click', () => this.toggleView('grid'));
        }
        if (this.listViewBtn) {
            this.listViewBtn.addEventListener('click', () => this.toggleView('list'));
        }

        // Auth buttons
        if (this.loginBtn) {
            this.loginBtn.addEventListener('click', () => this.openModal(this.loginModal));
        }
        if (this.registerBtn) {
            this.registerBtn.addEventListener('click', () => this.openModal(this.registerModal));
        }
        if (this.logoutBtn) {
            this.logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        // Explore button
        if (this.exploreBtn) {
            this.exploreBtn.addEventListener('click', () => {
                document.getElementById('materials').scrollIntoView({ behavior: 'smooth' });
            });
        }

        // Forms
        if (this.registerForm) {
            this.registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }
        if (this.loginForm) {
            this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
        if (this.verifyWhatsappBtn) {
            this.verifyWhatsappBtn.addEventListener('click', () => this.handleWhatsappVerification());
        }

        // Close modals
        this.closeModalBtns.forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeAllModals();
            }
        });

        // Set up verification code generation when modal opens
        if (this.whatsappModal) {
            this.whatsappModal.addEventListener('click', () => {
                document.getElementById('verification-code').textContent = this.generateVerificationCode();
            });
        }
    }

    handleSearch(e) {
        this.appState.searchTerm = e.target.value.toLowerCase();
        this.filterMaterials();
    }

    handleFilter() {
        this.appState.levelFilter = this.levelFilter.value;
        this.appState.domainFilter = this.domainFilter.value;
        this.filterMaterials();
    }

    filterMaterials() {
        const { searchTerm, levelFilter, domainFilter } = this.appState;
        
        this.appState.filteredMaterials = this.studyMaterials.filter(material => {
            const matchesSearch = material.title.toLowerCase().includes(searchTerm) || 
                                 material.description.toLowerCase().includes(searchTerm) ||
                                 material.tags.some(tag => tag.toLowerCase().includes(searchTerm));
            
            const matchesLevel = !levelFilter || material.level === levelFilter;
            const matchesDomain = !domainFilter || material.domain === domainFilter;
            
            return matchesSearch && matchesLevel && matchesDomain;
        });
        
        this.renderMaterials();
    }

    toggleView(view) {
        this.appState.currentView = view;
        
        if (view === 'grid') {
            this.gridViewBtn.classList.add('active');
            this.listViewBtn.classList.remove('active');
            this.materialsContainer.classList.remove('materials-list');
            this.materialsContainer.classList.add('materials-grid');
        } else {
            this.listViewBtn.classList.add('active');
            this.gridViewBtn.classList.remove('active');
            this.materialsContainer.classList.remove('materials-grid');
            this.materialsContainer.classList.add('materials-list');
        }
        
        this.renderMaterials();
    }

    renderMaterials() {
        if (!this.materialsContainer) return;
        
        this.materialsContainer.innerHTML = '';
        
        if (this.appState.filteredMaterials.length === 0) {
            this.materialsContainer.innerHTML = '<p style="text-align: center; grid-column: 1 / -1; padding: 40px;">No materials match your search criteria.</p>';
            return;
        }
        
        this.appState.filteredMaterials.forEach(material => {
            const materialElement = this.createMaterialElement(material);
            this.materialsContainer.appendChild(materialElement);
        });
    }

    createMaterialElement(material) {
        const div = document.createElement('div');
        div.className = 'material-card';
        
        // Determine tag class based on level
        let levelClass = '';
        if (material.level === 'beginner') levelClass = 'tag-beginner';
        if (material.level === 'intermediate') levelClass = 'tag-intermediate';
        if (material.level === 'advanced') levelClass = 'tag-advanced';
        
        div.innerHTML = `
            <div class="material-image">
                <span>PDF</span>
            </div>
            <div class="material-content">
                <h3 class="material-title">${material.title}</h3>
                <p class="material-description">${material.description}</p>
                <div class="material-meta">
                    <span>${material.fileSize}</span>
                    <span>${material.domain.toUpperCase()}</span>
                </div>
                <div class="material-tags">
                    <span class="tag ${levelClass}">${material.level}</span>
                    ${material.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
                <div class="material-actions">
                    <span class="download-count">${material.downloadCount} downloads</span>
                    <button class="btn btn-primary download-btn" data-id="${material.id}" ${!this.appState.isVerified ? 'disabled' : ''}>
                        ${this.appState.isVerified ? 'Download' : 'Verify to Download'}
                    </button>
                </div>
            </div>
        `;
        
        // Add event listener to download button
        const downloadBtn = div.querySelector('.download-btn');
        downloadBtn.addEventListener('click', () => this.handleDownload(material));
        
        return div;
    }

    async handleDownload(material) {
        if (!this.appState.currentUser) {
            this.openModal(this.registerModal);
            return;
        }
        
        if (!this.appState.isVerified) {
            this.openModal(this.whatsappModal);
            return;
        }
        
        try {
            // Update download count in Firebase
            const countRef = db.collection('downloadCounts').doc(material.id);
            await countRef.set({
                count: firebase.firestore.FieldValue.increment(1),
                lastUpdated: new Date()
            }, { merge: true });

            // Log download in user's history
            await db.collection('downloads').add({
                userId: this.appState.currentUser.uid,
                materialId: material.id,
                materialTitle: material.title,
                downloadedAt: new Date(),
                userEmail: this.appState.currentUser.email
            });

            // Trigger actual file download
            this.downloadFile(material.fileUrl, material.title);
            
        } catch (error) {
            console.error('Error handling download:', error);
            alert('Error downloading file. Please try again.');
        }
    }

    downloadFile(fileUrl, fileName) {
        // Create a temporary anchor element to trigger download
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = fileName + '.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        alert(`Downloading: ${fileName}\n\nYour download should start shortly.`);
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const phone = document.getElementById('reg-phone').value;
        const password = document.getElementById('reg-password').value;
        
        // Basic validation
        if (!name || !email || !phone || !password) {
            alert('Please fill in all fields');
            return;
        }
        
        if (password.length < 6) {
            alert('Password must be at least 6 characters long');
            return;
        }

        try {
            // Create user with Firebase Auth
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Update user profile
            await user.updateProfile({
                displayName: name
            });

            // Save additional user data to Firestore
            await db.collection('users').doc(user.uid).set({
                name: name,
                email: email,
                phone: phone,
                whatsappVerified: false,
                createdAt: new Date(),
                lastLogin: new Date()
            });

            this.closeAllModals();
            this.openModal(this.whatsappModal);
            this.registerForm.reset();
            
        } catch (error) {
            console.error('Registration error:', error);
            alert('Registration failed: ' + error.message);
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        try {
            await auth.signInWithEmailAndPassword(email, password);
            this.closeAllModals();
            this.loginForm.reset();
        } catch (error) {
            console.error('Login error:', error);
            alert('Login failed: ' + error.message);
        }
    }

    async handleWhatsappVerification() {
        const confirmCode = document.getElementById('confirm-code').value;
        const verificationCode = document.getElementById('verification-code').textContent;
        
        if (confirmCode === verificationCode) {
            try {
                // Update user verification status in Firestore
                await db.collection('users').doc(this.appState.currentUser.uid).update({
                    whatsappVerified: true,
                    verifiedAt: new Date()
                });

                this.appState.isVerified = true;
                alert('Verification successful! You can now download materials.');
                this.closeAllModals();
                this.updateUserInterface();
            } catch (error) {
                console.error('Error updating verification:', error);
                alert('Error completing verification. Please try again.');
            }
        } else {
            alert('Invalid verification code. Please try again.');
        }
    }

    async handleLogout() {
        try {
            await auth.signOut();
            this.appState.currentUser = null;
            this.appState.isVerified = false;
            this.updateUserInterface();
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    updateUserInterface() {
        if (this.appState.currentUser) {
            if (this.loginBtn) this.loginBtn.style.display = 'none';
            if (this.registerBtn) this.registerBtn.style.display = 'none';
            if (this.logoutBtn) this.logoutBtn.style.display = 'block';
            if (this.userInfo) this.userInfo.style.display = 'flex';
            
            if (this.userName) this.userName.textContent = this.appState.currentUser.name;
            if (this.userAvatar) this.userAvatar.textContent = this.appState.currentUser.name.charAt(0).toUpperCase();
            
            const downloadBtns = document.querySelectorAll('.download-btn');
            downloadBtns.forEach(btn => {
                if (this.appState.isVerified) {
                    btn.textContent = 'Download';
                    btn.disabled = false;
                } else {
                    btn.textContent = 'Verify to Download';
                    btn.disabled = false;
                }
            });
        } else {
            if (this.loginBtn) this.loginBtn.style.display = 'block';
            if (this.registerBtn) this.registerBtn.style.display = 'block';
            if (this.logoutBtn) this.logoutBtn.style.display = 'none';
            if (this.userInfo) this.userInfo.style.display = 'none';
            
            const downloadBtns = document.querySelectorAll('.download-btn');
            downloadBtns.forEach(btn => {
                btn.textContent = 'Login to Download';
                btn.disabled = false;
            });
        }
    }

    openModal(modal) {
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    generateVerificationCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    const app = new StudyHubApp();
    
    // Load common components first
    await app.loadCommonComponents();
    
    // Then initialize the main app
    await app.initApp();
});