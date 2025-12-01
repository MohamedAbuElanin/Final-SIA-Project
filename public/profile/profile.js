/* ============================================================
   SIA Profile Page Scripts
   ============================================================ */

const state = {
    isEditing: false,
    userData: null,
    isLoading: true,
    testResults: {
        bigFive: null,
        holland: null
    },
    aiAnalysis: null
};

// Route Guard & Initialization
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (!window.firebase) {
            console.error("Firebase not initialized!");
            return;
        }

        firebase.auth().onAuthStateChanged((user) => {
            if (!user) {
                localStorage.clear();
                window.location.href = '../sign in/signin.html';
                return;
            }
            
            user.getIdToken().then((token) => {
                localStorage.setItem("authToken", token);
                localStorage.setItem("uid", user.uid);
                
                initHamburgerMenu();
                cacheElements();
                bindEvents();
                loadUserData(user);
                loadTestResults(user); // Load Big Five & Holland
            }).catch((error) => {
                console.error('Error getting token:', error);
                localStorage.clear();
                window.location.href = '../sign in/signin.html';
            });
        });
    }, 1000);
});

const refs = {};

function cacheElements() {
    // User Info
    refs.userNameDisplay = document.getElementById('userNameDisplay');
    refs.userEmailDisplay = document.getElementById('userEmailDisplay');
    refs.userNameInput = document.getElementById('userNameInput');
    refs.userEmailInput = document.getElementById('userEmailInput');
    refs.fullNameInput = document.getElementById('fullNameInput');
    refs.emailInput = document.getElementById('emailInput');
    refs.dobInput = document.getElementById('dobInput');
    refs.profilePhoto = document.getElementById('profilePhoto');
    
    // Forms & Buttons
    refs.editProfileBtn = document.getElementById('editProfileBtn');
    refs.saveProfileBtn = document.getElementById('saveProfileBtn');
    refs.personalInfoForm = document.getElementById('personalInfoForm');
    refs.educationSelect = document.getElementById('educationSelect');
    refs.educationOtherInput = document.getElementById('educationOtherInput');

    refs.uploadPhotoBtn = document.getElementById('uploadPhotoBtn');
    refs.avatarUploadInput = document.getElementById('avatarUploadInput');
    
    // Account Actions
    refs.changePasswordBtn = document.getElementById('changePasswordBtn');
    refs.deleteAccountBtn = document.getElementById('deleteAccountBtn');
    refs.logoutBtn = document.getElementById('logoutBtn');
    refs.exportPdfBtn = document.getElementById('exportPdfBtn');
    
    // Modals
    refs.changePasswordModal = document.getElementById('changePasswordModal');
    refs.changePasswordForm = document.getElementById('changePasswordForm');
    refs.currentPasswordInput = document.getElementById('currentPasswordInput');
    refs.newPasswordInput = document.getElementById('newPasswordInput');
    refs.confirmNewPasswordInput = document.getElementById('confirmNewPasswordInput');
    
    // Sections
    refs.bigFiveCard = document.querySelector('#personality-results .col-md-6:nth-child(1) .card-body');
    refs.hollandCard = document.querySelector('#personality-results .col-md-6:nth-child(2) .card-body');
    refs.recommendationsGrid = document.getElementById('recommendationsGrid');
    refs.savedJobsGrid = document.getElementById('savedJobsGrid');
    refs.activityList = document.getElementById('activityList');
    refs.resultsChartCanvas = document.getElementById('resultsChart');
}

function bindEvents() {
    refs.editProfileBtn?.addEventListener('click', enableEditMode);
    refs.saveProfileBtn?.addEventListener('click', saveProfileChanges);
    refs.uploadPhotoBtn?.addEventListener('click', () => refs.avatarUploadInput?.click());
    refs.avatarUploadInput?.addEventListener('change', handleAvatarUpload);
    refs.educationSelect?.addEventListener('change', handleEducationChange);
    
    refs.changePasswordBtn?.addEventListener('click', () => {
        if (refs.changePasswordModal) {
            const modal = new bootstrap.Modal(refs.changePasswordModal);
            modal.show();
        }
    });
    refs.changePasswordForm?.addEventListener('submit', handleChangePassword);
    
    refs.logoutBtn?.addEventListener('click', handleLogout);
    refs.deleteAccountBtn?.addEventListener('click', handleDeleteAccount);
    refs.exportPdfBtn?.addEventListener('click', handleExportPDF);
}

// ==========================================
// 1. User Data & Auth
// ==========================================

function handleLogout() {
    firebase.auth().signOut().then(() => {
        localStorage.clear();
        window.location.href = '../sign in/signin.html';
    });
}

function handleDeleteAccount() {
    if (!confirm("Are you sure you want to delete your account? This action cannot be undone.")) return;
    
    const user = firebase.auth().currentUser;
    if (!user) return;

    // Delete user data from Firestore
    const batch = firebase.firestore().batch();
    batch.delete(firebase.firestore().collection('users').doc(user.uid));
    batch.delete(firebase.firestore().collection('TestsResults').doc(user.uid));
    
    batch.commit().then(() => {
        user.delete().then(() => {
            alert("Account deleted.");
            window.location.href = '../sign up/signup.html';
        }).catch(err => {
            console.error("Error deleting auth account:", err);
            alert("Error deleting account. You may need to re-login first.");
        });
    }).catch(err => console.error("Error deleting user data:", err));
}

function loadUserData(user) {
    state.isLoading = true;
    
    firebase.firestore().collection('users').doc(user.uid).get()
        .then((doc) => {
            const data = doc.exists ? doc.data() : {};
            state.userData = data;
            
            // Update UI with Fallbacks
            const displayName = data.fullName || user.displayName || 'SIA User';
            const email = data.email || user.email || 'No email provided';
            
            if (refs.userNameDisplay) refs.userNameDisplay.textContent = displayName;
            if (refs.userEmailDisplay) refs.userEmailDisplay.textContent = email;
            
            // Form Fields
            if (refs.fullNameInput) refs.fullNameInput.value = data.fullName || '';
            if (refs.emailInput) refs.emailInput.value = data.email || user.email || '';
            if (refs.dobInput) refs.dobInput.value = data.dateOfBirth || '';
            
            // Education
            if (refs.educationSelect) {
                const opts = ['High School', 'Bachelor', 'Master', 'PhD', 'Other'];
                if (opts.includes(data.education)) {
                    refs.educationSelect.value = data.education;
                } else if (data.education) {
                    refs.educationSelect.value = 'Other';
                    if (refs.educationOtherInput) {
                        refs.educationOtherInput.value = data.education;
                        refs.educationOtherInput.classList.remove('d-none');
                    }
                }
            }

            // Student Status
            if (data.studentStatus === 'Student') {
                const el = document.getElementById('statusStudent');
                if (el) el.checked = true;
            } else if (data.studentStatus === 'Graduate') {
                const el = document.getElementById('statusGraduate');
                if (el) el.checked = true;
            }
            
            // Avatar Handling
            const setAvatar = (src) => {
                if (!refs.profilePhoto) return;
                refs.profilePhoto.src = src;
                refs.profilePhoto.onerror = () => {
                    refs.profilePhoto.onerror = null; 
                    refs.profilePhoto.src = data.gender === 'female' ? '../assets/female.svg' : '../assets/male.svg';
                };
            };

            if (data.avatar) {
                setAvatar(data.avatar);
            } else if (user.photoURL) {
                setAvatar(user.photoURL);
            } else {
                setAvatar(data.gender === 'female' ? '../assets/female.svg' : '../assets/male.svg');
            }
            
            state.isLoading = false;
            
            // Load Activity Log
            loadActivityLog(user);
        })
        .catch(err => {
            console.error("Error loading user data:", err);
            if (refs.userNameDisplay) refs.userNameDisplay.textContent = user.displayName || 'SIA User';
            if (refs.userEmailDisplay) refs.userEmailDisplay.textContent = user.email || '';
            state.isLoading = false;
        });
}

function loadActivityLog(user) {
    if (!refs.activityList) return;
    
    const logsRef = firebase.firestore().collection('users').doc(user.uid).collection('activityLogs');
    
    logsRef.orderBy('timestamp', 'desc').limit(5).get()
        .then(snapshot => {
            if (snapshot.empty) {
                refs.activityList.innerHTML = `
                    <li class="list-group-item bg-transparent text-muted border-secondary">
                        <i class="fas fa-info-circle me-2 text-gold"></i> Welcome to your new profile!
                    </li>
                `;
                return;
            }
            
            refs.activityList.innerHTML = '';
            snapshot.forEach(doc => {
                const log = doc.data();
                const date = log.timestamp ? new Date(log.timestamp.toDate()).toLocaleDateString() : '';
                const item = document.createElement('li');
                item.className = 'list-group-item bg-transparent text-muted border-secondary d-flex justify-content-between align-items-center';
                item.innerHTML = `
                    <div>
                        <i class="fas fa-check-circle me-2 text-gold"></i> ${log.action}
                    </div>
                    <small style="font-size: 0.8em;">${date}</small>
                `;
                refs.activityList.appendChild(item);
            });
        })
        .catch(err => {
            console.error("Error loading activity log:", err);
            refs.activityList.innerHTML = '<li class="list-group-item bg-transparent text-danger border-secondary">Could not load activities.</li>';
        });
}

function loadTestResults(user) {
    const db = firebase.firestore();
    const resultsRef = db.collection("TestsResults").doc(user.uid);

    resultsRef.get().then((doc) => {
        if (doc.exists) {
            const data = doc.data();
            state.testResults.bigFive = data["Big-Five"] || data["BigFive"] || null;
            state.testResults.holland = data["Holland-Code"] || data["Holland"] || data["HollandCodes"] || null;
            state.aiAnalysis = data["AI_Analysis"] || null;

            displayTestResults();
            
            if (state.aiAnalysis) {
                console.log("Loading existing AI Analysis...");
                displayAIAnalysis(state.aiAnalysis);
                renderChart();
            } else if (state.testResults.bigFive || state.testResults.holland) {
                console.log("Tests found but no analysis. Generating...");
                generateAIAnalysis(user);
            } else {
                renderChart();
            }
        } else {
            console.log("No test results found.");
            displayTestResults();
        }
    }).catch(err => console.error("Error loading test results:", err));
}

function displayTestResults() {
    // Big Five
    if (refs.bigFiveCard) {
        const bigFiveImg = '../Images/Test/Big Five.svg';
        if (state.testResults.bigFive) {
            refs.bigFiveCard.innerHTML = `
                <div class="text-center mb-3">
                    <img src="${bigFiveImg}" alt="Big Five" style="width: 80px; height: auto;">
                </div>
                <h6 class="card-title text-gold">Big Five Overview</h6>
                <p class="text-muted mb-2">Completed</p>
                <a href="../Test/Test.html?mode=review&test=Big-Five" class="btn btn-outline-light btn-sm">View Result</a>
            `;
        } else {
            refs.bigFiveCard.innerHTML = `
                <div class="text-center mb-3">
                    <img src="${bigFiveImg}" alt="Big Five" style="width: 80px; height: auto; opacity: 0.5;">
                </div>
                <h6 class="card-title text-gold">Big Five Overview</h6>
                <p class="text-muted mb-3">Not yet completed.</p>
                <a href="../Test/Test.html" class="btn btn-gold btn-sm">Start Test</a>
            `;
        }
    }

    // Holland
    if (refs.hollandCard) {
        const hollandImg = '../Images/Test/Holland codes.svg';
        if (state.testResults.holland) {
            refs.hollandCard.innerHTML = `
                <div class="text-center mb-3">
                    <img src="${hollandImg}" alt="Holland Codes" style="width: 80px; height: auto;">
                </div>
                <h6 class="card-title text-gold">Holland Codes Overview</h6>
                <p class="text-muted mb-2">Completed</p>
                <a href="../Test/Test.html?mode=review&test=Holland-codes" class="btn btn-outline-light btn-sm">View Result</a>
            `;
        } else {
            refs.hollandCard.innerHTML = `
                <div class="text-center mb-3">
                    <img src="${hollandImg}" alt="Holland Codes" style="width: 80px; height: auto; opacity: 0.5;">
                </div>
                <h6 class="card-title text-gold">Holland Codes Overview</h6>
                <p class="text-muted mb-3">Not yet completed.</p>
                <a href="../Test/Test.html" class="btn btn-gold btn-sm">Start Test</a>
            `;
        }
    }
}

async function generateAIAnalysis(user) {
    // Show loading state in recommendations area
    if (refs.recommendationsGrid) {
        refs.recommendationsGrid.innerHTML = '<div class="col-12 text-center"><i class="fas fa-spinner fa-spin fa-2x text-gold"></i><p class="mt-2">Generating personalized AI analysis...</p></div>';
    }

    try {
        const response = await fetch('http://localhost:5000/api/analyze-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userData: state.userData,
                bigFive: state.testResults.bigFive,
                holland: state.testResults.holland
            })
        });

        if (!response.ok) throw new Error('AI Analysis failed');

        const analysis = await response.json();
        
        // Save to Firestore
        await firebase.firestore().collection('TestsResults').doc(user.uid).update({
            AI_Analysis: analysis
        });

        state.aiAnalysis = analysis;
        displayAIAnalysis(analysis);
        renderChart();

    } catch (error) {
        console.error("AI Generation Error:", error);
        if (refs.recommendationsGrid) {
            refs.recommendationsGrid.innerHTML = '<div class="col-12 text-center text-danger"><p>Failed to generate analysis. Please try again later.</p></div>';
        }
    }
}

function displayAIAnalysis(analysis) {
    if (!analysis) return;

    // 1. Personality Analysis
    const personalitySection = document.getElementById('personality-results');
    let analysisDiv = document.getElementById('ai-personality-analysis');
    
    // Remove existing if any to prevent duplicates
    if (analysisDiv) analysisDiv.remove();
    
    analysisDiv = document.createElement('div');
    analysisDiv.id = 'ai-personality-analysis';
    analysisDiv.className = 'col-12 mt-4';
    analysisDiv.innerHTML = `
        <div class="card bg-dark border-gold">
            <div class="card-body">
                <h6 class="text-gold mb-3"><i class="fas fa-brain me-2"></i>AI Personality Insights</h6>
                <p class="text-muted mb-0" style="line-height: 1.6;">${analysis.personalityAnalysis}</p>
            </div>
        </div>
    `;
    
    // Insert after the test cards row
    if (personalitySection) {
        personalitySection.appendChild(analysisDiv);
    }

    // 2. Career Recommendations
    if (refs.recommendationsGrid) {
        refs.recommendationsGrid.innerHTML = '';
        if (analysis.recommendedCareers && analysis.recommendedCareers.length > 0) {
            analysis.recommendedCareers.forEach(career => {
                const col = document.createElement('div');
                col.className = 'col-md-4';
                col.innerHTML = `
                    <article class="job-card h-100">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h6 class="mb-0 text-gold text-uppercase" style="font-size: 0.9rem; letter-spacing: 0.05em;">${career.title}</h6>
                            <span class="fit-pill">${career.fit}</span>
                        </div>
                        <p class="text-muted mb-3 small flex-grow-1">${career.reason}</p>
                        <div class="job-card__skills mt-auto">
                            ${career.skills ? career.skills.map(skill => `<span>${skill}</span>`).join('') : ''}
                        </div>
                    </article>
                `;
                refs.recommendationsGrid.appendChild(col);
            });
        } else {
            refs.recommendationsGrid.innerHTML = '<div class="col-12 text-center text-muted"><p>No specific career recommendations found.</p></div>';
        }
    }

    // 3. Resources
    const savedCareersSection = document.getElementById('saved-careers');
    if (savedCareersSection) {
        // Update section header
        const header = savedCareersSection.querySelector('.section-heading');
        if (header) {
            header.querySelector('h5').textContent = "Recommended Resources";
            header.querySelector('p').textContent = "Curated learning path based on your profile.";
        }
        
        const container = document.getElementById('savedJobsGrid');
        if (container) {
            container.innerHTML = '';
            
            // Helper to create resource lists
            const createResourceList = (title, items, icon) => {
                if (!items || items.length === 0) return '';
                return `
                    <div class="col-md-6 mb-4">
                        <div class="card h-100 bg-dark border-secondary">
                            <div class="card-body">
                                <h6 class="text-gold mb-3"><i class="${icon} me-2"></i>${title}</h6>
                                <ul class="list-group list-group-flush bg-transparent">
                                    ${items.map(item => `
                                        <li class="list-group-item bg-transparent text-muted border-secondary px-0 py-2">
                                            <a href="${item.link || '#'}" target="_blank" class="text-decoration-none text-light hover-gold d-flex justify-content-between align-items-center">
                                                <span>${item.title}</span>
                                                <i class="fas fa-external-link-alt small text-muted ms-2"></i>
                                            </a>
                                            ${item.platform || item.author ? `<small class="d-block text-muted mt-1">${item.platform || item.author}</small>` : ''}
                                        </li>
                                    `).join('')}
                                </ul>
                            </div>
                        </div>
                    </div>
                `;
            };

            let resourcesHTML = '<div class="row g-4 w-100">';
            
            // Courses
            const courses = [...(analysis.learningResources?.paidCourses || []), ...(analysis.learningResources?.freeCourses || [])];
            resourcesHTML += createResourceList('Top Courses', courses.slice(0, 5), 'fa-solid fa-graduation-cap');
            
            // Books
            resourcesHTML += createResourceList('Recommended Books', analysis.learningResources?.books?.slice(0, 5), 'fa-solid fa-book');
            
            // Videos/Podcasts
            const media = [...(analysis.learningResources?.youtubeVideos || []), ...(analysis.learningResources?.podcasts || [])];
            resourcesHTML += createResourceList('Videos & Podcasts', media.slice(0, 5), 'fa-brands fa-youtube');
            
            // Roadmap
            if (analysis.roadmap) {
                const roadmapItems = analysis.roadmap.map(r => ({ 
                    title: r.step, 
                    platform: r.description 
                }));
                resourcesHTML += createResourceList('Learning Roadmap', roadmapItems, 'fa-solid fa-road');
            }
            
            resourcesHTML += '</div>';
            container.innerHTML = resourcesHTML;
        }
    }
}

// ==========================================
// 3. Visualization (Chart.js)
// ==========================================

function renderChart() {
    if (!refs.resultsChartCanvas) return;

    // Destroy existing chart if any
    if (window.myProfileChart) {
        window.myProfileChart.destroy();
    }

    const ctx = refs.resultsChartCanvas.getContext('2d');
    
    // Prepare data
    let labels = [];
    let dataPoints = [];
    let label = '';
    let chartType = 'bar';

    if (state.testResults.bigFive) {
        // Big Five Radar Chart
        labels = ['Openness', 'Conscientiousness', 'Extraversion', 'Agreeableness', 'Neuroticism'];
        const b5 = state.testResults.bigFive;
        // Handle different casing/naming
        dataPoints = [
            b5.Openness || b5.openness || 0,
            b5.Conscientiousness || b5.conscientiousness || 0,
            b5.Extraversion || b5.extraversion || 0,
            b5.Agreeableness || b5.agreeableness || 0,
            b5.Neuroticism || b5.neuroticism || 0
        ];
        label = 'Big Five Traits';
        chartType = 'radar';
    } else if (state.testResults.holland) {
        // Holland Bar Chart
        labels = ['Realistic', 'Investigative', 'Artistic', 'Social', 'Enterprising', 'Conventional'];
        const h = state.testResults.holland;
        dataPoints = [
            h.Realistic || h.realistic || h.R || 0,
            h.Investigative || h.investigative || h.I || 0,
            h.Artistic || h.artistic || h.A || 0,
            h.Social || h.social || h.S || 0,
            h.Enterprising || h.enterprising || h.E || 0,
            h.Conventional || h.conventional || h.C || 0
        ];
        label = 'Holland Codes';
        chartType = 'bar';
    } else {
        return; // No data to chart
    }

    window.myProfileChart = new Chart(ctx, {
        type: chartType,
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: dataPoints,
                backgroundColor: 'rgba(212, 175, 55, 0.2)', // Gold with opacity
                borderColor: '#d4af37', // Gold
                borderWidth: 2,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#d4af37'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: { // For radar
                    angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    pointLabels: { color: '#fff', font: { size: 12 } },
                    suggestedMin: 0,
                    suggestedMax: 100
                },
                y: { // For bar
                    display: chartType === 'bar',
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#fff' }
                },
                x: {
                    display: chartType === 'bar',
                    grid: { display: false },
                    ticks: { color: '#fff' }
                }
            },
            plugins: {
                legend: { labels: { color: '#fff' } }
            }
        }
    });
}

// ==========================================
// 4. Export PDF
// ==========================================

function handleExportPDF() {
    const element = document.querySelector('.profile-page');
    const opt = {
        margin: [5, 5],
        filename: `SIA_Profile_${state.userData?.fullName || 'Report'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    // Temporarily hide buttons for clean PDF
    const buttons = document.querySelectorAll('button, .btn');
    buttons.forEach(b => b.classList.add('d-none-print'));
    
    // Add print style class
    document.body.classList.add('printing-pdf');

    html2pdf().set(opt).from(element).save().then(() => {
        // Restore buttons
        buttons.forEach(b => b.classList.remove('d-none-print'));
        document.body.classList.remove('printing-pdf');
    });
}

// ==========================================
// 5. Helpers
// ==========================================

function enableEditMode() {
    state.isEditing = true;
    refs.saveProfileBtn.classList.remove('d-none');
    refs.editProfileBtn.classList.add('disabled');
    toggleHeaderInputs(true);
    togglePersonalInfoFields(false);
}

function saveProfileChanges() {
    if (!state.isEditing) return;
    const formData = new FormData(refs.personalInfoForm);
    
    // Get radio value manually if needed, or rely on FormData
    let studentStatus = null;
    if (document.getElementById('statusStudent').checked) studentStatus = 'Student';
    if (document.getElementById('statusGraduate').checked) studentStatus = 'Graduate';

    const updatedData = {
        fullName: formData.get('fullName'),
        email: formData.get('email'), // Allow email update if needed, or keep read-only
        dateOfBirth: formData.get('dob'),
        education: formData.get('education'),
        studentStatus: studentStatus
    };
    
    // If 'Other' education is selected, save the specific text
    if (updatedData.education === 'Other') {
        updatedData.education = formData.get('educationOther');
    }

    firebase.firestore().collection('users').doc(firebase.auth().currentUser.uid).update(updatedData)
        .then(() => {
            state.isEditing = false;
            refs.saveProfileBtn.classList.add('d-none');
            refs.editProfileBtn.classList.remove('disabled');
            toggleHeaderInputs(false);
            togglePersonalInfoFields(true);
            loadUserData(firebase.auth().currentUser); // Reload to refresh
            
            // Log Activity
            firebase.firestore().collection('users').doc(firebase.auth().currentUser.uid).collection('activityLogs').add({
                action: 'Updated Profile Information',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            alert('Saved!');
        })
        .catch(err => {
            console.error("Error saving profile:", err);
            alert("Error saving changes: " + err.message);
        });
}

function toggleHeaderInputs(show) {
    refs.userNameDisplay.classList.toggle('d-none', show);
    refs.userNameInput.classList.toggle('d-none', !show);
    // ... handle other inputs
}

function togglePersonalInfoFields(disabled) {
    const fields = refs.personalInfoForm.querySelectorAll('input, select');
    fields.forEach(f => f.disabled = disabled);
}

function handleEducationChange() {
    const isOther = refs.educationSelect.value === 'other' || refs.educationSelect.value === 'Other';
    refs.educationOtherInput.classList.toggle('d-none', !isOther);
}

function handleAvatarUpload(e) {
    // Placeholder for avatar upload logic
    console.log("Avatar upload triggered");
}

function handleChangePassword(e) {
    e.preventDefault();
    const newPass = refs.newPasswordInput.value;
    const user = firebase.auth().currentUser;
    
    user.updatePassword(newPass).then(() => {
        alert("Password updated!");
        bootstrap.Modal.getInstance(refs.changePasswordModal).hide();
    }).catch(err => alert(err.message));
}

function initHamburgerMenu() {
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    const navAuth = document.querySelector('.nav-auth');

    if (hamburger) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navLinks.classList.toggle('active');
            navAuth.classList.toggle('active');
        });
    }
}
