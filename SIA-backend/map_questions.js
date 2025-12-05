const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require("@google/genai");

const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });

// Initialize Gemini AI (Using key from .env)
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

async function mapQuestions() {
    const filePath = path.join(__dirname, '../public/Test/Big-Five.json');
    const rawData = fs.readFileSync(filePath);
    const questions = JSON.parse(rawData);

    const prompt = `
    You are a psychologist. Classify each of the following Big Five personality test questions into one of the 5 domains:
    - Openness (O)
    - Conscientiousness (C)
    - Extraversion (E)
    - Agreeableness (A)
    - Neuroticism (N)

    Also indicate if the scoring should be REVERSED (R) or NORMAL (+).
    Normal (+) means "Very Accurate" gives high score for the trait.
    Reversed (R) means "Very Accurate" gives low score for the trait.

    Return a JSON object where keys are Question IDs (e.g., "B1") and values are objects like {"category": "N", "polarity": "+"}.

    Questions:
    ${JSON.stringify(questions.map(q => ({id: q.id, text: q.question})))}
    `;

    try {
        console.log("Sending request to Gemini...");
        const response = await ai.models.generateContent({
            model: "gemini-1.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        const mappingText = response.data.candidates[0].content.parts[0].text;
        const mapping = JSON.parse(mappingText);

        // Update questions with category and polarity
        const updatedQuestions = questions.map(q => {
            if (mapping[q.id]) {
                return { ...q, category: mapping[q.id].category, polarity: mapping[q.id].polarity };
            }
            return q;
        });

        fs.writeFileSync(filePath, JSON.stringify(updatedQuestions, null, 2));
        console.log("Big-Five.json updated successfully with categories!");

    } catch (error) {
        console.error("Error mapping questions:", error);
    }
}

mapQuestions();
