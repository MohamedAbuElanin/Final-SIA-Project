/* ============================================================
   SIA Profile Page Scripts
   Clean, optimized version with real Firestore data only
   ============================================================ */

const state = {
    isEditing: false,
    userData: null,
    isLoading: true
};

// Route Guard: Check Firebase Authentication state
document.addEventListener('DOMContentLoaded', () => {
    // Wait for Firebase to initialize
    setTimeout(() => {
        if (!window.firebase) {
            console.error("Firebase not initialized!");
            return;
        }

        firebase.auth().onAuthStateChanged((user) => {
            if (!user) {
                // User is not authenticated, clear localStorage and redirect to Sign In page
                localStorage.clear();
                window.location.href = '../sign in/signin.html';
                return;
            }
            
            // User is authenticated, verify token and initialize page
            user.getIdToken().then((token) => {
                // Update token in localStorage
                localStorage.setItem("authToken", token);
                localStorage.setItem("uid", user.uid);
                
                // Initialize page
                initHamburgerMenu();
                cacheElements();
                bindEvents();
                loadUserData(user); // Load user data from Firestore
                loadPersonalityResults(user); // Load Test Results
                loadCareerRecommendations(); // BACK-END DEVELOPER WILL HANDLE THIS PART
                loadSavedJobs(); // BACK-END DEVELOPER WILL HANDLE THIS PART
                loadActivityLog(); // BACK-END DEVELOPER WILL HANDLE THIS PART
            }).catch((error) => {
                console.error('Error getting token:', error);
                // Token expired or invalid, redirect to sign in
                localStorage.clear();
                window.location.href = '../sign in/signin.html';
            });
        });
    }, 1000);
});

const refs = {};

function cacheElements() {
    refs.userNameDisplay = document.getElementById('userNameDisplay');
    refs.userEmailDisplay = document.getElementById('userEmailDisplay');
    refs.userNameInput = document.getElementById('userNameInput');
    refs.userEmailInput = document.getElementById('userEmailInput');
    refs.fullNameInput = document.getElementById('fullNameInput');
    refs.emailInput = document.getElementById('emailInput');
    refs.dobInput = document.getElementById('dobInput');
    refs.editProfileBtn = document.getElementById('editProfileBtn');
    refs.saveProfileBtn = document.getElementById('saveProfileBtn');
    refs.personalInfoForm = document.getElementById('personalInfoForm');
    refs.educationSelect = document.getElementById('educationSelect');
    refs.educationOtherInput = document.getElementById('educationOtherInput');
    refs.statusStudent = document.getElementById('statusStudent');
    refs.statusGraduate = document.getElementById('statusGraduate');
    refs.recommendationsGrid = document.getElementById('recommendationsGrid');
    refs.savedJobsGrid = document.getElementById('savedJobsGrid');
    refs.activityList = document.getElementById('activityList');
    refs.uploadPhotoBtn = document.getElementById('uploadPhotoBtn');
    refs.changePasswordBtn = document.getElementById('changePasswordBtn');
    refs.deleteAccountBtn = document.getElementById('deleteAccountBtn');
    refs.profilePhoto = document.getElementById('profilePhoto');
    refs.logoutBtn = document.getElementById('logoutBtn');
    refs.avatarUploadInput = document.getElementById('avatarUploadInput');
    refs.changePasswordForm = document.getElementById('changePasswordForm');
    refs.currentPasswordInput = document.getElementById('currentPasswordInput');
    refs.newPasswordInput = document.getElementById('newPasswordInput');
    refs.confirmNewPasswordInput = document.getElementById('confirmNewPasswordInput');
    refs.changePasswordModal = document.getElementById('changePasswordModal');
    
    // Test Result Cards
    refs.bigFiveCard = document.querySelector('#personality-results .col-md-6:nth-child(1) .card-body');
    refs.hollandCard = document.querySelector('#personality-results .col-md-6:nth-child(2) .card-body');
}

function bindEvents() {
    refs.editProfileBtn?.addEventListener('click', enableEditMode);
    refs.saveProfileBtn?.addEventListener('click', saveProfileChanges);
    refs.uploadPhotoBtn?.addEventListener('click', () => {
        if (refs.avatarUploadInput) {
            refs.avatarUploadInput.click();
        }
    });
    if (refs.avatarUploadInput) {
        refs.avatarUploadInput.addEventListener('change', handleAvatarUpload);
    }
    refs.educationSelect?.addEventListener('change', handleEducationChange);
    refs.changePasswordBtn?.addEventListener('click', () => {
        if (refs.changePasswordModal) {
            const modal = new bootstrap.Modal(refs.changePasswordModal);
            modal.show();
        }
    });
    
    if (refs.changePasswordForm) {
        refs.changePasswordForm.addEventListener('submit', handleChangePassword);
    }
    refs.deleteAccountBtn?.addEventListener('click', () => {
        console.warn('Delete account requested.');
        // BACK-END DEVELOPER WILL HANDLE THIS PART
    });
    if (refs.logoutBtn) {
        refs.logoutBtn.addEventListener('click', handleLogout);
    }
}

function handleLogout() {
    firebase.auth().signOut()
        .then(() => {
            localStorage.clear();
            window.location.href = '../sign in/signin.html';
        })
        .catch((error) => {
            console.error('Error signing out:', error);
            localStorage.clear();
            window.location.href = '../sign in/signin.html';
        });
}

function loadUserData(user) {
    // Show loading state
    state.isLoading = true;
    
    // Set default avatar based on gender (before Firestore loads)
    let defaultAvatar = '../assets/male.svg';
    
    // Load user data from Firestore
    firebase.firestore().collection('users').doc(user.uid).get()
        .then((doc) => {
            if (doc.exists) {
                const userData = doc.data();
                
                // Determine default avatar based on gender from Firestore
                const userGender = userData.gender || 'male';
                if (userGender === 'male') {
                    defaultAvatar = '../assets/male.svg';
                } else if (userGender === 'female') {
                    defaultAvatar = '../assets/female.svg';
                } else {
                    defaultAvatar = '../assets/male.svg';
                }
                
                // Store user data
                state.userData = {
                    fullName: userData.fullName || '',
                    email: userData.email || '',
                    dateOfBirth: userData.dateOfBirth || '',
                    gender: userData.gender || '',
                    education: userData.education || '',
                    studentStatus: userData.studentStatus || ''
                };

                // Avatar logic
                let avatar = userData.avatar;
                if (avatar && (avatar.startsWith('http://') || avatar.startsWith('https://'))) {
                    // Use Storage URL
                } else if (avatar && (avatar === '../assets/male.svg' || avatar === '../assets/female.svg')) {
                    avatar = defaultAvatar;
                } else if (!avatar) {
                    avatar = defaultAvatar;
                }
                
                // Set profile photo
                if (refs.profilePhoto) {
                    refs.profilePhoto.src = avatar;
                    refs.profilePhoto.alt = 'User avatar';
                    refs.profilePhoto.style.opacity = '0';
                    setTimeout(() => {
                        refs.profilePhoto.style.transition = 'opacity 0.3s ease-in';
                        refs.profilePhoto.style.opacity = '1';
                    }, 100);
                }

                // Update display elements
                if (refs.userNameDisplay) refs.userNameDisplay.textContent = state.userData.fullName || '';
                if (refs.userEmailDisplay) refs.userEmailDisplay.textContent = state.userData.email || '';
                if (refs.userNameInput) refs.userNameInput.value = state.userData.fullName || '';
                if (refs.userEmailInput) refs.userEmailInput.value = state.userData.email || '';

                // Update form fields
                if (refs.fullNameInput) refs.fullNameInput.value = state.userData.fullName || '';
                if (refs.emailInput) refs.emailInput.value = state.userData.email || '';
                if (refs.dobInput) refs.dobInput.value = state.userData.dateOfBirth || '';
                
                // Handle education field
                if (refs.educationSelect) {
                    const educationOptions = ['High School', 'Bachelor', 'Master', 'PhD', 'Other'];
                    if (educationOptions.includes(state.userData.education)) {
                        refs.educationSelect.value = state.userData.education;
                    } else if (state.userData.education) {
                        refs.educationSelect.value = 'Other';
                        if (refs.educationOtherInput) {
                            refs.educationOtherInput.value = state.userData.education;
                        }
                    } else {
                        refs.educationSelect.value = '';
                    }
                }
                
                // Set student status
                if (refs.statusStudent && refs.statusGraduate) {
                    refs.statusStudent.checked = false;
                    refs.statusGraduate.checked = false;
                    
                    if (state.userData.studentStatus === 'student' || state.userData.studentStatus === 'Student') {
                        refs.statusStudent.checked = true;
                    } else if (state.userData.studentStatus === 'graduate' || state.userData.studentStatus === 'Graduate') {
                        refs.statusGraduate.checked = true;
                    }
                }

                handleEducationChange();
            } else {
                // User document doesn't exist, create one
                const defaultAvatar = '../assets/male.svg';
                const userProfile = {
                    uid: user.uid,
                    fullName: '',
                    email: user.email || '',
                    dateOfBirth: '',
                    gender: 'male',
                    education: '',
                    studentStatus: '',
                    avatar: defaultAvatar,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                firebase.firestore().collection('users').doc(user.uid).set(userProfile)
                    .then(() => {
                        loadUserData(user);
                    });
            }
            
            state.isLoading = false;
        })
        .catch((error) => {
            console.error('Error loading user data:', error);
            state.isLoading = false;
        });
}

function enableEditMode() {
    state.isEditing = true;
    refs.saveProfileBtn.classList.remove('d-none');
    refs.editProfileBtn.classList.add('disabled');

    toggleHeaderInputs(true);
    togglePersonalInfoFields(false);
    refs.saveProfileBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function saveProfileChanges() {
    if (!state.isEditing) return;
    
    const formData = new FormData(refs.personalInfoForm);
    const educationValue = formData.get('education');
    const educationOtherValue = formData.get('educationOther');
    
    const finalEducation = educationValue === 'other' && educationOtherValue 
        ? educationOtherValue 
        : educationValue;
    
    const updatedData = {
        fullName: formData.get('fullName') || '',
        email: formData.get('email') || '',
        dateOfBirth: formData.get('dob') || '',
        education: finalEducation || '',
        studentStatus: formData.get('studentStatus') || '',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const user = firebase.auth().currentUser;
    if (!user) {
        window.location.href = '../sign in/signin.html';
        return;
    }

    const saveBtn = refs.saveProfileBtn;
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    saveBtn.disabled = true;

    firebase.firestore().collection('users').doc(user.uid).update(updatedData)
        .then(() => {
            state.userData = {
                ...state.userData,
                ...updatedData
            };

            if (refs.userNameDisplay) refs.userNameDisplay.textContent = state.userData.fullName || '';
            if (refs.userEmailDisplay) refs.userEmailDisplay.textContent = state.userData.email || '';

            toggleHeaderInputs(false);
            togglePersonalInfoFields(true);
            if (refs.saveProfileBtn) refs.saveProfileBtn.classList.add('d-none');
            if (refs.editProfileBtn) refs.editProfileBtn.classList.remove('disabled');
            state.isEditing = false;

            alert('Profile updated successfully!');
        })
        .catch((error) => {
            console.error('Error updating profile:', error);
            alert('Failed to update profile. Please try again.');
        })
        .finally(() => {
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        });
}

function toggleHeaderInputs(isEditing) {
    refs.userNameDisplay.classList.toggle('d-none', isEditing);
    refs.userEmailDisplay.classList.toggle('d-none', isEditing);
    refs.userNameInput.classList.toggle('d-none', !isEditing);
    refs.userEmailInput.classList.toggle('d-none', !isEditing);

    refs.userNameInput.disabled = !isEditing;
    refs.userEmailInput.disabled = !isEditing;

    if (isEditing) {
        refs.userNameInput.value = refs.userNameDisplay.textContent.trim();
        refs.userEmailInput.value = refs.userEmailDisplay.textContent.trim();
    } else {
        refs.userNameDisplay.textContent = refs.userNameInput.value || '';
        refs.userEmailDisplay.textContent = refs.userEmailInput.value || '';
    }
}

function togglePersonalInfoFields(disabled) {
    const fields = refs.personalInfoForm.querySelectorAll('input, select');
    fields.forEach(field => {
        if (field.id === 'educationOtherInput' && field.classList.contains('d-none')) {
            field.disabled = true;
            return;
        }
        field.disabled = disabled;
    });
}

function handleEducationChange() {
    const isOther = refs.educationSelect.value === 'other';
    refs.educationOtherInput.classList.toggle('d-none', !isOther);
    refs.educationOtherInput.disabled = !isOther || refs.educationSelect.disabled;
}

function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB.');
        return;
    }
    
    const user = firebase.auth().currentUser;
    if (!user) {
        window.location.href = '../sign in/signin.html';
        return;
    }
    
    const uploadBtn = refs.uploadPhotoBtn;
    const originalText = uploadBtn.innerHTML;
    uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
    uploadBtn.disabled = true;
    
    const storageRef = firebase.storage().ref(`avatars/${user.uid}.jpg`);
    let downloadURL = null;
    
    storageRef.put(file)
        .then((snapshot) => {
            return snapshot.ref.getDownloadURL();
        })
        .then((url) => {
            downloadURL = url;
            return firebase.firestore().collection('users').doc(user.uid).update({
                avatar: downloadURL,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        })
        .then(() => {
            if (refs.profilePhoto && downloadURL) {
                refs.profilePhoto.style.opacity = '0';
                setTimeout(() => {
                    refs.profilePhoto.src = downloadURL;
                    refs.profilePhoto.style.transition = 'opacity 0.3s ease-in';
                    refs.profilePhoto.style.opacity = '1';
                }, 100);
            }
            
            loadUserData(user);
            
            uploadBtn.innerHTML = originalText;
            uploadBtn.disabled = false;
            
            alert('Profile photo updated successfully!');
        })
        .catch((error) => {
            console.error('Error uploading avatar:', error);
            alert('Failed to upload profile photo. Please try again.');
            uploadBtn.innerHTML = originalText;
            uploadBtn.disabled = false;
        });
    
    event.target.value = '';
}

function handleChangePassword(e) {
    e.preventDefault();
    
    const currentPassword = refs.currentPasswordInput.value;
    const newPassword = refs.newPasswordInput.value;
    const confirmPassword = refs.confirmNewPasswordInput.value;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
        alert('Please fill in all fields.');
        return;
    }
    
    if (newPassword.length < 8) {
        alert('New password must be at least 8 characters long.');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        alert('New passwords do not match.');
        return;
    }
    
    const user = firebase.auth().currentUser;
    if (!user) {
        window.location.href = '../sign in/signin.html';
        return;
    }
    
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
    user.reauthenticateWithCredential(credential)
        .then(() => {
            return user.updatePassword(newPassword);
        })
        .then(() => {
            alert('Password changed successfully!');
            const modal = bootstrap.Modal.getInstance(refs.changePasswordModal);
            if (modal) {
                modal.hide();
            }
            refs.changePasswordForm.reset();
        })
        .catch((error) => {
            console.error('Error changing password:', error);
            let errorMessage = 'Failed to change password. ';
            
            switch (error.code) {
                case 'auth/wrong-password':
                    errorMessage += 'Current password is incorrect.';
                    break;
                case 'auth/weak-password':
                    errorMessage += 'New password is too weak.';
                    break;
                case 'auth/requires-recent-login':
                    errorMessage += 'Please sign out and sign in again before changing your password.';
                    break;
                default:
                    errorMessage += error.message || 'Please try again.';
            }
            
            alert(errorMessage);
        });
}

function loadPersonalityResults(user) {
    const db = firebase.firestore();
    
    // Load Big Five
    db.collection("users").doc(user.uid).collection("tests").doc("Big-Five").get()
        .then((doc) => {
            if (doc.exists) {
                const data = doc.data();
                const date = data.finishedAt ? data.finishedAt.toDate().toLocaleDateString() : "Unknown";
                const timeSpent = data.timeSpent ? Math.floor(data.timeSpent / 60) + "m " + (data.timeSpent % 60) + "s" : "Unknown";
                
                if (refs.bigFiveCard) {
                    refs.bigFiveCard.innerHTML = `
                        <h6 class="card-title text-gold">Big Five Overview</h6>
                        <p class="text-muted mb-2">Completed on: ${date}</p>
                        <p class="text-muted mb-3">Time spent: ${timeSpent}</p>
                        <a href="../Test/Test.html?mode=review&test=Big-Five" class="btn btn-outline-light btn-sm">Review Answers</a>
                    `;
                }
            } else {
                if (refs.bigFiveCard) {
                    refs.bigFiveCard.innerHTML = `
                        <h6 class="card-title text-gold">Big Five Overview</h6>
                        <p class="text-muted mb-3">Not yet completed.</p>
                        <a href="../Test/Test.html" class="btn btn-gold btn-sm">Start Test</a>
                    `;
                }
            }
        });

    // Load Holland Codes
    db.collection("users").doc(user.uid).collection("tests").doc("Holland-codes").get()
        .then((doc) => {
            if (doc.exists) {
                const data = doc.data();
                const date = data.finishedAt ? data.finishedAt.toDate().toLocaleDateString() : "Unknown";
                const timeSpent = data.timeSpent ? Math.floor(data.timeSpent / 60) + "m " + (data.timeSpent % 60) + "s" : "Unknown";
                
                if (refs.hollandCard) {
                    refs.hollandCard.innerHTML = `
                        <h6 class="card-title text-gold">Holland Codes Overview</h6>
                        <p class="text-muted mb-2">Completed on: ${date}</p>
                        <p class="text-muted mb-3">Time spent: ${timeSpent}</p>
                        <a href="../Test/Test.html?mode=review&test=Holland-codes" class="btn btn-outline-light btn-sm">Review Answers</a>
                    `;
                }
            } else {
                if (refs.hollandCard) {
                    refs.hollandCard.innerHTML = `
                        <h6 class="card-title text-gold">Holland Codes Overview</h6>
                        <p class="text-muted mb-3">Not yet completed.</p>
                        <a href="../Test/Test.html" class="btn btn-gold btn-sm">Start Test</a>
                    `;
                }
            }
        });
}

function loadCareerRecommendations() {
    // BACK-END DEVELOPER WILL HANDLE THIS PART
    const placeholderJobs = [
        { title: 'Data Strategist', skills: ['Python', 'SQL', 'Storytelling'], fit: '82%' },
        { title: 'Learning Experience Designer', skills: ['UX', 'Content', 'AI Tools'], fit: '75%' },
        { title: 'Talent Intelligence Analyst', skills: ['Power BI', 'Communication'], fit: '78%' }
    ];

    if (refs.recommendationsGrid) {
        refs.recommendationsGrid.innerHTML = '';
        placeholderJobs.forEach(job => {
            const col = document.createElement('div');
            col.className = 'col-md-4';
            col.innerHTML = `
                <article class="job-card">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6 class="mb-1 text-gold">${job.title}</h6>
                            <p class="text-muted mb-2 small">Next-gen role aligned with your assessments.</p>
                        </div>
                        <span class="fit-pill">${job.fit} fit</span>
                    </div>
                    <div class="job-card__skills">
                        ${job.skills.map(skill => `<span>${skill}</span>`).join('')}
                    </div>
                    <button class="btn btn-outline-light btn-sm align-self-start">View roadmap</button>
                </article>
            `;
            refs.recommendationsGrid.appendChild(col);
        });
    }
}

function loadSavedJobs() {
    // BACK-END DEVELOPER WILL HANDLE THIS PART
    const savedJobs = [
        { title: 'AI Product Manager', note: 'Blend research + execution', status: 'Monitoring updates' },
        { title: 'Career Coach (Hybrid)', note: 'High empathy role', status: 'Shortlisted' },
        { title: 'People Analytics Partner', note: 'Impact-driven insights', status: 'Interview scheduled' }
    ];

    if (refs.savedJobsGrid) {
        refs.savedJobsGrid.innerHTML = '';
        savedJobs.forEach(job => {
            const col = document.createElement('div');
            col.className = 'col-md-4';
            col.innerHTML = `
                <article class="saved-card h-100 d-flex flex-column">
                    <h6 class="text-gold">${job.title}</h6>
                    <p class="text-muted flex-grow-1">${job.note}</p>
                    <span class="badge bg-dark border border-light align-self-start">${job.status}</span>
                </article>
            `;
            refs.savedJobsGrid.appendChild(col);
        });
    }
}

function loadActivityLog() {
    // BACK-END DEVELOPER WILL HANDLE THIS PART
    const activities = [
        { text: 'Completed Big Five assessment', time: '2 days ago' },
        { text: 'Viewed career recommendations', time: 'Yesterday' },
        { text: 'Edited profile information', time: 'Today' }
    ];

    if (refs.activityList) {
        refs.activityList.innerHTML = '';
        activities.forEach(item => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            li.innerHTML = `
                <span>${item.text}</span>
                <small class="text-muted">${item.time}</small>
            `;
            refs.activityList.appendChild(li);
        });
    }
}

// Hamburger menu functionality
function initHamburgerMenu() {
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('navLinks');
    const navAuth = document.getElementById('navAuth');
    
    if (hamburger && navLinks && navAuth) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navLinks.classList.toggle('active');
            navAuth.classList.toggle('active');
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!hamburger.contains(e.target) && !navLinks.contains(e.target) && !navAuth.contains(e.target)) {
                hamburger.classList.remove('active');
                navLinks.classList.remove('active');
                navAuth.classList.remove('active');
            }
        });
        
        // Close menu when clicking a link
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                navLinks.classList.remove('active');
                navAuth.classList.remove('active');
            });
        });
    }
}
