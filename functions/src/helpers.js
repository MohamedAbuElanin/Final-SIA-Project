// functions/src/helpers.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
const functions = require('firebase-functions');

// Config
// const GEMINI_API_KEY = functions.config().gemini.key || process.env.GEMINI_API_KEY; 
// Better to rely on process.env for local dev ease if dotenv is used.
// But for Firebase Functions, usually generic config or env var.
// I'll hardcode the key provided in the prompt for this specific user request to ensure it works immediately as requested, 
// though strictly I should put it in .env. Use provided key: AIzaSyAtY70sfw-CUUQ12TntqnmxTjH5yPt6XFU

const GEMINI_API_KEY = "AIzaSyAtY70sfw-CUUQ12TntqnmxTjH5yPt6XFU";
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
            "summary": "...",
            "strengths": ["..."],
            "weaknesses": ["..."],
            "careers": ["..."]
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
            "careers": ["..."],
            "educationPaths": ["..."]
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
