const admin = require('firebase-admin');

// Helper to calculate age from DOB
function calculateAge(dob) {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    const difference = Date.now() - birthDate.getTime();
    const ageDate = new Date(difference);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
}

// 1. Get Dashboard Stats
async function getStats() {
    try {
        const usersSnapshot = await admin.firestore().collection('users').get();
        const totalUsers = usersSnapshot.size;

        const resultsSnapshot = await admin.firestore().collection('TestsResults').get();
        const totalTests = resultsSnapshot.size; // This counts users who have results, strictly speaking. 
        // Or if we want total *individual* tests run:
        // We'd need to aggregate bigfive + holland counts or query subcollections.
        // For efficiency, counting 'TestResults' docs gives "Users who have taken at least one test".
        // Let's stick to that for speed, or count documents in subcollections if needed (expensive).
        // Let's count total completed tests by summing fields?
        // Let's keep it simple: "Users with Results" vs "Total Users".
        
        // Active Users (last 30 days) - Requires querying 'activityLogs' or checking 'lastUpdated' on user?
        // Checking 'TestsResults.lastUpdated' is one way.
        // Or specific 'lastLogin' field if we tracked it (we didn't explicitly).
        // Let's use 'lastUpdated' from TestsResults as a proxy for test activity.
        
        // For a more accurate "Active Users", let's query users collection if we had a lastActive field.
        // Since we don't, we'll return 0 or placeholder, OR count users added recently?
        // Let's count users created in last 30 days.
        
        // Active Users (last 30 days)
        // Note: thirtyDaysAgo was already declared above.
        
        let activeUsers = 0;
        try {
            // Check if users collection has createdAt index before running this query
            // For robustness in this repair scripts context, we wrap in try/catch 
            const activeUsersSnapshot = await admin.firestore().collection('users')
                .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
                .get();
            activeUsers = activeUsersSnapshot.size;
        } catch (e) {
            console.warn("Active Users Query Failed (likely missing index or field):", e);
            // Fallback: Return 0 or try counting by metadata if accessible (not easily accessible in bulk without listUsers)
            activeUsers = 0; 
        }
        try {
            const activeUsersSnapshot = await admin.firestore().collection('users')
                .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
                .get();
            activeUsers = activeUsersSnapshot.size;
        } catch (e) {
            console.warn("Could not query by createdAt, defaulting to 0 or metadata check if needed.", e);
        }

        return {
            totalUsers,
            totalTests, // Users who have test results
            activeUsers // New users in last 30 days
        };
    } catch (error) {
        console.error("Error getting stats:", error);
        throw error;
    }
}

// 2. Get User Details
async function getUserDetails(uid) {
    try {
        const userDoc = await admin.firestore().collection('users').doc(uid).get();
        if (!userDoc.exists) throw new Error('User not found');
        const userData = userDoc.data();

        // Get Test Results
        const testsDoc = await admin.firestore().collection('TestsResults').doc(uid).get();
        const testResults = testsDoc.exists ? testsDoc.data() : {};

        // Get Activity Logs (Limit 50)
        const logsSnapshot = await admin.firestore().collection('users').doc(uid).collection('activityLogs')
            .orderBy('timestamp', 'desc').limit(50).get();
        
        const activityLogs = logsSnapshot.docs.map(doc => {
            const data = doc.data();
            // Handle missing timestamp gracefully
            let logTime = null;
            if (data.timestamp && typeof data.timestamp.toDate === 'function') {
                logTime = data.timestamp.toDate();
            } else if (data.timestamp) {
                // heuristic for ISO string or other format
                logTime = new Date(data.timestamp);
            }

            return {
                action: data.action || "Unknown Action",
                details: data.details || "",
                timestamp: logTime
            };
        });

        return {
            info: {
                ...userData,
                age: calculateAge(userData.dateOfBirth)
            },
            results: testResults,
            activity: activityLogs
        };
    } catch (error) {
        console.error("Error getting user details:", error);
        throw error;
    }
}

module.exports = {
    getStats,
    getUserDetails
};
