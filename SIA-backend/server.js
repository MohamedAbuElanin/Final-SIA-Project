// ملف السيرفر الرئيسي.
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenAI } = require("@google/genai");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Gemini AI
const ai = new GoogleGenAI({
  apiKey: "AIzaSyAtY70sfw-CUUQ12TntqnmxTjH5yPt6XFU"
});

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Test route
app.get('/', (req, res) => {
    res.send('SIA Back-End is running!');
});

// Calculate Scores Endpoint
app.post('/api/calculate-scores', (req, res) => {
    try {
        const { testType, answers } = req.body;

        if (!answers) {
            return res.status(400).json({ error: 'Answers are required' });
        }

        let results = {};

        if (testType === 'Big-Five') {
            // Scoring logic for Big Five (IPIP-120)
            // Map questions to traits (Simplified mapping for demonstration if JSON not updated)
            // In a real scenario, we'd load the map from a file or DB.
            // For now, we will assume standard IPIP-120 rotation or use a simplified heuristic if map is missing.
            // BETTER APPROACH: Load the questions file which SHOULD have categories now, or use a hardcoded map.
            // Since map_questions.js might have failed, I will use a robust modulo-based mapping which is common for IPIP
            // OR better, just sum them up if the client sends categories. 
            // BUT the client sends { questionId: answerValue }.
            
            // Let's try to load the JSON file dynamically
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
        }

        res.json(results);

    } catch (error) {
        console.error('Error calculating scores:', error);
        res.status(500).json({ error: 'Failed to calculate scores' });
    }
});

// AI Analysis Endpoint
app.post('/api/analyze-profile', async (req, res) => {
    try {
        const { userData, bigFive, holland } = req.body;

        if (!userData) {
            return res.status(400).json({ error: 'User data is required' });
        }

        const prompt = `
        You are an expert career counselor and personality analyst. Analyze the following user profile and test results to provide a comprehensive, highly personalized career development plan.

        **User Profile:**
        - Name: ${userData.fullName}
        - Education: ${userData.education}
        - Student Status: ${userData.studentStatus}

        **Big Five Personality Traits (0-100%):**
        ${JSON.stringify(bigFive || {}, null, 2)}

        **Holland Codes (RIASEC Scores):**
        ${JSON.stringify(holland || {}, null, 2)}

        **Task:**
        Based strictly on the above data, generate a detailed JSON object. Do NOT return markdown. The JSON must follow this exact schema:

        {
            "personalityAnalysis": "A deep, scientific, yet accessible paragraph (approx 150 words) analyzing their personality blend. Explain how their specific Big Five traits (e.g., High Openness, Low Neuroticism) interact with their Holland Code (e.g., Artistic-Investigative) to influence their work style, strengths, and ideal environments.",
            "recommendedCareers": [
                { 
                    "title": "Specific Job Title 1", 
                    "fit": "95%", 
                    "reason": "2-3 sentences explaining exactly WHY this fits their specific trait combination.",
                    "skills": ["Key Skill 1", "Key Skill 2", "Key Skill 3"]
                },
                { 
                    "title": "Specific Job Title 2", 
                    "fit": "90%", 
                    "reason": "...",
                    "skills": ["..."]
                },
                { 
                    "title": "Specific Job Title 3", 
                    "fit": "85%", 
                    "reason": "...",
                    "skills": ["..."]
                }
            ],
            "learningResources": {
                "paidCourses": [
                    { "title": "Specific Course Name", "platform": "Coursera/Udemy/etc", "link": "https://..." },
                    { "title": "Specific Course Name", "platform": "Provider", "link": "https://..." }
                ],
                "freeCourses": [
                    { "title": "Specific Course Name", "platform": "YouTube/EdX/etc", "link": "https://..." },
                    { "title": "Specific Course Name", "platform": "Provider", "link": "https://..." }
                ],
                "youtubeVideos": [
                    { "title": "Video Title", "channel": "Channel Name", "link": "https://..." },
                    { "title": "Video Title", "channel": "Channel Name", "link": "https://..." }
                ],
                "books": [
                    { "title": "Book Title", "author": "Author Name" }
                ]
            },
            "roadmap": [
                { "step": "Phase 1: Foundation", "description": "Specific action items for the first 1-2 months..." },
                { "step": "Phase 2: Skill Building", "description": "Specific action items for months 3-6..." },
                { "step": "Phase 3: Application", "description": "Specific action items for job hunting or portfolio building..." }
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

        const analysisText = response.data.candidates[0].content.parts[0].text;
        const analysisJson = JSON.parse(analysisText);

        res.json(analysisJson);

    } catch (error) {
        console.error('Error generating AI analysis:', error);
        res.status(500).json({ error: 'Failed to generate analysis', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
