/**
 * Firebase Admin SDK Initialization
 * UPDATED: Reads Firebase service account from environment variable (FIREBASE_SERVICE_ACCOUNT)
 * Works for Render, Railway, and other cloud platforms
 * Falls back to application default credentials for Firebase Functions
 */

const admin = require('firebase-admin');
const logger = require('./logger');

// UPDATED: Initialize Firebase Admin SDK from environment variable
// Priority: FIREBASE_SERVICE_ACCOUNT (JSON string) > Application Default Credentials
try {
    // Check if FIREBASE_SERVICE_ACCOUNT environment variable is set
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        // Parse JSON string from environment variable
        let serviceAccount;
        try {
            serviceAccount = typeof process.env.FIREBASE_SERVICE_ACCOUNT === 'string'
                ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
                : process.env.FIREBASE_SERVICE_ACCOUNT;
            
            // Validate that serviceAccount has required fields
            if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
                throw new Error('Invalid service account: missing required fields (project_id, private_key, client_email)');
            }
            
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            logger.log('Firebase Admin initialized with service account from FIREBASE_SERVICE_ACCOUNT environment variable');
        } catch (parseError) {
            logger.error('Error parsing FIREBASE_SERVICE_ACCOUNT:', parseError.message);
            throw new Error(`Failed to parse FIREBASE_SERVICE_ACCOUNT: ${parseError.message}`);
        }
    } else {
        // Fallback to application default credentials (for Firebase Functions)
        try {
            admin.initializeApp({
                credential: admin.credential.applicationDefault()
            });
            logger.log('Firebase Admin initialized with application default credentials (Firebase Functions)');
        } catch (defaultError) {
            logger.error('Failed to initialize with application default credentials:', defaultError.message);
            throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is required for cloud deployment');
        }
    }
    
    // Verify initialization
    if (!admin.apps || admin.apps.length === 0) {
        throw new Error('Firebase Admin failed to initialize - no apps found');
    }
    
    logger.log('Firebase Admin initialized successfully');
} catch (error) {
    logger.error('ERROR: Failed to initialize Firebase Admin:', error.message);
    logger.error('Please ensure FIREBASE_SERVICE_ACCOUNT environment variable is set with a valid JSON string.');
    logger.error('The JSON should contain: project_id, private_key, client_email, and other Firebase service account fields.');
    throw error; // Re-throw to prevent server from starting with invalid config
}

module.exports = admin;
