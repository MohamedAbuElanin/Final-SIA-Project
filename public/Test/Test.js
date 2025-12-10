// Test.js - Refactored for Firebase Compat SDK
// Includes JSON Validation, Retake Prevention, and Review Mode

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
    // Wait for Firebase to initialize
    setTimeout(() => {
        if (window.firebase) {
            init();
        } else {
            console.error("Firebase not initialized!");
            alert("System error: Firebase not connected.");
        }
    }, 1000);
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
            console.log("User not logged in, redirecting...");
            window.location.href = "../sign in/signin.html";
        } else {
            console.log("User authenticated:", user.email);
        }
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
        const startBtn = card.querySelector('.btn-start');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                const testType = card.dataset.test;
                startTest(testType);
            });
        }
    });

    // Navigation
    if (elements.prevBtn) {
        elements.prevBtn.addEventListener('click', prevQuestion);
    }
    if (elements.nextBtn) {
        elements.nextBtn.addEventListener('click', nextQuestion);
    }

    // Results
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
async function startTest(testType) {
    // Normalize Holland Codes ID
    if (testType === 'Holland-codes') {
        testType = 'Holland';
    }

    state.currentTest = testType;
    state.isReviewMode = false;
    console.log("Starting test:", testType);

    const user = firebase.auth().currentUser;
    if (!user) {
        alert("Please sign in to start the test.");
        return;
    }

    const db = firebase.firestore();

    // 1. Check if user already completed this test
    try {
        const userTestRef = db.collection("users").doc(user.uid).collection("tests").doc(testType);
        const userTestSnap = await userTestRef.get();

        if (userTestSnap.exists) {
            const confirmReview = confirm("You have already completed this test. Would you like to review your answers instead?");
            if (confirmReview) {
                startReview(testType);
            }
            return; // Stop here, do not start new test
        }
    } catch (error) {
        console.error("Error checking previous results:", error);
        // Continue if check fails? Or block? Safer to block or warn.
        // Let's continue but log error.
    }

    // 2. Fetch Test Data
    db.collection("tests").doc(testType).get()
        .then((doc) => {
            if (!doc.exists) {
                throw new Error(`Test "${testType}" not found in Firestore.`);
            }
            
            const data = doc.data();
            
            // 3. JSON Validation
            if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
                throw new Error("Invalid test data format: 'questions' array missing or empty.");
            }

            state.questions = data.questions;
            
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
        })
        .catch((error) => {
            console.error("Error starting test:", error);
            alert("Failed to load the test. Please try again later.");
        });
}

async function startReview(testType) {
    // Normalize Holland Codes ID
    if (testType === 'Holland-codes') {
        testType = 'Holland';
    }

    state.currentTest = testType;
    state.isReviewMode = true;
    console.log("Starting review:", testType);

    const user = firebase.auth().currentUser;
    if (!user) {
        // If called from URL param and auth not ready yet, wait/retry logic is handled by checkAuth redirect
        // But here we might be in the flow.
        // checkAuth handles redirect.
        return;
    }

    const db = firebase.firestore();

    try {
        // 1. Fetch Questions
        const testDoc = await db.collection("tests").doc(testType).get();
        if (!testDoc.exists) {
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
        const userTestDoc = await db.collection("users").doc(user.uid).collection("tests").doc(testType).get();
        if (!userTestDoc.exists) {
            alert("No results found for this test.");
            window.location.href = "Test.html"; // Go back to selection
            return;
        }
        const userData = userTestDoc.data();
        state.answers = userData.result || {};
        state.elapsedSeconds = userData.timeSpent || 0;

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
        alert("Failed to load review mode.");
    }
}

function renderQuestion() {
    const question = state.questions[state.currentQuestionIndex];
    const hasAnswer = !!state.answers[question.id];
    
    // Update Progress
    elements.currentQuestionNum.textContent = state.currentQuestionIndex + 1;
    const progressPercent = ((state.currentQuestionIndex) / state.questions.length) * 100;
    elements.progressBar.style.width = `${progressPercent}%`;
    
    // Render Text
    elements.questionText.textContent = question.question;
    
    // Render Options
    elements.optionsContainer.innerHTML = '';
    
    question.options.forEach(option => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = option;
        
        // Check if selected
        if (state.answers[question.id] === option) {
            btn.classList.add('selected');
        }
        
        // Review Mode / Read-Only Logic
        if (state.isReviewMode) {
            btn.style.pointerEvents = 'none'; // Disable clicking
            if (state.answers[question.id] !== option) {
                btn.style.opacity = '0.5'; // Dim non-selected
            }
        } else {
            // Normal Test Mode
            if (hasAnswer) {
                if (state.answers[question.id] === option) {
                    btn.classList.add('selected');
                }
            } 
            btn.addEventListener('click', () => selectAnswer(question.id, option));
        }
        
        elements.optionsContainer.appendChild(btn);
    });
    
    // Update Previous Button
    if (elements.prevBtn) {
        elements.prevBtn.disabled = state.currentQuestionIndex === 0;
    }

    // Update Next Button
    if (elements.nextBtn) {
        elements.nextBtn.style.display = 'block';
        // In review mode, always enabled. In test mode, enabled if answered.
        elements.nextBtn.disabled = state.isReviewMode ? false : !hasAnswer;
        
        // If last question
        if (state.currentQuestionIndex === state.questions.length - 1) {
             if (state.isReviewMode) {
                 elements.nextBtn.textContent = "Back to Profile";
             } else {
                 elements.nextBtn.textContent = "Finish";
             }
        } else {
            elements.nextBtn.textContent = "Next";
        }
    }
    
    // Ensure container is visible and reset animation classes
    elements.questionContainer.classList.remove('fade-out');
    elements.questionContainer.classList.add('fade-in');
}

function selectAnswer(questionId, answer) {
    if (state.isReviewMode) return; // Double check

    // Save to state
    state.answers[questionId] = answer;
    
    // Update max reached index
    if (state.currentQuestionIndex > state.maxReachedIndex) {
        state.maxReachedIndex = state.currentQuestionIndex;
    }
    
    // Save to local storage
    saveProgress();
    
    // Visual feedback
    const buttons = elements.optionsContainer.querySelectorAll('.option-btn');
    buttons.forEach(btn => {
        if (btn.textContent === answer) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });

    // Enable Next button
    if (elements.nextBtn) {
        elements.nextBtn.disabled = false;
    }

    // Auto-Next with Animation
    setTimeout(() => {
        if (state.currentQuestionIndex < state.questions.length - 1) {
            // Fade out
            elements.questionContainer.classList.remove('fade-in');
            elements.questionContainer.classList.add('fade-out');
            
            setTimeout(() => {
                nextQuestion();
            }, 300);
        } else {
            // Last question - Wait for user to click Finish manually or auto-finish?
            // Usually auto-finish is risky if they want to change.
            // Let's just stay here.
        }
    }, 500);
}

function nextQuestion() {
    if (state.currentQuestionIndex < state.questions.length - 1) {
        state.currentQuestionIndex++;
        renderQuestion();
    } else {
        if (state.isReviewMode) {
            // Go back to profile
            window.location.href = "../profile/profile.html";
        } else {
            completeTest();
        }
    }
}

function prevQuestion() {
    if (state.currentQuestionIndex > 0) {
        elements.questionContainer.classList.remove('fade-in');
        elements.questionContainer.classList.add('fade-out');
        
        setTimeout(() => {
            state.currentQuestionIndex--;
            renderQuestion();
        }, 300);
    }
}

// --- Timer Logic ---
function startTimer() {
    if (state.isTimerRunning || state.isReviewMode) return;
    
    state.isTimerRunning = true;
    state.startTime = Date.now() - (state.elapsedSeconds * 1000);
    
    state.timerInterval = setInterval(() => {
        const now = Date.now();
        state.elapsedSeconds = Math.floor((now - state.startTime) / 1000);
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    state.isTimerRunning = false;
    clearInterval(state.timerInterval);
}

function updateTimerDisplay() {
    const minutes = Math.floor(state.elapsedSeconds / 60);
    const seconds = state.elapsedSeconds % 60;
    if (elements.timerDisplay) {
        elements.timerDisplay.textContent = `${pad(minutes)}:${pad(seconds)}`;
    }
}

function pad(num) {
    return num.toString().padStart(2, '0');
}

function handleVisibilityChange() {
    if (state.isReviewMode) return;

    if (document.hidden) {
        stopTimer();
    } else {
        if (!elements.testView.classList.contains('hidden')) {
            startTimer();
        }
    }
}

// --- Completion & Storage ---
function saveProgress() {
    if (state.isReviewMode) return;

    const progress = {
        testType: state.currentTest,
        answers: state.answers,
        elapsedSeconds: state.elapsedSeconds,
        timestamp: Date.now()
    };
    localStorage.setItem('sia_test_progress', JSON.stringify(progress));
}

function completeTest() {
    stopTimer();
    
    // Update Progress Bar to 100%
    elements.progressBar.style.width = '100%';
    
    // Show Result View
    elements.testView.classList.remove('active');
    elements.testView.classList.add('hidden');
    
    elements.resultView.classList.remove('hidden');
    setTimeout(() => elements.resultView.classList.add('active'), 50);
    
    // Display Time
    const minutes = Math.floor(state.elapsedSeconds / 60);
    const seconds = state.elapsedSeconds % 60;
    elements.finalTime.textContent = `${minutes}m ${seconds}s`;
}

function reviewAnswersFromResults() {
    // This is called immediately after finishing the test, before saving?
    // Or after saving?
    // The requirement says "Review Answers Mode... Allow the user to review answers after completing a test."
    // If they click "Review Answers" from the result card, we just switch back to test view in review mode.
    
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
 */
async function saveTestResult(testType, resultData, totalTime) {
    if (state.isSaving) {
        console.log("Already saving test result. Ignoring duplicate call.");
        return;
    }
    state.isSaving = true;

    const user = firebase.auth().currentUser;
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

        // Send to API for calculation and saving
        const response = await fetch(endpoint, {
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

        const data = await response.json();
        
        // Show results immediately
        displayInstantResults(testType, data.results, data.analysis);
        
        // Update result view
        elements.testView.classList.remove('active');
        elements.testView.classList.add('hidden');
        elements.resultView.classList.remove('hidden');
        setTimeout(() => elements.resultView.classList.add('active'), 50);

        // Save to Firestore under users/{uid}/results/{testType}
        await saveResultsToFirestore(user.uid, testType, data.results, data.analysis, totalTime);

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
    const resultBarFillStyle = 'background: linear-gradient(90deg, #d4af37, #f4d03f); height: 100%; transition: width 0.5s ease;';
    const analysisSectionStyle = 'margin-top: 2rem; padding: 1.5rem; background: rgba(212, 175, 55, 0.05); border-radius: 8px; border-left: 3px solid #d4af37;';
    const btnStyle = 'background: #d4af37; color: #000; border: none; padding: 0.75rem 2rem; border-radius: 8px; font-weight: 600; font-size: 1.1rem; cursor: pointer; transition: all 0.3s ease; margin-top: 2rem;';
    const btnHoverStyle = 'background: #b5952f; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);';

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
                        <p style="color: rgba(255, 255, 255, 0.8); line-height: 1.6;">${analysis.typeExplanation || 'Analysis generated successfully.'}</p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    elements.resultView.innerHTML = resultHTML + `
        <div style="text-align: center; margin-top: 2rem;">
            <button id="viewProfileBtn" style="${btnStyle}" onmouseover="this.style.background='#b5952f'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(212, 175, 55, 0.3)';" onmouseout="this.style.background='#d4af37'; this.style.transform='translateY(0)'; this.style.boxShadow='none';">
                <i class="fas fa-user" style="margin-right: 0.5rem;"></i>View Full Profile
            </button>
        </div>
    `;

    // Add event listener for profile button
    const profileBtn = document.getElementById('viewProfileBtn');
    if (profileBtn) {
        profileBtn.addEventListener('click', () => {
            window.location.href = "../profile/profile.html";
        });
    }
}

/**
 * Save results to Firestore under users/{uid}/results/{testType}
 */
async function saveResultsToFirestore(uid, testType, results, analysis, totalTime) {
    const db = firebase.firestore();
    const timestamp = firebase.firestore.FieldValue.serverTimestamp();
    
    // Save to users/{uid}/results/{testType}
    const resultPath = db.collection('users').doc(uid).collection('results').doc(testType);
    await resultPath.set({
        results: results,
        analysis: analysis,
        timeSpent: totalTime,
        completedAt: timestamp,
        testType: testType
    });

    // Also update TestsResults collection for backward compatibility
    const testResultsPath = db.collection('TestsResults').doc(uid);
    const updateData = {
        lastUpdated: timestamp
    };
    
    if (testType === 'Big-Five') {
        updateData.bigFive = results;
        updateData.AI_Analysis = { bigFive: analysis };
    } else if (testType === 'Holland' || testType === 'Holland-codes') {
        updateData.hollandCode = results;
        updateData.AI_Analysis = { ...(updateData.AI_Analysis || {}), holland: analysis };
    }
    
    await testResultsPath.set(updateData, { merge: true });
    
    console.log('Results saved to Firestore successfully');
}
