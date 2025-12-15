/* ============================================================
   SIA Profile Page - Complete Rebuild
   ============================================================
   
   Features:
   - Profile picture with default avatar (Male.svg/Female.svg)
   - Test sections (Holland & Big Five) with start/view buttons
   - AI Career Analysis (3 jobs, salaries USA/Egypt, roadmaps, resources)
   - Activity Log
   - Edit Profile
   - Upload Photo
   - Export PDF
   - Logout
   - Auto-trigger AI analysis after both tests complete
   ============================================================ */

// Import Firebase services
import { auth, db, storage } from '../firebase-config.js';
import { 
    doc, 
    getDoc, 
    updateDoc, 
    collection, 
    query, 
    orderBy, 
    limit, 
    onSnapshot,
    serverTimestamp,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { 
    onAuthStateChanged, 
    signOut, 
    updateProfile 
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { 
    ref, 
    uploadBytes, 
    getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";

// State Management
const ProfileState = {
    user: null,
    userData: null,
    testResults: null,
    aiAnalysis: null,
    activityLogs: [],
    listeners: []
};

// DOM Elements
const Elements = {
    loadingIndicator: document.getElementById('profileLoadingIndicator'),
    errorMessage: document.getElementById('profileErrorMessage'),
    profileContent: document.getElementById('profileContent'),
    profilePicture: document.getElementById('profilePicture'),
    uploadPhotoBtn: document.getElementById('uploadPhotoBtn'),
    photoInput: document.getElementById('photoInput'),
    profileUserName: document.getElementById('profileUserName'),
    profileUserEmail: document.getElementById('profileUserEmail'),
    editProfileBtn: document.getElementById('editProfileBtn'),
    exportPDFBtn: document.getElementById('exportPDFBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    hollandTestCard: document.getElementById('hollandTestCard'),
    startHollandBtn: document.getElementById('startHollandBtn'),
    viewHollandBtn: document.getElementById('viewHollandBtn'),
    hollandTestStatus: document.getElementById('hollandTestStatus'),
    bigFiveTestCard: document.getElementById('bigFiveTestCard'),
    startBigFiveBtn: document.getElementById('startBigFiveBtn'),
    viewBigFiveBtn: document.getElementById('viewBigFiveBtn'),
    bigFiveTestStatus: document.getElementById('bigFiveTestStatus'),
    aiAnalysisSection: document.getElementById('aiAnalysisSection'),
    aiAnalysisContent: document.getElementById('aiAnalysisContent'),
    activityLogList: document.getElementById('activityLogList'),
    editProfileModal: new bootstrap.Modal(document.getElementById('editProfileModal')),
    editProfileForm: document.getElementById('editProfileForm'),
    editName: document.getElementById('editName'),
    editEmail: document.getElementById('editEmail'),
    editAge: document.getElementById('editAge'),
    editGender: document.getElementById('editGender'),
    saveProfileBtn: document.getElementById('saveProfileBtn')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Wait for auth state
    if (typeof window.onAuthStateReady === 'undefined') {
        setTimeout(() => document.dispatchEvent(new Event('DOMContentLoaded')), 100);
        return;
    }

    window.onAuthStateReady(async (user) => {
        if (!user) {
            window.location.href = '../sign in/signin.html';
            return;
        }

        ProfileState.user = user;
        await initializeProfile();
    });
});

// Initialize Profile
async function initializeProfile() {
    try {
        showLoading();
        
        // CRITICAL: Check API health before loading profile
        const apiHealthy = await checkAPIHealth();
        if (!apiHealthy) {
            console.warn('[Profile] ⚠️ API health check failed, using Firestore fallback');
            // Continue with Firestore fallback - don't block UI
        }
        
        // Try API first, fallback to Firestore
        let apiLoadSuccess = false;
        if (apiHealthy) {
            try {
                await loadProfileDataFromAPI();
                apiLoadSuccess = true;
                console.log('[Profile] ✅ Profile data loaded from API');
            } catch (apiError) {
                console.warn('[Profile] ⚠️ API load failed, using Firestore fallback:', apiError.message || apiError);
                // Fall through to Firestore fallback
            }
        }
        
        // Fallback to Firestore if API failed or unavailable
        if (!apiLoadSuccess) {
            console.log('[Profile] 🔄 Loading profile data from Firestore...');
            await loadProfileData();
        }
        
        await loadTestResults();
        await loadActivityLogs();
        setupEventListeners();
        setupRealtimeListeners();
        hideLoading();
        Elements.profileContent.style.display = 'block';
    } catch (error) {
        console.error('[Profile] Initialization error:', error);
        showError('Failed to load profile. Please refresh the page.');
        // Still try to show content from Firestore
        try {
            await loadProfileData();
            Elements.profileContent.style.display = 'block';
        } catch (fallbackError) {
            console.error('[Profile] Fallback also failed:', fallbackError);
        }
    }
}

// Check API Health
async function checkAPIHealth() {
    try {
        const apiBaseUrl = window.CONFIG?.API_BASE_URL || 
                          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                            ? 'http://localhost:5000/api'
                            : '/api');
        
        // Use /api/health endpoint (not /health)
        const response = await fetch(`${apiBaseUrl}/health`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('[Profile] ✅ API health check passed:', data.status);
            return true;
        } else {
            console.warn(`[Profile] ⚠️ API health check returned ${response.status}`);
            return false;
        }
    } catch (error) {
        // Network error or timeout - backend is likely down
        console.warn('[Profile] ⚠️ API health check failed (backend may be down):', error.message || error);
        return false;
    }
}

// Load Profile Data from API
async function loadProfileDataFromAPI() {
    try {
        const token = await ProfileState.user.getIdToken();
        const apiBaseUrl = window.CONFIG?.API_BASE_URL || 
                          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                            ? 'http://localhost:5000/api'
                            : '/api');

        const response = await fetch(`${apiBaseUrl}/profile`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            signal: AbortSignal.timeout(30000) // 30 second timeout
        });

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        
        if (result.status !== 'success' || !result.data) {
            throw new Error('Invalid API response format');
        }

        const { user, testResults, testsComplete } = result.data;
        
        // Update state
        ProfileState.userData = user;
        ProfileState.testResults = testResults;
        ProfileState.testsComplete = testsComplete;
        
        // Set default avatar if no photo
        if (!ProfileState.userData.photoURL && !ProfileState.user.photoURL) {
            const gender = ProfileState.userData.gender || 'male';
            ProfileState.userData.photoURL = gender === 'female' 
                ? '../Images/Profile Photo/SVG/Female.svg'
                : '../Images/Profile Photo/SVG/Male.svg';
        }

        renderProfileHeader();
        console.log('[Profile] ✅ Profile data loaded from API');
    } catch (error) {
        console.error('[Profile] API load error:', error);
        throw error; // Re-throw to trigger Firestore fallback
    }
}

// Load Profile Data
async function loadProfileData() {
    try {
        const userDoc = await getDoc(doc(db, 'users', ProfileState.user.uid));
        
        if (userDoc.exists()) {
            ProfileState.userData = userDoc.data();
        } else {
            // Create user document if it doesn't exist
            const newUserData = {
                name: ProfileState.user.displayName || '',
                email: ProfileState.user.email || '',
                photoURL: ProfileState.user.photoURL || '',
                gender: null,
                age: null,
                createdAt: serverTimestamp(),
                lastLogin: serverTimestamp()
            };
            await setDoc(doc(db, 'users', ProfileState.user.uid), newUserData);
            ProfileState.userData = newUserData;
        }

        // Set default avatar if no photo
        if (!ProfileState.userData.photoURL && !ProfileState.user.photoURL) {
            const gender = ProfileState.userData.gender || 'male'; // Default to male
            ProfileState.userData.photoURL = gender === 'female' 
                ? '../Images/Profile Photo/SVG/Female.svg'
                : '../Images/Profile Photo/SVG/Male.svg';
        }

        renderProfileHeader();
    } catch (error) {
        console.error('[Profile] Error loading profile data:', error);
        throw error;
    }
}

// Load Test Results (initial snapshot - real-time listener will keep it updated)
async function loadTestResults() {
    try {
        const testResultsDoc = await getDoc(doc(db, 'tests_results', ProfileState.user.uid));
        
        if (testResultsDoc.exists()) {
            const data = testResultsDoc.data();
            ProfileState.testResults = data;
            
            // Derive completion flags from Firestore data
            const hollandCompleted = !!(
                data.holland &&
                ['R', 'I', 'A', 'S', 'E', 'C'].every(code => typeof data.holland[code] === 'number')
            );
            const bigFiveCompleted = !!(
                data.bigFive &&
                ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'].every(trait => 
                    typeof data.bigFive[trait] === 'number'
                )
            );

            // Ensure Firestore has explicit completion flags (single source of truth)
            const patch = {};
            if (data.hollandCompleted !== hollandCompleted) patch.hollandCompleted = hollandCompleted;
            if (data.bigFiveCompleted !== bigFiveCompleted) patch.bigFiveCompleted = bigFiveCompleted;
            if (Object.keys(patch).length > 0) {
                await updateDoc(doc(db, 'tests_results', ProfileState.user.uid), patch);
            }

            updateTestButtonsUI({
                hollandCompleted,
                bigFiveCompleted
            });

            renderTestSections();
        } else {
            // No test results yet
            updateTestButtonsUI({
                hollandCompleted: false,
                bigFiveCompleted: false
            });
            renderTestSections();
        }
    } catch (error) {
        console.error('[Profile] Error loading test results:', error);
    }
}

// Trigger AI Analysis with Firestore lock (aiStatus)
async function triggerAIAnalysis() {
    try {
        // CRITICAL: Check Firestore lock to prevent duplicates
        const profileRef = doc(db, 'users', ProfileState.user.uid);
        const profileSnap = await getDoc(profileRef);

        if (profileSnap.exists()) {
            const profile = profileSnap.data();

            if (profile.aiStatus === 'processing') {
                console.log('[Profile] ℹ️ AI analysis already processing, skipping duplicate trigger');
                showAIAnalyzingState();
                return;
            }

            if (profile.aiStatus === 'completed' && profile.aiAnalysis) {
                console.log('[Profile] ℹ️ AI analysis already completed, rendering existing analysis');
                ProfileState.userData = profile;
                renderAIAnalysis(profile.aiAnalysis);
                return;
            }
        }

        // Set Firestore lock: AI processing
        await updateDoc(profileRef, {
            aiStatus: 'processing',
            aiTriggeredAt: serverTimestamp()
        });

        console.log('[Profile] 🔄 Triggering AI analysis...');
        showAIAnalyzingState();
        
        const token = await ProfileState.user.getIdToken();
        const apiBaseUrl = window.CONFIG?.API_BASE_URL || 
                          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                            ? 'http://localhost:5000/api'
                            : '/api');

        const response = await fetch(`${apiBaseUrl}/analyze-with-gemini`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                userId: ProfileState.user.uid,
                testResults: {
                    bigFive: ProfileState.testResults.bigFive,
                    holland: ProfileState.testResults.holland
                }
            }),
            signal: AbortSignal.timeout(90000) // 90 second timeout for AI analysis
        });

        if (response.ok) {
            const result = await response.json();
            
            // Check if it's a cached response
            if (result.cached) {
                console.log('[Profile] ✅ Using cached AI analysis');
            } else {
                console.log('[Profile] ✅ AI analysis generated successfully');
            }
            
            // The backend saves the analysis into the user profile document
            // Just reload profile to get the updated data (listener will render)
            await loadProfileData();
            // Real-time listener on user document will handle rendering
        } else {
            const errorData = await response.json().catch(() => ({}));
            console.error('[Profile] ❌ Failed to trigger AI analysis:', errorData.message || response.statusText);
            
            // Don't block UI - show friendly message
            if (errorData.code === 'TESTS_INCOMPLETE') {
                console.log('[Profile] ℹ️ Tests incomplete, AI analysis will run when both tests are complete');
            } else {
                console.warn('[Profile] ⚠️ AI analysis failed, but profile still loads');
                // Log activity for retry
                await logActivity('AI analysis failed - will retry when available');
            }
        }
    } catch (error) {
        console.error('[Profile] Error triggering AI analysis:', error);
        
        // Don't block UI - graceful degradation
        if (error.name === 'AbortError') {
            console.warn('[Profile] ⚠️ AI analysis timed out, but profile still loads');
        } else {
            console.warn('[Profile] ⚠️ AI analysis error, but profile still loads');
        }
        
        // Log activity for retry
        await logActivity('AI analysis error - will retry when available');
    }
}

// Load Activity Logs
async function loadActivityLogs() {
    try {
        const activityRef = collection(db, 'users', ProfileState.user.uid, 'activityLogs');
        const q = query(activityRef, orderBy('timestamp', 'desc'), limit(20));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            ProfileState.activityLogs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            renderActivityLog();
        }, (error) => {
            console.error('[Profile] Activity log error:', error);
        });

        ProfileState.listeners.push(unsubscribe);
    } catch (error) {
        console.error('[Profile] Error loading activity logs:', error);
    }
}

// Render Profile Header
function renderProfileHeader() {
    if (!ProfileState.userData) return;

    // Profile Picture
    Elements.profilePicture.src = ProfileState.userData.photoURL || 
                                  ProfileState.user.photoURL || 
                                  '../Images/Profile Photo/SVG/Male.svg';

    // Name
    Elements.profileUserName.textContent = ProfileState.userData.name || 
                                          ProfileState.user.displayName || 
                                          'SIA User';

    // Email
    Elements.profileUserEmail.textContent = ProfileState.userData.email || 
                                           ProfileState.user.email || 
                                           '';
}

// Render Test Sections
function renderTestSections() {
    const data = ProfileState.testResults || {};
    const hollandCompleted = !!data.hollandCompleted;
    const bigFiveCompleted = !!data.bigFiveCompleted;

    // Update buttons based on completion flags
    updateTestButtonsUI({ hollandCompleted, bigFiveCompleted });

    // Update status cards for UX
    if (hollandCompleted) {
        Elements.hollandTestStatus.innerHTML = '<span class="text-success"><i class="fas fa-check-circle me-2"></i>Completed</span>';
        Elements.hollandTestStatus.className = 'test-status completed';
    } else {
        Elements.hollandTestStatus.innerHTML = '<span class="text-warning"><i class="fas fa-clock me-2"></i>Not Started</span>';
        Elements.hollandTestStatus.className = 'test-status pending';
    }

    if (bigFiveCompleted) {
        Elements.bigFiveTestStatus.innerHTML = '<span class="text-success"><i class="fas fa-check-circle me-2"></i>Completed</span>';
        Elements.bigFiveTestStatus.className = 'test-status completed';
    } else {
        Elements.bigFiveTestStatus.innerHTML = '<span class="text-warning"><i class="fas fa-clock me-2"></i>Not Started</span>';
        Elements.bigFiveTestStatus.className = 'test-status pending';
    }
}

// Update test buttons UI based on Firestore flags (single source of truth)
function updateTestButtonsUI(data) {
    const hollandCompleted = !!data.hollandCompleted;
    const bigFiveCompleted = !!data.bigFiveCompleted;

    toggleButtonVisibility(Elements.startHollandBtn, !hollandCompleted);
    toggleButtonVisibility(Elements.viewHollandBtn, hollandCompleted);

    toggleButtonVisibility(Elements.startBigFiveBtn, !bigFiveCompleted);
    toggleButtonVisibility(Elements.viewBigFiveBtn, bigFiveCompleted);

    // Optionally disable buttons after completion to prevent retake
    if (hollandCompleted && Elements.startHollandBtn) {
        Elements.startHollandBtn.disabled = true;
    }
    if (bigFiveCompleted && Elements.startBigFiveBtn) {
        Elements.startBigFiveBtn.disabled = true;
    }
}

function toggleButtonVisibility(buttonEl, shouldShow) {
    if (!buttonEl) return;
    buttonEl.style.display = shouldShow ? 'block' : 'none';
}

// Load AI Analysis from profile document (supports new aiAnalysis and legacy fields)
function loadAIAnalysis() {
    if (!ProfileState.userData) return;

    // Preferred: unified aiAnalysis object
    if (ProfileState.userData.aiAnalysis) {
        renderAIAnalysis(ProfileState.userData.aiAnalysis);
        return;
    }

    // Backwards compatibility: legacy fields
    const aiSummary = ProfileState.userData.aiSummary || ProfileState.userData.personalityAnalysis;
    const careers = ProfileState.userData.recommendedCareers || ProfileState.userData.top3Careers || [];
    
    if (!aiSummary && careers.length === 0) {
        Elements.aiAnalysisSection.style.display = 'none';
        return;
    }

    const legacyAnalysis = {
        personalityAnalysis: aiSummary,
        top3Careers: careers,
        overallStrengths: ProfileState.userData.skillsProfile?.strengths || [],
        overallWeaknesses: ProfileState.userData.skillsProfile?.weaknesses || [],
        learningRecommendations: ProfileState.userData.skillsProfile?.learningRecommendations || []
    };

    renderAIAnalysis(legacyAnalysis);
}

// Render AI analysis object (careers, salaries, roadmap, strengths, weaknesses, resources)
function renderAIAnalysis(aiAnalysis) {
    if (!aiAnalysis) {
        Elements.aiAnalysisSection.style.display = 'none';
        return;
    }

    Elements.aiAnalysisSection.style.display = 'block';

    const personalityAnalysis = aiAnalysis.personalityAnalysis || aiAnalysis.personalitySummary || '';
    const careers = aiAnalysis.top3Careers || [];
    const overallStrengths = aiAnalysis.overallStrengths || [];
    const overallWeaknesses = aiAnalysis.overallWeaknesses || [];
    const learningRecommendations = aiAnalysis.learningRecommendations || [];

    let html = '';

    if (personalityAnalysis) {
        html += `
            <div class="mb-4 fade-in">
                <h3 class="text-warning mb-3">Personality Summary</h3>
                <p class="text-light" style="line-height: 1.8;">${personalityAnalysis}</p>
            </div>
        `;
    }

    if (careers.length > 0) {
        html += '<h3 class="text-warning mb-4">Recommended Career Paths</h3>';
        html += '<div class="row g-4">';

        careers.slice(0, 3).forEach((career, index) => {
            // Handle roadmap structure (could be array of strings or array of objects)
            let roadmapHTML = '';
            if (career.roadmap && Array.isArray(career.roadmap)) {
                roadmapHTML = `
                    <div class="roadmap-section">
                        <h5 class="roadmap-title">Career Roadmap</h5>
                        <ol class="roadmap-steps">
                            ${career.roadmap.map((step, i) => {
                                const stepText = typeof step === 'string' ? step : (step.step || step.description || '');
                                return `<li class="roadmap-step">${stepText}</li>`;
                            }).join('')}
                        </ol>
                    </div>
                `;
            }

            // Handle resources structure
            let resourcesHTML = '';
            if (career.resources) {
                const resources = career.resources;
                const allResources = [
                    ...(resources.books || []).map(r => ({ ...r, type: 'book' })),
                    ...(resources.youtubeCourses || []).map(r => ({ ...r, type: 'youtube' })),
                    ...(resources.platforms || []).map(r => ({ ...r, type: 'platform' }))
                ];

                if (allResources.length > 0) {
                    resourcesHTML = `
                        <div class="learning-resources">
                            <h5 class="resources-title">Learning Resources</h5>
                            ${allResources.map(resource => {
                                const title = resource.title || resource.name || '';
                                const link = resource.link || resource.url || '#';
                                const author = resource.author || resource.channel || resource.platform || '';
                                return `
                                    <div class="resource-item">
                                        <a href="${link}" target="_blank" class="resource-link">
                                            <i class="fas fa-external-link-alt me-2"></i>
                                            ${title}${author ? ` - ${author}` : ''}
                                        </a>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `;
                }
            } else if (career.learningResources) {
                // Fallback for old structure
                resourcesHTML = `
                    <div class="learning-resources">
                        <h5 class="resources-title">Learning Resources</h5>
                        ${career.learningResources.map(resource => {
                            const title = typeof resource === 'string' ? resource : (resource.title || resource);
                            const link = resource.url || '#';
                            return `
                                <div class="resource-item">
                                    <a href="${link}" target="_blank" class="resource-link">
                                        <i class="fas fa-external-link-alt me-2"></i>${title}
                                    </a>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            }

            // Get salary info (if available)
            const salaryUSA = career.salaryUSA || career.salary?.usa || 'N/A';
            const salaryEgypt = career.salaryEgypt || career.salary?.egypt || 'N/A';

            html += `
                <div class="col-md-4">
                    <div class="career-card fade-in" style="animation-delay: ${index * 0.1}s">
                        <div class="career-header">
                            <h4 class="career-title">${career.title || 'Career Path'}</h4>
                            <span class="career-fit-badge">${career.fit || 'N/A'}% Match</span>
                        </div>
                        <p class="career-description">${career.reason || career.description || ''}</p>
                        
                        <div class="salary-comparison">
                            <div class="salary-card">
                                <div class="salary-country">🇺🇸 USA</div>
                                <div class="salary-amount">${typeof salaryUSA === 'number' ? '$' + salaryUSA.toLocaleString() : salaryUSA}</div>
                                <div class="salary-period">per year</div>
                            </div>
                            <div class="salary-card">
                                <div class="salary-country">🇪🇬 Egypt</div>
                                <div class="salary-amount">${typeof salaryEgypt === 'number' ? 'EGP ' + salaryEgypt.toLocaleString() : salaryEgypt}</div>
                                <div class="salary-period">per year</div>
                            </div>
                        </div>

                        ${roadmapHTML}

                        ${resourcesHTML}
                    </div>
                </div>
            `;
        });

        html += '</div>';
    }

    if (overallStrengths.length > 0 || overallWeaknesses.length > 0 || learningRecommendations.length > 0) {
        html += '<div class="mt-5"><h3 class="text-warning mb-4">Skills & Development</h3>';
        html += '<div class="row g-4">';

        if (overallStrengths.length > 0) {
            html += `
                <div class="col-md-4">
                    <div class="career-card">
                        <h5 class="text-success mb-3"><i class="fas fa-check-circle me-2"></i>Strengths</h5>
                        <ul class="list-unstyled">
                            ${overallStrengths.map(s => `<li class="mb-2"><i class="fas fa-star text-warning me-2"></i>${s}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            `;
        }

        if (overallWeaknesses.length > 0) {
            html += `
                <div class="col-md-4">
                    <div class="career-card">
                        <h5 class="text-warning mb-3"><i class="fas fa-lightbulb me-2"></i>Areas for Growth</h5>
                        <ul class="list-unstyled">
                            ${overallWeaknesses.map(w => `<li class="mb-2"><i class="fas fa-arrow-up text-warning me-2"></i>${w}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            `;
        }

        if (learningRecommendations.length > 0) {
            html += `
                <div class="col-md-4">
                    <div class="career-card">
                        <h5 class="text-warning mb-3"><i class="fas fa-graduation-cap me-2"></i>Learning Recommendations</h5>
                        <ul class="list-unstyled">
                            ${learningRecommendations.map(l => `<li class="mb-2"><i class="fas fa-book text-warning me-2"></i>${l}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            `;
        }

        html += '</div></div>';
    }

    Elements.aiAnalysisContent.innerHTML = html;
}

// Render Activity Log
function renderActivityLog() {
    if (!ProfileState.activityLogs || ProfileState.activityLogs.length === 0) {
        Elements.activityLogList.innerHTML = '<p class="text-muted text-center py-4">No activity yet</p>';
        return;
    }

    Elements.activityLogList.innerHTML = ProfileState.activityLogs.map(activity => {
        const timestamp = activity.timestamp?.toDate ? activity.timestamp.toDate() : new Date(activity.timestamp);
        const timeAgo = getTimeAgo(timestamp);
        
        let icon = 'fa-circle';
        if (activity.action?.includes('test') || activity.action?.includes('Test')) {
            icon = 'fa-clipboard-check';
        } else if (activity.action?.includes('login') || activity.action?.includes('Login')) {
            icon = 'fa-sign-in-alt';
        } else if (activity.action?.includes('profile') || activity.action?.includes('Profile')) {
            icon = 'fa-user-edit';
        }

        return `
            <li class="activity-item">
                <div class="activity-icon">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-action">${activity.action || activity.activityType || 'Activity'}</div>
                    <div class="activity-time">${timeAgo}</div>
                </div>
            </li>
        `;
    }).join('');
}

// Get Time Ago
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
}

// Setup Event Listeners
function setupEventListeners() {
    // Upload Photo
    Elements.uploadPhotoBtn.addEventListener('click', () => Elements.photoInput.click());
    Elements.photoInput.addEventListener('change', handlePhotoUpload);

    // Edit Profile
    Elements.editProfileBtn.addEventListener('click', openEditModal);
    Elements.saveProfileBtn.addEventListener('click', saveProfile);

    // Export PDF
    Elements.exportPDFBtn.addEventListener('click', exportPDF);

    // Logout
    Elements.logoutBtn.addEventListener('click', handleLogout);

    // Test Buttons
    Elements.startHollandBtn.addEventListener('click', () => startTest('Holland'));
    Elements.viewHollandBtn.addEventListener('click', () => viewTestResults('Holland'));
    Elements.startBigFiveBtn.addEventListener('click', () => startTest('Big-Five'));
    Elements.viewBigFiveBtn.addEventListener('click', () => viewTestResults('Big-Five'));
}

// Handle Photo Upload
async function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        showLoading();
        const storageRef = ref(storage, `profile-photos/${ProfileState.user.uid}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const photoURL = await getDownloadURL(storageRef);

        // Update Firebase Auth profile
        await updateProfile(ProfileState.user, { photoURL });

        // Update Firestore
        await updateDoc(doc(db, 'users', ProfileState.user.uid), {
            photoURL: photoURL,
            updatedAt: serverTimestamp()
        });

        // Update UI
        Elements.profilePicture.src = photoURL;
        ProfileState.userData.photoURL = photoURL;

        // Log activity
        await logActivity('Profile photo updated');

        hideLoading();
        alert('Photo uploaded successfully!');
    } catch (error) {
        console.error('[Profile] Error uploading photo:', error);
        hideLoading();
        alert('Failed to upload photo. Please try again.');
    }
}

// Open Edit Modal
function openEditModal() {
    Elements.editName.value = ProfileState.userData.name || '';
    Elements.editEmail.value = ProfileState.userData.email || '';
    Elements.editAge.value = ProfileState.userData.age || '';
    Elements.editGender.value = ProfileState.userData.gender || '';
    Elements.editProfileModal.show();
}

// Save Profile
async function saveProfile() {
    try {
        const updates = {
            name: Elements.editName.value,
            age: Elements.editAge.value ? parseInt(Elements.editAge.value) : null,
            gender: Elements.editGender.value || null,
            updatedAt: serverTimestamp()
        };

        await updateDoc(doc(db, 'users', ProfileState.user.uid), updates);
        
        // Update Firebase Auth display name
        if (updates.name) {
            await updateProfile(ProfileState.user, { displayName: updates.name });
        }

        // Update state
        ProfileState.userData = { ...ProfileState.userData, ...updates };
        
        // Update default avatar if gender changed
        if (updates.gender && !ProfileState.userData.photoURL && !ProfileState.user.photoURL) {
            const photoURL = updates.gender === 'female' 
                ? '../Images/Profile Photo/SVG/Female.svg'
                : '../Images/Profile Photo/SVG/Male.svg';
            await updateDoc(doc(db, 'users', ProfileState.user.uid), { photoURL });
            Elements.profilePicture.src = photoURL;
        }

        renderProfileHeader();
        Elements.editProfileModal.hide();
        
        // Log activity
        await logActivity('Profile updated');

        alert('Profile updated successfully!');
    } catch (error) {
        console.error('[Profile] Error saving profile:', error);
        alert('Failed to save profile. Please try again.');
    }
}

// Export PDF
async function exportPDF() {
    try {
        showLoading();
        const element = Elements.profileContent;
        const opt = {
            margin: 1,
            filename: `SIA_Profile_${ProfileState.userData.name || 'User'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        
        await html2pdf().set(opt).from(element).save();
        hideLoading();
        
        // Log activity
        await logActivity('Profile exported as PDF');
    } catch (error) {
        console.error('[Profile] Error exporting PDF:', error);
        hideLoading();
        alert('Failed to export PDF. Please try again.');
    }
}

// Handle Logout
async function handleLogout() {
    if (!confirm('Are you sure you want to logout?')) return;

    try {
        await signOut(auth);
        window.location.href = '../sign in/signin.html';
    } catch (error) {
        console.error('[Profile] Error logging out:', error);
        alert('Failed to logout. Please try again.');
    }
}

// Start Test
function startTest(testType) {
    window.location.href = `../Test/Test.html?test=${testType}`;
}

// View Test Results
function viewTestResults(testType) {
    // Navigate to test page in review mode or show results in modal
    window.location.href = `../Test/Test.html?test=${testType}&view=results`;
}

// Setup Realtime Listeners
function setupRealtimeListeners() {
    // Listen to user profile document (AI analysis + profile info)
    const userUnsubscribe = onSnapshot(doc(db, 'users', ProfileState.user.uid), (snapshot) => {
        if (!snapshot.exists()) return;

        const profile = snapshot.data();
        ProfileState.userData = profile;
        renderProfileHeader();

        // AI analysis state handling
        if (profile.aiStatus === 'processing') {
            showAIAnalyzingState();
        } else if (profile.aiStatus === 'completed' && profile.aiAnalysis) {
            renderAIAnalysis(profile.aiAnalysis);
        } else {
            // Fallback to legacy fields if aiStatus not set
            loadAIAnalysis();
        }
    }, (error) => {
        console.error('[Profile] User profile listener error:', error);
    });

    // Listen to test results in real-time (single source of truth for buttons + AI trigger)
    const testResultsUnsubscribe = onSnapshot(doc(db, 'tests_results', ProfileState.user.uid), async (snapshot) => {
        if (!snapshot.exists()) {
            // No results yet
            ProfileState.testResults = null;
            updateTestButtonsUI({
                hollandCompleted: false,
                bigFiveCompleted: false
            });
            renderTestSections();
            return;
        }

        const data = snapshot.data();
        ProfileState.testResults = data;

        // Derive completion flags
        const hollandCompleted = !!(
            data.holland &&
            ['R', 'I', 'A', 'S', 'E', 'C'].every(code => typeof data.holland[code] === 'number')
        );
        const bigFiveCompleted = !!(
            data.bigFive &&
            ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'].every(trait => 
                typeof data.bigFive[trait] === 'number'
            )
        );

        // Ensure Firestore has explicit completion flags
        const patch = {};
        if (data.hollandCompleted !== hollandCompleted) patch.hollandCompleted = hollandCompleted;
        if (data.bigFiveCompleted !== bigFiveCompleted) patch.bigFiveCompleted = bigFiveCompleted;
        if (Object.keys(patch).length > 0) {
            try {
                await updateDoc(doc(db, 'tests_results', ProfileState.user.uid), patch);
            } catch (err) {
                console.warn('[Profile] Warning: failed to update completion flags in Firestore:', err.message || err);
            }
        }

        // Update UI instantly
        updateTestButtonsUI({ hollandCompleted, bigFiveCompleted });
        renderTestSections();

        // Trigger AI analysis once both tests are complete
        if (hollandCompleted && bigFiveCompleted) {
            triggerAIAnalysis();
        }
    }, (error) => {
        console.error('[Profile] Test results listener error:', error);
    });

    ProfileState.listeners.push(userUnsubscribe, testResultsUnsubscribe);
}

// Show analyzing state in AI section
function showAIAnalyzingState() {
    if (!Elements.aiAnalysisSection || !Elements.aiAnalysisContent) return;
    Elements.aiAnalysisSection.style.display = 'block';
    Elements.aiAnalysisContent.innerHTML = `
        <div class="text-center py-4 fade-in">
            <div class="spinner-border text-warning mb-3" role="status">
                <span class="visually-hidden">Analyzing...</span>
            </div>
            <p class="text-muted mb-0">Analyzing your results…</p>
        </div>
    `;
}

// Log Activity
async function logActivity(action) {
    try {
        const activityRef = doc(collection(db, 'users', ProfileState.user.uid, 'activityLogs'));
        await setDoc(activityRef, {
            action: action,
            timestamp: serverTimestamp(),
            details: {}
        });
    } catch (error) {
        console.error('[Profile] Error logging activity:', error);
    }
}

// Cleanup listeners
window.addEventListener('beforeunload', () => {
    ProfileState.listeners.forEach(unsubscribe => unsubscribe());
});

// Helper Functions
function showLoading() {
    if (Elements.loadingIndicator) Elements.loadingIndicator.style.display = 'block';
    if (Elements.profileContent) Elements.profileContent.style.display = 'none';
}

function hideLoading() {
    if (Elements.loadingIndicator) Elements.loadingIndicator.style.display = 'none';
}

function showError(message) {
    if (Elements.errorMessage) {
        Elements.errorMessage.textContent = message;
        Elements.errorMessage.style.display = 'block';
    }
}

