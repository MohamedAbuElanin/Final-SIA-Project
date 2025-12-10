/**
 * Admin helper functions
 * FIXED: Added null checks, error handling, validation, and production-safe logging
 */

const admin = require('firebase-admin');
const logger = require('./logger');

// FIXED: Helper to calculate age from DOB with proper error handling
function calculateAge(dob) {
    if (!dob) return 'N/A';
    
    try {
        const birthDate = new Date(dob);
        
        // FIXED: Validate date
        if (isNaN(birthDate.getTime())) {
            return 'Invalid Date';
        }
        
        const difference = Date.now() - birthDate.getTime();
        const ageDate = new Date(difference);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    } catch (error) {
        logger.error('Error calculating age:', error.message);
        return 'N/A';
    }
}

// 1. Get Dashboard Stats
// FIXED: Added comprehensive error handling and null checks
async function getStats() {
    try {
        // FIXED: Add try-catch for each operation
        let totalUsers = 0;
        try {
            const usersSnapshot = await admin.firestore().collection('users').get();
            totalUsers = usersSnapshot.size;
        } catch (usersError) {
            logger.error('Error counting users:', usersError.message);
            // Continue with 0
        }

        let totalTests = 0;
        try {
            const resultsSnapshot = await admin.firestore().collection('TestsResults').get();
            totalTests = resultsSnapshot.size;
        } catch (resultsError) {
            logger.error('Error counting test results:', resultsError.message);
            // Continue with 0
        }

        // FIXED: Active Users (last 30 days) with proper error handling
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        let activeUsers = 0;
        try {
            // FIXED: Validate date before query
            if (isNaN(thirtyDaysAgo.getTime())) {
                throw new Error('Invalid date calculation');
            }
            
            const activeUsersSnapshot = await admin.firestore()
                .collection('users')
                .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
                .get();
            activeUsers = activeUsersSnapshot.size;
        } catch (e) {
            logger.warn("Active Users Query Failed:", e.message);
            // FIXED: Fallback - try alternative method
            try {
                // Alternative: Count users with recent activity in TestsResults
                const recentResults = await admin.firestore()
                    .collection('TestsResults')
                    .where('lastUpdated', '>=', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
                    .get();
                activeUsers = recentResults.size;
            } catch (fallbackError) {
                logger.warn("Fallback active users query also failed:", fallbackError.message);
                activeUsers = 0;
            }
        }

        return {
            totalUsers,
            totalTests,
            activeUsers
        };
    } catch (error) {
        logger.error("Error getting stats:", error.message);
        // FIXED: Return default values instead of throwing
        return {
            totalUsers: 0,
            totalTests: 0,
            activeUsers: 0,
            error: error.message
        };
    }
}

// 2. Get User Details
// FIXED: Added comprehensive validation and error handling
async function getUserDetails(uid) {
    try {
        // FIXED: Validate UID
        if (!uid || typeof uid !== 'string' || uid.trim().length === 0) {
            throw new Error('Invalid UID provided');
        }

        const userDoc = await admin.firestore().collection('users').doc(uid).get();
        if (!userDoc.exists) {
            throw new Error('User not found');
        }
        
        const userData = userDoc.data();
        
        // FIXED: Validate userData
        if (!userData || typeof userData !== 'object') {
            throw new Error('Invalid user data format');
        }

        // Get Test Results
        let testResults = {};
        try {
            const testsDoc = await admin.firestore()
                .collection('TestsResults')
                .doc(uid)
                .get();
            if (testsDoc.exists) {
                testResults = testsDoc.data() || {};
            }
        } catch (testError) {
            logger.warn('Error fetching test results:', testError.message);
            // Continue without test results
        }

        // Get Activity Logs (Limit 50)
        let activityLogs = [];
        try {
            const logsSnapshot = await admin.firestore()
                .collection('users')
                .doc(uid)
                .collection('activityLogs')
                .orderBy('timestamp', 'desc')
                .limit(50)
                .get();
            
            activityLogs = logsSnapshot.docs.map(doc => {
                const data = doc.data();
                
                // FIXED: Handle timestamp conversion safely
                let logTime = null;
                if (data.timestamp && typeof data.timestamp.toDate === 'function') {
                    try {
                        logTime = data.timestamp.toDate();
                    } catch (dateError) {
                        logger.warn('Error converting timestamp:', dateError.message);
                        logTime = new Date();
                    }
                } else if (data.timestamp) {
                    try {
                        logTime = new Date(data.timestamp);
                        // Validate date
                        if (isNaN(logTime.getTime())) {
                            logTime = new Date();
                        }
                    } catch (dateError) {
                        logger.warn('Error parsing timestamp:', dateError.message);
                        logTime = new Date();
                    }
                } else {
                    logTime = new Date(); // Default to now if missing
                }

                return {
                    action: data.action || "Unknown Action",
                    details: data.details || "",
                    timestamp: logTime
                };
            });
        } catch (logError) {
            logger.warn('Error fetching activity logs:', logError.message);
            // Continue without activity logs
        }

        // FIXED: Calculate age safely
        let age = 'N/A';
        try {
            age = calculateAge(userData.dateOfBirth);
        } catch (ageError) {
            logger.warn('Error calculating age:', ageError.message);
        }

        return {
            info: {
                ...userData,
                age: age
            },
            results: testResults,
            activity: activityLogs
        };
    } catch (error) {
        logger.error("Error getting user details:", error.message);
        throw error; // Re-throw for API to handle
    }
}

module.exports = {
    getStats,
    getUserDetails
};
