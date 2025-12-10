/**
 * Helper functions for AI analysis
 * FIXED: Removed hardcoded API keys, using environment variables only
 * FIXED: Production-safe logging using logger utility
 * Works for both Firebase Functions and Railway deployment
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const functions = require('firebase-functions');
const logger = require('./logger');

// FIXED: Use environment variables only - no hardcoded keys
// For Firebase Functions, use: firebase functions:secrets:set GEMINI_API_KEY
// For Railway, set GEMINI_API_KEY in environment variables
// Legacy support: firebase functions:config:set gemini.key="YOUR_KEY"
let GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// FIXED: Railway deployment - functions.config may not exist
if (!GEMINI_API_KEY && typeof functions !== 'undefined' && functions.config) {
    try {
        GEMINI_API_KEY = functions.config().gemini?.key || null;
    } catch (error) {
        // functions.config() may fail in Railway - ignore
        GEMINI_API_KEY = null;
    }
}

// FIXED: Initialize AI only if key is available
let genAI = null;
let model = null;

if (GEMINI_API_KEY) {
    try {
        genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        logger.log('Gemini AI initialized successfully');
    } catch (error) {
        logger.error('ERROR: Failed to initialize Gemini AI:', error.message);
        // Server continues - AI calls will fail gracefully
    }
} else {
    logger.warn('WARNING: GEMINI_API_KEY is not set!');
    logger.warn('Set it using: firebase functions:secrets:set GEMINI_API_KEY');
    logger.warn('Or (legacy): firebase functions:config:set gemini.key="YOUR_KEY"');
}

/**
 * Generate AI analysis for test results
 * FIXED: Added comprehensive error handling, validation, and production-safe logging
 * @param {string} testType - Type of test ('Big-Five' or 'Holland')
 * @param {Object} results - Test results object
 * @param {Object} userData - User profile data
 * @returns {Promise<Object>} AI-generated analysis
 */
const generateAnalysis = async (testType, results, userData) => {
    // FIXED: Validate inputs
    if (!testType || typeof testType !== 'string') {
        throw new Error('Invalid testType: must be a non-empty string');
    }

    if (!results || typeof results !== 'object') {
        throw new Error('Invalid results: must be an object');
    }

    if (!userData || typeof userData !== 'object') {
        throw new Error('Invalid userData: must be an object');
    }

    // FIXED: Check if AI is initialized
    if (!model || !genAI) {
        throw new Error('AI service is not available - GEMINI_API_KEY not configured');
    }

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
    } else {
        throw new Error(`Invalid testType: ${testType}. Must be 'Big-Five' or 'Holland'`);
    }

    try {
        // FIXED: Add timeout for AI requests (30 seconds)
        const aiPromise = model.generateContent(prompt);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('AI request timeout after 30 seconds')), 30000)
        );

        const result = await Promise.race([aiPromise, timeoutPromise]);
        const response = await result.response;
        const text = response.text();
        
        // FIXED: Better JSON cleanup
        let jsonStr = text.trim();
        
        // Remove markdown code blocks if present
        if (jsonStr.startsWith('```json')) {
            jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
        } else if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        jsonStr = jsonStr.trim();

        // FIXED: Better error handling for JSON parsing
        try {
            return JSON.parse(jsonStr);
        } catch (parseError) {
            logger.error('JSON Parse Error:', parseError.message);
            logger.error('Raw AI Response (first 500 chars):', jsonStr.substring(0, 500));
            throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
        }
    } catch (error) {
        // FIXED: Return structured error instead of generic object
        if (error.message && error.message.includes('timeout')) {
            throw new Error('AI service timeout - please try again');
        } else if (error.message && error.message.includes('API key')) {
            throw new Error('AI service authentication failed - check API key configuration');
        } else {
            logger.error('AI Generation Error:', error.message);
            // FIXED: Sanitize error message for production
            const errorMsg = process.env.NODE_ENV === 'production' 
                ? 'AI generation failed' 
                : error.message;
            throw new Error(`AI generation failed: ${errorMsg}`);
        }
    }
};

module.exports = { generateAnalysis };
