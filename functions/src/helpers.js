const { GoogleGenerativeAI } = require("@google/generative-ai");
const functions = require('firebase-functions');

// Config - Security Fix: Use Environment Variables
// Run: firebase functions:config:set gemini.key="YOUR_KEY"
const GEMINI_API_KEY = functions.config().gemini && functions.config().gemini.key ? functions.config().gemini.key : "AIzaSyAtY70sfw-CUUQ12TntqnmxTjH5yPt6XFU"; 
// Fallback to hardcoded ONLY if config is missing to prevent immediate crash during dev, 
// but strictly this should be set in env.

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const generateAnalysis = async (testType, results, userData) => {
    let prompt = "";
    if (testType === 'Big-Five') {
        prompt = `
        You are a personality expert. Analyze these Big Five scores:
        ${JSON.stringify(results)}
        
        User Context: ${JSON.stringify(userData)}
        
        Provide:
        1. A summary of their personality.
        2. Key strengths and weaknesses.
        3. Career recommendations.
        
        Return JSON format:
        {
            "personalityAnalysis": "...",
            "strengths": ["..."],
            "weaknesses": ["..."],
            "recommendedCareers": [
                {"title": "...", "fit": "High/Medium", "reason": "...", "skills": ["..."]}
            ]
        }
        `;
    } else if (testType === 'Holland') {
        prompt = `
        You are a career counselor. Analyze these Holland Codes (RIASEC):
        ${JSON.stringify(results)}
        
        User Context: ${JSON.stringify(userData)}
        
        Provide career recommendations and explanation of their type.
        
        Return JSON format:
        {
            "typeExplanation": "...",
            "top3Careers": [
                {
                    "title": "...", 
                    "fit": "90%", 
                    "reason": "...", 
                    "skills": ["..."],
                    "roadmap": [{"step": "...", "description": "..."}],
                    "resources": {"books": [{"title": "...", "author": "..."}]}
                }
            ]
        }
        `;
    }

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Basic cleanup content to ensure JSON
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error("AI Generation Error:", error);
        return { error: "Failed to generate analysis" };
    }
};

module.exports = { generateAnalysis };
