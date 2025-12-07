const functions = require("firebase-functions");
const {GoogleGenerativeAI} = require("@google/generative-ai");
const {logActivity} = require("./activityLog");

/**
 * Generates personalized recommendations using Gemini AI.
 */
exports.getGeminiRecommendations = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }

  const uid = context.auth.uid;
  const {promptContext} = data;

  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set.");
    throw new functions.https.HttpsError("internal", "AI service not configured.");
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({model: "gemini-1.5-flash"});

  try {
    const prompt = `
       You are a helpful career and personality assistant.
       User Context: ${JSON.stringify(promptContext)}
       
       Please provide personalized advice, book recommendations, and a learning roadmap based on this profile.
       Keep it concise and actionable.
     `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    await logActivity(uid, "gemini_consultation", {valid: true});

    return {recommendation: text};
  } catch (error) {
    console.error("Error calling Gemini:", error);
    throw new functions.https.HttpsError("internal", "Failed to generate recommendations.");
  }
});
