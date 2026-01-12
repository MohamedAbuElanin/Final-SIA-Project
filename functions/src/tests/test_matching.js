const {matchCareers} = require("../engine/matching");

// Sample User Data
// High Openness, High Conscientiousness, High Investigative, Realistic
const userBigFive = {
  O: 80,
  C: 85,
  E: 40,
  A: 50,
  N: 30,
};

const userHolland = {
  R: 70,
  I: 90,
  A: 40,
  S: 20,
  E: 30,
  C: 60,
};

console.log("Running Matching Engine Test...");
console.log("User Big Five:", userBigFive);
console.log("User Holland:", userHolland);

try {
  const matches = matchCareers(userBigFive, userHolland, 3);

  console.log("\nTop 3 Matches:");
  matches.forEach((m, i) => {
    console.log(`${i + 1}. ${m.title} (Score: ${m.score})`);
    console.log(`   Match Level: ${m.matchLevel}`);
    console.log(`   Breakdown: Holland ${m.breakdown.holland}, Big Five ${m.breakdown.bigFive}`);
  });

  if (matches.length > 0) {
    console.log("\nSUCCESS: Matches generated.");
  } else {
    console.error("\nFAILURE: No matches generated.");
  }
} catch (error) {
  console.error("\nERROR:", error);
}
