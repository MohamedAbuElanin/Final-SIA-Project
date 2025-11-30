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
            loadPersonalityResults(); // BACK-END DEVELOPER WILL HANDLE THIS PART
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
    
    // Monitor auth state changes (token expiration)
    firebase.auth().onAuthStateChanged((user) => {
        if (!user) {
            localStorage.clear();
            window.location.href = '../sign in/signin.html';
        }
    });
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
    // Default to male if gender is missing
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
                    defaultAvatar = '../assets/male.svg'; // Default to male if gender missing
                }
                
                // Store user data (only from Firestore, no Auth provider data)
                state.userData = {
                    fullName: userData.fullName || '',
                    email: userData.email || '',
                    dateOfBirth: userData.dateOfBirth || '',
                    gender: userData.gender || '',
                    education: userData.education || '',
                    studentStatus: userData.studentStatus || ''
                };

                // Avatar logic: Use Firestore avatar if exists, otherwise use default based on gender
                let avatar = userData.avatar;
                
                // If avatar exists and is a Storage URL (starts with http/https), use it
                if (avatar && (avatar.startsWith('http://') || avatar.startsWith('https://'))) {
                    // Use Storage URL directly
                } else if (avatar && (avatar === '../assets/male.svg' || avatar === '../assets/female.svg')) {
                    // If it's still the default SVG, use default based on gender
                    avatar = defaultAvatar;
                } else if (!avatar) {
                    // No avatar in Firestore, use default based on gender
                    avatar = defaultAvatar;
                }
                // If avatar is a relative path that's not the default, keep it as is
                
                // Set profile photo
                if (refs.profilePhoto) {
                    refs.profilePhoto.src = avatar;
                    refs.profilePhoto.alt = 'User avatar';
                    // Add smooth fade-in animation
                    refs.profilePhoto.style.opacity = '0';
                    setTimeout(() => {
                        refs.profilePhoto.style.transition = 'opacity 0.3s ease-in';
                        refs.profilePhoto.style.opacity = '1';
                    }, 100);
                }

                // Update display elements with REAL Firestore data (empty if not set)
                if (refs.userNameDisplay) refs.userNameDisplay.textContent = state.userData.fullName || '';
                if (refs.userEmailDisplay) refs.userEmailDisplay.textContent = state.userData.email || '';
                if (refs.userNameInput) refs.userNameInput.value = state.userData.fullName || '';
                if (refs.userEmailInput) refs.userEmailInput.value = state.userData.email || '';

                // Update form fields with REAL Firestore data (empty if not set, no placeholders)
                if (refs.fullNameInput) refs.fullNameInput.value = state.userData.fullName || '';
                if (refs.emailInput) refs.emailInput.value = state.userData.email || '';
                if (refs.dobInput) refs.dobInput.value = state.userData.dateOfBirth || '';
                
                // Handle education field - check if it's a standard option or "other"
                if (refs.educationSelect) {
                    const educationOptions = ['High School', 'Bachelor', 'Master', 'PhD', 'Other'];
                    if (educationOptions.includes(state.userData.education)) {
                        refs.educationSelect.value = state.userData.education;
                    } else if (state.userData.education) {
                        // If education is not a standard option, it's a custom "Other" value
                        refs.educationSelect.value = 'Other';
                        if (refs.educationOtherInput) {
                            refs.educationOtherInput.value = state.userData.education;
                        }
                    } else {
                        refs.educationSelect.value = '';
                    }
                }
                
                // Set student status (handle both 'student'/'graduate' and 'Student'/'Graduate')
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
                // User document doesn't exist, create one with minimal data
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
                        // Reload user data after creating profile
                        loadUserData(user);
                    });
            }
            
            // Hide loading state
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
    
    // If education is "Other", use the educationOther value, otherwise use education
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

    // Get current user
    const user = firebase.auth().currentUser;
    if (!user) {
        console.error('No user logged in');
        window.location.href = '../sign in/signin.html';
        return;
    }

    // Show loading state
    const saveBtn = refs.saveProfileBtn;
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    saveBtn.disabled = true;

    // Update Firestore
    firebase.firestore().collection('users').doc(user.uid).update(updatedData)
        .then(() => {
            // Update local state
            state.userData = {
                ...state.userData,
                ...updatedData
            };

            // Update display with real data
            if (refs.userNameDisplay) refs.userNameDisplay.textContent = state.userData.fullName || '';
            if (refs.userEmailDisplay) refs.userEmailDisplay.textContent = state.userData.email || '';

            toggleHeaderInputs(false);
            togglePersonalInfoFields(true);
            if (refs.saveProfileBtn) refs.saveProfileBtn.classList.add('d-none');
            if (refs.editProfileBtn) refs.editProfileBtn.classList.remove('disabled');
            state.isEditing = false;

            // Show success message
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
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB.');
        return;
    }
    
    const user = firebase.auth().currentUser;
    if (!user) {
        window.location.href = '../sign in/signin.html';
        return;
    }
    
    // Show loading state
    const uploadBtn = refs.uploadPhotoBtn;
    const originalText = uploadBtn.innerHTML;
    uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
    uploadBtn.disabled = true;
    
    // Upload to Firebase Storage
    const storageRef = firebase.storage().ref(`avatars/${user.uid}.jpg`);
    let downloadURL = null;
    
    storageRef.put(file)
        .then((snapshot) => {
            // Get download URL
            return snapshot.ref.getDownloadURL();
        })
        .then((url) => {
            downloadURL = url;
            // Update Firestore with new avatar URL
            return firebase.firestore().collection('users').doc(user.uid).update({
                avatar: downloadURL,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        })
        .then(() => {
            // Update profile photo display with smooth animation
            if (refs.profilePhoto && downloadURL) {
                refs.profilePhoto.style.opacity = '0';
                setTimeout(() => {
                    refs.profilePhoto.src = downloadURL;
                    refs.profilePhoto.style.transition = 'opacity 0.3s ease-in';
                    refs.profilePhoto.style.opacity = '1';
                }, 100);
            }
            
            // Reload user data
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
    
    // Reset input
    event.target.value = '';
}

function handleChangePassword(e) {
    e.preventDefault();
    
    const currentPassword = refs.currentPasswordInput.value;
    const newPassword = refs.newPasswordInput.value;
    const confirmPassword = refs.confirmNewPasswordInput.value;
    
    // Validation
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
    
    // Re-authenticate user first
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
    user.reauthenticateWithCredential(credential)
        .then(() => {
            // Update password
            return user.updatePassword(newPassword);
        })
        .then(() => {
            alert('Password changed successfully!');
            // Close modal
            const modal = bootstrap.Modal.getInstance(refs.changePasswordModal);
            if (modal) {
                modal.hide();
            }
            // Clear form
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

function loadPersonalityResults() {
    // BACK-END DEVELOPER WILL HANDLE THIS PART
    console.info('Personality results placeholder ready.');
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
