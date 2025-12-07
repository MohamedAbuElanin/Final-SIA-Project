const bigFiveQuestions = require('./data/Big-Five.json');

/**
 * Calculates Big Five scores based on provided answers.
 * @param {Object} answers - Map of question ID to answer text
 * @returns {Object} codes - Normalized scores for O, C, E, A, N
 */
const calculateBigFive = async (answers) => {
    const scores = { O: 0, C: 0, E: 0, A: 0, N: 0 };
    const maxScores = { O: 0, C: 0, E: 0, A: 0, N: 0 };

    bigFiveQuestions.forEach((q, index) => {
        const answer = answers[q.id];
        if (answer) {
            let category = 'N'; // Default
            const remainder = index % 5;
            if (remainder === 0) category = 'N';
            else if (remainder === 1) category = 'E';
            else if (remainder === 2) category = 'O';
            else if (remainder === 3) category = 'A';
            else if (remainder === 4) category = 'C';

            const defaultOptions = ["Very Inaccurate","Moderately Inaccurate","Neither Accurate Nor Inaccurate","Moderately Accurate","Very Accurate"];
            const options = q.options || defaultOptions;
            
            let score = options.indexOf(answer);
            if (score === -1) score = 2; // Default to neutral

            scores[category] += score;
            maxScores[category] += 4;
        }
    });

    const results = {};
    Object.keys(scores).forEach(trait => {
        const max = maxScores[trait];
        results[trait] = max > 0 ? Math.round((scores[trait] / max) * 100) : 0;
    });

    return results;
};

module.exports = { calculateBigFive };
