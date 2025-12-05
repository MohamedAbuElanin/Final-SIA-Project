// ملف السيرفر الرئيسي.
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { GoogleGenAI } = require("@google/genai");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Gemini AI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const admin = require('./firebase-admin');

// Middleware to verify Firebase ID Token
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

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Test route
app.get('/', (req, res) => {
    res.send('SIA Back-End is running!');
});




// Calculate Scores Endpoint
app.post('/api/calculate-scores', authenticateUser, (req, res) => {
    try {
        const { testType, answers } = req.body;

        if (!answers) {
            return res.status(400).json({ error: 'Answers are required' });
        }

        let results = {};
        if (testType === 'Big-Five') {
            // Big Five Scoring
            const bigFiveQuestions = require('../public/Test/Big-Five.json');
            
            const scores = { O: 0, C: 0, E: 0, A: 0, N: 0 };
            const counts = { O: 0, C: 0, E: 0, A: 0, N: 0 };

            // IPIP-120 Rotation (approximate if not in JSON): 
            // Usually it's N, E, O, A, C repeating.
            // Let's rely on the JSON having "category" if map_questions.js ran. 
            // If not, we fall back to rotation: 1=N, 2=E, 3=O, 4=A, 5=C...
            
            bigFiveQuestions.forEach((q, index) => {
                const answer = answers[q.id];
                if (answer !== undefined) {
                    // Determine category
                    let category = q.category;
                    let polarity = q.polarity || '+';

                    if (!category) {
                        // Fallback rotation: N, E, O, A, C
                        const remainder = (index) % 5;
                        if (remainder === 0) category = 'N';
                        else if (remainder === 1) category = 'E';
                        else if (remainder === 2) category = 'O';
                        else if (remainder === 3) category = 'A';
                        else if (remainder === 4) category = 'C';
                    }

                    // Determine score value (0-4 or 1-5)
                    // The client sends the option text usually? Or the index?
                    // Test.js sends the option TEXT. We need to map text to value.
                    // Options: ["Very Inaccurate", ..., "Very Accurate"] -> 0 to 4
                    const options = q.options || ["Very Inaccurate","Moderately Inaccurate","Neither Accurate Nor Inaccurate","Moderately Accurate","Very Accurate"];
                    let score = options.indexOf(answer);
                    
                    if (score === -1) score = 2; // Default to neutral if not found

                    // Handle polarity (Reverse scoring)
                    // If JSON doesn't have polarity, we might be inaccurate. 
                    // But let's assume standard positive for now if missing.
                    if (polarity === '-') {
                        score = 4 - score;
                    }

                    if (scores[category] !== undefined) {
                        scores[category] += score;
                        counts[category]++;
                    }
                }
            });

            // Normalize to 0-100 scale? Or just raw totals.
            // Let's return percentages relative to max possible.
            Object.keys(scores).forEach(trait => {
                const maxScore = counts[trait] * 4;
                results[trait] = maxScore > 0 ? Math.round((scores[trait] / maxScore) * 100) : 0;
            });

        } else if (testType === 'Holland' || testType === 'Holland-codes') {
            // Scoring for Holland Codes
            const hollandQuestions = require('../public/Test/Holland-codes.json');
            const scores = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
            
            hollandQuestions.forEach(q => {
                const answer = answers[q.id];
                if (answer !== undefined) {
                    const category = q.category; // Holland JSON has category
                    const options = q.options;
                    const points = q.points || [1, 2, 3, 4, 5];
                    
                    const optionIndex = options.indexOf(answer);
                    if (optionIndex !== -1 && scores[category] !== undefined) {
                        scores[category] += points[optionIndex];
                    }
                }
            });
            
            results = scores;

            // Normalize to 0-100 scale
            // Simple normalization: (Score / MaxPossible * 100)
            const counts = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
            hollandQuestions.forEach(q => {
                if (counts[q.category] !== undefined) counts[q.category]++;
            });

            Object.keys(results).forEach(cat => {
                const max = counts[cat] * 5; // Max point is 5
                if (max > 0) {
                    results[cat] = Math.round((results[cat] / max) * 100);
                } else {
                    results[cat] = 0;
                }
            });
        } // Close else if

        res.json(results);

    } catch (error) {
        console.error('Error calculating scores:', error);
        res.status(500).json({ error: 'Failed to calculate scores' });
    }
});

// AI Analysis Endpoint
app.post('/api/analyze-profile', authenticateUser, async (req, res) => {
    try {
        const { userData, bigFive, holland } = req.body;

        if (!userData) {
            return res.status(400).json({ error: 'User data is required' });
        }

        // --- PARTIAL ANALYSIS FALLBACK ---
        let promptTestsSection = "";
        
        if (bigFive) {
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

        if (holland) {
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

        const prompt = `
        You are an expert career counselor and personality analyst. Analyze the following user profile and test results to provide a comprehensive, highly personalized career development plan.

        **User Profile:**
        - Name: ${userData.fullName}
        - Education: ${userData.education}
        - Student Status: ${userData.studentStatus}

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

        const response = await ai.models.generateContent({
            model: "gemini-1.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        let analysisText = response.data.candidates[0].content.parts[0].text;
        
        // Clean up markdown code blocks if present (e.g., ```json ... ```)
        analysisText = analysisText.replace(/```json/g, '').replace(/```/g, '').trim();

        let analysisJson;
        try {
            analysisJson = JSON.parse(analysisText);
        } catch (parseError) {
            console.error("JSON Parse Error:", parseError);
            console.log("Raw Text:", analysisText);
            // Fallback or retry logic could go here
            return res.status(500).json({ error: "Failed to parse AI response", raw: analysisText });
        }

        res.json(analysisJson);

    } catch (error) {
        console.error('Error generating AI analysis:', error);
        res.status(500).json({ error: 'Failed to generate analysis', details: error.message });
    }
});

// GET User Profile Endpoint
app.get('/api/user-profile', authenticateUser, async (req, res) => {
    try {
        const uid = req.user.uid;
        const userDoc = await admin.firestore().collection('users').doc(uid).get();

        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(userDoc.data());
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
});

// GET Admin Users Endpoint (Protected)
app.get('/api/admin/users', authenticateUser, async (req, res) => {
    try {
        // In a real app, verify 'admin' role here!
        // For now, we return all users for demonstration.
        
        const listUsersResult = await admin.auth().listUsers(100);
        const users = listUsersResult.users.map(userRecord => ({
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName,
            metadata: userRecord.metadata
        }));

        res.json(users);
    } catch (error) {
        console.error('Error listing users:', error);
        res.status(500).json({ error: 'Failed to list users' });
    }
});

// 404 Handler - Must be after all other routes
app.use((req, res, next) => {
    res.status(404).sendFile(path.join(__dirname, '../public/errors/404.html'));
});

// 500 Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).sendFile(path.join(__dirname, '../public/errors/Server Error.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
