/**
 * Firebase Admin SDK Initialization
 * FIXED: Proper error handling, environment variable support, and Railway deployment readiness
 * Works for both Firebase Functions (default credentials) and Railway (service account)
 */

const admin = require('firebase-admin');
const dotenv = require('dotenv');
const logger = require('./logger');

dotenv.config();

// FIXED: Initialize Firebase Admin SDK with proper error handling
// Railway deployment: Use FIREBASE_SERVICE_ACCOUNT environment variable (JSON string)
// Firebase Functions: Uses application default credentials
try {
    // FIXED: Check for service account key file first
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        // Use service account key file if provided
        const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        logger.log('Firebase Admin initialized with service account key file');
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        // FIXED: Railway deployment - JSON string from environment variable
        try {
            const serviceAccount = typeof process.env.FIREBASE_SERVICE_ACCOUNT === 'string'
                ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
                : process.env.FIREBASE_SERVICE_ACCOUNT;
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            logger.log('Firebase Admin initialized with service account from environment (Railway)');
        } catch (parseError) {
            logger.error('Error parsing FIREBASE_SERVICE_ACCOUNT:', parseError.message);
            // Fallback to application default credentials
            admin.initializeApp({
                credential: admin.credential.applicationDefault()
            });
            logger.log('Firebase Admin initialized with application default credentials (fallback)');
        }
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        // FIXED: Support for base64 encoded service account key
        try {
            const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString());
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            logger.log('Firebase Admin initialized with base64 encoded service account key');
        } catch (parseError) {
            logger.error('Error parsing base64 service account key:', parseError.message);
            // Fallback to application default credentials
            admin.initializeApp({
                credential: admin.credential.applicationDefault()
            });
            logger.log('Firebase Admin initialized with application default credentials (fallback)');
        }
    } else {
        // FIXED: Fallback to application default credentials (Firebase Functions)
        admin.initializeApp({
            credential: admin.credential.applicationDefault()
        });
        logger.log('Firebase Admin initialized with application default credentials');
    }
    
    // FIXED: Verify initialization
    if (!admin.apps || admin.apps.length === 0) {
        throw new Error('Firebase Admin failed to initialize - no apps found');
    }
    
    logger.log('Firebase Admin initialized successfully');
} catch (error) {
    logger.error('ERROR: Failed to initialize Firebase Admin:', error.message);
    logger.error('Please ensure one of the following is set:');
    logger.error('1. GOOGLE_APPLICATION_CREDENTIALS environment variable pointing to service account key file');
    logger.error('2. FIREBASE_SERVICE_ACCOUNT environment variable with JSON string (Railway)');
    logger.error('3. FIREBASE_SERVICE_ACCOUNT_KEY environment variable with base64 encoded key');
    logger.error('4. Application default credentials configured (Firebase Functions)');
    throw error; // Re-throw to prevent server from starting with invalid config
}

module.exports = admin;
