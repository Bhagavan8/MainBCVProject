// Import Firebase configuration
import { db, auth, storage, functions } from './firebase-config.js';

// Initialize Firebase with dynamic imports
const loadFirebaseModules = async () => {
    const modules = {};
    
    try {
        modules.db = db;
        modules.auth = auth;
        modules.storage = storage;
        modules.functions = functions;
        
        console.log('Firebase modules loaded successfully');
        return modules;
    } catch (error) {
        console.error('Error loading Firebase modules:', error);
        throw error;
    }
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

export { initializeFirebase };