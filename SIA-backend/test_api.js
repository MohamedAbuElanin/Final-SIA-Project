const fetch = require('node-fetch'); // You might need to install node-fetch if not available, or use native fetch in Node 18+

async function testAnalyzeProfile() {
    const url = 'http://localhost:5000/api/analyze-profile';
    const data = {
        userData: {
            fullName: "Test User",
            education: "Bachelor",
            studentStatus: "Graduate"
        },
        bigFive: {
            Openness: 80,
            Conscientiousness: 70,
            Extraversion: 60,
            Agreeableness: 75,
            Neuroticism: 40
        },
        holland: {
            Realistic: 10,
            Investigative: 20,
            Artistic: 30,
            Social: 40,
            Enterprising: 50,
            Conventional: 60
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log("API Test Success!");
        console.log("Personality Analysis:", result.personalityAnalysis ? "Present" : "Missing");
        console.log("Recommended Careers:", result.recommendedCareers ? result.recommendedCareers.length : 0);
    } catch (error) {
        console.error("API Test Failed:", error);
    }
}

testAnalyzeProfile();
