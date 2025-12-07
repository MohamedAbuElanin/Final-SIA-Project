const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const { calculateBigFive } = require('./bigfive');
const { calculateHolland } = require('./holland');
const { generateAnalysis } = require('./helpers');

// Initialize Firebase Admin
admin.initializeApp();

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
        
        // 1. Detailed Result for Review/History
        await admin.firestore().collection('users').doc(req.user.uid).collection('tests').doc('Big-Five').set({
            result: results,
            analysis: analysis,
            answers: answers, // Save raw answers for review mode
            timestamp: timestamp,
            completedAt: timestamp,
            testType: 'Big-Five'
        });

        // 2. Profile Summary
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

app.post('/holland', authenticateUser, async (req, res) => {
    try {
        const { answers } = req.body;
        if (!answers) return res.status(400).send('Missing answers');

        const results = await calculateHolland(answers);
        
        // Fetch full user profile for AI Context
        const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
        const userProfile = userDoc.exists ? userDoc.data() : req.user;

        // Generate AI Analysis
        const analysis = await generateAnalysis('Holland', results, userProfile);

        // Save to Firestore (Paths expected by Frontend)
        const timestamp = admin.firestore.FieldValue.serverTimestamp();

        // 1. Detailed Result for Review/History
        await admin.firestore().collection('users').doc(req.user.uid).collection('tests').doc('Holland').set({
            result: results,
            analysis: analysis,
            answers: answers,
            timestamp: timestamp,
            completedAt: timestamp,
            testType: 'Holland'
        });

        // 2. Profile Summary
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

app.post('/logActivity', authenticateUser, async (req, res) => {
    try {
        const { action, details } = req.body;
        await admin.firestore().collection('activity_logs').add({
            uid: req.user.uid,
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

app.post('/analyze-profile', authenticateUser, async (req, res) => {
    try {
        const { userData, bigFive, holland } = req.body;
        // Logic to generate analysis based on what is provided
        // Using helper
        let analysis = {};
        if (bigFive) {
             const bfAnalysis = await generateAnalysis('Big-Five', bigFive, userData);
             analysis.bigFive = bfAnalysis;
        }
        if (holland) {
             const hAnalysis = await generateAnalysis('Holland', holland, userData);
             analysis.holland = hAnalysis;
        }
        
        // Save to Firestore
        await admin.firestore().collection('TestsResults').doc(req.user.uid).set({
            AI_Analysis: analysis
        }, { merge: true });

        res.json(analysis);
    } catch (error) {
        console.error('Error in analyze-profile:', error);
        res.status(500).send(error.message);
    }
});

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
             // Convert timestamp to date string for JSON
            if (data.timestamp && data.timestamp.toDate) data.timestamp = data.timestamp.toDate();
            return data;
        });

        // Fetch Test Results for convenience
        const testResultsDoc = await admin.firestore().collection('TestsResults').doc(req.user.uid).get();
        const testResults = testResultsDoc.exists ? testResultsDoc.data() : {};

        res.json({
            ...userDoc.data(),
            activity,
            testResults // Include test results in profile response
        });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).send(error.message);
    }
});


module.exports = app;
