// Test.js - Refactored for Firebase Modular SDK (v9+)
// FIXED: Uses modular SDK imports and proper Firebase initialization
// Includes JSON Validation, Retake Prevention, and Review Mode

// FIXED: Import Firebase services from firebase-config.js
import { app, auth, db, storage } from '../firebase-config.js';
import { 
    collection, 
    doc, 
    getDoc, 
    setDoc, 
    serverTimestamp,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged as onAuthStateChangedAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

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
    isSaving: false // Flag to prevent duplicate submissions
};

/**
 * Submit test data to the standalone Express server endpoint
 * This is a utility function that can be used as an alternative or fallback
 * to Firebase Functions for test submissions
 */
async function submitTestToServer(testType, resultData, totalTime) {
    try {
        const serverUrl = window.CONFIG?.SERVER_BASE_URL || 
                         (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                         ? 'http://localhost:5000'
                         : window.location.origin;
        
        const response = await fetch(`${serverUrl}/submit-test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                testType: testType,
                answers: resultData,
                totalTime: totalTime,
                timestamp: new Date().toISOString()
            })
        });

        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Test submitted to server successfully:', data);
        return data;
    } catch (error) {
        console.error('Error submitting test to server:', error);
        throw error;
    }
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
    // FIXED: Wait for Firebase to initialize properly
    function waitForFirebase() {
        if (window.firebaseApp && window.db && window.auth) {
            init();
        } else {
            console.log('Waiting for Firebase initialization...');
            setTimeout(waitForFirebase, 100);
        }
    }
    waitForFirebase();
});

function init() {
    checkAuth();
    setupEventListeners();
    checkUrlParams(); // Check for Review Mode
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
    // Test Selection
    elements.testCards.forEach(card => {
        card.addEventListener('click', () => {
            const testType = card.dataset.testType;
            if (testType) {
                startTest(testType);
            }
        });
    });

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
// FIXED: Uses modular SDK to fetch questions from Firestore
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
        alert("Please sign in to start the test.");
        return;
    }

    // FIXED: Use modular SDK Firestore with app instance
    try {
        // 1. Check if user already completed this test
        const userTestRef = doc(db, 'users', user.uid, 'tests', testType);
        const userTestSnap = await getDoc(userTestRef);

        if (userTestSnap.exists()) {
            const confirmReview = confirm("You have already completed this test. Would you like to review your answers instead?");
            if (confirmReview) {
                startReview(testType);
            }
            return; // Stop here, do not start new test
        }

        // 2. Fetch Test Data from Firestore
        // FIXED: Fetch from /tests/Big-Five or /tests/Holland
        const testDocRef = doc(db, 'tests', testType);
        const testDoc = await getDoc(testDocRef);
        
        if (!testDoc.exists()) {
            throw new Error(`Test "${testType}" not found in Firestore.`);
        }
        
        const testData = testDoc.data();
        
        // 3. JSON Validation
        if (!testData.questions || !Array.isArray(testData.questions) || testData.questions.length === 0) {
            throw new Error("Invalid test data format: 'questions' array missing or empty.");
        }

        state.questions = testData.questions;
        
        // Reset State
        state.currentQuestionIndex = 0;
        state.maxReachedIndex = 0;
        state.answers = {};
        state.elapsedSeconds = 0;
        
        // Switch View
        elements.selectionView.classList.remove('active');
        elements.selectionView.classList.add('hidden');
        elements.testView.classList.remove('hidden');
        setTimeout(() => elements.testView.classList.add('active'), 50);
        
        // Initialize UI
        elements.totalQuestions.textContent = state.questions.length;
        renderQuestion();
        startTimer();
    } catch (error) {
        console.error("Error starting test:", error);
        alert("Failed to load the test. Please try again later.");
    }
}

// FIXED: Uses modular SDK to fetch questions and results
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

    // FIXED: Use modular SDK Firestore with app instance
    try {
        // 1. Fetch Questions from Firestore
        const testDocRef = doc(db, 'tests', testType);
        const testDoc = await getDoc(testDocRef);
        
        if (!testDoc.exists()) {
            alert("Test data not found.");
            return;
        }
        
        const testData = testDoc.data();
        if (!testData.questions || !Array.isArray(testData.questions)) {
            alert("Invalid test data.");
            return;
        }
        state.questions = testData.questions;

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
            elements.timerDisplay.textContent = "Review Mode";
        }
        
        renderQuestion();
        // Do NOT start timer

    } catch (error) {
        console.error("Error starting review:", error);
        alert("Failed to load review data.");
    }
}

// --- Question Rendering ---
function renderQuestion() {
    if (state.questions.length === 0) {
        console.error("No questions loaded");
        return;
    }

    const question = state.questions[state.currentQuestionIndex];
    if (!question) {
        console.error("Question not found at index:", state.currentQuestionIndex);
        return;
    }

    elements.questionText.textContent = question.question || question.text || "Question not available";
    elements.currentQuestionNum.textContent = state.currentQuestionIndex + 1;

    // Clear options
    elements.optionsContainer.innerHTML = '';

    const options = question.options || [];
    options.forEach((option, index) => {
        const optionBtn = document.createElement('button');
        optionBtn.className = 'option-btn';
        optionBtn.textContent = option;
        optionBtn.dataset.optionIndex = index;
        
        // Check if this option is already selected
        const currentAnswer = state.answers[question.id];
        if (currentAnswer === option) {
            optionBtn.classList.add('selected');
        }
        
        optionBtn.addEventListener('click', () => {
            // Remove selected class from all options
            elements.optionsContainer.querySelectorAll('.option-btn').forEach(btn => {
                btn.classList.remove('selected');
            });
            // Add selected class to clicked option
            optionBtn.classList.add('selected');
            // Save answer
            state.answers[question.id] = option;
        });
        
        elements.optionsContainer.appendChild(optionBtn);
    });

    // Update progress bar
    const progress = ((state.currentQuestionIndex + 1) / state.questions.length) * 100;
    elements.progressBar.style.width = `${progress}%`;

    // Update navigation buttons
    if (elements.prevBtn) {
        elements.prevBtn.disabled = state.currentQuestionIndex === 0;
    }
    if (elements.nextBtn) {
        elements.nextBtn.textContent = state.currentQuestionIndex === state.questions.length - 1 ? 'Finish' : 'Next';
    }
}

function saveAnswer() {
    // Answers are saved immediately when option is clicked
    // This function can be used for additional processing if needed
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
        finishBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Processing...';
    }

    try {
        // Show loading animation in result view
        showResultLoading();

        // Get auth token
        const token = await user.getIdToken();
        
        // Determine endpoint
        let endpoint = '';
        if (testType === 'Big-Five') {
            endpoint = '/api/bigfive';
        } else if (testType === 'Holland' || testType === 'Holland-codes') {
            endpoint = '/api/holland';
        } else {
            throw new Error("Unknown test type: " + testType);
        }

        // Try Firebase Functions first (primary method)
        let response;
        let data;
        
        try {
            response = await fetch(endpoint, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    answers: resultData
                })
            });

            if (!response.ok) {
                throw new Error('Network response was not ok: ' + response.statusText);
            }

            data = await response.json();
        } catch (firebaseError) {
            console.warn('Firebase Functions failed, trying standalone server:', firebaseError);
            
            // Fallback to standalone server endpoint
            try {
                const serverData = await submitTestToServer(testType, resultData, totalTime);
                // If server submission succeeds but doesn't return results, use a basic response
                data = {
                    results: resultData, // Use raw answers as results
                    analysis: { message: 'Test submitted successfully. Results will be processed.' }
                };
                console.log('Test submitted to standalone server as fallback');
            } catch (serverError) {
                // If both fail, throw the original Firebase error
                throw firebaseError;
            }
        }
        
        // Show results immediately
        displayInstantResults(testType, data.results, data.analysis);
        
        // Update result view
        elements.testView.classList.remove('active');
        elements.testView.classList.add('hidden');
        elements.resultView.classList.remove('hidden');
        setTimeout(() => elements.resultView.classList.add('active'), 50);

        // FIXED: Save to Firestore using modular SDK
        // Save to /users/{uid}/tests/{testType}
        await saveResultsToFirestore(user.uid, testType, data.results, data.analysis, resultData, totalTime);

        state.isSaving = false;
        
        // Show success message
        if (finishBtn) {
            finishBtn.disabled = false;
            finishBtn.innerHTML = 'View Profile';
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
    // Loading will be replaced by results
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
async function saveResultsToFirestore(uid, testType, results, analysis, answers, totalTime) {
    try {
        // FIXED: Use modular SDK Firestore with app instance
        // Save to /users/{uid}/tests/{testType}
        const userTestRef = doc(db, 'users', uid, 'tests', testType);
        
        await setDoc(userTestRef, {
            result: results,
            analysis: analysis,
            answers: answers, // Store original answers
            timestamp: serverTimestamp(),
            completedAt: serverTimestamp(),
            testType: testType,
            timeSpent: totalTime,
            totalTime: totalTime
        }, { merge: true });

        console.log('Test results saved to Firestore successfully');
    } catch (error) {
        console.error('Error saving results to Firestore:', error);
        throw error;
    }
}
