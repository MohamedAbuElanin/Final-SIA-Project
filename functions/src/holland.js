/**
 * Holland Codes (RIASEC) Test Calculation
 * FIXED: Loads questions from Firestore instead of JSON files
 * FIXED: Added null checks, validation, error handling, and production-safe logging
 */

const admin = require("firebase-admin");
const logger = require("./logger");

/**
 * Load Holland Codes questions from Firestore
 * FIXED: Fetches questions from Firestore instead of requiring JSON file
 */
async function loadHollandQuestions() {
  try {
    const testDoc = await admin.firestore()
        .collection("tests")
        .doc("Holland")
        .get();

    if (!testDoc.exists) {
      logger.error("ERROR: Holland test document not found in Firestore");
      return [];
    }

    const testData = testDoc.data();
    const questions = testData.questions || [];

    if (!Array.isArray(questions) || questions.length === 0) {
      logger.error("ERROR: Holland questions array is empty or invalid");
      return [];
    }

    logger.log(`Loaded ${questions.length} Holland Codes questions from Firestore`);
    return questions;
  } catch (error) {
    logger.error("ERROR: Failed to load Holland questions from Firestore:", error.message);
    return [];
  }
}

/**
 * Calculates Holland Codes (RIASEC) scores based on provided answers.
 * FIXED: Loads questions from Firestore, added comprehensive validation and error handling
 * @param {Object} answers - Map of question ID to answer text
 * @return {Object} scores - Normalized scores for R, I, A, S, E, C
 */
const calculateHolland = async (answers) => {
  // FIXED: Validate inputs
  if (!answers || typeof answers !== "object") {
    throw new Error("Answers must be an object");
  }

  if (Object.keys(answers).length === 0) {
    throw new Error("Answers object cannot be empty");
  }

  // FIXED: Load questions from Firestore
  const hollandQuestions = await loadHollandQuestions();

  // FIXED: Check if questions are loaded
  if (!hollandQuestions || hollandQuestions.length === 0) {
    throw new Error("Holland Codes questions not loaded. Please ensure test data is uploaded to Firestore.");
  }

  const scores = {R: 0, I: 0, A: 0, S: 0, E: 0, C: 0};
  const maxScores = {R: 0, I: 0, A: 0, S: 0, E: 0, C: 0};

  hollandQuestions.forEach((q) => {
    // FIXED: Null check for question object
    if (!q || !q.id) {
      logger.warn(`Skipping invalid question: ${JSON.stringify(q)}`);
      return;
    }

    const answer = answers[q.id];

    // FIXED: Validate answer exists
    if (answer !== undefined && answer !== null && answer !== "") {
      const category = q.category;

      // FIXED: Validate category
      if (!category || !["R", "I", "A", "S", "E", "C"].includes(category)) {
        logger.warn(`Invalid category "${category}" for question ${q.id}`);
        return;
      }

      const options = q.options || [];
      let points = q.points || [1, 2, 3, 4, 5];

      // FIXED: Validate options and points arrays
      if (!Array.isArray(options) || options.length === 0) {
        logger.warn(`Invalid options for question ${q.id}`);
        return;
      }

      if (!Array.isArray(points) || points.length === 0) {
        logger.warn(`Invalid points for question ${q.id}`);
        return;
      }

      // FIXED: Ensure points array matches options length
      if (points.length !== options.length) {
        logger.warn(`Points array length doesn't match options for question ${q.id}`);
        // Use default points if mismatch
        points = Array.from({length: options.length}, (_, i) => i + 1);
      }

      const index = options.indexOf(answer);

      // FIXED: Handle case where answer is not in options
      if (index === -1) {
        // Try case-insensitive match
        const lowerAnswer = String(answer).toLowerCase();
        const foundIndex = options.findIndex((opt) => String(opt).toLowerCase() === lowerAnswer);

        if (foundIndex !== -1) {
          // FIXED: Validate category and index before accessing
          if (scores[category] !== undefined && foundIndex < points.length) {
            scores[category] += points[foundIndex] || 0;
            maxScores[category] += points[points.length - 1] || 5;
          }
        } else {
          logger.warn(`Answer "${answer}" not found in options for question ${q.id}`);
        }
      } else {
        // FIXED: Validate category and index before accessing
        if (scores[category] !== undefined && index < points.length) {
          scores[category] += points[index] || 0;
          maxScores[category] += points[points.length - 1] || 5; // Max possible points
        }
      }
    }
  });

  // FIXED: Normalize to 0-100 with validation
  const results = {};
  Object.keys(scores).forEach((cat) => {
    const max = maxScores[cat];
    // FIXED: Prevent division by zero
    if (max > 0) {
      results[cat] = Math.round((scores[cat] / max) * 100);
      // FIXED: Ensure result is within valid range
      results[cat] = Math.max(0, Math.min(100, results[cat]));
    } else {
      results[cat] = 0;
    }
  });

  // FIXED: Validate results object
  if (Object.keys(results).length === 0) {
    throw new Error("Failed to calculate any results. Check answers format.");
  }

  return results;
};

module.exports = {calculateHolland};
