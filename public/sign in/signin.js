// Console easter egg
console.log("Welcome to SIA — Ancient Wisdom for Modern Careers");

// Route Guard: Redirect if already logged in
// Wait for Firebase to initialize
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.firebase) {
            firebase.auth().onAuthStateChanged((user) => {
                if (user) {
                    // User is already logged in, redirect to profile
                    window.location.href = '../profile/profile.html';
                }
            });
        }
    }, 1000);
});

// Mobile hamburger menu toggle
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

// Password toggle functionality
const signInPasswordToggle = document.getElementById('signInPasswordToggle');
const signInPassword = document.getElementById('signInPassword');

if (signInPasswordToggle && signInPassword) {
    signInPasswordToggle.addEventListener('click', () => {
        const type = signInPassword.getAttribute('type') === 'password' ? 'text' : 'password';
        signInPassword.setAttribute('type', type);
        
        const icon = signInPasswordToggle.querySelector('i');
        if (type === 'password') {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        } else {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        }
    });
}

// Form validation
const signInForm = document.getElementById('signInFormElement');
const signInEmail = document.getElementById('signInEmail');
const signInPasswordInput = document.getElementById('signInPassword');
const signInEmailError = document.getElementById('signInEmailError');
const signInPasswordError = document.getElementById('signInPasswordError');
const signInFormError = document.getElementById('signInFormError');

// Email validation
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Clear errors
function clearErrors() {
    if (signInEmailError) signInEmailError.textContent = '';
    if (signInPasswordError) signInPasswordError.textContent = '';
    if (signInFormError) {
        signInFormError.textContent = '';
        signInFormError.classList.remove('show');
    }
}

// Real-time validation
if (signInEmail) {
    signInEmail.addEventListener('blur', () => {
        if (!signInEmail.value.trim()) {
            signInEmailError.textContent = 'Email is required';
        } else if (!validateEmail(signInEmail.value)) {
            signInEmailError.textContent = 'Please enter a valid email address';
        } else {
            signInEmailError.textContent = '';
        }
    });

    signInEmail.addEventListener('input', () => {
        if (signInEmailError.textContent) {
            signInEmailError.textContent = '';
        }
    });
}

if (signInPasswordInput) {
    signInPasswordInput.addEventListener('blur', () => {
        if (!signInPasswordInput.value.trim()) {
            signInPasswordError.textContent = 'Password is required';
        } else if (signInPasswordInput.value.length < 6) {
            signInPasswordError.textContent = 'Password must be at least 6 characters';
        } else {
            signInPasswordError.textContent = '';
        }
    });

    signInPasswordInput.addEventListener('input', () => {
        if (signInPasswordError.textContent) {
            signInPasswordError.textContent = '';
        }
    });
}

// Form submission
if (signInForm) {
    signInForm.addEventListener('submit', (e) => {
        e.preventDefault();
        clearErrors();

        let isValid = true;

        // Validate email
        if (!signInEmail.value.trim()) {
            signInEmailError.textContent = 'Email is required';
            isValid = false;
        } else if (!validateEmail(signInEmail.value)) {
            signInEmailError.textContent = 'Please enter a valid email address';
            isValid = false;
        }

        // Validate password
        if (!signInPasswordInput.value.trim()) {
            signInPasswordError.textContent = 'Password is required';
            isValid = false;
        } else if (signInPasswordInput.value.length < 6) {
            signInPasswordError.textContent = 'Password must be at least 6 characters';
            isValid = false;
        }

        if (!isValid) {
            return;
        }

        // Firebase Authentication integration
        const submitBtn = signInForm.querySelector('.form-btn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';
        submitBtn.disabled = true;

        const email = signInEmail.value.trim();
        const password = signInPasswordInput.value;

        // Sign in with email and password
        firebase.auth().signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // User signed in successfully
                const user = userCredential.user;
                
                // Get the ID token
                return user.getIdToken().then((token) => {
                    // Save tokens to localStorage
                    localStorage.setItem("authToken", token);
                    localStorage.setItem("uid", user.uid);
                    
                    return { user, token };
                });
            })
            .then(({ user }) => {
                // Redirect to profile page
                window.location.href = '../profile/profile.html';
            })
            .catch((error) => {
                // Handle errors
                let errorMessage = 'An error occurred. Please try again.';
                
                switch (error.code) {
                    case 'auth/user-not-found':
                        errorMessage = 'No account found with this email.';
                        signInEmailError.textContent = errorMessage;
                        break;
                    case 'auth/wrong-password':
                        errorMessage = 'Incorrect password.';
                        signInPasswordError.textContent = errorMessage;
                        break;
                    case 'auth/invalid-email':
                        errorMessage = 'Invalid email address.';
                        signInEmailError.textContent = errorMessage;
                        break;
                    case 'auth/user-disabled':
                        errorMessage = 'This account has been disabled.';
                        break;
                    case 'auth/network-request-failed':
                        errorMessage = 'Network error. Please check your connection.';
                        break;
                    case 'auth/too-many-requests':
                        errorMessage = 'Too many failed attempts. Please try again later.';
                        break;
                    default:
                        errorMessage = error.message || 'Invalid email or password. Please try again.';
                }
                
                signInFormError.textContent = errorMessage;
                signInFormError.classList.add('show');
                
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            });
    });
}

// Google Sign In
const googleBtn = document.querySelector('.google-btn');
if (googleBtn) {
    googleBtn.addEventListener('click', () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        
        googleBtn.disabled = true;
        const originalText = googleBtn.innerHTML;
        googleBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
        
        firebase.auth().signInWithPopup(provider)
            .then((result) => {
                const user = result.user;
                
                // Get ID token and save to localStorage
                return user.getIdToken().then((token) => {
                    localStorage.setItem("authToken", token);
                    localStorage.setItem("uid", user.uid);
                    
                    // Check if user document exists in Firestore
                    return firebase.firestore().collection('users').doc(user.uid).get()
                        .then((doc) => {
                            if (!doc.exists) {
                                // Create user profile with minimal data (only email from Google)
                                // Ignore Google's displayName and photoURL
                                const defaultAvatar = '../assets/male.svg'; // Default to male
                                
                                const userProfile = {
                                    uid: user.uid,
                                    fullName: '', // Empty - user will fill in profile
                                    email: user.email || '', // Only use email from Google
                                    dateOfBirth: '',
                                    gender: 'male', // Default
                                    education: '',
                                    studentStatus: '',
                                    avatar: defaultAvatar, // Use default, not Google photo
                                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                                };
                                
                                return firebase.firestore().collection('users').doc(user.uid).set(userProfile);
                            }
                        });
                });
            })
            .then(() => {
                window.location.href = '../profile/profile.html';
            })
            .catch((error) => {
                let errorMessage = 'An error occurred. Please try again.';
                
                switch (error.code) {
                    case 'auth/popup-closed-by-user':
                        errorMessage = 'Sign-in popup was closed.';
                        break;
                    case 'auth/cancelled-popup-request':
                        errorMessage = 'Sign-in was cancelled.';
                        break;
                    case 'auth/network-request-failed':
                        errorMessage = 'Network error. Please check your connection.';
                        break;
                    default:
                        errorMessage = error.message || 'Failed to sign in with Google.';
                }
                
                if (signInFormError) {
                    signInFormError.textContent = errorMessage;
                    signInFormError.classList.add('show');
                }
                
                googleBtn.innerHTML = originalText;
                googleBtn.disabled = false;
            });
    });
}

// Fade-in animation on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, observerOptions);

// Observe all elements with fade-in class
document.querySelectorAll('.fade-in').forEach(el => {
    observer.observe(el);
});

// Floating golden particles effect
const canvas = document.getElementById('particles');
if (canvas) {
    const ctx = canvas.getContext('2d');

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const particleCount = 50;

    class Particle {
        constructor() {
            this.reset();
            this.y = Math.random() * canvas.height;
        }
        
        reset() {
            this.x = Math.random() * canvas.width;
            this.y = -10;
            this.size = Math.random() * 3 + 1;
            this.speed = Math.random() * 2 + 0.5;
            this.opacity = Math.random() * 0.5 + 0.2;
            this.glow = Math.random() * 0.3 + 0.2;
        }
        
        update() {
            this.y += this.speed;
            this.x += Math.sin(this.y * 0.01) * 0.5;
            
            if (this.y > canvas.height) {
                this.reset();
            }
        }
        
        draw() {
            ctx.save();
            ctx.globalAlpha = this.opacity;
            ctx.fillStyle = '#D4AF37';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#D4AF37';
            
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
        }
    }

    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        particles.forEach(particle => {
            particle.update();
            particle.draw();
        });
        
        requestAnimationFrame(animate);
    }

    animate();

    // Handle window resize
    window.addEventListener('resize', function() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
}

// Hero section entrance animation
window.addEventListener('load', () => {
    const heroContent = document.querySelector('.hero-content');
    if (heroContent) {
        setTimeout(() => {
            heroContent.classList.add('visible');
        }, 200);
    }
});
