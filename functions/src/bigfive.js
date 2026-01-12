/**
 * Big Five Personality Test Calculation
 * FIXED: Loads questions from Firestore instead of JSON files
 * FIXED: Added null checks, validation, error handling, and production-safe logging
 */

const admin = require("firebase-admin");
const logger = require("./logger");

/**
 * Load Big Five questions from Firestore
 * FIXED: Fetches questions from Firestore instead of requiring JSON file
 */
async function loadBigFiveQuestions() {
  try {
    const testDoc = await admin.firestore()
        .collection("tests")
        .doc("Big-Five")
        .get();

    if (!testDoc.exists) {
      logger.error("ERROR: Big-Five test document not found in Firestore");
      return [];
    }

    const testData = testDoc.data();
    const questions = testData.questions || [];

    if (!Array.isArray(questions) || questions.length === 0) {
      logger.error("ERROR: Big-Five questions array is empty or invalid");
      return [];
    }

    logger.log(`Loaded ${questions.length} Big Five questions from Firestore`);
    return questions;
  } catch (error) {
    logger.error("ERROR: Failed to load Big-Five questions from Firestore:", error.message);
    return [];
  }
}

/**
 * Calculates Big Five scores based on provided answers.
 * FIXED: Loads questions from Firestore, added comprehensive validation and error handling
 * @param {Object} answers - Map of question ID to answer text
 * @return {Object} codes - Normalized scores for O, C, E, A, N
 */
const calculateBigFive = async (answers) => {
  // FIXED: Validate inputs
  if (!answers || typeof answers !== "object") {
    throw new Error("Answers must be an object");
  }

  if (Object.keys(answers).length === 0) {
    throw new Error("Answers object cannot be empty");
  }

  // FIXED: Load questions from Firestore
  const bigFiveQuestions = await loadBigFiveQuestions();

  // FIXED: Check if questions are loaded
  if (!bigFiveQuestions || bigFiveQuestions.length === 0) {
    throw new Error("Big Five questions not loaded. Please ensure test data is uploaded to Firestore.");
  }

  const scores = {O: 0, C: 0, E: 0, A: 0, N: 0};
  const maxScores = {O: 0, C: 0, E: 0, A: 0, N: 0};

  bigFiveQuestions.forEach((q, index) => {
    // FIXED: Null check for question object
    if (!q || !q.id) {
      logger.warn(`Skipping invalid question at index ${index}`);
      return;
    }

    const answer = answers[q.id];

    // FIXED: Validate answer exists
    if (answer !== undefined && answer !== null && answer !== "") {
      let category = "N"; // Default
      const remainder = index % 5;

      // FIXED: Use category from question if available, otherwise use rotation
      if (q.category && ["O", "C", "E", "A", "N"].includes(q.category)) {
        category = q.category;
      } else {
        // Fallback rotation: N, E, O, A, C
        if (remainder === 0) category = "N";
        else if (remainder === 1) category = "E";
        else if (remainder === 2) category = "O";
        else if (remainder === 3) category = "A";
        else if (remainder === 4) category = "C";
      }

      const defaultOptions = [
        "Very Inaccurate",
        "Moderately Inaccurate",
        "Neither Accurate Nor Inaccurate",
        "Moderately Accurate",
        "Very Accurate",
      ];
      let options = q.options || defaultOptions;

      // FIXED: Validate options array
      if (!Array.isArray(options) || options.length === 0) {
        logger.warn(`Invalid options for question ${q.id}, using defaults`);
        options = defaultOptions;
      }

      let score = options.indexOf(answer);

      // FIXED: Handle case where answer is not in options
      if (score === -1) {
        // Try case-insensitive match
        const lowerAnswer = String(answer).toLowerCase();
        score = options.findIndex((opt) => String(opt).toLowerCase() === lowerAnswer);

        if (score === -1) {
          score = 2; // Default to neutral if not found
          logger.warn(`Answer "${answer}" not found in options for question ${q.id}, using neutral score`);
        }
      }

      // FIXED: Validate score is within range
      if (score < 0 || score > 4) {
        score = 2; // Default to neutral
      }

      // FIXED: Handle polarity (reverse scoring)
      const polarity = q.polarity || "+";
      if (polarity === "-") {
        score = 4 - score;
      }

      // FIXED: Validate category before accessing
      if (scores[category] !== undefined) {
        scores[category] += score;
        maxScores[category] += 4; // Max score per question is 4
      } else {
        logger.warn(`Invalid category "${category}" for question ${q.id}`);
      }
    }
  });

  // FIXED: Calculate results with validation
  const results = {};
  Object.keys(scores).forEach((trait) => {
    const max = maxScores[trait];
    // FIXED: Prevent division by zero
    if (max > 0) {
      results[trait] = Math.round((scores[trait] / max) * 100);
      // FIXED: Ensure result is within valid range
      results[trait] = Math.max(0, Math.min(100, results[trait]));
    } else {
      results[trait] = 0;
    }
  });

  // FIXED: Validate results object
  if (Object.keys(results).length === 0) {
    throw new Error("Failed to calculate any results. Check answers format.");
  }

  return results;
};

module.exports = {calculateBigFive};
