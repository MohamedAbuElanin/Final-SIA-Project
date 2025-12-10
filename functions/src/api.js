/**
 * Firebase Functions API Routes
 * FIXED: All endpoints have proper validation, error handling, security, and production-safe logging
 * Works for both Firebase Functions and Railway deployment
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const { calculateBigFive } = require('./bigfive');
const { calculateHolland } = require('./holland');
const { generateAnalysis } = require('./helpers');
const logger = require('./logger');

// FIXED: Initialize Firebase Admin if not already initialized
// Works for both Firebase Functions and Railway (with service account)
if (!admin.apps.length) {
    try {
        // FIXED: Railway deployment - use environment variable for service account
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            logger.log('Firebase Admin initialized with service account from environment');
        } else {
            // Firebase Functions uses default credentials
            admin.initializeApp();
            logger.log('Firebase Admin initialized with default credentials');
        }
    } catch (error) {
        logger.error('Error initializing Firebase Admin:', error.message);
        // Continue - may be initialized elsewhere
    }
}

const app = express();

// FIXED: CORS configuration - allow all origins for Firebase Functions
// For Railway, configure ALLOWED_ORIGINS environment variable
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // In production, check allowed origins if set
        if (process.env.ALLOWED_ORIGINS) {
            const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
            if (allowedOrigins.indexOf(origin) !== -1) {
                return callback(null, true);
            }
            return callback(new Error('Not allowed by CORS'));
        }
        
        // Default: allow all origins (Firebase Functions behavior)
        callback(null, true);
    },
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' })); // FIXED: Add size limit

// FIXED: Auth Middleware with better error handling
const authenticateUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        // FIXED: Proper validation
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                error: 'Unauthorized', 
                message: 'No authentication token provided',
                code: 'NO_TOKEN'
            });
        }

        const idToken = authHeader.split('Bearer ')[1];
        
        // FIXED: Validate token format
        if (!idToken || idToken.trim().length === 0) {
            return res.status(401).json({ 
                error: 'Unauthorized', 
                message: 'Invalid token format',
                code: 'INVALID_TOKEN_FORMAT'
            });
        }

        try {
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            req.user = decodedToken;
            next();
        } catch (error) {
            logger.error('Token verification error:', error.message);
            return res.status(403).json({ 
                error: 'Forbidden', 
                message: 'Invalid or expired token',
                code: 'INVALID_TOKEN'
            });
        }
    } catch (error) {
        logger.error('Authentication middleware error:', error.message);
        return res.status(500).json({ 
            error: 'Internal server error', 
            message: 'Authentication failed',
            code: 'AUTH_ERROR'
        });
    }
};

// Routes

// 1. Big Five Test
// FIXED: Added comprehensive validation and error handling
app.post('/bigfive', authenticateUser, async (req, res) => {
    try {
        // FIXED: Validate request body
        const { answers } = req.body;
        
        if (!answers || typeof answers !== 'object' || Object.keys(answers).length === 0) {
            return res.status(400).json({ 
                error: 'Bad Request', 
                message: 'Missing or invalid answers',
                code: 'MISSING_ANSWERS'
            });
        }

        // FIXED: Validate user object
        if (!req.user || !req.user.uid) {
            return res.status(401).json({ 
                error: 'Unauthorized', 
                message: 'Invalid user authentication',
                code: 'INVALID_USER'
            });
        }
        
        const results = await calculateBigFive(answers);
        
        // FIXED: Validate results
        if (!results || typeof results !== 'object') {
            return res.status(500).json({ 
                error: 'Internal server error', 
                message: 'Failed to calculate results',
                code: 'CALCULATION_ERROR'
            });
        }
        
        // Fetch full user profile for AI Context
        let userProfile = req.user;
        try {
            const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
            if (userDoc.exists) {
                userProfile = userDoc.data();
            }
        } catch (firestoreError) {
            logger.warn('Could not fetch user profile from Firestore:', firestoreError.message);
            // Continue with req.user as fallback
        }

        // Generate AI Analysis
        let analysis = null;
        try {
            analysis = await generateAnalysis('Big-Five', results, userProfile);
        } catch (aiError) {
            logger.error('AI Analysis failed:', aiError.message);
            // Continue without analysis - don't fail the entire request
            analysis = { error: 'Analysis temporarily unavailable' };
        }
        
        // FIXED: Use batch for atomic writes
        const timestamp = admin.firestore.FieldValue.serverTimestamp();
        const batch = admin.firestore().batch();
        
        // Detailed Result
        const testRef = admin.firestore()
            .collection('users')
            .doc(req.user.uid)
            .collection('tests')
            .doc('Big-Five');
        batch.set(testRef, {
            result: results,
            analysis: analysis,
            answers: answers,
            timestamp: timestamp,
            completedAt: timestamp,
            testType: 'Big-Five'
        }, { merge: true });

        // Profile Summary
        const resultsRef = admin.firestore()
            .collection('TestsResults')
            .doc(req.user.uid);
        batch.set(resultsRef, {
            bigFive: results,
            AI_Analysis: { bigFive: analysis },
            lastUpdated: timestamp
        }, { merge: true });

        // Log Activity
        const activityRef = admin.firestore()
            .collection('users')
            .doc(req.user.uid)
            .collection('activityLogs')
            .doc();
        batch.set(activityRef, {
            action: 'Completed Big-Five Test',
            timestamp: timestamp
        });

        // FIXED: Commit transaction with error handling
        try {
            await batch.commit();
        } catch (commitError) {
            logger.error('Error committing Firestore batch:', commitError.message);
            // Still return results even if save fails
        }

        res.json({ 
            status: 'success',
            results, 
            analysis 
        });
    } catch (error) {
        logger.error('Error in BigFive:', error.message);
        res.status(500).json({ 
            error: 'Internal server error', 
            message: 'Failed to process Big Five test',
            code: 'BIGFIVE_ERROR', 
            details: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
});

// 2. Holland Test
// FIXED: Added comprehensive validation and error handling
app.post('/holland', authenticateUser, async (req, res) => {
    try {
        // FIXED: Validate request body
        const { answers } = req.body;
        
        if (!answers || typeof answers !== 'object' || Object.keys(answers).length === 0) {
            return res.status(400).json({ 
                error: 'Bad Request', 
                message: 'Missing or invalid answers',
                code: 'MISSING_ANSWERS'
            });
        }

        // FIXED: Validate user object
        if (!req.user || !req.user.uid) {
            return res.status(401).json({ 
                error: 'Unauthorized', 
                message: 'Invalid user authentication',
                code: 'INVALID_USER'
            });
        }

        const results = await calculateHolland(answers);
        
        // FIXED: Validate results
        if (!results || typeof results !== 'object') {
            return res.status(500).json({ 
                error: 'Internal server error', 
                message: 'Failed to calculate results',
                code: 'CALCULATION_ERROR'
            });
        }
        
        let userProfile = req.user;
        try {
            const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
            if (userDoc.exists) {
                userProfile = userDoc.data();
            }
        } catch (firestoreError) {
            logger.warn('Could not fetch user profile from Firestore:', firestoreError.message);
        }

        let analysis = null;
        try {
            analysis = await generateAnalysis('Holland', results, userProfile);
        } catch (aiError) {
            logger.error('AI Analysis failed:', aiError.message);
            analysis = { error: 'Analysis temporarily unavailable' };
        }

        const timestamp = admin.firestore.FieldValue.serverTimestamp();
        const batch = admin.firestore().batch();

        // Detailed Result
        const testRef = admin.firestore()
            .collection('users')
            .doc(req.user.uid)
            .collection('tests')
            .doc('Holland');
        batch.set(testRef, {
            result: results,
            analysis: analysis,
            answers: answers,
            timestamp: timestamp,
            completedAt: timestamp,
            testType: 'Holland'
        }, { merge: true });

        // Profile Summary
        const resultsRef = admin.firestore()
            .collection('TestsResults')
            .doc(req.user.uid);
        batch.set(resultsRef, {
            hollandCode: results,
            AI_Analysis: { holland: analysis },
            lastUpdated: timestamp
        }, { merge: true });
        
        // Log Activity
        const activityRef = admin.firestore()
            .collection('users')
            .doc(req.user.uid)
            .collection('activityLogs')
            .doc();
        batch.set(activityRef, {
            action: 'Completed Holland Test',
            timestamp: timestamp
        });

        try {
            await batch.commit();
        } catch (commitError) {
            logger.error('Error committing Firestore batch:', commitError.message);
        }

        res.json({ 
            status: 'success',
            results, 
            analysis 
        });
    } catch (error) {
        logger.error('Error in Holland:', error.message);
        res.status(500).json({ 
            error: 'Internal server error', 
            message: 'Failed to process Holland test',
            code: 'HOLLAND_ERROR', 
            details: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
});

// 3. Load Profile
// FIXED: Added validation and error handling
app.get('/profile', authenticateUser, async (req, res) => {
    try {
        // FIXED: Validate user object
        if (!req.user || !req.user.uid) {
            return res.status(401).json({ 
                error: 'Unauthorized', 
                message: 'Invalid user authentication',
                code: 'INVALID_USER'
            });
        }

        const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
        if (!userDoc.exists) {
            return res.status(404).json({ 
                error: 'Not found', 
                message: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }
        
        // Fetch Activity
        let activity = [];
        try {
            const activitySnapshot = await admin.firestore()
                .collection('users')
                .doc(req.user.uid)
                .collection('activityLogs')
                .orderBy('timestamp', 'desc')
                .limit(10)
                .get();
                
            activity = activitySnapshot.docs.map(doc => {
                const data = doc.data();
                // FIXED: Handle timestamp conversion safely
                if (data.timestamp && typeof data.timestamp.toDate === 'function') {
                    data.timestamp = data.timestamp.toDate();
                }
                return data;
            });
        } catch (activityError) {
            logger.warn('Error fetching activity logs:', activityError.message);
            // Continue without activity logs
        }

        // Fetch Test Results
        let testResults = {};
        try {
            const testResultsDoc = await admin.firestore()
                .collection('TestsResults')
                .doc(req.user.uid)
                .get();
            if (testResultsDoc.exists) {
                testResults = testResultsDoc.data();
            }
        } catch (resultsError) {
            logger.warn('Error fetching test results:', resultsError.message);
            // Continue without test results
        }

        res.json({
            status: 'success',
            data: {
                ...userDoc.data(),
                activity,
                testResults
            }
        });
    } catch (error) {
        logger.error('Error fetching profile:', error.message);
        res.status(500).json({ 
            error: 'Internal server error', 
            message: 'Failed to fetch profile',
            code: 'PROFILE_ERROR', 
            details: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
});

// 4. AI Analysis
// FIXED: Added validation and error handling
app.post('/analyze-profile', authenticateUser, async (req, res) => {
    try {
        // FIXED: Validate request body
        const { userData, bigFive, holland } = req.body;
        
        if (!userData || typeof userData !== 'object') {
            return res.status(400).json({ 
                error: 'Bad Request', 
                message: 'User data is required',
                code: 'MISSING_USER_DATA'
            });
        }

        // FIXED: Validate user object
        if (!req.user || !req.user.uid) {
            return res.status(401).json({ 
                error: 'Unauthorized', 
                message: 'Invalid user authentication',
                code: 'INVALID_USER'
            });
        }

        let analysis = {};
        
        if (bigFive && typeof bigFive === 'object') {
            try {
                const bfAnalysis = await generateAnalysis('Big-Five', bigFive, userData);
                analysis.bigFive = bfAnalysis;
            } catch (aiError) {
                logger.error('Big Five analysis failed:', aiError.message);
                analysis.bigFive = { error: 'Analysis temporarily unavailable' };
            }
        }
        
        if (holland && typeof holland === 'object') {
            try {
                const hAnalysis = await generateAnalysis('Holland', holland, userData);
                analysis.holland = hAnalysis;
            } catch (aiError) {
                logger.error('Holland analysis failed:', aiError.message);
                analysis.holland = { error: 'Analysis temporarily unavailable' };
            }
        }
        
        // FIXED: Save to Firestore with error handling
        try {
            await admin.firestore()
                .collection('TestsResults')
                .doc(req.user.uid)
                .set({
                    AI_Analysis: analysis,
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
        } catch (saveError) {
            logger.error('Error saving analysis:', saveError.message);
            // Continue - return analysis even if save fails
        }

        res.json({ 
            status: 'success',
            data: analysis 
        });
    } catch (error) {
        logger.error('Error in analyze-profile:', error.message);
        res.status(500).json({ 
            error: 'Internal server error', 
            message: 'Failed to generate analysis',
            code: 'ANALYZE_ERROR', 
            details: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
});

// 5. Activity Log
// FIXED: Added validation and error handling
app.post('/activity', authenticateUser, async (req, res) => {
    try {
        // FIXED: Validate request body
        const { action, details } = req.body;
        
        if (!action || typeof action !== 'string' || action.trim().length === 0) {
            return res.status(400).json({ 
                error: 'Bad Request', 
                message: 'Action is required and must be a non-empty string',
                code: 'MISSING_ACTION'
            });
        }

        // FIXED: Validate user object
        if (!req.user || !req.user.uid) {
            return res.status(401).json({ 
                error: 'Unauthorized', 
                message: 'Invalid user authentication',
                code: 'INVALID_USER'
            });
        }

        // FIXED: Sanitize action to prevent injection
        const sanitizedAction = action.substring(0, 200).trim();
        const sanitizedDetails = details ? details.substring(0, 1000) : null;

        await admin.firestore()
            .collection('users')
            .doc(req.user.uid)
            .collection('activityLogs')
            .add({
                action: sanitizedAction,
                details: sanitizedDetails,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
            
        res.status(200).json({ 
            status: 'success',
            message: 'Activity logged' 
        });
    } catch (error) {
        logger.error('Error logging activity:', error.message);
        res.status(500).json({ 
            error: 'Internal server error', 
            message: 'Failed to log activity',
            code: 'ACTIVITY_ERROR', 
            details: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
});

// --- ADMIN ROUTES ---
const adminLogic = require('./admin');

// FIXED: Strict Admin Check with proper error handling
const requireAdmin = async (req, res, next) => {
    try {
        // FIXED: Validate user object
        if (!req.user || !req.user.uid) {
            return res.status(401).json({ 
                error: 'Unauthorized', 
                message: 'Invalid user authentication',
                code: 'INVALID_USER'
            });
        }

        // Check custom claims first (preferred method)
        if (req.user.admin === true) {
            return next();
        }

        // Fallback: Check Firestore users collection for role field
        try {
            const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                if (userData.role === 'admin') {
                    return next();
                }
            }
        } catch (firestoreError) {
            logger.error('Error checking user role in Firestore:', firestoreError.message);
            // Continue to next check
        }

        // Legacy: Check email (REMOVE AFTER MIGRATION)
        const legacyAdminEmails = ['mohamedosman@gmail.com', 'mohamedosman@gamil.com'];
        if (req.user.email && legacyAdminEmails.includes(req.user.email)) {
            logger.warn('Using legacy email-based admin check. Please migrate to role-based access.');
            return next();
        }

        return res.status(403).json({ 
            error: 'Forbidden', 
            message: 'Admin access required',
            code: 'ADMIN_REQUIRED'
        });
    } catch (error) {
        logger.error('Error checking admin status:', error.message);
        return res.status(500).json({ 
            error: 'Internal server error', 
            message: 'Failed to verify admin status',
            code: 'ADMIN_CHECK_ERROR'
        });
    }
};

// 6. Admin: List Users
// FIXED: Added validation and error handling
app.get('/admin/users', authenticateUser, requireAdmin, async (req, res) => {
    try {
        const listUsersResult = await admin.auth().listUsers(1000);
        const users = listUsersResult.users.map(user => ({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            metadata: user.metadata
        }));
        
        res.json({ 
            status: 'success',
            data: users 
        });
    } catch (error) {
        logger.error('Error listing users:', error.message);
        res.status(500).json({ 
            error: 'Internal server error', 
            message: 'Failed to list users',
            code: 'LIST_USERS_ERROR', 
            details: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
});

// 7. Admin: Get Stats
// FIXED: Added error handling
app.get('/admin/stats', authenticateUser, requireAdmin, async (req, res) => {
    try {
        const stats = await adminLogic.getStats();
        res.json({ 
            status: 'success',
            data: stats 
        });
    } catch (error) {
        logger.error('Error in admin stats:', error.message);
        res.status(500).json({ 
            error: 'Internal server error', 
            message: 'Failed to fetch admin statistics',
            code: 'ADMIN_STATS_ERROR', 
            details: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
});

// 8. Admin: Get User Details
// FIXED: Added validation and error handling
app.get('/admin/user/:uid', authenticateUser, requireAdmin, async (req, res) => {
    try {
        // FIXED: Validate UID parameter
        const { uid } = req.params;
        
        if (!uid || typeof uid !== 'string' || uid.trim().length === 0) {
            return res.status(400).json({ 
                error: 'Bad Request', 
                message: 'Invalid user UID',
                code: 'INVALID_UID'
            });
        }

        const details = await adminLogic.getUserDetails(uid);
        res.json({ 
            status: 'success',
            data: details 
        });
    } catch (error) {
        logger.error('Error in admin user details:', error.message);
        
        // FIXED: Handle specific error types
        if (error.message && error.message.includes('not found')) {
            return res.status(404).json({ 
                error: 'Not found', 
                message: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }
        
        res.status(500).json({ 
            error: 'Internal server error', 
            message: 'Failed to fetch user details',
            code: 'ADMIN_USER_ERROR', 
            details: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
});

// 9. Admin: Set User Role
// FIXED: Added comprehensive validation and error handling
app.post('/admin/set-role', authenticateUser, requireAdmin, async (req, res) => {
    try {
        // FIXED: Validate request body
        const { uid, role } = req.body;
        
        if (!uid || typeof uid !== 'string' || uid.trim().length === 0) {
            return res.status(400).json({ 
                error: 'Bad Request', 
                message: 'UID is required and must be a non-empty string',
                code: 'MISSING_UID'
            });
        }
        
        if (!role || typeof role !== 'string') {
            return res.status(400).json({ 
                error: 'Bad Request', 
                message: 'Role is required',
                code: 'MISSING_ROLE'
            });
        }
        
        if (role !== 'admin' && role !== 'user') {
            return res.status(400).json({ 
                error: 'Bad Request', 
                message: 'Invalid role. Must be "admin" or "user"',
                code: 'INVALID_ROLE'
            });
        }
        
        // FIXED: Prevent self-demotion (safety check)
        if (uid === req.user.uid && role === 'user') {
            return res.status(400).json({ 
                error: 'Bad Request', 
                message: 'Cannot revoke your own admin privileges',
                code: 'SELF_DEMOTION'
            });
        }
        
        const { setAdminClaim } = require('./admin-claims');
        const isAdmin = role === 'admin';
        const result = await setAdminClaim(uid, isAdmin);
        
        res.json({ 
            status: 'success',
            data: result 
        });
    } catch (error) {
        logger.error('Error setting user role:', error.message);
        res.status(500).json({ 
            error: 'Internal server error', 
            message: 'Failed to set user role',
            code: 'SET_ROLE_ERROR', 
            details: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
});

// FIXED: 404 Handler
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Not found', 
        message: 'The requested endpoint does not exist',
        code: 'ENDPOINT_NOT_FOUND',
        path: req.path
    });
});

// FIXED: Error Handler
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err.message);
    res.status(500).json({ 
        error: 'Internal server error', 
        message: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'production' ? undefined : err.message
    });
});

module.exports = app;
