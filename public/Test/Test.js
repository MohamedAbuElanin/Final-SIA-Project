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
function checkAuth() {
    firebase.auth().onAuthStateChanged((user) => {
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

function saveTestResult(testType, resultData, totalTime) {
    // Set saving flag to prevent duplicate submissions
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

    // Disable finish button to prevent multiple clicks
    const finishBtn = elements.finishBtn;
    if (finishBtn) {
        finishBtn.disabled = true;
        finishBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving...';
    }

    // Call Backend to Calculate Scores
    user.getIdToken().then(token => {
        fetch(`${CONFIG.API_BASE_URL}/calculate-scores`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                testType: testType,
                answers: resultData
            })
        })
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(scores => {
        console.log("Scores calculated:", scores);
        
        const db = firebase.firestore();
        
        // Prepare data for both storage locations
        const testResultData = {
            result: scores,
            answers: resultData, // Raw answers for review mode
            timeSpent: totalTime,
            completedAt: firebase.firestore.FieldValue.serverTimestamp(),
            testType: testType
        };

        // 1. Save to subcollection for review mode access
        const subcollectionRef = db.collection('users').doc(user.uid).collection('tests').doc(testType);
        
        // 2. Save scores to TestsResults collection for profile page
        const testResultsRef = db.collection("TestsResults").doc(user.uid);
        let profileUpdateData = {};
        if (testType === 'Big-Five') {
            profileUpdateData['bigFive'] = scores;
        } else {
            profileUpdateData['hollandCode'] = scores; // Standardized key
        }
        
        // Save to both locations simultaneously
        Promise.all([
            subcollectionRef.set(testResultData),
            testResultsRef.set(profileUpdateData, { merge: true })
        ])
        .then(() => {
            // Log Activity
            const activityRef = db.collection('users').doc(user.uid).collection('activityLogs');
            activityRef.add({
                action: `Completed ${testType} Test`,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(err => console.error("Error logging activity:", err));

            console.log("Test result saved successfully to both locations!");
            state.isSaving = false;
            alert("Test completed and saved!");
            window.location.href = "../profile/profile.html";
        })
        .catch((error) => {
            console.error("Error saving to Firestore:", error);
            state.isSaving = false;
            if (finishBtn) {
                finishBtn.disabled = false;
                finishBtn.innerHTML = 'Finish & Save';
            }
            alert("Failed to save results to database: " + error.message);
        });

    })
    .catch(error => {
        console.error("Error calculating scores:", error);
        state.isSaving = false;
        if (finishBtn) {
            finishBtn.disabled = false;
            finishBtn.innerHTML = 'Finish & Save';
        }
        alert("Failed to calculate scores. Please check your connection.");
    });
    }); // Close getIdToken
}
