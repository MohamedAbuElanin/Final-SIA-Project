const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const { calculateBigFive } = require('./bigfive');
const { calculateHolland } = require('./holland');
const { generateAnalysis } = require('./helpers');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

const app = express();

// Automatically allow cross-origin requests
app.use(cors({ origin: true }));
app.use(express.json());

// Auth Middleware
const authenticateUser = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const idToken = authHeader.split('Bearer ')[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error('Error verifying token:', error);
        res.status(403).json({ error: 'Unauthorized: Invalid token' });
    }
};

// Routes

// 1. Big Five Test
app.post('/bigfive', authenticateUser, async (req, res) => {
    try {
        const { answers } = req.body;
        if (!answers) return res.status(400).send('Missing answers');
        
        const results = await calculateBigFive(answers);
        
        // Fetch full user profile for AI Context
        const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
        const userProfile = userDoc.exists ? userDoc.data() : req.user;

        // Generate AI Analysis
        const analysis = await generateAnalysis('Big-Five', results, userProfile);
        
        // Save to Firestore (Paths expected by Frontend)
        const timestamp = admin.firestore.FieldValue.serverTimestamp();
        
        // Detailed Result
        await admin.firestore().collection('users').doc(req.user.uid).collection('tests').doc('Big-Five').set({
            result: results,
            analysis: analysis,
            answers: answers,
            timestamp: timestamp,
            completedAt: timestamp,
            testType: 'Big-Five'
        });

        // Profile Summary
        await admin.firestore().collection('TestsResults').doc(req.user.uid).set({
            bigFive: results,
            AI_Analysis: { bigFive: analysis },
            lastUpdated: timestamp
        }, { merge: true });

        // Log Activity
        await admin.firestore().collection('users').doc(req.user.uid).collection('activityLogs').add({
            action: 'Completed Big-Five Test',
            timestamp: timestamp
        });

        res.json({ results, analysis });
    } catch (error) {
        console.error('Error in BigFive:', error);
        res.status(500).send(error.message);
    }
});

// 2. Holland Test
app.post('/holland', authenticateUser, async (req, res) => {
    try {
        const { answers } = req.body;
        if (!answers) return res.status(400).send('Missing answers');

        const results = await calculateHolland(answers);
        
        const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
        const userProfile = userDoc.exists ? userDoc.data() : req.user;

        const analysis = await generateAnalysis('Holland', results, userProfile);

        const timestamp = admin.firestore.FieldValue.serverTimestamp();

        // Detailed Result
        await admin.firestore().collection('users').doc(req.user.uid).collection('tests').doc('Holland').set({
            result: results,
            analysis: analysis,
            answers: answers,
            timestamp: timestamp,
            completedAt: timestamp,
            testType: 'Holland'
        });

        // Profile Summary
        await admin.firestore().collection('TestsResults').doc(req.user.uid).set({
            hollandCode: results,
             AI_Analysis: { holland: analysis }
        }, { merge: true });
        
        // Log Activity
        await admin.firestore().collection('users').doc(req.user.uid).collection('activityLogs').add({
            action: 'Completed Holland Test',
            timestamp: timestamp
        });

        res.json({ results, analysis });
    } catch (error) {
         console.error('Error in Holland:', error);
        res.status(500).send(error.message);
    }
});

// 3. Load Profile
app.get('/profile', authenticateUser, async (req, res) => {
    try {
        const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
        if (!userDoc.exists) return res.status(404).send('User not found');
        
        // Fetch Activity
        const activitySnapshot = await admin.firestore().collection('users').doc(req.user.uid).collection('activityLogs')
            .orderBy('timestamp', 'desc')
            .limit(10)
            .get();
            
        const activity = activitySnapshot.docs.map(doc => {
            const data = doc.data();
            if (data.timestamp && data.timestamp.toDate) data.timestamp = data.timestamp.toDate();
            return data;
        });

        // Fetch Test Results
        const testResultsDoc = await admin.firestore().collection('TestsResults').doc(req.user.uid).get();
        const testResults = testResultsDoc.exists ? testResultsDoc.data() : {};

        res.json({
            ...userDoc.data(),
            activity,
            testResults
        });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).send(error.message);
    }
});

// 4. AI Analysis
app.post('/analyze-profile', authenticateUser, async (req, res) => {
    try {
        const { userData, bigFive, holland } = req.body;
        let analysis = {};
        
        if (bigFive) {
             const bfAnalysis = await generateAnalysis('Big-Five', bigFive, userData);
             analysis.bigFive = bfAnalysis;
        }
        if (holland) {
             const hAnalysis = await generateAnalysis('Holland', holland, userData);
             analysis.holland = hAnalysis;
        }
        
        await admin.firestore().collection('TestsResults').doc(req.user.uid).set({
            AI_Analysis: analysis
        }, { merge: true });

        res.json(analysis);
    } catch (error) {
        console.error('Error in analyze-profile:', error);
        res.status(500).send(error.message);
    }
});

// 5. Activity Log
app.post('/activity', authenticateUser, async (req, res) => {
    try {
        const { action, details } = req.body;
        await admin.firestore().collection('users').doc(req.user.uid).collection('activityLogs').add({
            action,
            details,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        res.status(200).send('Logged');
    } catch (error) {
        console.error('Error logging activity:', error);
        res.status(500).send(error.message);
    }
});

// --- ADMIN ROUTES ---
const adminLogic = require('./admin');

// Middleware: Strict Admin Check
const requireAdmin = (req, res, next) => {
    if (req.user.email !== 'mohamedosman@gamil.com') {
        return res.status(403).json({ error: 'Unauthorized: Admin access only' });
    }
    next();
};

// 6. Admin: List Users (Updated)
app.get('/admin/users', authenticateUser, requireAdmin, async (req, res) => {
    try {
        const listUsersResult = await admin.auth().listUsers(1000); // Fetch up to 1000
        const users = listUsersResult.users.map(user => ({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            metadata: user.metadata
        }));
        res.json(users);
    } catch (error) {
        console.error('Error listing users:', error);
        res.status(500).send(error.message);
    }
});

// 7. Admin: Get Stats
app.get('/admin/stats', authenticateUser, requireAdmin, async (req, res) => {
    try {
        const stats = await adminLogic.getStats();
        res.json(stats);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// 8. Admin: Get User Details
app.get('/admin/user/:uid', authenticateUser, requireAdmin, async (req, res) => {
    try {
        const { uid } = req.params;
        const details = await adminLogic.getUserDetails(uid);
        res.json(details);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

module.exports = app;
