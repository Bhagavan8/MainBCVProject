// Import Firebase configuration
import firebaseConfig from './firebase-config.js';

// Initialize Firebase with dynamic imports
// Dynamic import function for Firebase modules
const loadFirebaseModules = async () => {
    const modules = {};
    
    // Core app is always needed
    const { initializeApp } = await import('firebase/app');
    modules.app = initializeApp(firebaseConfig);
    
    // Load auth only when needed
    modules.loadAuth = async () => {
        const { getAuth } = await import(
            /* webpackChunkName: "firebase-auth" */
            'firebase/auth'
        );
        return getAuth(modules.app);
    };
    
    // Load firestore only when needed
    modules.loadFirestore = async () => {
        const { getFirestore } = await import(
            /* webpackChunkName: "firebase-firestore" */
            'firebase/firestore'
        );
        return getFirestore(modules.app);
    };
    
    return modules;
};

// Initialize Firebase with retry mechanism
async function initializeFirebase(retryCount = 3, delay = 1000) {
    for (let i = 0; i < retryCount; i++) {
        try {
            const firebase = await loadFirebaseModules();
            console.log('Firebase initialized successfully');
            return firebase;
        } catch (error) {
            if (i === retryCount - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

export default initializeFirebase;