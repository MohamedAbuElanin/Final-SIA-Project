const hollandQuestions = require('./data/Holland-codes.json');

const calculateHolland = async (answers) => {
    const scores = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
    const maxScores = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };

    hollandQuestions.forEach(q => {
        const answer = answers[q.id];
        if (answer) {
            const category = q.category;
            const options = q.options;
            const points = q.points || [1, 2, 3, 4, 5];
            
            const index = options.indexOf(answer);
            if (index !== -1 && scores[category] !== undefined) {
                scores[category] += points[index];
                // Max possible points for this question is usually the last element of points array
                maxScores[category] += points[points.length - 1]; 
            }
        }
    });

    // Normalize to 0-100
    const results = {};
    Object.keys(scores).forEach(cat => {
        const max = maxScores[cat];
        results[cat] = max > 0 ? Math.round((scores[cat] / max) * 100) : 0; 
    });

    return results;
};

module.exports = { calculateHolland };
