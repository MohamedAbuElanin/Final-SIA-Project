import { auth } from "../firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// --- State Management ---
const state = {
    currentTest: null, // 'Big-Five' or 'Holland-codes'
    questions: [],
    currentQuestionIndex: 0,
    answers: {}, // { questionId: answerValue }
    startTime: null,
    timerInterval: null,
    elapsedSeconds: 0,
    isTimerRunning: false,
    maxReachedIndex: 0 // Track furthest progress to manage "Review" vs "New"
};

// --- DOM Elements ---
const elements = {
    selectionView: document.getElementById('selectionView'),
    testView: document.getElementById('testView'),
    resultView: document.getElementById('resultView'),
    testCards: document.querySelectorAll('.test-card'),
    questionContainer: document.getElementById('questionContainer'),
    questionText: document.getElementById('questionText'),
    optionsContainer: document.getElementById('optionsContainer'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'), // Re-added for read-only nav
    currentQuestionNum: document.getElementById('currentQuestionNum'),
    totalQuestions: document.getElementById('totalQuestions'),
    progressBar: document.getElementById('progressBar'),
    timerDisplay: document.getElementById('timerDisplay'),
    finalTime: document.getElementById('finalTime'),
    finishBtn: document.getElementById('finishBtn'),
    reviewBtn: document.getElementById('reviewBtn'), // Re-added logic for this if needed
    navAuth: document.getElementById('navAuth')
};

// --- Authentication Check ---
function checkAuth() {
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.href = "../sign in/signin.html";
        }
    });
}

// --- Initialization ---
function init() {
    checkAuth();
    setupEventListeners();
}

function setupEventListeners() {
    // Test Selection
    elements.testCards.forEach(card => {
        card.addEventListener('click', () => {
            const testType = card.dataset.test;
            startTest(testType);
        });
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
    
    // Review Button
    const reviewBtn = document.getElementById('reviewBtn');
    if (reviewBtn) {
        reviewBtn.addEventListener('click', reviewAnswers);
    }

    // Visibility Change (Pause Timer)
    document.addEventListener('visibilitychange', handleVisibilityChange);
}

// --- Test Logic ---
async function startTest(testType) {
    state.currentTest = testType;
    
    try {
        const response = await fetch(`../${testType}.json`);
        if (!response.ok) throw new Error(`Failed to load ${testType} questions`);
        
        state.questions = await response.json();
        
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
        alert("Failed to load the test. Please try again.");
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
        
        // Read-Only Logic: If answer exists, disable interaction
        if (hasAnswer) {
            btn.style.pointerEvents = 'none';
            if (state.answers[question.id] !== option) {
                btn.style.opacity = '0.5';
            }
        } else {
            // Click handler for Auto-Next (only if not answered)
            btn.addEventListener('click', () => selectAnswer(question.id, option));
        }
        
        elements.optionsContainer.appendChild(btn);
    });
    
    // Update Previous Button
    if (elements.prevBtn) {
        elements.prevBtn.disabled = state.currentQuestionIndex === 0;
    }

    // Update Next Button (Only visible if answer exists)
    if (elements.nextBtn) {
        if (hasAnswer) {
            elements.nextBtn.style.display = 'block';
            elements.nextBtn.disabled = false;
        } else {
            elements.nextBtn.style.display = 'none';
        }
    }
    
    // Ensure container is visible and reset animation classes
    elements.questionContainer.classList.remove('fade-out');
    elements.questionContainer.classList.add('fade-in');
}

function selectAnswer(questionId, answer) {
    // Save to state
    state.answers[questionId] = answer;
    
    // Update max reached index
    if (state.currentQuestionIndex > state.maxReachedIndex) {
        state.maxReachedIndex = state.currentQuestionIndex;
    }
    
    // Save to local storage
    saveProgress();
    
    // Visual feedback (highlight selected)
    const buttons = elements.optionsContainer.querySelectorAll('.option-btn');
    buttons.forEach(btn => {
        if (btn.textContent === answer) {
            btn.classList.add('selected');
        } else {
            btn.style.pointerEvents = 'none'; // Disable other options
            btn.style.opacity = '0.5'; // Dim others
        }
    });

    // Auto-Next with Animation
    setTimeout(() => {
        // 1. Fade out current question
        elements.questionContainer.classList.remove('fade-in');
        elements.questionContainer.classList.add('fade-out');
        
        // 2. Wait for fade out, then load next
        setTimeout(() => {
            nextQuestion();
        }, 300); // Match CSS transition duration (0.3s)
        
    }, 400); // Short delay to see the selection
}

function nextQuestion() {
    if (state.currentQuestionIndex < state.questions.length - 1) {
        state.currentQuestionIndex++;
        renderQuestion();
    } else {
        // Last question submitted
        completeTest();
    }
}

function prevQuestion() {
    if (state.currentQuestionIndex > 0) {
        // Animation for previous? 
        // Let's just do the same fade out/in for consistency
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
    if (state.isTimerRunning) return;
    
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
    elements.timerDisplay.textContent = `${pad(minutes)}:${pad(seconds)}`;
}

function pad(num) {
    return num.toString().padStart(2, '0');
}

function handleVisibilityChange() {
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

function reviewAnswers() {
    // Go back to test view, first question
    elements.resultView.classList.remove('active');
    elements.resultView.classList.add('hidden');
    
    elements.testView.classList.remove('hidden');
    setTimeout(() => elements.testView.classList.add('active'), 50);
    
    state.currentQuestionIndex = 0;
    renderQuestion(); 
    // Timer should probably NOT resume if just reviewing? 
    // Requirement 4 says "Ends when the user finishes the last question".
    // So timer stops. Review is read-only.
}

function finishTest() {
    // Final save or cleanup
    localStorage.removeItem('sia_test_progress'); // Clear temp progress
    
    // Redirect or show final message
    alert("Test data saved locally! (Ready for Firestore integration)");
    window.location.href = "../index.html"; // Return home
}

// Start
init();
