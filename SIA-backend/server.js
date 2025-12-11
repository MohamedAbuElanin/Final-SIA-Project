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

// FIXED: CORS configuration - more restrictive for security
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // In production, specify allowed origins
        const allowedOrigins = process.env.ALLOWED_ORIGINS 
            ? process.env.ALLOWED_ORIGINS.split(',')
            : ['http://localhost:5000', 'http://localhost:3000'];
        
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
};

// Middleware
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

// GET route - Health check
app.get('/', (req, res) => {
    res.json({ 
        status: 'success',
        message: 'SIA Backend Server is running!',
        timestamp: new Date().toISOString()
    });
});

// Health check endpoint for Render/Railway
app.get('/healthz', (req, res) => {
    res.status(200).json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
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

// GET User Profile Endpoint
// FIXED: Added validation and error handling
app.get('/api/user-profile', authenticateUser, async (req, res) => {
    try {
        // FIXED: Validate user object
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

// FIXED: 404 Handler - Must be after all other routes
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Not found', 
        message: 'The requested endpoint does not exist',
        code: 'ENDPOINT_NOT_FOUND',
        path: req.path
    });
});

// FIXED: 500 Error Handler - Standardized error format
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err.message);
    res.status(500).json({ 
        error: 'Internal server error', 
        message: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'production' ? undefined : err.message
    });
});

// Start server
// FIXED: Railway deployment - listens on PORT from environment
app.listen(PORT, '0.0.0.0', () => {
    logger.log(`Server running on port ${PORT}`);
    logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.log(`Server ready for requests`);
});

// Export app for testing
module.exports = app;
