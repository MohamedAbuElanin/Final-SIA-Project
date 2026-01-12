/**
 * Helper functions for AI analysis
 * FIXED: Removed hardcoded API keys, using environment variables only
 * FIXED: Production-safe logging using logger utility
 * Works for both Firebase Functions and Railway deployment
 */

const {GoogleGenerativeAI} = require("@google/generative-ai");
const functions = require("firebase-functions");

const {logger} = functions;

// Import static data for post-processing
const {careers} = require("./data/careers");
const {matchCareers} = require("./engine/matching");

// Logic to get API Key safely
let GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY && functions.config && functions.config().gemini) {
  GEMINI_API_KEY = functions.config().gemini.key;
}

// Initialize AI only if key is available
let genAI = null;
let model = null;

if (GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    // Use gemini-1.5-flash for speed and cost effectiveness
    model = genAI.getGenerativeModel({model: "gemini-1.5-flash"});
    logger.log("Gemini AI initialized successfully");
  } catch (error) {
    logger.error("ERROR: Failed to initialize Gemini AI:", error.message);
  }
} else {
  logger.warn("WARNING: GEMINI_API_KEY is not set!");
  logger.warn("Set it using: firebase functions:secrets:set GEMINI_API_KEY");
}

/**
 * Generate AI analysis for test results
 * FIXED: Added comprehensive error handling, validation, and production-safe logging
 * @param {string} testType - Type of test ('Big-Five', 'Holland', 'Career-Match')
 * @param {Object} results - Test results object or Combined results
 * @param {Object} userData - User profile data
 * @return {Promise<Object>} AI-generated analysis
 */
const generateAnalysis = async (testType, results, userData) => {
  if (!model) {
    throw new Error("Gemini AI is not initialized (Missing API Key)");
  }

  let prompt = "";

  if (testType === "Big-Five") {
    prompt = `
        You are an expert Psychologist. Analyze these Big Five Personality Traits scores:
        ${JSON.stringify(results)}
        
        User Context: ${JSON.stringify(userData)}

        Return structured JSON (ensure keys are exact):
        {
            "personalityAnalysis": "Detailed 2-paragraph analysis of their personality.",
            "strengths": ["Strength 1", "Strength 2", "Strength 3"],
            "weaknesses": ["Weakness 1", "Weakness 2", "Weakness 3"],
            "learningRecommendations": ["Tip 1", "Tip 2"]
        }
        `;
  } else if (testType === "Holland") {
    prompt = `
        You are a Career Counselor. Analyze these Holland Code (RIASEC) scores:
        ${JSON.stringify(results)}
        
        User Context: ${JSON.stringify(userData)}

        Return structured JSON (ensure keys are exact):
        {
            "typeExplanation": "Explain their primary and secondary Holland types.",
            "workStyle": "Describe their preferred work environment."
        }
        `;
  } else if (testType === "Career-Match") {
    // Use the Matching Engine to get data-driven matches first
    // We ask for top 5 matches to give the AI good context
    const topMatches = matchCareers(results.bigFive, results.holland, 5);

    prompt = `
        You are a generic career counselor.
        We have identified the top career matches for this user based on their personality (Big Five) 
        and interests (Holland Codes).

        User Context: ${JSON.stringify(userData)}
        
        Top Data-Driven Matches (Technical Roles):
        ${JSON.stringify(topMatches)}
        
        Task:
        For EACH of the matches provided in the list above, provide:
        1. A specific "Why this fits you" explanation.
        2. A "Skills Gap / Focus" recommendation based on general knowledge of these roles.
        3. Recommended resources (1 book, 1 course/link).

        CRITICAL: 
        - DO NOT invent new careers. Use ONLY the titles provided in the matches.
        - You do NOT need to provide salary data; we have that statically.

        Return structured JSON (ensure keys are exact):
        {
            "topCareers": [
                {
                    "title": "(Use the exact title from the match data)", 
                    "fit": "(Excellent Match / Good Match / Fair Match - based on score)", 
                    "reason": "...", 
                    "skills": ["..."], 
                    "roadmap": [{"step": "...", "description": "..."}],
                    "resources": {"books": [{"title": "...", "author": "..."}]}
                }
            ]
        }
        `;
  } else {
    throw new Error(`Invalid testType: ${testType}. Must be 'Big-Five', 'Holland', or 'Career-Match'`);
  }

  try {
    // Add timeout for AI requests (30 seconds)
    const aiPromise = model.generateContent(prompt);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("AI request timeout after 30 seconds")), 30000),
    );

    const result = await Promise.race([aiPromise, timeoutPromise]);
    const response = await result.response;
    const text = response.text();

    // Better JSON cleanup
    let jsonStr = text.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    jsonStr = jsonStr.trim();

    // Better error handling for JSON parsing
    try {
      const parsed = JSON.parse(jsonStr);

      // POST-PROCESSING: Merge Static Data (Salary) for Career-Match
      if (testType === "Career-Match" && parsed.topCareers && Array.isArray(parsed.topCareers)) {
        parsed.topCareers = parsed.topCareers.map((aiCareer) => {
          const staticMatch = careers.find((c) => c.title === aiCareer.title) || {};
          // Ensure salary is injected from static data (Single Source of Truth)
          const salary = staticMatch.salary || {egypt: "N/A", usa: "N/A"};

          return {
            ...aiCareer,
            salary: salary,
            // Ensure fit score is numeric if possible (passed from match data), or keep AI text
            fit: typeof aiCareer.fit === "number" ? aiCareer.fit : aiCareer.fit,
          };
        });
      }

      return parsed;
    } catch (parseError) {
      logger.error("JSON Parse Error:", parseError.message);
      logger.error("Raw AI Response (first 500 chars):", jsonStr.substring(0, 500));
      throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
    }
  } catch (error) {
    logger.error(`AI Generation Error (${testType}):`, error.message);
    throw error;
  }
};

module.exports = {generateAnalysis};
