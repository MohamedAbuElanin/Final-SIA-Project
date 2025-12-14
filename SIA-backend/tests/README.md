# Test Questions Directory

This directory contains the test question JSON files for the SIA application.

## Directory Structure

```
tests/
├── Big-Five/
│   └── questions.json
└── Holland/
    └── questions.json
```

## Expected JSON Format

### Big-Five Questions (`tests/Big-Five/questions.json`)

The file should contain an array of question objects:

```json
[
  {
    "id": "B1",
    "question": "Question text here",
    "options": [
      "Very Inaccurate",
      "Moderately Inaccurate",
      "Neither Accurate Nor Inaccurate",
      "Moderately Accurate",
      "Very Accurate"
    ],
    "category": "O",
    "polarity": "+"
  }
]
```

**Fields:**
- `id`: Unique question identifier (e.g., "B1", "B2")
- `question`: The question text
- `options`: Array of 5 answer options
- `category`: One of "O" (Openness), "C" (Conscientiousness), "E" (Extraversion), "A" (Agreeableness), "N" (Neuroticism)
- `polarity`: "+" for normal scoring, "-" for reversed scoring

### Holland Questions (`tests/Holland/questions.json`)

The file should contain an array of question objects:

```json
[
  {
    "id": "H1",
    "question": "Question text here",
    "options": [
      "Strongly Disagree",
      "Disagree",
      "Neutral",
      "Agree",
      "Strongly Agree"
    ],
    "category": "R",
    "points": [1, 2, 3, 4, 5]
  }
]
```

**Fields:**
- `id`: Unique question identifier (e.g., "H1", "H2")
- `question`: The question text
- `options`: Array of answer options
- `category`: One of "R" (Realistic), "I" (Investigative), "A" (Artistic), "S" (Social), "E" (Enterprising), "C" (Conventional)
- `points`: Array of point values corresponding to each option

## API Endpoints

Once the JSON files are in place, the following endpoints will serve them:

- `GET /api/tests/bigfive` - Returns Big-Five questions
- `GET /api/tests/holland` - Returns Holland questions

## Fallback Locations

The API endpoints will also check these fallback locations if the primary files don't exist:

1. `SIA-backend/tests/Big-Five/questions.json` (primary)
2. `public/Test/Big-Five.json` (fallback)
3. `SIA-backend/tests/Big-Five.json` (alternative)

Same pattern applies for Holland questions.

