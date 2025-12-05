const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

try {
    // Initialize Firebase Admin SDK
    // Note: Ensure GOOGLE_APPLICATION_CREDENTIALS env var is set 
    // OR provide a serviceAccountKey.json path
    
    // For now, using application default credentials which works if set up,
    // or we can update this to require a specific key file if the user provides one.
    admin.initializeApp({
        credential: admin.credential.applicationDefault()
    });
    
    console.log('Firebase Admin Initialized successfully');
} catch (error) {
    console.error('Error initializing Firebase Admin:', error);
}

module.exports = admin;
