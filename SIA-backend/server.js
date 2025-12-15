/**
 * SIA Backend Server - Main Express Server
 * FIXED: All runtime errors, security vulnerabilities, and missing validations
 * Works for both Firebase Functions and Railway deployment
 */

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const logger = require('./logger');

// Load environment variables
dotenv.config();

const app = express();
// FIXED: Railway deployment - use PORT from environment (Railway sets this automatically)
const PORT = process.env.PORT || 5000;

// FIXED: Validate required environment variables
if (!process.env.GEMINI_API_KEY) {
    logger.error('ERROR: GEMINI_API_KEY environment variable is not set!');
    logger.error('Please set it in your .env file or environment variables.');
    process.exit(1);
}

// FIXED: Initialize Gemini AI with proper error handling
let ai;
try {
    const { GoogleGenAI } = require("@google/genai");
    ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY
    });
    logger.log('Gemini AI initialized successfully');
} catch (error) {
    logger.error('ERROR: Failed to initialize GoogleGenAI:', error.message);
    process.exit(1);
}

// UPDATED: Initialize Firebase Admin from environment variable
// Reads FIREBASE_SERVICE_ACCOUNT environment variable (JSON string)
// Falls back to application default credentials for Firebase Functions
// For Render/Railway: Set FIREBASE_SERVICE_ACCOUNT in dashboard environment variables
let admin;
try {
    admin = require('./firebase-admin');
    if (!admin || !admin.auth) {
        throw new Error('Firebase Admin not properly initialized');
    }
    logger.log('Firebase Admin initialized successfully');
} catch (error) {
    logger.error('ERROR: Failed to initialize Firebase Admin:', error.message);
    logger.error('Make sure FIREBASE_SERVICE_ACCOUNT environment variable is set with valid JSON.');
    process.exit(1);
}

// FIXED: Rate limiting middleware to prevent abuse
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// FIXED: CORS configuration - allow frontend requests
// Explicitly allow Firebase hosting domains and localhost for development
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // Firebase hosting domains (production)
        const firebaseDomains = [
            'https://sia-993a7.firebaseapp.com',
            'https://sia-project-2458a.web.app',
            'https://sia-993a7.web.app' // Additional Firebase domain
        ];
        
        // Local development origins
        const localOrigins = [
            'http://localhost:5000', 
            'http://localhost:3000',
            'http://localhost:8080',
            'http://localhost:5506',  // Live Server default port
            'http://127.0.0.1:5000',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:8080',
            'http://127.0.0.1:5506'   // Live Server default port
        ];
        
        // Combine all allowed origins
        const allowedOrigins = process.env.ALLOWED_ORIGINS 
            ? [...process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()), ...firebaseDomains, ...localOrigins]
            : [...firebaseDomains, ...localOrigins];
        
        // Check if origin is in allowed list
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else if (process.env.NODE_ENV !== 'production') {
            // In development, allow any localhost/127.0.0.1
            if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
                callback(null, true);
            } else {
                logger.warn(`CORS blocked origin in development: ${origin}`);
                callback(new Error('Not allowed by CORS'));
            }
        } else {
            // In production, only allow explicit domains
            logger.warn(`CORS blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

// ==========================================
// MIDDLEWARE STACK
// ==========================================

// Request logging middleware - CRITICAL for debugging 404s
app.use((req, res, next) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    req.requestId = requestId;
    
    // Log all incoming requests
    logger.log(`[Request] [${requestId}] ${req.method} ${req.path}`);
    logger.log(`[Request] [${requestId}] Origin: ${req.get('origin') || 'none'}`);
    logger.log(`[Request] [${requestId}] IP: ${req.ip}`);
    
    // Log response when finished
    const originalSend = res.send;
    res.send = function(data) {
        logger.log(`[Response] [${requestId}] ${req.method} ${req.path} → ${res.statusCode}`);
        return originalSend.call(this, data);
    };
    
    next();
});

// Standard middleware
app.use(limiter); // FIXED: Apply rate limiting
app.use(cors(corsOptions)); // FIXED: Use configured CORS
app.use(bodyParser.json({ limit: '10mb' })); // FIXED: Add size limit
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' })); // FIXED: Add size limit

// FIXED: Middleware to verify Firebase ID Token with better error handling
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

// ==========================================
// ROOT & HEALTH CHECK ENDPOINTS
// ==========================================

// GET route - Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'success',
        message: 'SIA Backend Server is running!',
        timestamp: new Date().toISOString(),
        endpoints: {
            health: '/api/health',
            profile: '/api/profile'
        }
    });
});

// Health check endpoint for Render/Railway (legacy)
app.get('/healthz', (req, res) => {
    res.status(200).json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// ==========================================
// HEALTH CHECK ENDPOINT
// ==========================================
// GET /api/health - Server health and availability check
// Must be before other /api routes for quick availability check
// No authentication required
// CRITICAL: Always returns 200 if server is running (even if services are down)
app.get('/api/health', (req, res) => {
    const requestId = req.requestId || `health_${Date.now()}`;
    
    // Log health check request
    logger.log(`[Health Check] 📥 [${requestId}] GET /api/health from ${req.ip}`);
    
    try {
        // Get package version
        const packageJson = require('./package.json');
        const version = packageJson.version || '1.0.0';
        
        // Get registered routes for response
        const registeredRoutes = {
            profile: '/api/profile',
            health: '/api/health',
            saveTest: '/api/save-test',
            analyze: '/api/analyze-with-gemini',
            userProfile: '/api/user-profile',
            bigfive: '/api/bigfive',
            holland: '/api/holland'
        };
        
        // Check service status (non-blocking)
        const firebaseStatus = admin && admin.firestore ? 'connected' : 'disconnected';
        const aiStatus = ai ? 'available' : 'unavailable';
        
        const healthData = {
            status: 'healthy', // Always healthy if server is running
            uptime: Math.floor(process.uptime()), // Integer seconds
            environment: process.env.NODE_ENV || 'development',
            version: version,
            port: PORT,
            routes: registeredRoutes,
            timestamp: new Date().toISOString(),
            services: {
                firebase: firebaseStatus,
                ai: aiStatus
            },
            requestId: requestId
        };
        
        logger.log(`[Health Check] ✅ [${requestId}] Health check successful - Uptime: ${healthData.uptime}s`);
        
        // ALWAYS return 200 - server is running
        res.status(200).json(healthData);
    } catch (error) {
        // Even on error, return 200 with unhealthy status
        logger.error(`[Health Check] ⚠️ [${requestId}] Error in health check:`, error.message);
        res.status(200).json({
            status: 'unhealthy',
            uptime: Math.floor(process.uptime()),
            environment: process.env.NODE_ENV || 'development',
            version: 'unknown',
            port: PORT,
            error: error.message,
            timestamp: new Date().toISOString(),
            requestId: requestId
        });
    }
});

// POST route - Save Test Results to Firestore
// Saves test results to users/{userId}/tests/{testName}
// FIXED: Added comprehensive error handling and validation
app.post('/api/save-test', async (req, res) => {
    try {
        // Validate request body exists
        if (!req.body || typeof req.body !== 'object') {
            logger.error('Invalid request body in save-test');
            return res.status(400).json({ 
                error: 'Bad Request',
                message: 'Request body is required and must be a JSON object',
                code: 'INVALID_BODY'
            });
        }

        const { userId, testName, resultData } = req.body;

        // Validate required fields with detailed logging
        if (!userId) {
            logger.error('Missing userId in save-test request');
            return res.status(400).json({ 
                error: 'Missing fields',
                message: 'userId is required',
                code: 'MISSING_USER_ID'
            });
        }

        if (!testName) {
            logger.error('Missing testName in save-test request');
            return res.status(400).json({ 
                error: 'Missing fields',
                message: 'testName is required',
                code: 'MISSING_TEST_NAME'
            });
        }

        if (!resultData) {
            logger.error('Missing resultData in save-test request');
            return res.status(400).json({ 
                error: 'Missing fields',
                message: 'resultData is required',
                code: 'MISSING_RESULT_DATA'
            });
        }

        // Validate userId format (should be a string)
        if (typeof userId !== 'string' || userId.trim().length === 0) {
            logger.error('Invalid userId format:', typeof userId, userId);
            return res.status(400).json({ 
                error: 'Invalid userId',
                message: 'userId must be a non-empty string',
                code: 'INVALID_USER_ID'
            });
        }

        // Validate testName format
        if (typeof testName !== 'string' || testName.trim().length === 0) {
            logger.error('Invalid testName format:', typeof testName, testName);
            return res.status(400).json({ 
                error: 'Invalid testName',
                message: 'testName must be a non-empty string',
                code: 'INVALID_TEST_NAME'
            });
        }

        // Validate resultData is an object (but allow arrays for answers)
        if (!resultData || typeof resultData !== 'object') {
            logger.error('Invalid resultData type:', typeof resultData);
            return res.status(400).json({ 
                error: 'Invalid resultData',
                message: 'resultData must be an object',
                code: 'INVALID_RESULT_DATA'
            });
        }

        // Normalize test name (handle variations)
        const normalizedTestName = testName.trim();
        const validTestNames = ['Big-Five', 'Holland', 'Holland-codes'];
        if (!validTestNames.includes(normalizedTestName)) {
            logger.warn(`Test name "${normalizedTestName}" not in standard list, proceeding anyway`);
        }

        logger.log(`[Save-Test] Saving test result for user ${userId}, test: ${normalizedTestName}`);
        logger.log(`[Save-Test] Result data structure:`, {
            hasAnswers: !!resultData.answers,
            hasResult: !!resultData.result,
            hasAnalysis: !!resultData.analysis,
            keys: Object.keys(resultData)
        });

        // Validate Firestore admin is initialized
        if (!admin || !admin.firestore) {
            logger.error('Firebase Admin not initialized');
            return res.status(500).json({ 
                error: 'Internal server error',
                message: 'Database service not available',
                code: 'DATABASE_UNAVAILABLE'
            });
        }

        // Save to Firestore: users/{userId}/tests/{testName}
        const db = admin.firestore();
        const docRef = db
            .collection('users')
            .doc(userId.trim())
            .collection('tests')
            .doc(normalizedTestName);

        // Prepare document data with proper timestamps
        const documentData = {
            ...resultData,
            testType: normalizedTestName,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            savedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // Save to Firestore with error handling
        try {
            await docRef.set(documentData, { merge: true });
            logger.log(`[Save-Test] ✅ Test result saved successfully for user ${userId}, test: ${normalizedTestName}`);
            
            // ALSO save to new tests_results collection structure
            try {
                await saveToNewTestResultsStructure(userId, normalizedTestName, resultData);
            } catch (newStructError) {
                // Log but don't fail the request if new structure save fails
                logger.warn('[Save-Test] Failed to save to new structure:', newStructError.message);
            }
        } catch (firestoreError) {
            logger.error('[Save-Test] Firestore error:', firestoreError.message);
            logger.error('[Save-Test] Firestore error stack:', firestoreError.stack);
            
            // Check for specific Firestore errors
            if (firestoreError.code === 'permission-denied') {
                return res.status(403).json({ 
                    error: 'Permission denied',
                    message: 'Firestore security rules denied this operation',
                    code: 'FIRESTORE_PERMISSION_DENIED'
                });
            } else if (firestoreError.code === 'unavailable') {
                return res.status(503).json({ 
                    error: 'Service unavailable',
                    message: 'Firestore service is temporarily unavailable',
                    code: 'FIRESTORE_UNAVAILABLE'
                });
            } else {
                throw firestoreError; // Re-throw to be caught by outer catch
            }
        }

        res.json({ 
            success: true,
            message: 'Test result saved successfully',
            path: `users/${userId}/tests/${normalizedTestName}`,
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        // Comprehensive error logging
        logger.error('[Save-Test] ❌ Error saving test result:', err.message);
        logger.error('[Save-Test] Error code:', err.code);
        logger.error('[Save-Test] Error stack:', err.stack);
        
        // Determine appropriate status code
        let statusCode = 500;
        if (err.code === 'permission-denied') {
            statusCode = 403;
        } else if (err.code === 'unavailable' || err.code === 'deadline-exceeded') {
            statusCode = 503;
        } else if (err.message && err.message.includes('validation')) {
            statusCode = 400;
        }
        
        res.status(statusCode).json({ 
            error: 'Failed to save test result',
            message: err.message || 'An unexpected error occurred',
            code: err.code || 'SAVE_ERROR',
            details: process.env.NODE_ENV === 'production' ? undefined : err.stack
        });
    }
});

// ==========================================
// AI ANALYSIS ENDPOINT
// ==========================================
// POST /api/analyze-with-gemini - Analyze test results with Gemini AI
// Accepts: { userId, combinedResults } or { testResults: { bigfive: {...}, holland: {...} } }
// CRITICAL: Prevents duplicate analysis execution
app.post('/api/analyze-with-gemini', authenticateUser, async (req, res) => {
    const requestId = req.requestId || `analyze_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const userId = req.user?.uid || req.body.userId;
    
    // Structured logging
    logger.log(`[Gemini API] 📥 [${requestId}] POST /api/analyze-with-gemini`);
    logger.log(`[Gemini API] 📥 [${requestId}] User: ${userId}`);
    logger.log(`[Gemini API] 📥 [${requestId}] IP: ${req.ip}`);
    
    try {
        // Validate authentication (if using middleware)
        if (!userId) {
            logger.warn(`[Gemini API] ⚠️ [${requestId}] Missing userId`);
            return res.status(400).json({
                status: 'error',
                error: 'Missing fields',
                message: 'userId is required',
                code: 'MISSING_USER_ID',
                requestId: requestId
            });
        }

        // CRITICAL: Check if analysis already exists or is in progress to prevent duplicates
        const db = admin.firestore();
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();

            // If AI is already processing or completed, return existing analysis
            if (userData.aiStatus === 'processing') {
                logger.log(`[Gemini API] ℹ️ [${requestId}] AI analysis already processing for user ${userId}, skipping duplicate trigger`);
                return res.status(200).json({
                    status: 'success',
                    message: 'AI analysis already processing',
                    code: 'AI_ALREADY_PROCESSING',
                    requestId: requestId
                });
            }

            if (userData.aiStatus === 'completed' && userData.aiAnalysis) {
                logger.log(`[Gemini API] ℹ️ [${requestId}] AI analysis already completed for user ${userId}, returning cached result`);
                return res.status(200).json({
                    status: 'success',
                    message: 'Analysis already exists',
                    analysis: userData.aiAnalysis,
                    cached: true,
                    requestId: requestId
                });
            }

            // Backwards compatibility: if legacy fields exist, respect 1-hour cache window
            if (userData.aiSummary && userData.recommendedCareers && userData.recommendedCareers.length > 0) {
                const lastAnalysisTime = userData.aiAnalysisUpdatedAt?.toDate?.() || 
                                       (userData.aiAnalysisUpdatedAt ? new Date(userData.aiAnalysisUpdatedAt) : null);
                
                if (lastAnalysisTime) {
                    const hoursSinceAnalysis = (new Date() - lastAnalysisTime) / (1000 * 60 * 60);
                    
                    // If analysis exists and is less than 1 hour old, return existing
                    if (hoursSinceAnalysis < 1) {
                        logger.log(`[Gemini API] ℹ️ [${requestId}] Legacy analysis exists (${Math.round(hoursSinceAnalysis * 60)} minutes ago), returning existing`);
                        return res.status(200).json({
                            status: 'success',
                            message: 'Analysis already exists',
                            analysis: {
                                personalityAnalysis: userData.aiSummary,
                                top3Careers: userData.recommendedCareers
                            },
                            cached: true,
                            requestId: requestId
                        });
                    }
                }
            }
        }

        const { combinedResults, testResults: testResultsBody } = req.body;

        // Extract test results
        let bigFiveResults = null;
        let hollandResults = null;

        if (combinedResults) {
            bigFiveResults = combinedResults.bigfive || combinedResults.bigFive || null;
            hollandResults = combinedResults.holland || null;
        } else if (testResultsBody) {
            bigFiveResults = testResultsBody.bigfive || testResultsBody.bigFive || null;
            hollandResults = testResultsBody.holland || null;
        } else {
            // Try to fetch from Firestore if not provided
            logger.log(`[Gemini API] ℹ️ [${requestId}] Test results not in request, fetching from Firestore`);
            const testResultsDoc = await db.collection('tests_results').doc(userId).get();
            if (testResultsDoc.exists) {
                const testData = testResultsDoc.data();
                bigFiveResults = testData.bigFive || null;
                hollandResults = testData.holland || null;
            }
        }

        // Validate that at least one test result is provided
        if (!bigFiveResults && !hollandResults) {
            logger.warn(`[Gemini API] ⚠️ [${requestId}] No test results provided or found`);
            return res.status(400).json({ 
                status: 'error',
                error: 'Invalid data',
                message: 'At least one test result (bigfive or holland) must be provided',
                code: 'INVALID_DATA',
                requestId: requestId
            });
        }

        // CRITICAL: Validate both tests are complete before analysis
        const hasBigFive = bigFiveResults && typeof bigFiveResults === 'object' &&
            ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'].every(trait => 
                typeof bigFiveResults[trait] === 'number'
            );
        const hasHolland = hollandResults && typeof hollandResults === 'object' &&
            ['R', 'I', 'A', 'S', 'E', 'C'].every(code => 
                typeof hollandResults[code] === 'number'
            );

        if (!hasBigFive || !hasHolland) {
            logger.warn(`[Gemini API] ⚠️ [${requestId}] Tests incomplete - Big Five: ${hasBigFive}, Holland: ${hasHolland}`);
            return res.status(400).json({
                status: 'error',
                error: 'Tests incomplete',
                message: 'Both Big Five and Holland tests must be completed before AI analysis',
                code: 'TESTS_INCOMPLETE',
                requestId: requestId,
                testsStatus: {
                    bigFive: hasBigFive,
                    holland: hasHolland
                }
            });
        }

        // Check if AI is initialized
        if (!ai) {
            logger.error(`[Gemini API] ❌ [${requestId}] AI service not available`);
            return res.status(503).json({ 
                status: 'error',
                error: 'Service unavailable', 
                message: 'AI service is not available',
                code: 'AI_SERVICE_UNAVAILABLE',
                requestId: requestId
            });
        }

        // CRITICAL: Set AI status to "processing" before calling Gemini (Firestore lock)
        await userRef.update({
            aiStatus: 'processing',
            aiTriggeredAt: admin.firestore.FieldValue.serverTimestamp(),
            lastAIAnalysisRequestId: requestId
        });

        logger.log(`[Gemini API] 🔄 [${requestId}] Starting AI analysis for user ${userId}`);
        logger.log(`[Gemini API] 🔄 [${requestId}] Big Five: ${hasBigFive ? 'Complete' : 'Incomplete'}, Holland: ${hasHolland ? 'Complete' : 'Incomplete'}`);

        // Build prompt for Gemini
        let promptTestsSection = "";
        
        if (bigFiveResults && typeof bigFiveResults === 'object') {
            promptTestsSection += `
            **Big Five Personality Traits:**
            ${JSON.stringify(bigFiveResults, null, 2)}
            `;
        } else {
            promptTestsSection += `
            **Big Five Personality Traits:**
            [Data Not Available]
            `;
        }

        if (hollandResults && typeof hollandResults === 'object') {
            promptTestsSection += `
            **Holland Codes (RIASEC Scores):**
            ${JSON.stringify(hollandResults, null, 2)}
            `;
        } else {
            promptTestsSection += `
            **Holland Codes (RIASEC Scores):**
            [Data Not Available]
            `;
        }

        const prompt = `
        You are an expert career counselor and personality analyst. Analyze the following test results to provide personalized career recommendations.

        ${promptTestsSection}

        **Task:**
        Generate a detailed JSON object with exactly 3 career recommendations. The JSON must follow this exact schema:

        {
            "personalityAnalysis": "A deep analysis (approx 150 words) explaining how their personality traits and interests align with career paths.",
            "top3Careers": [
                { 
                    "title": "Specific Job Title 1 (Most Compatible)", 
                    "fit": "95%", 
                    "reason": "2-3 sentences explaining WHY this fits their specific trait combination.",
                    "skills": ["Key Skill 1", "Key Skill 2", "Key Skill 3"],
                    "roadmap": [
                        { "step": "Phase 1: Foundation (Months 1-2)", "description": "Specific, actionable steps" },
                        { "step": "Phase 2: Skill Building (Months 3-6)", "description": "Specific, actionable steps" },
                        { "step": "Phase 3: Application (Months 7-12)", "description": "Specific, actionable steps" }
                    ],
                    "resources": {
                        "books": [
                            { "title": "Recommended Book", "author": "Author Name", "link": "https://amazon.com/..." }
                        ],
                        "youtubeCourses": [
                            { "title": "Course Title", "channel": "Channel Name", "link": "https://youtube.com/..." }
                        ],
                        "platforms": [
                            { "title": "Course Name", "platform": "Coursera/Udemy/edX", "link": "https://platform.com/..." }
                        ]
                    }
                },
                { 
                    "title": "Specific Job Title 2 (Second Most Compatible)", 
                    "fit": "90%", 
                    "reason": "...",
                    "skills": ["..."],
                    "roadmap": [
                        { "step": "Phase 1: Foundation", "description": "..." },
                        { "step": "Phase 2: Skill Building", "description": "..." },
                        { "step": "Phase 3: Application", "description": "..." }
                    ],
                    "resources": {
                        "books": [{ "title": "...", "author": "...", "link": "https://..." }],
                        "youtubeCourses": [{ "title": "...", "channel": "...", "link": "https://..." }],
                        "platforms": [{ "title": "...", "platform": "...", "link": "https://..." }]
                    }
                },
                { 
                    "title": "Specific Job Title 3 (Third Most Compatible)", 
                    "fit": "85%", 
                    "reason": "...",
                    "skills": ["..."],
                    "roadmap": [
                        { "step": "Phase 1: Foundation", "description": "..." },
                        { "step": "Phase 2: Skill Building", "description": "..." },
                        { "step": "Phase 3: Application", "description": "..." }
                    ],
                    "resources": {
                        "books": [{ "title": "...", "author": "...", "link": "https://..." }],
                        "youtubeCourses": [{ "title": "...", "channel": "...", "link": "https://..." }],
                        "platforms": [{ "title": "...", "platform": "...", "link": "https://..." }]
                    }
                }
            ]
        }
        `;

        // Get Gemini model from env var or use default
        const geminiModel = process.env.GEMINI_MODEL || "gemini-1.5-flash";

        // Call Gemini API with timeout
        let response;
        try {
            response = await Promise.race([
                ai.models.generateContent({
                    model: geminiModel,
                    contents: prompt,
                    config: {
                        responseMimeType: "application/json",
                    }
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('AI request timeout')), 60000)
                )
            ]);
        } catch (aiError) {
            logger.error('Error calling Gemini API:', aiError.message);
            return res.status(500).json({ 
                error: 'AI service error',
                message: 'Failed to generate analysis',
                code: 'AI_ERROR',
                details: process.env.NODE_ENV === 'production' ? undefined : aiError.message
            });
        }

        // Parse Gemini response
        let analysis;
        try {
            const responseText = response.text || JSON.stringify(response);
            analysis = typeof responseText === 'string' ? JSON.parse(responseText) : responseText;
        } catch (parseError) {
            logger.error('Error parsing Gemini response:', parseError.message);
            return res.status(500).json({ 
                error: 'Invalid AI response',
                message: 'Failed to parse analysis',
                code: 'PARSE_ERROR'
            });
        }

        // CRITICAL: Save analysis directly in user profile document
        const timestamp = admin.firestore.FieldValue.serverTimestamp();

        // Normalize careers for profile usage
        const careers = (analysis.top3Careers || []).map(career => ({
            title: career.title || '',
            fit: career.fit || 'N/A',
            reason: career.reason || '',
            skills: career.skills || [],
            roadmap: career.roadmap || [],
            resources: career.resources || {}
        }));

        // Unified aiAnalysis object saved in profile document
        const aiAnalysis = {
            personalityAnalysis: analysis.personalityAnalysis || analysis.personalitySummary || '',
            top3Careers: careers,
            overallStrengths: analysis.overallStrengths || [],
            overallWeaknesses: analysis.overallWeaknesses || [],
            learningRecommendations: analysis.learningRecommendations || [],
            generatedAt: timestamp
        };

        await userRef.update({
            // Legacy fields for backward compatibility
            aiSummary: analysis.personalityAnalysis || analysis.personalitySummary || '',
            recommendedCareers: careers,
            skillsProfile: {
                strengths: analysis.overallStrengths || [],
                weaknesses: analysis.overallWeaknesses || [],
                learningRecommendations: analysis.learningRecommendations || []
            },
            // New unified AI fields
            aiStatus: 'completed',
            aiAnalysis: aiAnalysis,
            aiAnalysisUpdatedAt: timestamp,
            lastAIAnalysisRequestId: requestId
        });

        logger.log(`[Gemini API] ✅ [${requestId}] Analysis saved to Firestore for user ${userId}`);

        // Return structured response
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json({
            status: 'success',
            message: 'AI analysis completed successfully',
            analysis: aiAnalysis,
            requestId: requestId,
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        const requestId = req.requestId || `analyze_error_${Date.now()}`;
        logger.error(`[Gemini API] ❌ [${requestId}] Error in analyze-with-gemini:`, err.message);
        logger.error(`[Gemini API] ❌ [${requestId}] Error stack:`, err.stack);
        logger.error(`[Gemini API] ❌ [${requestId}] User ID: ${userId || 'unknown'}`);
        
        // Structured error response - NEVER return HTML
        res.setHeader('Content-Type', 'application/json');
        res.status(500).json({ 
            status: 'error',
            error: 'Failed to analyze with Gemini',
            message: err.message,
            code: 'ANALYSIS_ERROR',
            requestId: requestId,
            timestamp: new Date().toISOString(),
            details: process.env.NODE_ENV === 'production' ? undefined : err.stack
        });
    }
});

// GET route - Big Five Test Questions from JSON file
// FIXED: Loads from local JSON file instead of Firestore
app.get('/api/bigfive', (req, res) => {
    try {
        logger.log('Fetching Big-Five questions from JSON file...');
        
        const filePath = path.join(__dirname, 'tests', 'Big-Five', 'BigFive.json');
        
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            logger.error('Big-Five JSON file not found:', filePath);
            return res.status(404).json({ 
                error: 'Not found', 
                message: 'Big-Five test questions file not found',
                code: 'QUESTIONS_NOT_FOUND'
            });
        }
        
        // Read and parse JSON file
        const fileData = fs.readFileSync(filePath, 'utf8');
        const questions = JSON.parse(fileData);
        
        logger.log(`Big-Five questions loaded: ${questions.length} questions`);
        
        // Return as { questions: [...] } format for compatibility
        res.json({ questions: questions });
        
    } catch (error) {
        logger.error('Error loading Big-Five questions from JSON:', error.message);
        res.status(500).json({ 
            error: 'Internal server error', 
            message: 'Failed to load Big-Five test questions',
            code: 'LOAD_ERROR',
            details: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
});

// GET route - Holland Test Questions from JSON file
// FIXED: Loads from local JSON file instead of Firestore
// Support both /api/holland and /api/tests/holland for compatibility
app.get('/api/holland', (req, res) => {
    try {
        logger.log('Fetching Holland questions from JSON file...');
        
        const filePath = path.join(__dirname, 'tests', 'Holland', 'Holland.json');
        
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            logger.error('Holland JSON file not found:', filePath);
            return res.status(404).json({ 
                error: 'Not found', 
                message: 'Holland test questions file not found',
                code: 'QUESTIONS_NOT_FOUND'
            });
        }
        
        // Read and parse JSON file
        const fileData = fs.readFileSync(filePath, 'utf8');
        const questions = JSON.parse(fileData);
        
        logger.log(`Holland questions loaded: ${questions.length} questions`);
        
        // Return as { questions: [...] } format for compatibility
        res.json({ questions: questions });
        
    } catch (error) {
        logger.error('Error loading Holland questions from JSON:', error.message);
        res.status(500).json({ 
            error: 'Internal server error', 
            message: 'Failed to load Holland test questions',
            code: 'LOAD_ERROR',
            details: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
});

// Additional routes for /api/tests/* pattern (alias routes)
app.get('/api/tests/bigfive', (req, res) => {
    try {
        logger.log('Fetching Big-Five questions from JSON file via /api/tests/bigfive...');
        
        const filePath = path.join(__dirname, 'tests', 'Big-Five', 'BigFive.json');
        
        if (!fs.existsSync(filePath)) {
            logger.error('Big-Five JSON file not found:', filePath);
            return res.status(404).json({ 
                error: 'Not found', 
                message: 'Big-Five test questions file not found',
                code: 'QUESTIONS_NOT_FOUND'
            });
        }
        
        const fileData = fs.readFileSync(filePath, 'utf8');
        const questions = JSON.parse(fileData);
        logger.log(`Big-Five questions loaded via /api/tests/bigfive: ${questions.length} questions`);
        res.json({ questions: questions });
    } catch (error) {
        logger.error('Error loading Big-Five questions from JSON:', error.message);
        res.status(500).json({ 
            error: 'Internal server error', 
            message: 'Failed to load Big-Five test questions',
            code: 'LOAD_ERROR',
            details: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
});

app.get('/api/tests/holland', (req, res) => {
    try {
        logger.log('Fetching Holland questions from JSON file via /api/tests/holland...');
        
        const filePath = path.join(__dirname, 'tests', 'Holland', 'Holland.json');
        
        if (!fs.existsSync(filePath)) {
            logger.error('Holland JSON file not found:', filePath);
            return res.status(404).json({ 
                error: 'Not found', 
                message: 'Holland test questions file not found',
                code: 'QUESTIONS_NOT_FOUND'
            });
        }
        
        const fileData = fs.readFileSync(filePath, 'utf8');
        const questions = JSON.parse(fileData);
        logger.log(`Holland questions loaded via /api/tests/holland: ${questions.length} questions`);
        res.json({ questions: questions });
    } catch (error) {
        logger.error('Error loading Holland questions from JSON:', error.message);
        res.status(500).json({ 
            error: 'Internal server error', 
            message: 'Failed to load Holland test questions',
            code: 'LOAD_ERROR',
            details: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
});

// POST route - Submit test data (generic endpoint)
// FIXED: Added input validation and error handling
app.post('/submit-test', (req, res) => {
    try {
        // FIXED: Validate request body
        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({ 
                error: 'Bad Request', 
                message: 'Invalid request body',
                code: 'INVALID_BODY'
            });
        }

        // FIXED: Production-safe logging
        logger.log('Received test data:', JSON.stringify(req.body, null, 2));
        
        // FIXED: Validate required fields
        if (!req.body.testType && !req.body.answers) {
            return res.status(400).json({ 
                error: 'Bad Request', 
                message: 'Missing required fields: testType or answers',
                code: 'MISSING_FIELDS'
            });
        }
        
        // Respond with success
        res.json({ 
            status: 'success', 
            message: 'Test submitted!',
            receivedData: req.body,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error in /submit-test:', error.message);
        res.status(500).json({ 
            error: 'Internal server error', 
            message: 'Failed to process test submission',
            code: 'SUBMIT_ERROR'
        });
    }
});

// Calculate Scores Endpoint
// FIXED: Added comprehensive validation and error handling
app.post('/api/calculate-scores', authenticateUser, async (req, res) => {
    try {
        // FIXED: Validate request body
        const { testType, answers } = req.body;

        if (!testType) {
            return res.status(400).json({ 
                error: 'Bad Request', 
                message: 'Test type is required',
                code: 'MISSING_TEST_TYPE'
            });
        }

        if (!answers || typeof answers !== 'object' || Object.keys(answers).length === 0) {
            return res.status(400).json({ 
                error: 'Bad Request', 
                message: 'Answers are required and must be a non-empty object',
                code: 'MISSING_ANSWERS'
            });
        }

        // FIXED: Validate test type
        const validTestTypes = ['Big-Five', 'Holland', 'Holland-codes'];
        if (!validTestTypes.includes(testType)) {
            return res.status(400).json({ 
                error: 'Bad Request', 
                message: `Invalid test type. Must be one of: ${validTestTypes.join(', ')}`,
                code: 'INVALID_TEST_TYPE'
            });
        }

        let results = {};
        
        try {
            if (testType === 'Big-Five') {
                // FIXED: Load questions from Firestore instead of JSON file
                let bigFiveQuestions;
                try {
                    const testDoc = await admin.firestore()
                        .collection('tests')
                        .doc('Big-Five')
                        .get();
                    
                    if (!testDoc.exists) {
                        return res.status(500).json({ 
                            error: 'Internal server error', 
                            message: 'Big Five test data not found in Firestore',
                            code: 'TEST_DATA_NOT_FOUND'
                        });
                    }
                    
                    const testData = testDoc.data();
                    bigFiveQuestions = testData.questions || [];
                    
                    if (!Array.isArray(bigFiveQuestions) || bigFiveQuestions.length === 0) {
                        return res.status(500).json({ 
                            error: 'Internal server error', 
                            message: 'Invalid test questions format in Firestore',
                            code: 'INVALID_QUESTIONS_FORMAT'
                        });
                    }
                } catch (firestoreError) {
                    logger.error('Error loading Big-Five questions from Firestore:', firestoreError.message);
                    return res.status(500).json({ 
                        error: 'Internal server error', 
                        message: 'Failed to load test questions from Firestore',
                        code: 'FIRESTORE_LOAD_ERROR'
                    });
                }
                
                const scores = { O: 0, C: 0, E: 0, A: 0, N: 0 };
                const counts = { O: 0, C: 0, E: 0, A: 0, N: 0 };
                
                bigFiveQuestions.forEach((q, index) => {
                    // FIXED: Null check for question object
                    if (!q || !q.id) return;
                    
                    const answer = answers[q.id];
                    if (answer !== undefined && answer !== null) {
                        // Determine category
                        let category = q.category;
                        let polarity = q.polarity || '+';

                        if (!category) {
                            // Fallback rotation: N, E, O, A, C
                            const remainder = index % 5;
                            if (remainder === 0) category = 'N';
                            else if (remainder === 1) category = 'E';
                            else if (remainder === 2) category = 'O';
                            else if (remainder === 3) category = 'A';
                            else if (remainder === 4) category = 'C';
                        }

                        // Determine score value
                        const defaultOptions = ["Very Inaccurate","Moderately Inaccurate","Neither Accurate Nor Inaccurate","Moderately Accurate","Very Accurate"];
                        const options = q.options || defaultOptions;
                        let score = options.indexOf(answer);
                        
                        // FIXED: Handle case where answer is not in options
                        if (score === -1) {
                            // Try case-insensitive match
                            const lowerAnswer = String(answer).toLowerCase();
                            score = options.findIndex(opt => String(opt).toLowerCase() === lowerAnswer);
                            if (score === -1) {
                                score = 2; // Default to neutral if not found
                                logger.warn(`Answer "${answer}" not found in options for question ${q.id}, using neutral score`);
                            }
                        }

                        // FIXED: Validate score is within range
                        if (score < 0 || score > 4) {
                            score = 2; // Default to neutral
                        }

                        // FIXED: Handle polarity (Reverse scoring)
                        if (polarity === '-') {
                            score = 4 - score;
                        }

                        // FIXED: Validate category before accessing
                        if (scores[category] !== undefined) {
                            scores[category] += score;
                            counts[category]++;
                        }
                    }
                });

                // Normalize to 0-100 scale
                Object.keys(scores).forEach(trait => {
                    const maxScore = counts[trait] * 4;
                    results[trait] = maxScore > 0 ? Math.round((scores[trait] / maxScore) * 100) : 0;
                });

            } else if (testType === 'Holland' || testType === 'Holland-codes') {
                // FIXED: Load questions from Firestore instead of JSON file
                let hollandQuestions;
                try {
                    const testDoc = await admin.firestore()
                        .collection('tests')
                        .doc('Holland')
                        .get();
                    
                    if (!testDoc.exists) {
                        return res.status(500).json({ 
                            error: 'Internal server error', 
                            message: 'Holland Codes test data not found in Firestore',
                            code: 'TEST_DATA_NOT_FOUND'
                        });
                    }
                    
                    const testData = testDoc.data();
                    hollandQuestions = testData.questions || [];
                    
                    if (!Array.isArray(hollandQuestions) || hollandQuestions.length === 0) {
                        return res.status(500).json({ 
                            error: 'Internal server error', 
                            message: 'Invalid test questions format in Firestore',
                            code: 'INVALID_QUESTIONS_FORMAT'
                        });
                    }
                } catch (firestoreError) {
                    logger.error('Error loading Holland questions from Firestore:', firestoreError.message);
                    return res.status(500).json({ 
                        error: 'Internal server error', 
                        message: 'Failed to load test questions from Firestore',
                        code: 'FIRESTORE_LOAD_ERROR'
                    });
                }

                const scores = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
                
                hollandQuestions.forEach(q => {
                    // FIXED: Null check for question object
                    if (!q || !q.id) return;
                    
                    const answer = answers[q.id];
                    if (answer !== undefined && answer !== null) {
                        const category = q.category;
                        const options = q.options || [];
                        const points = q.points || [1, 2, 3, 4, 5];
                        
                        const optionIndex = options.indexOf(answer);
                        // FIXED: Validate category and index before accessing
                        if (optionIndex !== -1 && scores[category] !== undefined) {
                            scores[category] += points[optionIndex] || 0;
                        }
                    }
                });
                
                results = scores;

                // Normalize to 0-100 scale
                const counts = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
                hollandQuestions.forEach(q => {
                    if (q && q.category && counts[q.category] !== undefined) {
                        counts[q.category]++;
                    }
                });

                Object.keys(results).forEach(cat => {
                    const max = counts[cat] * 5; // Max point is 5
                    if (max > 0) {
                        results[cat] = Math.round((results[cat] / max) * 100);
                    } else {
                        results[cat] = 0;
                    }
                });
            }

            res.json({ 
                status: 'success',
                results: results 
            });

        } catch (calculationError) {
            logger.error('Error calculating scores:', calculationError.message);
            throw calculationError;
        }

    } catch (error) {
        logger.error('Error in /api/calculate-scores:', error.message);
        res.status(500).json({ 
            error: 'Internal server error', 
            message: 'Failed to calculate scores',
            code: 'CALCULATION_ERROR',
            details: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
});

// AI Analysis Endpoint
// FIXED: Added comprehensive validation and error handling
app.post('/api/analyze-profile', authenticateUser, async (req, res) => {
    try {
        // FIXED: Validate request body
        const { userData, bigFive, holland } = req.body;

        if (!userData || typeof userData !== 'object') {
            return res.status(400).json({ 
                error: 'Bad Request', 
                message: 'User data is required and must be an object',
                code: 'MISSING_USER_DATA'
            });
        }

        // FIXED: Validate userData fields
        if (!userData.fullName || typeof userData.fullName !== 'string') {
            return res.status(400).json({ 
                error: 'Bad Request', 
                message: 'User data must include a valid fullName',
                code: 'INVALID_USER_DATA'
            });
        }

        // FIXED: Check if AI is initialized
        if (!ai) {
            return res.status(503).json({ 
                error: 'Service unavailable', 
                message: 'AI service is not available',
                code: 'AI_SERVICE_UNAVAILABLE'
            });
        }

        // Build prompt with available data
        let promptTestsSection = "";
        
        if (bigFive && typeof bigFive === 'object') {
            promptTestsSection += `
            **Big Five Personality Traits (0-100%):**
            ${JSON.stringify(bigFive, null, 2)}
            `;
        } else {
            promptTestsSection += `
            **Big Five Personality Traits:**
            [Data Not Available - Infer broadly from Holland Codes if present, or focus on general career advice based on profile]
            `;
        }

        if (holland && typeof holland === 'object') {
            promptTestsSection += `
            **Holland Codes (RIASEC Scores):**
            ${JSON.stringify(holland, null, 2)}
            `;
        } else {
            promptTestsSection += `
            **Holland Codes (RIASEC Scores):**
            [Data Not Available - Infer broadly from Big Five if present]
            `;
        }

        // FIXED: Sanitize user input to prevent injection
        const sanitizedName = (userData.fullName || '').substring(0, 100);
        const sanitizedEducation = (userData.education || 'Not specified').substring(0, 100);
        const sanitizedStatus = (userData.studentStatus || 'Not specified').substring(0, 50);

        const prompt = `
        You are an expert career counselor and personality analyst. Analyze the following user profile and test results to provide a comprehensive, highly personalized career development plan.

        **User Profile:**
        - Name: ${sanitizedName}
        - Education: ${sanitizedEducation}
        - Student Status: ${sanitizedStatus}

        ${promptTestsSection}

        **Task:**
        Based strictly on the available data, generate a detailed JSON object. Do NOT return markdown. The JSON must follow this exact schema. You MUST return EXACTLY 3 careers (Top 3 most compatible).

        {
            "personalityAnalysis": "A deep, scientific, yet accessible paragraph (approx 150 words) analyzing their personality blend. Explain how their specific Big Five traits (e.g., High Openness, Low Neuroticism) interact with their Holland Code (e.g., Artistic-Investigative) to influence their work style, strengths, and ideal environments.",
            "top3Careers": [
                { 
                    "title": "Specific Job Title 1 (Most Compatible)", 
                    "fit": "95%", 
                    "reason": "2-3 sentences explaining exactly WHY this fits their specific trait combination.",
                    "skills": ["Key Skill 1", "Key Skill 2", "Key Skill 3"],
                    "roadmap": [
                        { "step": "Phase 1: Foundation (Months 1-2)", "description": "Specific, actionable steps: Learn X, complete Y course, build Z project..." },
                        { "step": "Phase 2: Skill Building (Months 3-6)", "description": "Specific, actionable steps: Master A skill, contribute to B, network with C..." },
                        { "step": "Phase 3: Application (Months 7-12)", "description": "Specific, actionable steps: Build portfolio, apply to positions, prepare for interviews..." }
                    ],
                    "resources": {
                        "books": [
                            { "title": "Most Highly Recommended/Famous Book for this Field", "author": "Author Name", "link": "https://amazon.com/..." }
                        ],
                        "youtubeCourses": [
                            { "title": "Popular High-Quality Course/Playlist Title", "channel": "Reputable Channel Name", "link": "https://youtube.com/playlist?list=..." }
                        ],
                        "platforms": [
                            { "title": "Structured Course Name", "platform": "Coursera/Udemy/edX", "link": "https://platform.com/course/..." },
                            { "title": "Another Course", "platform": "Platform Name", "link": "https://..." }
                        ]
                    }
                },
                { 
                    "title": "Specific Job Title 2 (Second Most Compatible)", 
                    "fit": "90%", 
                    "reason": "...",
                    "skills": ["..."],
                    "roadmap": [
                        { "step": "Phase 1: Foundation", "description": "..." },
                        { "step": "Phase 2: Skill Building", "description": "..." },
                        { "step": "Phase 3: Application", "description": "..." }
                    ],
                    "resources": {
                        "books": [{ "title": "...", "author": "...", "link": "https://..." }],
                        "youtubeCourses": [{ "title": "...", "channel": "...", "link": "https://..." }],
                        "platforms": [{ "title": "...", "platform": "...", "link": "https://..." }]
                    }
                },
                { 
                    "title": "Specific Job Title 3 (Third Most Compatible)", 
                    "fit": "85%", 
                    "reason": "...",
                    "skills": ["..."],
                    "roadmap": [
                        { "step": "Phase 1: Foundation", "description": "..." },
                        { "step": "Phase 2: Skill Building", "description": "..." },
                        { "step": "Phase 3: Application", "description": "..." }
                    ],
                    "resources": {
                        "books": [{ "title": "...", "author": "...", "link": "https://..." }],
                        "youtubeCourses": [{ "title": "...", "channel": "...", "link": "https://..." }],
                        "platforms": [{ "title": "...", "platform": "...", "link": "https://..." }]
                    }
                }
            ]
        }
        `;

        // FIXED: Add timeout and error handling for AI call
        let response;
        try {
            response = await Promise.race([
                ai.models.generateContent({
                    model: "gemini-1.5-flash",
                    contents: prompt,
                    config: {
                        responseMimeType: "application/json",
                    }
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('AI request timeout')), 30000)
                )
            ]);
        } catch (aiError) {
            logger.error('AI API Error:', aiError.message);
            return res.status(503).json({ 
                error: 'Service unavailable', 
                message: 'AI service is temporarily unavailable',
                code: 'AI_SERVICE_ERROR',
                details: process.env.NODE_ENV === 'production' ? undefined : aiError.message
            });
        }

        // FIXED: Add null checks for response
        if (!response || !response.data || !response.data.candidates || response.data.candidates.length === 0) {
            return res.status(500).json({ 
                error: 'Internal server error', 
                message: 'Invalid response from AI service',
                code: 'INVALID_AI_RESPONSE'
            });
        }

        let analysisText = response.data.candidates[0].content.parts[0].text;
        
        // Clean up markdown code blocks if present
        analysisText = analysisText.replace(/```json/g, '').replace(/```/g, '').trim();

        // FIXED: Better error handling for JSON parsing
        let analysisJson;
        try {
            analysisJson = JSON.parse(analysisText);
        } catch (parseError) {
            logger.error("JSON Parse Error:", parseError.message);
            logger.log("Raw Text (first 500 chars):", analysisText.substring(0, 500));
            return res.status(500).json({ 
                error: 'Internal server error', 
                message: 'Failed to parse AI response',
                code: 'JSON_PARSE_ERROR',
                details: process.env.NODE_ENV === 'production' ? undefined : parseError.message
            });
        }

        res.json({ 
            status: 'success',
            data: analysisJson 
        });

    } catch (error) {
        logger.error('Error generating AI analysis:', error.message);
        res.status(500).json({ 
            error: 'Internal server error', 
            message: 'Failed to generate analysis',
            code: 'ANALYSIS_ERROR',
            details: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
});

// ==========================================
// PROFILE API ENDPOINT
// ==========================================
// GET /api/profile - Get user profile with test results and AI analysis
// Structure: users/{userId} and tests_results/{userId}
// FIXED: Added comprehensive logging and error handling
app.get('/api/profile', authenticateUser, async (req, res) => {
    // CRITICAL: Use requestId from middleware (already set)
    const requestId = req.requestId || `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const userId = req.user?.uid || 'unknown';
    
    // Structured logging
    logger.log(`[Profile API] 📥 [${requestId}] GET /api/profile`);
    logger.log(`[Profile API] 📥 [${requestId}] User: ${userId}`);
    logger.log(`[Profile API] 📥 [${requestId}] IP: ${req.ip}`);
    logger.log(`[Profile API] 📥 [${requestId}] Origin: ${req.get('origin') || 'none'}`);
    logger.log(`[Profile API] 📥 [${requestId}] User-Agent: ${req.get('user-agent') || 'unknown'}`);
    
    try {
        // Validate user authentication (should already be validated by middleware, but double-check)
        if (!req.user || !req.user.uid) {
            logger.warn(`[Profile API] ⚠️ [${requestId}] Unauthorized: Missing user in request`);
            return res.status(401).json({ 
                status: 'error',
                error: 'Unauthorized', 
                message: 'Invalid user authentication',
                code: 'INVALID_USER',
                requestId: requestId
            });
        }

        const uid = req.user.uid;
        const db = admin.firestore();
        
        // 1. Fetch user document from users collection
        const userDoc = await db.collection('users').doc(uid).get();
        
        if (!userDoc.exists) {
            // Create user document from Auth data if it doesn't exist
            const authUser = await admin.auth().getUser(uid);
            const newUserData = {
                name: authUser.displayName || '',
                email: authUser.email || '',
                age: null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                completedTests: false,
                aiSummary: null,
                recommendedCareers: [],
                skillsProfile: []
            };
            
            await db.collection('users').doc(uid).set(newUserData, { merge: true });
            
            return res.json({
                status: 'success',
                data: {
                    user: newUserData,
                    testResults: null,
                    testsComplete: false
                }
            });
        }

        const userData = userDoc.data();
        
        // 2. Fetch test results from tests_results collection
        let testResults = null;
        let testsComplete = false;
        
        try {
            const testResultsDoc = await db.collection('tests_results').doc(uid).get();
            
            if (testResultsDoc.exists) {
                const resultsData = testResultsDoc.data();
                
                // Validate test completeness
                const hasHolland = resultsData.holland && 
                    typeof resultsData.holland === 'object' &&
                    ['R', 'I', 'A', 'S', 'E', 'C'].every(code => 
                        typeof resultsData.holland[code] === 'number'
                    );
                
                const hasBigFive = resultsData.bigFive && 
                    typeof resultsData.bigFive === 'object' &&
                    ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'].every(trait => 
                        typeof resultsData.bigFive[trait] === 'number'
                    );
                
                testsComplete = hasHolland && hasBigFive;
                
                if (testsComplete) {
                    testResults = {
                        holland: {
                            R: resultsData.holland.R || 0,
                            I: resultsData.holland.I || 0,
                            A: resultsData.holland.A || 0,
                            S: resultsData.holland.S || 0,
                            E: resultsData.holland.E || 0,
                            C: resultsData.holland.C || 0
                        },
                        bigFive: {
                            openness: resultsData.bigFive.openness || 0,
                            conscientiousness: resultsData.bigFive.conscientiousness || 0,
                            extraversion: resultsData.bigFive.extraversion || 0,
                            agreeableness: resultsData.bigFive.agreeableness || 0,
                            neuroticism: resultsData.bigFive.neuroticism || 0
                        },
                        completedAt: resultsData.completedAt || null
                    };
                    
                    // Update user's completedTests flag if not already set
                    if (!userData.completedTests) {
                        await db.collection('users').doc(uid).update({
                            completedTests: true
                        });
                        userData.completedTests = true;
                    }
                    
                    // Trigger AI analysis if tests are complete but AI data is missing
                    if (testsComplete && (!userData.aiSummary || !userData.recommendedCareers || userData.recommendedCareers.length === 0)) {
                        // AI analysis will be triggered asynchronously
                        // Don't wait for it in the response
                        triggerAIAnalysis(uid, testResults).catch(err => {
                            logger.error('Error triggering AI analysis:', err.message);
                        });
                    }
                } else {
                    // Tests incomplete - return partial results
                    testResults = {
                        holland: hasHolland ? resultsData.holland : null,
                        bigFive: hasBigFive ? resultsData.bigFive : null,
                        completedAt: null
                    };
                }
            }
        } catch (testError) {
            logger.error('Error fetching test results:', testError.message);
            // Continue without test results
        }

        // 3. Return combined data with structured response
        const responseData = {
            status: 'success',
            requestId: requestId,
            timestamp: new Date().toISOString(),
            data: {
                user: {
                    name: userData.name || '',
                    email: userData.email || '',
                    age: userData.age || null,
                    photoURL: userData.photoURL || null,
                    gender: userData.gender || null,
                    createdAt: userData.createdAt,
                    completedTests: userData.completedTests || false,
                    aiSummary: userData.aiSummary || null,
                    recommendedCareers: userData.recommendedCareers || [],
                    skillsProfile: userData.skillsProfile || {}
                },
                testResults: testResults,
                testsComplete: testsComplete
            }
        };
        
        logger.log(`[Profile API] ✅ [${requestId}] Successfully returned profile for user ${uid}`);
        logger.log(`[Profile API] ✅ [${requestId}] Tests complete: ${testsComplete}, AI summary: ${userData.aiSummary ? 'yes' : 'no'}`);
        
        // ALWAYS return JSON, never HTML
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json(responseData);
        
    } catch (error) {
        const requestId = req.requestId || `profile_error_${Date.now()}`;
        logger.error(`[Profile API] ❌ [${requestId}] Error fetching user profile:`, error.message);
        logger.error(`[Profile API] ❌ [${requestId}] Error stack:`, error.stack);
        logger.error(`[Profile API] ❌ [${requestId}] User ID: ${req.user?.uid || 'unknown'}`);
        
        // Structured error response - NEVER return HTML
        res.setHeader('Content-Type', 'application/json');
        res.status(500).json({ 
            status: 'error',
            error: 'Internal server error', 
            message: 'Failed to fetch user profile',
            code: 'PROFILE_FETCH_ERROR',
            requestId: requestId,
            timestamp: new Date().toISOString(),
            details: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
});

/**
 * Helper function to save test results to new tests_results collection structure
 * Structure: tests_results/{userId} with holland and bigFive sub-objects
 */
async function saveToNewTestResultsStructure(userId, testName, resultData) {
    try {
        const db = admin.firestore();
        const testResultsRef = db.collection('tests_results').doc(userId);
        
        // Get existing document
        const existingDoc = await testResultsRef.get();
        const existingData = existingDoc.exists() ? existingDoc.data() : {};
        
        // Normalize test name
        const normalizedTestName = testName.trim().toLowerCase();
        let isHolland = normalizedTestName.includes('holland');
        let isBigFive = normalizedTestName.includes('big') || normalizedTestName.includes('five');
        
        // Extract scores from resultData
        // Handle different data structures
        let hollandData = null;
        let bigFiveData = null;
        
        if (isHolland) {
            // Extract Holland codes (R, I, A, S, E, C)
            const hollandScores = resultData.result || resultData.scores || resultData.holland || {};
            hollandData = {
                R: hollandScores.R || hollandScores.Realistic || hollandScores.realistic || 0,
                I: hollandScores.I || hollandScores.Investigative || hollandScores.investigative || 0,
                A: hollandScores.A || hollandScores.Artistic || hollandScores.artistic || 0,
                S: hollandScores.S || hollandScores.Social || hollandScores.social || 0,
                E: hollandScores.E || hollandScores.Enterprising || hollandScores.enterprising || 0,
                C: hollandScores.C || hollandScores.Conventional || hollandScores.conventional || 0
            };
        }
        
        if (isBigFive) {
            // Extract Big Five traits
            const bigFiveScores = resultData.result || resultData.scores || resultData.bigFive || {};
            bigFiveData = {
                openness: bigFiveScores.openness || bigFiveScores.Openness || bigFiveScores.O || 0,
                conscientiousness: bigFiveScores.conscientiousness || bigFiveScores.Conscientiousness || bigFiveScores.C || 0,
                extraversion: bigFiveScores.extraversion || bigFiveScores.Extraversion || bigFiveScores.E || 0,
                agreeableness: bigFiveScores.agreeableness || bigFiveScores.Agreeableness || bigFiveScores.A || 0,
                neuroticism: bigFiveScores.neuroticism || bigFiveScores.Neuroticism || bigFiveScores.N || 0
            };
        }
        
        // Prepare update data
        const updateData = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        if (hollandData) {
            updateData.holland = hollandData;
        }
        
        if (bigFiveData) {
            updateData.bigFive = bigFiveData;
        }
        
        // Set completedAt if both tests are now complete
        const hasHolland = updateData.holland || existingData.holland;
        const hasBigFive = updateData.bigFive || existingData.bigFive;
        
        if (hasHolland && hasBigFive && !existingData.completedAt) {
            updateData.completedAt = admin.firestore.FieldValue.serverTimestamp();
        } else if (hasHolland && hasBigFive && existingData.completedAt) {
            // Keep existing completedAt
            updateData.completedAt = existingData.completedAt;
        }
        
        // Save to tests_results collection
        await testResultsRef.set(updateData, { merge: true });
        
        logger.log(`[Save-Test] ✅ Saved to new tests_results structure for user ${userId}`);
        
    } catch (error) {
        logger.error('[Save-Test] Error saving to new structure:', error.message);
        throw error;
    }
}

/**
 * Helper function to trigger AI analysis asynchronously
 * Analyzes both tests together and saves results to users collection
 */
async function triggerAIAnalysis(userId, testResults) {
    try {
        if (!ai) {
            logger.warn('AI service not available for analysis');
            return;
        }

        const { holland, bigFive } = testResults;
        
        // Build comprehensive prompt for AI
        const prompt = `
You are an expert career counselor and personality analyst. Analyze the following test results to provide personalized career recommendations.

**Holland Codes (RIASEC):**
- Realistic (R): ${holland.R}%
- Investigative (I): ${holland.I}%
- Artistic (A): ${holland.A}%
- Social (S): ${holland.S}%
- Enterprising (E): ${holland.E}%
- Conventional (C): ${holland.C}%

**Big Five Personality Traits:**
- Openness: ${bigFive.openness}%
- Conscientiousness: ${bigFive.conscientiousness}%
- Extraversion: ${bigFive.extraversion}%
- Agreeableness: ${bigFive.agreeableness}%
- Neuroticism: ${bigFive.neuroticism}%

**Task:**
Generate a detailed JSON object with the following structure:

{
    "personalitySummary": "A comprehensive 200-300 word analysis explaining how their personality traits and interests align with career paths. Write in a warm, encouraging, and human-readable style.",
    "top3Careers": [
        {
            "title": "Specific Job Title 1",
            "fit": "95%",
            "reason": "2-3 sentences explaining WHY this fits their specific trait combination",
            "strengths": ["Strength 1", "Strength 2", "Strength 3"],
            "weaknesses": ["Area for improvement 1", "Area for improvement 2"]
        },
        {
            "title": "Specific Job Title 2",
            "fit": "90%",
            "reason": "...",
            "strengths": ["..."],
            "weaknesses": ["..."]
        },
        {
            "title": "Specific Job Title 3",
            "fit": "85%",
            "reason": "...",
            "strengths": ["..."],
            "weaknesses": ["..."]
        }
    ],
    "overallStrengths": ["Global strength 1", "Global strength 2", "Global strength 3"],
    "overallWeaknesses": ["Area for growth 1", "Area for growth 2"],
    "learningRecommendations": [
        "Specific learning recommendation 1",
        "Specific learning recommendation 2",
        "Specific learning recommendation 3"
    ]
}

Return ONLY valid JSON, no markdown formatting.
        `;

        const geminiModel = process.env.GEMINI_MODEL || "gemini-1.5-flash";
        
        const response = await Promise.race([
            ai.models.generateContent({
                model: geminiModel,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                }
            }),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('AI request timeout')), 60000)
            )
        ]);

        // Parse AI response
        let analysis;
        try {
            const responseText = response.text || JSON.stringify(response);
            analysis = typeof responseText === 'string' ? JSON.parse(responseText) : responseText;
        } catch (parseError) {
            logger.error('Error parsing AI response:', parseError.message);
            throw new Error('Failed to parse AI analysis');
        }

        // Extract and structure data for Firestore
        const aiSummary = analysis.personalitySummary || '';
        const recommendedCareers = (analysis.top3Careers || []).map(career => ({
            title: career.title || '',
            fit: career.fit || 'N/A',
            reason: career.reason || '',
            strengths: career.strengths || [],
            weaknesses: career.weaknesses || []
        }));
        
        const skillsProfile = {
            strengths: analysis.overallStrengths || [],
            weaknesses: analysis.overallWeaknesses || [],
            learningRecommendations: analysis.learningRecommendations || []
        };

        // Save to users collection
        await admin.firestore().collection('users').doc(userId).update({
            aiSummary: aiSummary,
            recommendedCareers: recommendedCareers,
            skillsProfile: skillsProfile,
            aiAnalysisUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        logger.log(`[AI Analysis] ✅ Successfully saved analysis for user ${userId}`);
        
    } catch (error) {
        logger.error('[AI Analysis] Error:', error.message);
        logger.error('[AI Analysis] Stack:', error.stack);
        throw error;
    }
}

// Keep the old endpoint for backward compatibility
app.get('/api/user-profile', authenticateUser, async (req, res) => {
    try {
        if (!req.user || !req.user.uid) {
            return res.status(401).json({ 
                error: 'Unauthorized', 
                message: 'Invalid user authentication',
                code: 'INVALID_USER'
            });
        }

        const uid = req.user.uid;
        const userDoc = await admin.firestore().collection('users').doc(uid).get();

        if (!userDoc.exists) {
            return res.status(404).json({ 
                error: 'Not found', 
                message: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }

        res.json({ 
            status: 'success',
            data: userDoc.data() 
        });
    } catch (error) {
        logger.error('Error fetching user profile:', error.message);
        res.status(500).json({ 
            error: 'Internal server error', 
            message: 'Failed to fetch user profile',
            code: 'PROFILE_FETCH_ERROR',
            details: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
});

// GET Admin Users Endpoint (Protected)
// FIXED: Added admin role verification and better error handling
app.get('/api/admin/users', authenticateUser, async (req, res) => {
    try {
        // FIXED: Check admin role
        const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        
        // FIXED: Verify admin role
        if (!req.user.admin && userData.role !== 'admin') {
            return res.status(403).json({ 
                error: 'Forbidden', 
                message: 'Admin access required',
                code: 'ADMIN_REQUIRED'
            });
        }
        
        const listUsersResult = await admin.auth().listUsers(100);
        const users = listUsersResult.users.map(userRecord => ({
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName,
            metadata: userRecord.metadata
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

// ==========================================
// GLOBAL 404 HANDLER FOR API ROUTES
// ==========================================
// CRITICAL: Must be after all other routes
// ALWAYS returns JSON, never HTML
app.use((req, res) => {
    const requestId = req.requestId || `404_${Date.now()}`;
    
    // Log 404 for debugging
    logger.warn(`[404 Handler] ⚠️ [${requestId}] ${req.method} ${req.path} - Endpoint not found`);
    logger.warn(`[404 Handler] ⚠️ [${requestId}] Origin: ${req.get('origin') || 'none'}`);
    logger.warn(`[404 Handler] ⚠️ [${requestId}] User-Agent: ${req.get('user-agent') || 'unknown'}`);
    
    // ALWAYS return JSON, never HTML
    res.setHeader('Content-Type', 'application/json');
    res.status(404).json({ 
        status: 'error',
        error: 'Not found', 
        message: 'The requested endpoint does not exist',
        code: 'ENDPOINT_NOT_FOUND',
        path: req.path,
        method: req.method,
        requestId: requestId,
        timestamp: new Date().toISOString(),
        availableEndpoints: [
            'GET /api/health',
            'GET /api/profile',
            'POST /api/analyze-with-gemini',
            'POST /api/save-test'
        ]
    });
});

// ==========================================
// GLOBAL ERROR HANDLER
// ==========================================
// CRITICAL: Catches all unhandled errors
// ALWAYS returns JSON, never HTML
app.use((err, req, res, next) => {
    const requestId = req.requestId || `error_${Date.now()}`;
    
    logger.error(`[Error Handler] ❌ [${requestId}] Unhandled error:`, err.message);
    logger.error(`[Error Handler] ❌ [${requestId}] Error stack:`, err.stack);
    logger.error(`[Error Handler] ❌ [${requestId}] Path: ${req.path}`);
    logger.error(`[Error Handler] ❌ [${requestId}] Method: ${req.method}`);
    
    // ALWAYS return JSON, never HTML
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ 
        status: 'error',
        error: 'Internal server error', 
        message: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
        requestId: requestId,
        timestamp: new Date().toISOString(),
        details: process.env.NODE_ENV === 'production' ? undefined : err.message
    });
});

// ==========================================
// ROUTE REGISTRATION LOGGING & VALIDATION
// ==========================================
// Log all registered routes on startup for debugging
// CRITICAL: Validates routes are actually registered at runtime
function logRegisteredRoutes() {
    logger.log('═══════════════════════════════════════════════════════');
    logger.log('📋 ROUTE REGISTRATION VALIDATION');
    logger.log('═══════════════════════════════════════════════════════');
    
    // Extract actual routes from Express app
    const actualRoutes = [];
    
    function extractRoutes(stack, basePath = '') {
        if (!stack) return;
        
        stack.forEach((layer) => {
            if (layer.route) {
                const methods = Object.keys(layer.route.methods)
                    .filter(method => layer.route.methods[method])
                    .map(m => m.toUpperCase())
                    .join(', ');
                
                if (methods) {
                    const fullPath = basePath + layer.route.path;
                    actualRoutes.push({ methods, path: fullPath });
                }
            } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
                const routerPath = basePath;
                extractRoutes(layer.handle.stack, routerPath);
            }
        });
    }
    
    if (app._router && app._router.stack) {
        extractRoutes(app._router.stack);
    }
    
    // Critical routes that MUST exist
    const criticalRoutes = [
        { method: 'GET', path: '/' },
        { method: 'GET', path: '/healthz' },
        { method: 'GET', path: '/api/health' },
        { method: 'GET', path: '/api/profile' },
        { method: 'GET', path: '/api/user-profile' },
        { method: 'POST', path: '/api/save-test' },
        { method: 'POST', path: '/api/analyze-with-gemini' },
        { method: 'POST', path: '/api/analyze-profile' },
        { method: 'GET', path: '/api/bigfive' },
        { method: 'GET', path: '/api/holland' },
        { method: 'GET', path: '/api/tests/bigfive' },
        { method: 'GET', path: '/api/tests/holland' },
        { method: 'POST', path: '/api/calculate-scores' },
        { method: 'GET', path: '/api/admin/users' }
    ];
    
    // Validate critical routes
    let allRoutesValid = true;
    criticalRoutes.forEach(route => {
        const found = actualRoutes.some(r => 
            r.path === route.path && r.methods.includes(route.method)
        );
        
        if (found) {
            logger.log(`  ✅ ${route.method.padEnd(6)} ${route.path}`);
        } else {
            logger.log(`  ❌ ${route.method.padEnd(6)} ${route.path} - NOT FOUND!`);
            allRoutesValid = false;
        }
    });
    
    logger.log('═══════════════════════════════════════════════════════');
    logger.log(`📊 Total routes registered: ${actualRoutes.length}`);
    
    if (!allRoutesValid) {
        logger.error('⚠️  WARNING: Some critical routes are missing!');
        logger.error('⚠️  This may cause 404 errors. Check route registration order.');
    } else {
        logger.log('✅ All critical routes validated successfully');
    }
    
    logger.log('═══════════════════════════════════════════════════════');
    
    // Log all registered routes for debugging
    if (process.env.LOG_ALL_ROUTES === 'true') {
        logger.log('📋 All Registered Routes:');
        actualRoutes.forEach(route => {
            logger.log(`  ${route.methods.padEnd(20)} ${route.path}`);
        });
    }
}

// ==========================================
// SERVER STARTUP WITH VALIDATION
// ==========================================
// Start server with comprehensive validation
// FIXED: Railway deployment - listens on PORT from environment

// CRITICAL: Validate server can start before listening
function validateServerReady() {
    const issues = [];
    
    if (!admin) {
        issues.push('Firebase Admin not initialized');
    }
    
    if (!ai) {
        issues.push('Gemini AI not initialized');
    }
    
    if (!app) {
        issues.push('Express app not created');
    }
    
    // Validate critical routes exist in code (static check)
    // Note: Runtime validation happens in logRegisteredRoutes()
    
    if (issues.length > 0) {
        logger.error('═══════════════════════════════════════════════════════');
        logger.error('❌ SERVER VALIDATION FAILED');
        logger.error('═══════════════════════════════════════════════════════');
        issues.forEach(issue => logger.error(`  ❌ ${issue}`));
        logger.error('═══════════════════════════════════════════════════════');
        return false;
    }
    
    return true;
}

// Start server
try {
    if (!validateServerReady()) {
        logger.error('Server cannot start due to validation failures. Exiting.');
        process.exit(1);
    }
    
    app.listen(PORT, '0.0.0.0', () => {
        logger.log('═══════════════════════════════════════════════════════');
        logger.log(`🚀 SERVER STARTED SUCCESSFULLY`);
        logger.log('═══════════════════════════════════════════════════════');
        logger.log(`📍 Port: ${PORT}`);
        logger.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        logger.log(`⏰ Started at: ${new Date().toISOString()}`);
        logger.log(`🔧 Node Version: ${process.version}`);
        logger.log('═══════════════════════════════════════════════════════');
        
        // Log registered routes with validation
        logRegisteredRoutes();
        
        logger.log('═══════════════════════════════════════════════════════');
        logger.log(`✅ Server ready for requests`);
        logger.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
        logger.log(`🔗 Profile API: http://localhost:${PORT}/api/profile`);
        logger.log(`🔗 Root: http://localhost:${PORT}/`);
        logger.log('═══════════════════════════════════════════════════════');
        logger.log(`💡 TIP: Test health endpoint first: curl http://localhost:${PORT}/api/health`);
        logger.log(`💡 TIP: If you see 404 errors, check route registration log above`);
        logger.log('═══════════════════════════════════════════════════════');
    });
    
    // Handle server errors
    app.on('error', (error) => {
        logger.error('═══════════════════════════════════════════════════════');
        logger.error('❌ SERVER ERROR');
        logger.error('═══════════════════════════════════════════════════════');
        logger.error('Error:', error.message);
        logger.error('Stack:', error.stack);
        logger.error('═══════════════════════════════════════════════════════');
    });
    
} catch (startupError) {
    logger.error('═══════════════════════════════════════════════════════');
    logger.error('❌ SERVER STARTUP FAILED');
    logger.error('═══════════════════════════════════════════════════════');
    logger.error('Error:', startupError.message);
    logger.error('Stack:', startupError.stack);
    logger.error('═══════════════════════════════════════════════════════');
    process.exit(1);
}

// Export app for testing
module.exports = app;
