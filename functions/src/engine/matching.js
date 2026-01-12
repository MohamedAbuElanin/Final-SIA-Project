/**
 * Career Matching Engine
 * Calculates compatibility scores between user profiles (Big Five + Holland) and Careers.
 */

const {getAllCareers} = require("../data/careers");

/**
 * Normalizes a score value to 0-1 range.
 * Assumes input is 0-100.
 * @param {number} val - The input value to normalize.
 * @return {number} The normalized value between 0 and 1.
 */
const normalize = (val) => {
  if (typeof val !== "number") return 0;
  return Math.max(0, Math.min(100, val)) / 100;
};

/**
 * Calculate Match Score
 * @param {Object} userBigFive - { O: 0-100, C: 0-100, ... }
 * @param {Object} userHolland - { R: 0-100, I: 0-100, ... }
 * @param {Object} career - Career object from database
 * @return {Object} { score: 0-100, details: {} }
 */
const calculateMatchScore = (userBigFive, userHolland, career) => {
  // 1. Holland Score Calculation (60% Weight)
  // We average the user's scores for the career's primary Holland codes.
  let hollandScoreTotal = 0;
  let hollandCount = 0;

  if (career.holland && Array.isArray(career.holland)) {
    career.holland.forEach((code) => {
      if (userHolland[code] !== undefined) {
        hollandScoreTotal += userHolland[code];
        hollandCount++;
      }
    });
  }

  const hollandScore = hollandCount > 0 ? (hollandScoreTotal / hollandCount) : 0;

  // 2. Big Five Score Calculation (40% Weight)
  // We check alignment with defined 'high' or 'low' traits.
  let bigFiveScoreTotal = 0;
  let bigFiveCount = 0;

  if (career.bigFive) {
    Object.keys(career.bigFive).forEach((trait) => {
      const req = career.bigFive[trait];
      const userVal = userBigFive[trait] || 50; // default neutral

      if (req === "high") {
        // Closer to 100 is better
        bigFiveScoreTotal += userVal;
      } else if (req === "low") {
        // Closer to 0 is better -> Invert score
        bigFiveScoreTotal += (100 - userVal);
      } else {
        // 'mid' or specific range could be added here
        // For now, if specified but not high/low, we ignore or treat as mid (optional)
        // Let's assume we only list relevant high/low traits
      }
      bigFiveCount++;
    });
  }

  // If no specific Big Five traits listed, assume neutral fit (50%) or ignore
  const bigFiveScore = bigFiveCount > 0 ? (bigFiveScoreTotal / bigFiveCount) : 50;

  // 3. Weighted Average
  const WEIGHT_HOLLAND = 0.6;
  const WEIGHT_BIGFIVE = 0.4;

  const finalScore = Math.round(
      (hollandScore * WEIGHT_HOLLAND) +
        (bigFiveScore * WEIGHT_BIGFIVE),
  );

  return {
    score: finalScore,
    matchLevel: getMatchLevel(finalScore),
    breakdown: {
      holland: Math.round(hollandScore),
      bigFive: Math.round(bigFiveScore),
    },
  };
};

const getMatchLevel = (score) => {
  if (score >= 80) return "Excellent Match";
  if (score >= 65) return "Good Match";
  if (score >= 50) return "Fair Match";
  return "Low Match";
};

/**
 * Match Careers for User
 * @param {Object} userBigFive
 * @param {Object} userHolland
 * @param {number} topN - Number of careers to return
 * @return {Array} Sorted careers with scores
 */
const matchCareers = (userBigFive, userHolland, topN = 5) => {
  const careers = getAllCareers();

  if (!careers || careers.length === 0) return [];

  const scoredCareers = careers.map((career) => {
    const match = calculateMatchScore(userBigFive, userHolland, career);
    return {
      ...career,
      score: match.score,
      matchLevel: match.matchLevel,
      breakdown: match.breakdown,
    };
  });

  // Sort descending by score
  scoredCareers.sort((a, b) => b.score - a.score);

  return scoredCareers.slice(0, topN);
};

module.exports = {
  calculateMatchScore,
  matchCareers,
  normalize,
};
