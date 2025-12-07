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
// Route Guard & Initialization
document.addEventListener('DOMContentLoaded', () => {
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
            checkUrlParams(); // Check if we need to enter edit mode immediately
        }).catch((error) => {
            console.error('Error getting token:', error);
            localStorage.clear();
            window.location.href = '../sign in/signin.html';
        });
    });
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
    refs.bigFiveChartContainer = document.getElementById('bigFiveChart');
    refs.hollandChartContainer = document.getElementById('hollandChart');
    refs.careerAnalysisContainer = document.getElementById('careerAnalysisContainer');
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
    
    // Use API Instead of Direct Firestore
    user.getIdToken().then(token => {
        fetch('/api/profile', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch profile api');
            return response.json();
        })
        .then(data => {
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
            
            // Render Activity Log from API response
            renderActivityLog(data.activity || []);
            
            // Initial Test Results from API response (optional, can still reload separately)
             if (data.testResults) {
                state.testResults.bigFive = data.testResults["bigFive"] || data.testResults["Big-Five"] || null;
                state.testResults.hollandCode = data.testResults["hollandCode"] || data.testResults["Holland"] || null;
                state.aiAnalysis = data.testResults["AI_Analysis"] || null;
                displayTestResults();
                if (state.aiAnalysis) {
                     displayAIAnalysis(state.aiAnalysis);
                     renderCharts();
                } else {
                     renderCharts(); 
                }
            } else {
                 loadTestResults(user); // Fallback if API didn't return test results
            }

        })
        .catch(err => {
            console.error("Error loading user data via API:", err);
            // Fallback to minimal display
            if (refs.userNameDisplay) refs.userNameDisplay.textContent = user.displayName || 'SIA User';
            if (refs.userEmailDisplay) refs.userEmailDisplay.textContent = user.email || '';
            state.isLoading = false;
        });
    });
}

function renderActivityLog(activities) {
    if (!refs.activityList) return;
    
    if (!activities || activities.length === 0) {
        refs.activityList.innerHTML = `
            <li class="list-group-item bg-transparent text-muted border-secondary">
                <i class="fas fa-info-circle me-2 text-gold"></i> Welcome to your new profile!
            </li>
        `;
        return;
    }
    
    refs.activityList.innerHTML = '';
    activities.forEach(log => {
        const date = log.timestamp ? new Date(log.timestamp).toLocaleDateString() : '';
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
}

function loadTestResults(user) {
    const db = firebase.firestore();
    const resultsRef = db.collection("TestsResults").doc(user.uid);

    resultsRef.get().then((doc) => {
        if (doc.exists) {
            const data = doc.data();
            state.testResults.bigFive = data["bigFive"] || data["Big-Five"] || data["BigFive"] || null;
            state.testResults.hollandCode = data["hollandCode"] || data["Holland-Code"] || data["Holland"] || null;
            state.aiAnalysis = data["AI_Analysis"] || null;

            displayTestResults();
            
            if (state.aiAnalysis) {
                console.log("Loading existing AI Analysis...");
                displayAIAnalysis(state.aiAnalysis);
                renderCharts();
            } else if (state.testResults.bigFive || state.testResults.hollandCode) {
                console.log("Tests found but no analysis. Generating...");
                generateAIAnalysis(user);
            } else {
                renderCharts();
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
                <a href="../Test/Test.html?mode=review&test=Big-Five" class="btn btn-outline-light btn-sm">View Results</a>
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
        if (state.testResults.hollandCode) {
            refs.hollandCard.innerHTML = `
                <div class="text-center mb-3">
                    <img src="${hollandImg}" alt="Holland Codes" style="width: 80px; height: auto;">
                </div>
                <h6 class="card-title text-gold">Holland Codes Overview</h6>
                <p class="text-muted mb-2">Completed</p>
                <a href="../Test/Test.html?mode=review&test=Holland-codes" class="btn btn-outline-light btn-sm">View Results</a>
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
        const user = firebase.auth().currentUser;
        if (!user) throw new Error("User not authenticated");
        
        const token = await user.getIdToken();

        const response = await fetch('/api/analyze-profile', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                userData: state.userData,
                bigFive: state.testResults.bigFive,
                holland: state.testResults.hollandCode
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
        renderCharts();

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
    
    if (analysis.personalityAnalysis) {
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
    }

    // 2. Career Recommendations (Simplified cards in recommendations section)
    if (refs.recommendationsGrid) {
        refs.recommendationsGrid.innerHTML = '';
        const careers = analysis.top3Careers || analysis.recommendedCareers || [];
        if (careers.length > 0) {
            careers.forEach((career, index) => {
                const col = document.createElement('div');
                col.className = 'col-md-4';
                col.innerHTML = `
                    <article class="job-card h-100">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h6 class="mb-0 text-gold text-uppercase" style="font-size: 0.9rem; letter-spacing: 0.05em;">${career.title}</h6>
                            <span class="badge bg-gold text-dark">${career.fit || 'N/A'}</span>
                        </div>
                        <p class="text-muted mb-3 small flex-grow-1">${career.reason || 'No reason provided.'}</p>
                        <div class="job-card__skills mt-auto">
                            ${career.skills && career.skills.length > 0 ? career.skills.map(skill => `<span class="badge bg-secondary me-1 mb-1">${skill}</span>`).join('') : '<span class="text-muted small">No skills listed</span>'}
                        </div>
                    </article>
                `;
                refs.recommendationsGrid.appendChild(col);
            });
        } else {
            refs.recommendationsGrid.innerHTML = '<div class="col-12 text-center text-muted"><p>No specific career recommendations found.</p></div>';
        }
    }

    // 3. Final Career Analysis with Roadmaps and Resources
    if (refs.careerAnalysisContainer) {
        const careers = analysis.top3Careers || [];
        if (careers.length > 0) {
            let careerHTML = '';
            
            careers.forEach((career, index) => {
                const rankEmojis = ['🥇', '🥈', '🥉'];
                careerHTML += `
                    <div class="card bg-dark border-gold mb-4">
                        <div class="card-header border-gold">
                            <h5 class="text-gold mb-0">
                                ${rankEmojis[index]} ${career.title} 
                                <span class="badge bg-gold text-dark ms-2">${career.fit || 'N/A'} Match</span>
                            </h5>
                            <p class="text-muted mb-0 mt-2">${career.reason || ''}</p>
                        </div>
                        <div class="card-body">
                            <div class="row g-4">
                                <!-- Roadmap Section -->
                                <div class="col-md-12">
                                    <h6 class="text-gold mb-3"><i class="fas fa-route me-2"></i>Career Roadmap</h6>
                                    <div class="roadmap-timeline">
                                        ${career.roadmap && career.roadmap.length > 0 ? career.roadmap.map((step, stepIndex) => `
                                            <div class="roadmap-step mb-3">
                                                <div class="d-flex align-items-start">
                                                    <div class="roadmap-number me-3">${stepIndex + 1}</div>
                                                    <div class="flex-grow-1">
                                                        <h6 class="text-light mb-1">${step.step || `Phase ${stepIndex + 1}`}</h6>
                                                        <p class="text-muted mb-0">${step.description || 'No description provided.'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        `).join('') : '<p class="text-muted">No roadmap available for this career.</p>'}
                                    </div>
                                </div>
                                
                                <!-- Resources Section -->
                                <div class="col-md-12">
                                    <h6 class="text-gold mb-3"><i class="fas fa-book-open me-2"></i>Top Resources</h6>
                                    <div class="row g-3">
                                        ${career.resources ? `
                                            <!-- Books -->
                                            ${career.resources.books && career.resources.books.length > 0 ? `
                                                <div class="col-md-4">
                                                    <div class="card bg-dark border-secondary h-100">
                                                        <div class="card-body">
                                                            <h6 class="text-gold mb-3"><i class="fas fa-book me-2"></i>Recommended Book</h6>
                                                            ${career.resources.books.slice(0, 1).map(book => `
                                                                <a href="${book.link || '#'}" target="_blank" class="text-decoration-none text-light d-block mb-2">
                                                                    <strong>${book.title || 'N/A'}</strong>
                                                                    ${book.author ? `<br><small class="text-muted">by ${book.author}</small>` : ''}
                                                                    <i class="fas fa-external-link-alt small text-muted ms-2"></i>
                                                                </a>
                                                            `).join('')}
                                                        </div>
                                                    </div>
                                                </div>
                                            ` : ''}
                                            
                                            <!-- YouTube Courses -->
                                            ${career.resources.youtubeCourses && career.resources.youtubeCourses.length > 0 ? `
                                                <div class="col-md-4">
                                                    <div class="card bg-dark border-secondary h-100">
                                                        <div class="card-body">
                                                            <h6 class="text-gold mb-3"><i class="fab fa-youtube me-2"></i>YouTube Course</h6>
                                                            ${career.resources.youtubeCourses.slice(0, 1).map(yt => `
                                                                <a href="${yt.link || '#'}" target="_blank" class="text-decoration-none text-light d-block mb-2">
                                                                    <strong>${yt.title || 'N/A'}</strong>
                                                                    ${yt.channel ? `<br><small class="text-muted">${yt.channel}</small>` : ''}
                                                                    <i class="fas fa-external-link-alt small text-muted ms-2"></i>
                                                                </a>
                                                            `).join('')}
                                                        </div>
                                                    </div>
                                                </div>
                                            ` : ''}
                                            
                                            <!-- Platform Courses -->
                                            ${career.resources.platforms && career.resources.platforms.length > 0 ? `
                                                <div class="col-md-4">
                                                    <div class="card bg-dark border-secondary h-100">
                                                        <div class="card-body">
                                                            <h6 class="text-gold mb-3"><i class="fas fa-graduation-cap me-2"></i>Platform Course</h6>
                                                            ${career.resources.platforms.slice(0, 1).map(platform => `
                                                                <a href="${platform.link || '#'}" target="_blank" class="text-decoration-none text-light d-block mb-2">
                                                                    <strong>${platform.title || 'N/A'}</strong>
                                                                    ${platform.platform ? `<br><small class="text-muted">on ${platform.platform}</small>` : ''}
                                                                    <i class="fas fa-external-link-alt small text-muted ms-2"></i>
                                                                </a>
                                                            `).join('')}
                                                        </div>
                                                    </div>
                                                </div>
                                            ` : ''}
                                        ` : '<div class="col-12"><p class="text-muted">No resources available for this career.</p></div>'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            refs.careerAnalysisContainer.innerHTML = careerHTML;
        } else {
            refs.careerAnalysisContainer.innerHTML = '<div class="alert alert-info bg-dark border-gold text-muted">No career analysis available yet. Complete both tests to generate recommendations.</div>';
        }
    }
}

// ==========================================
// 3. Visualization (ApexCharts)
// ==========================================

function renderCharts() {
    // Render Big Five Radar Chart
    if (state.testResults.bigFive && refs.bigFiveChartContainer) {
        const b5 = state.testResults.bigFive;
        const labels = ['Openness', 'Conscientiousness', 'Extraversion', 'Agreeableness', 'Neuroticism'];
        const dataPoints = [
            b5.Openness || b5.openness || b5.O || 0,
            b5.Conscientiousness || b5.conscientiousness || b5.C || 0,
            b5.Extraversion || b5.extraversion || b5.E || 0,
            b5.Agreeableness || b5.agreeableness || b5.A || 0,
            b5.Neuroticism || b5.neuroticism || b5.N || 0
        ];

        // Destroy existing chart if any
        if (window.bigFiveChart) {
            window.bigFiveChart.destroy();
        }

        const options = {
            series: [{ name: 'Score', data: dataPoints }],
            chart: {
                type: 'radar',
                height: 400,
                toolbar: { show: false },
                background: 'transparent'
            },
            colors: ['#d4af37'],
            xaxis: { categories: labels },
            yaxis: {
                min: 0,
                max: 100,
                tickAmount: 5
            },
            plotOptions: {
                radar: {
                    polygons: {
                        strokeColors: 'rgba(255, 255, 255, 0.1)',
                        fill: {
                            colors: ['transparent']
                        }
                    }
                }
            },
            fill: {
                opacity: 0.3
            },
            stroke: {
                width: 2,
                colors: ['#d4af37']
            },
            markers: {
                size: 5,
                colors: ['#d4af37'],
                strokeColors: '#fff',
                strokeWidth: 2
            },
            theme: {
                mode: 'dark'
            },
            tooltip: {
                theme: 'dark',
                y: {
                    formatter: (val) => `${val}%`
                }
            }
        };

        window.bigFiveChart = new ApexCharts(refs.bigFiveChartContainer, options);
        window.bigFiveChart.render();
    }

    // Render Holland Code Hexagon/Bar Chart
    if (state.testResults.hollandCode && refs.hollandChartContainer) {
        const h = state.testResults.hollandCode;
        const labels = ['Realistic', 'Investigative', 'Artistic', 'Social', 'Enterprising', 'Conventional'];
        const dataPoints = [
            h.Realistic || h.realistic || h.R || 0,
            h.Investigative || h.investigative || h.I || 0,
            h.Artistic || h.artistic || h.A || 0,
            h.Social || h.social || h.S || 0,
            h.Enterprising || h.enterprising || h.E || 0,
            h.Conventional || h.conventional || h.C || 0
        ];

        // Destroy existing chart if any
        if (window.hollandChart) {
            window.hollandChart.destroy();
        }

        const options = {
            series: [{ name: 'Score', data: dataPoints }],
            chart: {
                type: 'bar',
                height: 400,
                toolbar: { show: false },
                background: 'transparent'
            },
            colors: ['#d4af37'],
            plotOptions: {
                bar: {
                    borderRadius: 4,
                    horizontal: false,
                    distributed: false,
                    columnWidth: '60%'
                }
            },
            dataLabels: {
                enabled: true,
                style: {
                    colors: ['#fff']
                },
                formatter: (val) => `${val}%`
            },
            xaxis: {
                categories: labels,
                labels: {
                    style: {
                        colors: '#fff'
                    }
                }
            },
            yaxis: {
                min: 0,
                max: 100,
                labels: {
                    style: {
                        colors: '#fff'
                    },
                    formatter: (val) => `${val}%`
                },
                grid: {
                    borderColor: 'rgba(255, 255, 255, 0.1)'
                }
            },
            grid: {
                borderColor: 'rgba(255, 255, 255, 0.1)',
                strokeDashArray: 4
            },
            fill: {
                opacity: 0.8,
                type: 'gradient',
                gradient: {
                    shade: 'dark',
                    type: 'vertical',
                    shadeIntensity: 0.5,
                    gradientToColors: ['#f4d03f'],
                    inverseColors: false,
                    opacityFrom: 0.8,
                    opacityTo: 0.3,
                    stops: [0, 100]
                }
            },
            theme: {
                mode: 'dark'
            },
            tooltip: {
                theme: 'dark',
                y: {
                    formatter: (val) => `${val}%`
                }
            }
        };

        window.hollandChart = new ApexCharts(refs.hollandChartContainer, options);
        window.hollandChart.render();
    }
}

// ==========================================
// 4. Export PDF
// ==========================================

function handleExportPDF() {
    // Show loading state
    const exportBtn = refs.exportPdfBtn;
    const originalText = exportBtn.innerHTML;
    exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Generating PDF...';
    exportBtn.disabled = true;

    const element = document.querySelector('.profile-page');
    
    // Ensure Final Career Analysis section is visible
    const careerAnalysisSection = document.getElementById('final-career-analysis');
    if (careerAnalysisSection) {
        careerAnalysisSection.classList.remove('d-none');
    }

    const opt = {
        margin: [10, 10, 10, 10],
        filename: `SIA_Profile_${state.userData?.fullName?.replace(/[^a-z0-9]/gi, '_') || 'Report'}_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2, 
            useCORS: true, 
            logging: false,
            windowWidth: element.scrollWidth,
            windowHeight: element.scrollHeight,
            backgroundColor: '#000000'
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'], before: '.profile-section' }
    };

    // Temporarily hide interactive elements for clean PDF
    const buttons = document.querySelectorAll('button, .btn:not(.d-print-block)');
    const inputs = document.querySelectorAll('input, select, textarea');
    const socialIcons = document.querySelectorAll('.footer__social');
    
    buttons.forEach(b => {
        if (!b.classList.contains('d-print-block')) {
            b.style.display = 'none';
        }
    });
    inputs.forEach(inp => inp.style.display = 'none');
    socialIcons.forEach(icon => icon.style.display = 'none');
    
    // Add print style class
    document.body.classList.add('printing-pdf');

    html2pdf().set(opt).from(element).save().then(() => {
        // Restore elements
        buttons.forEach(b => b.style.display = '');
        inputs.forEach(inp => inp.style.display = '');
        socialIcons.forEach(icon => icon.style.display = '');
        document.body.classList.remove('printing-pdf');
        
        // Restore button
        exportBtn.innerHTML = originalText;
        exportBtn.disabled = false;
    }).catch((error) => {
        console.error("PDF Export Error:", error);
        alert("Failed to generate PDF. Please try again.");
        exportBtn.innerHTML = originalText;
        exportBtn.disabled = false;
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
            // Sync with Auth Profile
            const user = firebase.auth().currentUser;
            user.updateProfile({
                displayName: updatedData.fullName,
                // photoURL: updatedData.avatar // If avatar was updated
            }).then(() => {
                console.log("Auth profile updated");
            }).catch(err => console.error("Error updating auth profile:", err));

            state.isEditing = false;
            refs.saveProfileBtn.classList.add('d-none');
            refs.editProfileBtn.classList.remove('disabled');
            toggleHeaderInputs(false);
            togglePersonalInfoFields(true);
            loadUserData(user); // Reload to refresh
            
            // Log Activity
            firebase.firestore().collection('users').doc(user.uid).collection('activityLogs').add({
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
    fields.forEach(f => {
        // Keep email disabled to prevent mismatch with Auth email
        if (f.id !== 'emailInput') {
            f.disabled = disabled;
        }
    });
}

function handleEducationChange() {
    const isOther = refs.educationSelect.value === 'other' || refs.educationSelect.value === 'Other';
    refs.educationOtherInput.classList.toggle('d-none', !isOther);
}

function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert('Image size should be less than 5MB.');
        return;
    }

    const user = firebase.auth().currentUser;
    if (!user) return;

    // Show loading state
    const uploadBtn = refs.uploadPhotoBtn;
    const originalText = uploadBtn.innerHTML;
    uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Uploading...';
    uploadBtn.disabled = true;

    // Create a reference to the file location
    const storageRef = firebase.storage().ref();
    const fileRef = storageRef.child(`users/${user.uid}/profile_${Date.now()}.jpg`);

    // Upload file
    fileRef.put(file).then((snapshot) => {
        // Get the URL
        return snapshot.ref.getDownloadURL();
    }).then((downloadURL) => {
        // Update Firestore
        return firebase.firestore().collection('users').doc(user.uid).update({
            avatar: downloadURL
        }).then(() => {
            return downloadURL; // Pass URL to next chain
        });
    }).then((downloadURL) => {
        // Update Auth Profile (optional but good for consistency)
        return user.updateProfile({
            photoURL: downloadURL
        }).then(() => downloadURL);
    }).then((downloadURL) => {
        // Update UI
        if (refs.profilePhoto) refs.profilePhoto.src = downloadURL;
        
        // Log Activity
        firebase.firestore().collection('users').doc(user.uid).collection('activityLogs').add({
            action: 'Updated Profile Picture',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert('Profile photo updated successfully!');
    }).catch((error) => {
        console.error("Error uploading avatar:", error);
        alert('Failed to upload image: ' + error.message);
    }).finally(() => {
        // Reset button
        uploadBtn.innerHTML = originalText;
        uploadBtn.disabled = false;
        // Clear input so same file can be selected again if needed
        e.target.value = '';
    });
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
