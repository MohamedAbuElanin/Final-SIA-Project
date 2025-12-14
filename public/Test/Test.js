// Test.js - Refactored for Firebase Modular SDK (v9+)
// FIXED: Uses modular SDK imports and proper Firebase initialization
// Includes JSON Validation, Retake Prevention, and Review Mode

// FIXED: Import Firebase services from firebase-config.js
import { app, auth, db, storage } from '../firebase-config.js';
// Import Firestore functions
import { 
    collection, 
    doc, 
    getDoc, 
    getDocs,
    setDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
// Import Auth functions (onAuthStateChanged is from auth module, not firestore!)
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// State Management
const state = {
    currentTest: null, // 'Big-Five' or 'Holland'
    questions: [],
    currentQuestionIndex: 0,
    answers: {}, // { questionId: answerValue }
    startTime: null,
    timerInterval: null,
    elapsedSeconds: 0,
    isTimerRunning: false,
    maxReachedIndex: 0, // Track furthest progress to manage "Review" vs "New"
    isReviewMode: false, // Flag for Review Mode
    isSaving: false, // Flag to prevent duplicate submissions
    isSavingToFirestore: false, // Flag to prevent duplicate Firestore saves
    answeredQuestions: new Set() // Track answered questions to prevent duplicates
};

/**
 * Calculate test scores client-side based on answers and questions
 * This function handles both Big-Five and Holland test scoring
 * 
 * @param {string} testType - The type of test ('Big-Five' or 'Holland')
 * @param {Object} answers - Object mapping question IDs to selected answers
 * @param {Array} questions - Array of question objects with scoring information
 * @returns {Object} Calculated scores for the test
 */
function calculateScores(testType, answers, questions) {
    console.log(`[Calculate] Calculating scores for ${testType} with ${Object.keys(answers).length} answers`);
    
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
        console.error('[Calculate] ❌ No questions provided for score calculation');
        throw new Error('Questions array is required for score calculation');
    }
    
    if (!answers || typeof answers !== 'object' || Object.keys(answers).length === 0) {
        console.warn('[Calculate] ⚠️ No answers provided, returning empty scores');
        return {};
    }
    
    let results = {};
    
    if (testType === 'Big-Five') {
        // Big Five Personality Test Scoring
        // Traits: O (Openness), C (Conscientiousness), E (Extraversion), A (Agreeableness), N (Neuroticism)
        const scores = { O: 0, C: 0, E: 0, A: 0, N: 0 };
        const counts = { O: 0, C: 0, E: 0, A: 0, N: 0 };
        
        questions.forEach((question, index) => {
            if (!question || !question.id) {
                console.warn(`[Calculate] Skipping invalid question at index ${index}`);
                return;
            }
            
            const answer = answers[question.id];
            if (answer === undefined || answer === null) {
                return; // Skip unanswered questions
            }
            
            // Determine category (trait)
            let category = question.category;
            let polarity = question.polarity || '+';
            
            // If category not specified, assign based on index modulo 5
            if (!category) {
                const remainder = index % 5;
                if (remainder === 0) category = 'N';      // Neuroticism
                else if (remainder === 1) category = 'E'; // Extraversion
                else if (remainder === 2) category = 'O'; // Openness
                else if (remainder === 3) category = 'A'; // Agreeableness
                else if (remainder === 4) category = 'C'; // Conscientiousness
            }
            
            // Get options and scores
            const defaultOptions = ["Very Inaccurate", "Moderately Inaccurate", "Neither Accurate Nor Inaccurate", "Moderately Accurate", "Very Accurate"];
            const options = question.options || defaultOptions;
            const questionScores = question.scores || [0, 1, 2, 3, 4];
            
            // Find the index of the selected answer
            let scoreIndex = options.indexOf(answer);
            
            // If exact match not found, try case-insensitive match
            if (scoreIndex === -1) {
                const lowerAnswer = String(answer).toLowerCase();
                scoreIndex = options.findIndex(opt => String(opt).toLowerCase() === lowerAnswer);
            }
            
            // If still not found, use neutral score (middle option)
            if (scoreIndex === -1) {
                scoreIndex = Math.floor(options.length / 2);
                console.warn(`[Calculate] Answer "${answer}" not found in options for question ${question.id}, using neutral score`);
            }
            
            // Get the score value
            let score = questionScores[scoreIndex] !== undefined ? questionScores[scoreIndex] : scoreIndex;
            
            // Ensure score is within valid range (0-4)
            if (score < 0 || score > 4) {
                score = Math.max(0, Math.min(4, score));
            }
            
            // Apply polarity (reverse score if negative)
            if (polarity === '-') {
                score = 4 - score;
            }
            
            // Add to category total
            if (scores[category] !== undefined) {
                scores[category] += score;
                counts[category]++;
            }
        });
        
        // Calculate percentage scores (0-100)
        Object.keys(scores).forEach(trait => {
            const maxScore = counts[trait] * 4; // Maximum possible score
            results[trait] = maxScore > 0 ? Math.round((scores[trait] / maxScore) * 100) : 0;
        });
        
        console.log('[Calculate] ✅ Big-Five scores calculated:', results);
        
    } else if (testType === 'Holland' || testType === 'Holland-codes') {
        // Holland Codes (RIASEC) Scoring
        // Categories: R (Realistic), I (Investigative), A (Artistic), S (Social), E (Enterprising), C (Conventional)
        const validCategories = ['R', 'I', 'A', 'S', 'E', 'C'];
        const scores = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
        const counts = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
        
        // Debug: Log question structure for first few questions
        if (questions.length > 0) {
            console.log('[Calculate] Sample question structure:', {
                id: questions[0].id,
                category: questions[0].category,
                hasCategory: 'category' in questions[0],
                categoryType: typeof questions[0].category,
                allKeys: Object.keys(questions[0])
            });
        }
        
        questions.forEach((question, index) => {
            // Skip invalid questions
            if (!question || typeof question !== 'object') {
                console.warn(`[Calculate] Skipping invalid question at index ${index}: not an object`);
                return;
            }
            
            if (!question.id) {
                console.warn(`[Calculate] Skipping question at index ${index}: missing id`);
                return;
            }
            
            // Get category - handle both string and potential Firestore field name variations
            let category = question.category;
            
            // If category is missing, check for alternative field names (Firestore might use different casing)
            if (!category) {
                category = question.Category || question.CATEGORY || question.categoryCode || null;
            }
            
            // Normalize category to uppercase string
            if (category) {
                category = String(category).trim().toUpperCase();
            }
            
            // Validate category exists and is valid
            if (!category || !validCategories.includes(category)) {
                // Only warn if category is actually missing/invalid (not just empty string)
                if (category !== null && category !== undefined && category !== '') {
                    console.warn(`[Calculate] Question ${question.id} has invalid category: "${category}". Valid categories are: ${validCategories.join(', ')}`);
                } else {
                    console.warn(`[Calculate] Question ${question.id} is missing category field. Skipping.`);
                }
                return;
            }
            
            // Get answer for this question
            const answer = answers[question.id];
            if (answer === undefined || answer === null || answer === '') {
                return; // Skip unanswered questions (no warning needed)
            }
            
            // Get options and scores arrays
            const options = Array.isArray(question.options) ? question.options : [];
            const questionScores = Array.isArray(question.scores) ? question.scores : [1, 2, 3, 4, 5];
            
            // Validate options array
            if (options.length === 0) {
                console.warn(`[Calculate] Question ${question.id} has no options array. Using default scoring.`);
            }
            
            // Find the index of the selected answer
            let scoreIndex = options.indexOf(answer);
            
            // If exact match not found, try case-insensitive match
            if (scoreIndex === -1) {
                const lowerAnswer = String(answer).toLowerCase().trim();
                scoreIndex = options.findIndex(opt => String(opt).toLowerCase().trim() === lowerAnswer);
            }
            
            // If still not found, use neutral score (middle option)
            if (scoreIndex === -1) {
                scoreIndex = Math.floor(options.length / 2);
                console.warn(`[Calculate] Answer "${answer}" not found in options for question ${question.id}, using neutral score (index ${scoreIndex})`);
            }
            
            // Get the score value from questionScores array, or default to index-based scoring
            let score;
            if (questionScores.length > scoreIndex && questionScores[scoreIndex] !== undefined) {
                score = questionScores[scoreIndex];
            } else if (options.length > 0) {
                // Default: 1-5 scale based on position
                score = scoreIndex + 1;
            } else {
                // Fallback: use middle value
                score = 3;
            }
            
            // Ensure score is a valid number
            score = Number(score);
            if (isNaN(score) || score < 0) {
                console.warn(`[Calculate] Invalid score for question ${question.id}, using default score 3`);
                score = 3;
            }
            
            // Add to category total
            scores[category] += score;
            counts[category]++;
            
            // Debug log for first few questions
            if (index < 3) {
                console.log(`[Calculate] Question ${question.id} (${category}): answer="${answer}", scoreIndex=${scoreIndex}, score=${score}, total=${scores[category]}`);
            }
        });
        
        // Calculate percentage scores (0-100)
        Object.keys(scores).forEach(cat => {
            const maxScore = counts[cat] * 5; // Maximum possible score (assuming 1-5 scale)
            if (maxScore > 0) {
                results[cat] = Math.round((scores[cat] / maxScore) * 100);
            } else {
                results[cat] = 0;
            }
        });
        
        // Log summary
        console.log('[Calculate] ✅ Holland Codes scores calculated:', results);
        console.log('[Calculate] Score totals:', scores);
        console.log('[Calculate] Question counts per category:', counts);
        
    } else {
        console.error(`[Calculate] ❌ Unknown test type: ${testType}`);
        throw new Error(`Unsupported test type: ${testType}`);
    }
    
    return results;
}

// DOM Elements
const elements = {
    selectionView: document.getElementById('selectionView'),
    testView: document.getElementById('testView'),
    resultView: document.getElementById('resultView'),
    testCards: document.querySelectorAll('.test-card'),
    questionContainer: document.getElementById('questionContainer'),
    questionText: document.getElementById('questionText'),
    optionsContainer: document.getElementById('optionsContainer'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    currentQuestionNum: document.getElementById('currentQuestionNum'),
    totalQuestions: document.getElementById('totalQuestions'),
    progressBar: document.getElementById('progressBar'),
    timerDisplay: document.getElementById('timerDisplay'),
    finalTime: document.getElementById('finalTime'),
    finishBtn: document.getElementById('finishBtn'),
    reviewBtn: document.getElementById('reviewBtn'),
    navAuth: document.getElementById('navAuth')
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Test] DOM Content Loaded');
    // FIXED: Wait for Firebase to initialize properly
    function waitForFirebase() {
        if (window.firebaseApp && window.db && window.auth) {
            console.log('[Test] ✅ Firebase initialized, calling init()');
            init();
        } else {
            console.log('[Test] Waiting for Firebase initialization...');
            setTimeout(waitForFirebase, 100);
        }
    }
    waitForFirebase();
});

function init() {
    console.log('[Test] 🚀 Initializing Test page...');
    console.log('[Test] Elements found:', {
        selectionView: !!elements.selectionView,
        testView: !!elements.testView,
        resultView: !!elements.resultView,
        testCards: elements.testCards.length
    });
    
    checkAuth();
    setupEventListeners();
    checkUrlParams(); // Check for Review Mode
    
    console.log('[Test] ✅ Initialization complete');
}

// --- Authentication Check ---
// FIXED: Now uses centralized auth state to prevent redirect loops
function checkAuth() {
    if (typeof window.onAuthStateReady === 'undefined') {
        setTimeout(checkAuth, 100);
        return;
    }

    window.onAuthStateReady((user) => {
        if (!user) {
            window.location.href = "../sign in/signin.html";
            return;
        }
        
        // User is authenticated, continue
        console.log('User authenticated:', user.uid);
    });
}

function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const testType = urlParams.get('test');

    if (mode === 'review' && testType) {
        startReview(testType);
    }
}

function setupEventListeners() {
    console.log('[Test] Setting up event listeners...');
    console.log('[Test] Found test cards:', elements.testCards.length);
    
    // Test Selection
    elements.testCards.forEach((card, index) => {
        console.log(`[Test] Setting up card ${index + 1}:`, card.dataset.test);
        
        // Handle both card click and button click
        const handleTestStart = (e) => {
            console.log('[Test] Test start clicked!', e.target);
            // Prevent event bubbling if button is clicked
            if (e.target.classList.contains('btn-start')) {
                e.stopPropagation();
            }
            
            // Get test type from data-test attribute
            const testType = card.dataset.test || card.dataset.testType;
            console.log('[Test] Test type detected:', testType);
            
            if (testType) {
                console.log('[Test] ✅ Calling startTest with type:', testType);
                startTest(testType);
            } else {
                console.error('[Test] ❌ No test type found on card:', card);
            }
        };
        
        card.addEventListener('click', handleTestStart);
        console.log(`[Test] ✅ Card ${index + 1} click listener added`);
        
        // Also handle button clicks directly
        const startButton = card.querySelector('.btn-start');
        if (startButton) {
            startButton.addEventListener('click', handleTestStart);
            console.log(`[Test] ✅ Button ${index + 1} click listener added`);
        } else {
            console.warn(`[Test] ⚠️ No .btn-start button found in card ${index + 1}`);
        }
    });
    
    console.log('[Test] ✅ Event listeners setup complete');

    // Navigation Buttons
    if (elements.prevBtn) {
        elements.prevBtn.addEventListener('click', () => {
            if (state.currentQuestionIndex > 0) {
                state.currentQuestionIndex--;
                renderQuestion();
            }
        });
    }

    if (elements.nextBtn) {
        elements.nextBtn.addEventListener('click', () => {
            if (state.currentQuestionIndex < state.questions.length - 1) {
                saveAnswer();
                state.currentQuestionIndex++;
                if (state.currentQuestionIndex > state.maxReachedIndex) {
                    state.maxReachedIndex = state.currentQuestionIndex;
                }
                renderQuestion();
            } else {
                // Last question
                saveAnswer();
                finishTest();
            }
        });
    }

    // Finish Button
    if (elements.finishBtn) {
        elements.finishBtn.addEventListener('click', finishTest);
    }

    // Review Button (from Result View)
    if (elements.reviewBtn) {
        elements.reviewBtn.addEventListener('click', reviewAnswersFromResults);
    }

    // Visibility Change (Pause Timer)
    document.addEventListener('visibilitychange', handleVisibilityChange);
}

// --- Test Logic ---
// FIXED: Fetches questions from Firestore
async function startTest(testType) {
    // Normalize Holland Codes ID
    if (testType === 'Holland-codes') {
        testType = 'Holland';
    }

    state.currentTest = testType;
    state.isReviewMode = false;
    console.log("Starting test:", testType);

    // FIXED: Use modular SDK auth
    const user = auth.currentUser;
    if (!user) {
        alert(window.i18n?.t('test_please_sign_in') || "Please sign in to start the test.");
        return;
    }

    try {
        // 1. Check if user already completed this test
        const userTestRef = doc(db, 'users', user.uid, 'tests', testType);
        const userTestSnap = await getDoc(userTestRef);

        if (userTestSnap.exists()) {
            const confirmReview = confirm(window.i18n?.t('test_already_completed') || "You have already completed this test. Would you like to review your answers instead?");
            if (confirmReview) {
                startReview(testType);
            }
            return; // Stop here, do not start new test
        }

        // 2. Fetch Test Questions - Try Firestore first, then API, then local JSON files
        let testData = null;
        let questions = null;
        let loadedFrom = 'none';
        
        // Map test type to collection name and JSON file name
        const collectionMap = {
            'Big-Five': 'Big-Five',
            'Holland': 'Holland'
        };
        
        const jsonFileMap = {
            'Big-Five': 'big_five.json',
            'Holland': 'holland.json'
        };
        
        const collectionName = collectionMap[testType];
        const jsonFileName = jsonFileMap[testType];
        
        if (!jsonFileName || !collectionName) {
            throw new Error(`Invalid test type: "${testType}"`);
        }
        
        // Method 1: Try loading from Firestore
        // Try as document first: /tests/{collectionName} (document with questions array)
        // Then try as subcollection: /tests/{collectionName} (subcollection of question documents)
        try {
            console.log(`[Test] Attempting to load from Firestore: /tests/${collectionName}`);
            
            // First, try as a document (most common structure)
            const testDocRef = doc(db, 'tests', collectionName);
            const testDocSnap = await getDoc(testDocRef);
            
            if (testDocSnap.exists()) {
                const docData = testDocSnap.data();
                // Check if document has questions array
                if (docData.questions && Array.isArray(docData.questions) && docData.questions.length > 0) {
                    // Ensure all questions have proper structure and preserve all fields
                    const questionsArray = docData.questions.map((q, idx) => {
                        // If question is missing id, use index-based ID
                        if (!q.id && q.id !== 0) {
                            q.id = q.id || `Q${idx + 1}`;
                        }
                        return q;
                    });
                    
                    // Debug: Log first question structure for Holland tests
                    if (testType === 'Holland' && questionsArray.length > 0) {
                        console.log('[Test] Sample Firestore question structure (document array):', {
                            id: questionsArray[0].id,
                            category: questionsArray[0].category,
                            hasCategory: 'category' in questionsArray[0],
                            allFields: Object.keys(questionsArray[0])
                        });
                    }
                    
                    testData = { questions: questionsArray };
                    loadedFrom = 'firestore';
                    console.log(`[Test] ✅ Successfully loaded ${questionsArray.length} questions from Firestore document /tests/${collectionName}`);
                } else if (Array.isArray(docData) && docData.length > 0) {
                    // Document data is directly an array
                    const questionsArray = docData.map((q, idx) => {
                        if (!q.id && q.id !== 0) {
                            q.id = q.id || `Q${idx + 1}`;
                        }
                        return q;
                    });
                    
                    testData = { questions: questionsArray };
                    loadedFrom = 'firestore';
                    console.log(`[Test] ✅ Successfully loaded ${questionsArray.length} questions from Firestore document /tests/${collectionName}`);
                } else {
                    console.log(`[Test] Firestore document /tests/${collectionName} exists but has no questions array, trying subcollection...`);
                    // Try as subcollection
                    const subCollectionRef = collection(db, 'tests', collectionName, 'questions');
                    const subQuerySnapshot = await getDocs(subCollectionRef);
                    
                if (!subQuerySnapshot.empty) {
                    const questionsArray = [];
                    subQuerySnapshot.forEach((questionDoc) => {
                        const data = questionDoc.data();
                        // Preserve all fields from Firestore, including category
                        const question = { 
                            id: questionDoc.id, 
                            ...data 
                        };
                        // Debug: Log first question structure for Holland tests
                        if (testType === 'Holland' && questionsArray.length === 0) {
                            console.log('[Test] Sample Firestore question structure:', {
                                id: question.id,
                                category: question.category,
                                hasCategory: 'category' in question,
                                allFields: Object.keys(question)
                            });
                        }
                        questionsArray.push(question);
                    });
                    
                    if (questionsArray.length > 0) {
                        testData = { questions: questionsArray };
                        loadedFrom = 'firestore';
                        console.log(`[Test] ✅ Successfully loaded ${questionsArray.length} questions from Firestore subcollection /tests/${collectionName}/questions`);
                    }
                }
                }
            } else {
                // Document doesn't exist, try as subcollection directly
                console.log(`[Test] Firestore document /tests/${collectionName} doesn't exist, trying as subcollection...`);
                const subCollectionRef = collection(db, 'tests', collectionName);
                const subQuerySnapshot = await getDocs(subCollectionRef);
                
                if (!subQuerySnapshot.empty) {
                    const questionsArray = [];
                    subQuerySnapshot.forEach((questionDoc) => {
                        const data = questionDoc.data();
                        // Include all questions, but validate they have required fields
                        if (data.question || data.text || data.id) {
                            const question = { 
                                id: questionDoc.id, 
                                ...data 
                            };
                            // Ensure id is set (use document ID if not in data)
                            if (!question.id) {
                                question.id = questionDoc.id;
                            }
                            // Debug: Log first question structure for Holland tests
                            if (testType === 'Holland' && questionsArray.length === 0) {
                                console.log('[Test] Sample Firestore question structure (subcollection):', {
                                    id: question.id,
                                    category: question.category,
                                    hasCategory: 'category' in question,
                                    allFields: Object.keys(question)
                                });
                            }
                            questionsArray.push(question);
                        }
                    });
                    
                    if (questionsArray.length > 0) {
                        testData = { questions: questionsArray };
                        loadedFrom = 'firestore';
                        console.log(`[Test] ✅ Successfully loaded ${questionsArray.length} questions from Firestore subcollection /tests/${collectionName}`);
                    }
                }
            }
            
            if (!testData) {
                console.log(`[Test] Firestore /tests/${collectionName} not found or empty, trying next method`);
            }
        } catch (firestoreError) {
            console.warn(`[Test] Firestore load failed:`, firestoreError.message);
            console.log(`[Test] Trying API endpoint...`);
        }
        
        // Method 2: Try API endpoint if Firestore failed
        if (!testData) {
            try {
                const apiBaseUrl = window.CONFIG?.API_BASE_URL || 
                                    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                                    ? 'http://localhost:5000/api'
                                    : (window.CONFIG?.BACKEND_URL || 'https://your-backend-url.railway.app/api');
                
                const endpointMap = {
                    'Big-Five': 'tests/bigfive',
                    'Holland': 'tests/holland'
                };
                
                const endpoint = endpointMap[testType];
                console.log(`[Test] Attempting to fetch questions from API: ${apiBaseUrl}/${endpoint}`);
                const response = await fetch(`${apiBaseUrl}/${endpoint}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    testData = await response.json();
                    loadedFrom = 'api';
                    console.log(`[Test] ✅ Successfully loaded from API. Keys:`, Object.keys(testData));
                } else {
                    console.warn(`[Test] API returned ${response.status}, falling back to local JSON file`);
                }
            } catch (apiError) {
                console.warn(`[Test] API fetch failed:`, apiError.message);
                console.log(`[Test] Falling back to local JSON file: ${jsonFileName}`);
            }
        }
        
        // Method 3: Fallback to local JSON file if both Firestore and API failed
        if (!testData) {
            try {
                const jsonPath = `./${jsonFileName}`;
                console.log(`[Test] Loading from local JSON file: ${jsonPath}`);
                const response = await fetch(jsonPath);
                
                if (!response.ok) {
                    throw new Error(`Failed to load local JSON file: ${response.status} ${response.statusText}`);
                }
                
                testData = await response.json();
                loadedFrom = 'local';
                console.log(`[Test] ✅ Successfully loaded from local JSON file`);
            } catch (jsonError) {
                console.error(`[Test] Failed to load local JSON file:`, jsonError);
                const errorMsg = window.i18n?.t('test_failed_load') || "Failed to load test questions. Please check your connection and try again.";
                throw new Error(errorMsg);
            }
        }
        
        console.log(`[Test] Questions loaded from: ${loadedFrom}`);
        
        // Handle questions extraction (supports both API response format and direct JSON array)
        questions = testData.questions || testData;
        
        // 3. Validate questions structure
        if (Array.isArray(questions)) {
            // Direct array
            state.questions = questions;
        } else if (questions && typeof questions === 'object') {
            // Nested structure - try to find questions array
            if (questions.questions && Array.isArray(questions.questions)) {
                state.questions = questions.questions;
            } else {
                throw new Error("Invalid test data format: 'questions' array not found.");
            }
        } else {
            throw new Error("Invalid test data format: expected questions array.");
        }
        
        if (!Array.isArray(state.questions)) {
            throw new Error("Invalid test data format: 'questions' must be an array.");
        }
        
        if (state.questions.length === 0) {
            throw new Error("Test questions array is empty. Please contact support.");
        }
        
        // Validate question structure
        const invalidQuestions = state.questions.filter((q, index) => {
            if (!q || typeof q !== 'object') {
                console.warn(`[Test] Question at index ${index} is not an object:`, q);
                return true;
            }
            if (!q.id) {
                console.warn(`[Test] Question at index ${index} missing 'id':`, q);
                return true;
            }
            if (!q.question && !q.text) {
                console.warn(`[Test] Question at index ${index} missing 'question' or 'text':`, q);
                return true;
            }
            // For Holland tests, validate category exists
            if (testType === 'Holland' && !q.category) {
                console.warn(`[Test] Holland question ${q.id} at index ${index} missing 'category' field`);
                // Don't mark as invalid - we'll handle missing categories gracefully in scoring
            }
            return false;
        });
        
        if (invalidQuestions.length > 0) {
            console.error(`[Test] Found ${invalidQuestions.length} invalid questions`);
            throw new Error(`Some questions have invalid format. Please contact support.`);
        }
        
        // For Holland tests, log category distribution for debugging
        if (testType === 'Holland') {
            const categoryCounts = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0, missing: 0 };
            state.questions.forEach(q => {
                const cat = q.category ? String(q.category).trim().toUpperCase() : null;
                if (cat && ['R', 'I', 'A', 'S', 'E', 'C'].includes(cat)) {
                    categoryCounts[cat]++;
                } else {
                    categoryCounts.missing++;
                }
            });
            console.log(`[Test] Holland test category distribution:`, categoryCounts);
            if (categoryCounts.missing > 0) {
                console.warn(`[Test] ⚠️ ${categoryCounts.missing} questions are missing valid categories`);
            }
        }

        console.log(`[Test] ✅ Successfully loaded ${state.questions.length} valid questions for ${testType}`);
        
        // Reset State
        state.currentQuestionIndex = 0;
        state.maxReachedIndex = 0;
        state.answers = {};
        state.elapsedSeconds = 0;
        state.answeredQuestions.clear(); // Clear answered questions set
        state.isSavingToFirestore = false; // Reset Firestore saving flag
        
        // Switch View with animation
        elements.selectionView.classList.remove('active');
        elements.selectionView.classList.add('hidden');
        
        // Show loading state briefly
        if (elements.testView) {
            elements.testView.classList.remove('hidden');
            elements.testView.style.opacity = '0';
            
            // Animate in
            setTimeout(() => {
                elements.testView.classList.add('active');
                elements.testView.style.opacity = '1';
                elements.testView.style.transition = 'opacity 0.5s ease';
            }, 50);
        }
        
        // Initialize UI
        elements.totalQuestions.textContent = state.questions.length;
        
        // Small delay to ensure view is visible before rendering
        setTimeout(() => {
            renderQuestion();
            startTimer();
        }, 100);
    } catch (error) {
        console.error("[Test] Error starting test:", error);
        console.error("[Test] Error details:", {
            message: error.message,
            stack: error.stack,
            testType: testType,
            user: user?.uid
        });
        
        // Show user-friendly error message
        const errorMessage = error.message || (window.i18n?.t('test_failed_load_generic') || "Failed to load the test. Please try again later.");
        alert(`Error: ${errorMessage}\n\nIf this problem persists, please contact support.`);
        
        // Optionally, show error in UI instead of alert
        if (elements.selectionView) {
            elements.selectionView.classList.add('active');
            elements.selectionView.classList.remove('hidden');
        }
    }
}

// FIXED: Fetches questions from Firestore
async function startReview(testType) {
    // Normalize Holland Codes ID
    if (testType === 'Holland-codes') {
        testType = 'Holland';
    }

    state.currentTest = testType;
    state.isReviewMode = true;
    console.log("Starting review:", testType);

    // FIXED: Use modular SDK auth
    const user = auth.currentUser;
    if (!user) {
        return;
    }

    try {
        // 1. Fetch Questions - Try Firestore first, then API, then local JSON files
        let testData = null;
        let questions = null;
        let loadedFrom = 'none';
        
        // Map test type to collection name and JSON file name
        const collectionMap = {
            'Big-Five': 'Big-Five',
            'Holland': 'Holland'
        };
        
        const jsonFileMap = {
            'Big-Five': 'big_five.json',
            'Holland': 'holland.json'
        };
        
        const collectionName = collectionMap[testType];
        const jsonFileName = jsonFileMap[testType];
        
        if (!jsonFileName || !collectionName) {
            alert("Invalid test type.");
            return;
        }
        
        // Method 1: Try loading from Firestore
        try {
            console.log(`[Review] Attempting to load from Firestore: /tests/${collectionName}`);
            
            // First, try as a document
            const testDocRef = doc(db, 'tests', collectionName);
            const testDocSnap = await getDoc(testDocRef);
            
            if (testDocSnap.exists()) {
                const docData = testDocSnap.data();
                if (docData.questions && Array.isArray(docData.questions) && docData.questions.length > 0) {
                    testData = { questions: docData.questions };
                    loadedFrom = 'firestore';
                    console.log(`[Review] ✅ Successfully loaded ${docData.questions.length} questions from Firestore document`);
                } else if (Array.isArray(docData) && docData.length > 0) {
                    testData = { questions: docData };
                    loadedFrom = 'firestore';
                    console.log(`[Review] ✅ Successfully loaded ${docData.length} questions from Firestore document`);
                } else {
                    // Try as subcollection
                    const subCollectionRef = collection(db, 'tests', collectionName, 'questions');
                    const subQuerySnapshot = await getDocs(subCollectionRef);
                    
                    if (!subQuerySnapshot.empty) {
                        const questionsArray = [];
                        subQuerySnapshot.forEach((questionDoc) => {
                            questionsArray.push({ id: questionDoc.id, ...questionDoc.data() });
                        });
                        
                        if (questionsArray.length > 0) {
                            testData = { questions: questionsArray };
                            loadedFrom = 'firestore';
                            console.log(`[Review] ✅ Successfully loaded ${questionsArray.length} questions from Firestore subcollection`);
                        }
                    }
                }
            } else {
                // Try as subcollection directly
                const subCollectionRef = collection(db, 'tests', collectionName);
                const subQuerySnapshot = await getDocs(subCollectionRef);
                
                if (!subQuerySnapshot.empty) {
                    const questionsArray = [];
                    subQuerySnapshot.forEach((questionDoc) => {
                        const data = questionDoc.data();
                        if (data.question || data.text) {
                            questionsArray.push({ id: questionDoc.id, ...data });
                        }
                    });
                    
                    if (questionsArray.length > 0) {
                        testData = { questions: questionsArray };
                        loadedFrom = 'firestore';
                        console.log(`[Review] ✅ Successfully loaded ${questionsArray.length} questions from Firestore subcollection`);
                    }
                }
            }
        } catch (firestoreError) {
            console.warn(`[Review] Firestore load failed:`, firestoreError.message);
        }
        
        // Method 2: Try API endpoint if Firestore failed
        if (!testData) {
            try {
                const apiBaseUrl = window.CONFIG?.API_BASE_URL || 
                                    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                                    ? 'http://localhost:5000/api'
                                    : (window.CONFIG?.BACKEND_URL || 'https://your-backend-url.railway.app/api');
                
                const endpointMap = {
                    'Big-Five': 'tests/bigfive',
                    'Holland': 'tests/holland'
                };
                
                const endpoint = endpointMap[testType];
                console.log(`[Review] Attempting to fetch questions from API: ${apiBaseUrl}/${endpoint}`);
                const response = await fetch(`${apiBaseUrl}/${endpoint}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    testData = await response.json();
                    loadedFrom = 'api';
                    console.log(`[Review] ✅ Successfully loaded from API`);
                } else {
                    console.warn(`[Review] API returned ${response.status}, falling back to local JSON file`);
                }
            } catch (apiError) {
                console.warn(`[Review] API fetch failed:`, apiError.message);
                console.log(`[Review] Falling back to local JSON file: ${jsonFileName}`);
            }
        }
        
        // Method 3: Fallback to local JSON file if both Firestore and API failed
        if (!testData) {
            try {
                const jsonPath = `./${jsonFileName}`;
                console.log(`[Review] Loading from local JSON file: ${jsonPath}`);
                const response = await fetch(jsonPath);
                
                if (!response.ok) {
                    throw new Error(`Failed to load local JSON file: ${response.status}`);
                }
                
                testData = await response.json();
                loadedFrom = 'local';
                console.log(`[Review] ✅ Successfully loaded from local JSON file`);
            } catch (jsonError) {
                console.error(`[Review] Failed to load local JSON file:`, jsonError);
                alert(window.i18n?.t('test_failed_load') || "Failed to load test questions. Please check your connection and try again.");
                return;
            }
        }
        
        console.log(`[Review] Questions loaded from: ${loadedFrom}`);
        
        // Handle questions extraction
        questions = testData.questions || testData;
        
        if (Array.isArray(questions)) {
            state.questions = questions;
        } else if (questions && typeof questions === 'object' && questions.questions && Array.isArray(questions.questions)) {
            state.questions = questions.questions;
        } else {
            alert("Invalid test data format.");
            return;
        }
        
        if (!Array.isArray(state.questions) || state.questions.length === 0) {
            alert("Test questions array is empty.");
            return;
        }
        
        console.log(`[Review] ✅ Successfully loaded ${state.questions.length} questions for ${testType}`);

        // 2. Fetch User Results
        const userTestRef = doc(db, 'users', user.uid, 'tests', testType);
        const userTestDoc = await getDoc(userTestRef);
        
        if (!userTestDoc.exists()) {
            alert("No results found for this test.");
            window.location.href = "Test.html"; // Go back to selection
            return;
        }
        
        const userData = userTestDoc.data();
        state.answers = userData.answers || userData.result || {};
        state.elapsedSeconds = userData.timeSpent || userData.totalTime || 0;

        // 3. Setup Review UI
        state.currentQuestionIndex = 0;
        
        elements.selectionView.classList.remove('active');
        elements.selectionView.classList.add('hidden');
        elements.testView.classList.remove('hidden');
        setTimeout(() => elements.testView.classList.add('active'), 50);

        elements.totalQuestions.textContent = state.questions.length;
        
        // Hide Timer or Show "Review Mode"
        if (elements.timerDisplay) {
            elements.timerDisplay.textContent = window.i18n?.t('test_review_mode') || "Review Mode";
        }
        
        renderQuestion();
        // Do NOT start timer

    } catch (error) {
        console.error("Error starting review:", error);
        alert(window.i18n?.t('test_failed_load_review') || "Failed to load review data.");
    }
}

// --- Question Rendering ---
/**
 * Render the current question with answer options
 * This function displays the question and sets up click handlers for answers
 */
function renderQuestion() {
    if (state.questions.length === 0) {
        console.error("[Test] No questions loaded");
        return;
    }

    const question = state.questions[state.currentQuestionIndex];
    if (!question) {
        console.error("[Test] Question not found at index:", state.currentQuestionIndex);
        return;
    }

    console.log(`[Test] Rendering question ${state.currentQuestionIndex + 1}/${state.questions.length}: ${question.id}`);

    // Add fade-out animation before changing content
    if (elements.questionContainer) {
        elements.questionContainer.classList.add('fade-out');
    }

    // Wait for fade-out, then update content and fade-in
    setTimeout(() => {
        const questionText = question.question || question.text || (window.i18n?.t('test_question_not_available') || "Question not available");
        elements.questionText.textContent = questionText;
        elements.currentQuestionNum.textContent = state.currentQuestionIndex + 1;

        // Clear options
        elements.optionsContainer.innerHTML = '';

        const options = question.options || [];
        options.forEach((option, index) => {
            const optionBtn = document.createElement('button');
            optionBtn.className = 'option-btn';
            optionBtn.textContent = option;
            optionBtn.dataset.optionIndex = index;
            optionBtn.dataset.questionId = question.id;
            
            // Check if this option is already selected
            const currentAnswer = state.answers[question.id];
            if (currentAnswer === option) {
                optionBtn.classList.add('selected');
            }
            
            // Add click handler that saves to Firestore and auto-advances
            optionBtn.addEventListener('click', async () => {
                // Prevent duplicate clicks while saving
                if (optionBtn.disabled) {
                    console.log('[Test] Answer already being processed, ignoring click');
                    return;
                }
                
                // Disable all buttons to prevent multiple clicks
                elements.optionsContainer.querySelectorAll('.option-btn').forEach(btn => {
                    btn.disabled = true;
                    btn.style.opacity = '0.6'; // Visual feedback
                });
                
                // Disable Next button during save
                if (elements.nextBtn) {
                    elements.nextBtn.disabled = true;
                }
                
                // Remove selected class from all options
                elements.optionsContainer.querySelectorAll('.option-btn').forEach(btn => {
                    btn.classList.remove('selected');
                });
                
                // Add selected class to clicked option
                optionBtn.classList.add('selected');
                
                // Save answer to state immediately
                state.answers[question.id] = option;
                
                console.log(`[Test] Answer selected for ${question.id}: ${option}`);
                
                // Save to Firestore and auto-advance
                await saveAnswerToFirestore(question.id, option);
            });
            
            elements.optionsContainer.appendChild(optionBtn);
        });

        // Update progress bar with animation
        const progress = ((state.currentQuestionIndex + 1) / state.questions.length) * 100;
        elements.progressBar.style.width = `${progress}%`;

        // Remove fade-out and add fade-in
        if (elements.questionContainer) {
            elements.questionContainer.classList.remove('fade-out');
            elements.questionContainer.classList.add('fade-in');
        }
    }, 150); // Small delay for smooth transition

    // Update navigation buttons
    if (elements.prevBtn) {
        elements.prevBtn.disabled = state.currentQuestionIndex === 0;
    }
    if (elements.nextBtn) {
        const finishText = window.i18n?.t('test_finish_btn') || 'Finish';
        const nextText = window.i18n?.t('test_next') || 'Next';
        elements.nextBtn.textContent = state.currentQuestionIndex === state.questions.length - 1 ? finishText : nextText;
        // Keep Next button visible but disabled during auto-advance
        // User can still use it for manual navigation if needed
        elements.nextBtn.disabled = state.isSavingToFirestore;
    }
}

/**
 * Save answer to Firestore immediately when user selects an option
 * Path: /users/{uid}/tests/{testId}
 * 
 * @param {string} questionId - The ID of the question being answered
 * @param {string} answer - The selected answer value
 */
async function saveAnswerToFirestore(questionId, answer) {
    // Prevent duplicate saves
    if (state.isSavingToFirestore) {
        console.log('[Test] Already saving to Firestore, skipping duplicate save');
        return;
    }
    
    // Check if this question was already answered (prevent duplicates)
    if (state.answeredQuestions.has(questionId)) {
        console.log(`[Test] Question ${questionId} already answered, updating answer`);
    }
    
    const user = auth.currentUser;
    if (!user) {
        console.error('[Test] No authenticated user, cannot save to Firestore');
        // Re-enable buttons if save fails
        elements.optionsContainer.querySelectorAll('.option-btn').forEach(btn => {
            btn.disabled = false;
        });
        return;
    }
    
    state.isSavingToFirestore = true;
    state.answeredQuestions.add(questionId);
    
    try {
        // Firestore path: /users/{uid}/tests/{testId}
        const testDocRef = doc(db, 'users', user.uid, 'tests', state.currentTest);
        
        // Get existing document to merge answers
        const existingDoc = await getDoc(testDocRef);
        const existingData = existingDoc.exists() ? existingDoc.data() : {};
        
        // Prepare answer data with timestamp
        const answerData = {
            [questionId]: {
                answer: answer,
                answeredAt: serverTimestamp(),
                questionIndex: state.currentQuestionIndex
            }
        };
        
        // Merge with existing answers
        const updatedAnswers = {
            ...(existingData.answers || {}),
            ...answerData
        };
        
        // Update or create document
        const testData = {
            testType: state.currentTest,
            answers: updatedAnswers,
            currentQuestionIndex: state.currentQuestionIndex,
            totalQuestions: state.questions.length,
            lastUpdated: serverTimestamp(),
            ...(existingData.startTime ? { startTime: existingData.startTime } : { startTime: serverTimestamp() })
        };
        
        // Use setDoc with merge to update existing or create new
        await setDoc(testDocRef, testData, { merge: true });
        
        console.log(`[Test] ✅ Answer saved to Firestore: /users/${user.uid}/tests/${state.currentTest}`);
        
        // Also save to localStorage as backup
        localStorage.setItem('sia_test_progress', JSON.stringify({
            testType: state.currentTest,
            answers: state.answers,
            currentIndex: state.currentQuestionIndex
        }));
        
        // Auto-advance to next question after successful save
        await autoAdvanceToNextQuestion();
        
    } catch (error) {
        console.error('[Test] ❌ Error saving answer to Firestore:', error);
        // Re-enable buttons on error so user can try again
        elements.optionsContainer.querySelectorAll('.option-btn').forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1'; // Restore opacity
        });
        
        // Re-enable Next button
        if (elements.nextBtn) {
            elements.nextBtn.disabled = false;
        }
        
        // Remove from answered set so user can retry
        state.answeredQuestions.delete(questionId);
    } finally {
        state.isSavingToFirestore = false;
    }
}

/**
 * Automatically advance to the next question after answer is saved
 * If it's the last question, finish the test instead
 */
async function autoAdvanceToNextQuestion() {
    // Small delay for visual feedback (user sees their selection)
    await new Promise(resolve => setTimeout(resolve, 800));
    
    if (state.currentQuestionIndex < state.questions.length - 1) {
        // Move to next question
        state.currentQuestionIndex++;
        if (state.currentQuestionIndex > state.maxReachedIndex) {
            state.maxReachedIndex = state.currentQuestionIndex;
        }
        
        console.log(`[Test] ✅ Auto-advancing to question ${state.currentQuestionIndex + 1}/${state.questions.length}`);
        
        // Re-enable Next button for manual navigation
        if (elements.nextBtn) {
            elements.nextBtn.disabled = false;
        }
        
        renderQuestion();
    } else {
        // Last question answered, finish the test
        console.log('[Test] ✅ Last question answered, finishing test');
        finishTest();
    }
}

/**
 * Legacy saveAnswer function for backward compatibility
 * Now primarily used for localStorage backup
 */
function saveAnswer() {
    // Save to localStorage as backup
    localStorage.setItem('sia_test_progress', JSON.stringify({
        testType: state.currentTest,
        answers: state.answers,
        currentIndex: state.currentQuestionIndex
    }));
}

// --- Timer Functions ---
function startTimer() {
    if (state.isTimerRunning) return;
    
    state.isTimerRunning = true;
    state.startTime = Date.now() - (state.elapsedSeconds * 1000);
    
    state.timerInterval = setInterval(() => {
        state.elapsedSeconds = Math.floor((Date.now() - state.startTime) / 1000);
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }
    state.isTimerRunning = false;
}

function updateTimerDisplay() {
    if (elements.timerDisplay) {
        const hours = Math.floor(state.elapsedSeconds / 3600);
        const minutes = Math.floor((state.elapsedSeconds % 3600) / 60);
        const seconds = state.elapsedSeconds % 60;
        elements.timerDisplay.textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

function handleVisibilityChange() {
    if (document.hidden) {
        // Page is hidden, pause timer
        if (state.isTimerRunning && state.startTime) {
            state.elapsedSeconds = Math.floor((Date.now() - state.startTime) / 1000);
            stopTimer();
        }
    } else {
        // Page is visible, resume timer
        if (!state.isTimerRunning && state.startTime) {
            state.startTime = Date.now() - (state.elapsedSeconds * 1000);
            startTimer();
        }
    }
}

function reviewAnswersFromResults() {
    state.isReviewMode = true;
    
    // Go back to test view
    elements.resultView.classList.remove('active');
    elements.resultView.classList.add('hidden');
    
    elements.testView.classList.remove('hidden');
    setTimeout(() => elements.testView.classList.add('active'), 50);
    
    state.currentQuestionIndex = 0;
    renderQuestion(); 
}

function finishTest() {
    // Prevent duplicate submissions
    if (state.isSaving) {
        console.log("Test result is already being saved. Please wait...");
        return;
    }

    stopTimer();
    localStorage.removeItem('sia_test_progress');

    const totalTime = state.elapsedSeconds;
    const finalResult = state.answers;
    const currentTestType = state.currentTest;

    // Validate that we have answers
    if (!currentTestType || Object.keys(finalResult).length === 0) {
        alert("Error: No test data to save. Please complete the test first.");
        return;
    }

    saveTestResult(currentTestType, finalResult, totalTime);
}

/**
 * Save test result with instant result generation
 * Shows results immediately after calculation, then saves to Firestore
 * FIXED: Uses modular SDK for all Firebase operations
 */
async function saveTestResult(testType, resultData, totalTime) {
    if (state.isSaving) {
        console.log("Already saving test result. Ignoring duplicate call.");
        return;
    }
    state.isSaving = true;

    // FIXED: Use modular SDK auth
    const user = auth.currentUser;
    if (!user) {
        state.isSaving = false;
        alert("You must be logged in!");
        return;
    }

    const finishBtn = elements.finishBtn;
    if (finishBtn) {
        finishBtn.disabled = true;
        const processingText = window.i18n?.t('test_processing') || 'Processing...';
        finishBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-2"></i>${processingText}`;
    }

    try {
        console.log(`[Test] Starting test result save for ${testType}`);
        console.log(`[Test] Total answers: ${Object.keys(resultData).length}, Time: ${totalTime}s`);
        
        // Show loading animation in result view
        showResultLoading();

        // Step 1: Calculate scores client-side using the questions we already have
        let calculatedResults = {};
        let analysis = { message: 'Results calculated successfully.' };
        
        try {
            if (!state.questions || state.questions.length === 0) {
                throw new Error('Questions array is empty. Cannot calculate scores.');
            }
            
            calculatedResults = calculateScores(testType, resultData, state.questions);
            console.log('[Test] ✅ Scores calculated client-side:', calculatedResults);
            
        } catch (calcError) {
            console.error('[Test] ❌ Error calculating scores:', calcError);
            analysis = { 
                message: 'Score calculation encountered an error. Results may be incomplete.',
                error: calcError.message 
            };
            // Continue with empty results - user can still see their answers
        }
        
        // Step 2: Show results immediately to user
        displayInstantResults(testType, calculatedResults, analysis);
        
        // Update result view
        elements.testView.classList.remove('active');
        elements.testView.classList.add('hidden');
        elements.resultView.classList.remove('hidden');
        setTimeout(() => elements.resultView.classList.add('active'), 50);

        // Update finish button to show saving state
        if (finishBtn) {
            finishBtn.disabled = true;
            const savingText = window.i18n?.t('test_saving') || 'Saving...';
            finishBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${savingText}`;
        }

        // Step 3: Save everything directly to Firestore (no backend API calls)
        try {
            const testDocRef = doc(db, 'users', user.uid, 'tests', testType);
            
            // Prepare complete test result data
            const testResultData = {
                testType: testType,
                answers: resultData, // All individual answers
                results: calculatedResults, // Calculated scores
                analysis: analysis, // Analysis message
                timeSpent: totalTime,
                totalTime: totalTime,
                totalQuestions: state.questions.length,
                answeredQuestions: Object.keys(resultData).length,
                completedAt: serverTimestamp(),
                lastUpdated: serverTimestamp()
            };
            
            // Preserve startTime if it exists
            const existingDoc = await getDoc(testDocRef);
            if (existingDoc.exists()) {
                const existingData = existingDoc.data();
                if (existingData.startTime) {
                    testResultData.startTime = existingData.startTime;
                }
            } else if (state.startTime) {
                testResultData.startTime = new Date(state.startTime).toISOString();
            }
            
            // Save to Firestore (merge to preserve any existing data)
            await setDoc(testDocRef, testResultData, { merge: true });
            
            console.log(`[Test] ✅ Test result saved to Firestore: /users/${user.uid}/tests/${testType}`);
            
            // Show success notification
            showSaveSuccess();
            
            // Check if both tests are complete and trigger Gemini analysis (if needed)
            try {
                await checkAndTriggerGeminiAnalysis(user.uid);
            } catch (geminiError) {
                // Gemini analysis is optional, don't block on this
                console.warn('[Test] Gemini analysis check failed (non-critical):', geminiError);
            }
            
        } catch (saveError) {
            console.error('[Test] ❌ Error saving test result to Firestore:', saveError);
            const errorMsg = window.i18n?.t('test_save_error') || 'Failed to save result: ';
            alert(errorMsg + saveError.message);
            // Don't throw - user can still see their results
        }

        state.isSaving = false;
        
        // Update finish button
        if (finishBtn) {
            finishBtn.disabled = false;
            const viewProfileText = window.i18n?.t('test_view_profile') || 'View Profile';
            finishBtn.innerHTML = viewProfileText;
            finishBtn.onclick = () => {
                window.location.href = "../profile/profile.html";
            };
        }

    } catch (error) {
        console.error("Error saving test:", error);
        state.isSaving = false;
        
        if (finishBtn) {
            finishBtn.disabled = false;
            finishBtn.innerHTML = 'Finish & Save';
        }
        
        alert("Failed to save result: " + error.message);
        hideResultLoading();
    }
}

/**
 * Show loading animation in result view
 */
function showResultLoading() {
    if (elements.resultView) {
        elements.resultView.classList.remove('hidden');
        elements.resultView.innerHTML = `
            <div class="text-center p-5">
                <i class="fas fa-spinner fa-spin fa-3x text-gold mb-3"></i>
                <h4 class="text-gold">Generating Your Results...</h4>
                <p class="text-muted">This may take a few seconds</p>
            </div>
        `;
    }
}

/**
 * Hide loading animation
 */
function hideResultLoading() {
    // Loading is hidden when results are displayed
}

/**
 * Show success message after saving test result
 */
function showSaveSuccess() {
    // Create a temporary success notification
    const successMsg = document.createElement('div');
    successMsg.className = 'save-success-notification';
    successMsg.innerHTML = `
        <div class="save-success-content">
            <i class="fas fa-check-circle"></i>
            <span>Test results saved successfully!</span>
        </div>
    `;
    successMsg.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #D4AF37, #f4d03f);
        color: #000;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(212, 175, 55, 0.4);
        z-index: 10000;
        animation: slideInRight 0.3s ease-out;
        font-weight: 600;
    `;
    
    document.body.appendChild(successMsg);
    
    // Remove after 3 seconds
    setTimeout(() => {
        successMsg.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
            if (successMsg.parentNode) {
                successMsg.parentNode.removeChild(successMsg);
            }
        }, 300);
    }, 3000);
}

// Add CSS animations for success notification (only once)
if (!document.getElementById('save-success-styles')) {
    const style = document.createElement('style');
    style.id = 'save-success-styles';
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        .save-success-content {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .save-success-content i {
            font-size: 1.2rem;
        }
    `;
    document.head.appendChild(style);
}


/**
 * Display instant results after calculation
 * Uses inline styles to avoid modifying CSS files
 */
function displayInstantResults(testType, results, analysis) {
    if (!elements.resultView) return;

    // Inline styles for result display (to avoid modifying CSS files)
    const resultCardStyle = 'background: #0a0a0a; border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 16px; padding: 2rem; margin: 2rem 0;';
    const resultsGridStyle = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin: 2rem 0;';
    const resultItemStyle = 'background: rgba(212, 175, 55, 0.05); padding: 1rem; border-radius: 8px; border: 1px solid rgba(212, 175, 55, 0.2);';
    const resultLabelStyle = 'color: #d4af37; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem;';
    const resultValueStyle = 'color: #fff; font-size: 1.5rem; font-weight: 700; margin: 0.5rem 0;';
    const resultBarStyle = 'background: rgba(255, 255, 255, 0.1); height: 8px; border-radius: 4px; overflow: hidden; margin-top: 0.5rem;';
    const resultBarFillStyle = 'background: linear-gradient(90deg, #d4af37, #f4d03f); height: 100%; transition: width 0.3s ease;';
    const analysisSectionStyle = 'margin-top: 2rem; padding-top: 2rem; border-top: 1px solid rgba(212, 175, 55, 0.2);';

    let resultHTML = '';

    if (testType === 'Big-Five') {
        const labels = {
            'O': 'Openness',
            'C': 'Conscientiousness',
            'E': 'Extraversion',
            'A': 'Agreeableness',
            'N': 'Neuroticism'
        };
        
        resultHTML = `
            <div style="${resultCardStyle}">
                <h3 style="color: #d4af37; margin-bottom: 2rem; text-align: center; font-size: 2rem;">Big Five Personality Results</h3>
                <div style="${resultsGridStyle}">
                    ${Object.keys(results).map(key => `
                        <div style="${resultItemStyle}">
                            <div style="${resultLabelStyle}">${labels[key] || key}</div>
                            <div style="${resultValueStyle}">${results[key]}%</div>
                            <div style="${resultBarStyle}">
                                <div class="result-bar-fill" style="${resultBarFillStyle} width: ${results[key]}%"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                ${analysis ? `
                    <div style="${analysisSectionStyle}">
                        <h4 style="color: #d4af37; margin-bottom: 1rem;">Analysis</h4>
                        <p style="color: rgba(255, 255, 255, 0.8); line-height: 1.6;">${analysis.personalityAnalysis || 'Analysis generated successfully.'}</p>
                    </div>
                ` : ''}
            </div>
        `;
    } else if (testType === 'Holland' || testType === 'Holland-codes') {
        const labels = {
            'R': 'Realistic',
            'I': 'Investigative',
            'A': 'Artistic',
            'S': 'Social',
            'E': 'Enterprising',
            'C': 'Conventional'
        };
        
        resultHTML = `
            <div style="${resultCardStyle}">
                <h3 style="color: #d4af37; margin-bottom: 2rem; text-align: center; font-size: 2rem;">Holland Codes Results</h3>
                <div style="${resultsGridStyle}">
                    ${Object.keys(results).map(key => `
                        <div style="${resultItemStyle}">
                            <div style="${resultLabelStyle}">${labels[key] || key}</div>
                            <div style="${resultValueStyle}">${results[key]}%</div>
                            <div style="${resultBarStyle}">
                                <div class="result-bar-fill" style="${resultBarFillStyle} width: ${results[key]}%"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                ${analysis ? `
                    <div style="${analysisSectionStyle}">
                        <h4 style="color: #d4af37; margin-bottom: 1rem;">Analysis</h4>
                        <p style="color: rgba(255, 255, 255, 0.8); line-height: 1.6;">
                            ${analysis.typeExplanation || analysis.personalityAnalysis || 'Analysis generated successfully.'}
                        </p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    if (elements.resultView) {
        elements.resultView.innerHTML = resultHTML;
    }

    // Add event listener for profile button
    const profileBtn = document.getElementById('viewProfileBtn');
    if (profileBtn) {
        profileBtn.addEventListener('click', () => {
            window.location.href = "../profile/profile.html";
        });
    }
}

/**
 * Save test results to Firestore
 * FIXED: Uses modular SDK and saves to correct Firestore paths
 * Path: /users/{uid}/tests/{testType}
 */
/**
 * Save test result to Firestore via backend API
 * FIXED: Uses backend endpoint instead of client-side Firestore
 */
/**
 * Save test result to backend Firestore
 * Path: /users/{userId}/tests/{testName}
 * 
 * @param {string} userId - User's Firebase UID
 * @param {string} testName - Test type (Big-Five or Holland)
 * @param {object} resultData - Complete test result data including answers, results, analysis, etc.
 * @returns {Promise<object>} Success response from backend
 */
/**
 * This function has been removed - all test results are now saved directly to Firestore
 * No backend API calls are needed for saving test results
 */

/**
 * Check if both tests are complete and trigger Gemini analysis
 */
async function checkAndTriggerGeminiAnalysis(userId) {
    try {
        console.log('[Gemini] Checking if both tests are complete...');
        
        // Fetch both test results from Firestore
        const bigFiveRef = doc(db, 'users', userId, 'tests', 'Big-Five');
        const hollandRef = doc(db, 'users', userId, 'tests', 'Holland');
        
        const [bigFiveSnap, hollandSnap] = await Promise.all([
            getDoc(bigFiveRef),
            getDoc(hollandRef)
        ]);
        
        if (!bigFiveSnap.exists() || !hollandSnap.exists()) {
            console.log('[Gemini] Both tests not complete yet. Big-Five:', bigFiveSnap.exists(), 'Holland:', hollandSnap.exists());
            return;
        }
        
        console.log('[Gemini] Both tests complete! Triggering analysis...');
        
        // Get test results
        const bigFiveData = bigFiveSnap.data();
        const hollandData = hollandSnap.data();
        
        // Prepare combined results
        const combinedResults = {
            bigfive: bigFiveData.results || bigFiveData.result || bigFiveData,
            holland: hollandData.results || hollandData.result || hollandData
        };
        
        // Save combined results to Firestore for potential Cloud Function processing
        // This allows a Cloud Function to trigger Gemini analysis later if needed
        const analysisRef = doc(db, 'users', userId, 'analysis', 'combined');
        await setDoc(analysisRef, {
            combinedResults: combinedResults,
            bigFiveCompleted: bigFiveData.completedAt || serverTimestamp(),
            hollandCompleted: hollandData.completedAt || serverTimestamp(),
            lastUpdated: serverTimestamp(),
            status: 'pending' // Can be processed by Cloud Function
        }, { merge: true });
        
        console.log('[Gemini] ✅ Combined results saved to Firestore for analysis');
        console.log('[Gemini] Note: Gemini analysis can be triggered by a Cloud Function if configured');
        
        // Note: Gemini analysis via API has been removed - use Cloud Functions if needed
        
    } catch (error) {
        console.error('[Gemini] ❌ Error triggering analysis:', error);
        // Don't show error to user - analysis can be triggered manually later
    }
}

/**
 * Show notification that Gemini analysis is complete
 */
function showGeminiAnalysisComplete() {
    const notification = document.createElement('div');
    notification.className = 'gemini-analysis-notification';
    notification.innerHTML = `
        <div class="gemini-notification-content">
            <i class="fas fa-check-circle"></i>
            <span>Career analysis complete! Check your profile for job recommendations.</span>
        </div>
    `;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #4CAF50, #45a049);
        color: #fff;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(76, 175, 80, 0.4);
        z-index: 10001;
        animation: slideInRight 0.3s ease-out;
        font-weight: 600;
        max-width: 400px;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}
