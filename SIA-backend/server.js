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

// AI Analysis Endpoint
app.post('/api/analyze-profile', async (req, res) => {
    try {
        const { userData, bigFive, holland } = req.body;

        if (!userData) {
            return res.status(400).json({ error: 'User data is required' });
        }

        const prompt = `
        You are an expert career counselor and personality analyst. Analyze the following user profile and test results to provide a comprehensive career development plan.

        **User Profile:**
        - Name: ${userData.fullName}
        - Education: ${userData.education}
        - Student Status: ${userData.studentStatus}

        **Big Five Personality Traits:**
        ${JSON.stringify(bigFive || {}, null, 2)}

        **Holland Codes (RIASEC):**
        ${JSON.stringify(holland || {}, null, 2)}

        **Task:**
        Based on the above data, generate a detailed JSON object with the following structure. DO NOT return markdown formatting, just the raw JSON.

        {
            "personalityAnalysis": "A detailed paragraph analyzing their personality based on Big Five and Holland codes.",
            "recommendedCareers": [
                { "title": "Career Title 1", "fit": "95%", "reason": "Why this fits..." },
                { "title": "Career Title 2", "fit": "90%", "reason": "Why this fits..." },
                { "title": "Career Title 3", "fit": "85%", "reason": "Why this fits..." }
            ],
            "requiredSkills": ["Skill 1", "Skill 2", "Skill 3", "Skill 4", "Skill 5"],
            "learningResources": {
                "paidCourses": [
                    { "title": "Course Title", "platform": "Provider", "link": "URL if known or #" },
                    { "title": "Course Title", "platform": "Provider", "link": "URL if known or #" }
                ],
                "freeCourses": [
                    { "title": "Course Title", "platform": "Provider", "link": "URL if known or #" },
                    { "title": "Course Title", "platform": "Provider", "link": "URL if known or #" }
                ],
                "youtubeVideos": [
                    { "title": "Video Title", "channel": "Channel Name", "link": "URL if known or #" },
                    { "title": "Video Title", "channel": "Channel Name", "link": "URL if known or #" }
                ],
                "podcasts": [
                    { "title": "Podcast Name", "host": "Host Name", "link": "URL if known or #" }
                ],
                "blogs": [
                    { "title": "Article Title", "source": "Source", "link": "URL if known or #" }
                ],
                "books": [
                    { "title": "Book Title", "author": "Author" }
                ]
            },
            "roadmap": [
                { "step": "Step 1", "description": "What to do..." },
                { "step": "Step 2", "description": "What to do..." },
                { "step": "Step 3", "description": "What to do..." },
                { "step": "Step 4", "description": "What to do..." }
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
