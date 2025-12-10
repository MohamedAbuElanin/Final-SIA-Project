// Firebase Configuration - v9 Compat Mode
// Note: Firebase API keys are safe to expose in client-side code (publicly visible).
// They identify your project, but security is handled via Firebase Security Rules (Firestore/Storage) and App Check.
// Do not commit service account keys (private keys) which are for backend only.

const firebaseConfig = {
  apiKey: "AIzaSyBbcUi02rCzwZOVY3uRloGKk21-fC7IFDk",
  authDomain: "sia-993a7.firebaseapp.com",
  projectId: "sia-993a7",
  storageBucket: "sia-993a7.firebasestorage.app",
  messagingSenderId: "415064406442",
  appId: "1:415064406442:web:c1550b2aad4d331b8b53d3",
  measurementId: "G-4F3VZ10MX1",
};

// Defensive check: Verify domain authorization
function checkFirebaseDomain() {
    const currentHostname = window.location.hostname;
    const expectedDomains = [
        'sia-993a7.firebaseapp.com',
        'sia-993a7.web.app',
        'localhost',
        '127.0.0.1'
    ];
    
    const isAuthorized = expectedDomains.some(domain => 
        currentHostname === domain || currentHostname.endsWith('.' + domain)
    );
    
    if (!isAuthorized && currentHostname !== 'localhost' && currentHostname !== '127.0.0.1') {
        console.warn('⚠️ Firebase Domain Warning:', {
            current: currentHostname,
            expected: expectedDomains.join(' or '),
            message: 'This domain may not be authorized. Please add it to Firebase Console → Authentication → Authorized domains'
        });
    }
}

// Check for emulator settings that might override production
function checkEmulatorSettings() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // Allow emulator in development
        return;
    }
    
    // Ensure no emulator settings are active in production
    if (typeof firebase !== 'undefined' && firebase.firestore) {
        const firestoreSettings = firebase.firestore().settings;
        if (firestoreSettings && firestoreSettings.host && firestoreSettings.host.includes('localhost')) {
            console.error('❌ Emulator settings detected in production! Disabling emulator.');
            firebase.firestore().settings({ host: undefined });
        }
    }
}

// Initialize Firebase (v9 compat mode)
if (!firebase.apps.length) {
    checkFirebaseDomain();
    checkEmulatorSettings();
    firebase.initializeApp(firebaseConfig);
} else {
    // Already initialized, but check domain anyway
    checkFirebaseDomain();
}

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Make services available globally
window.db = db;
window.auth = auth;
window.storage = storage;

// Export config for defensive checks
window.firebaseConfig = firebaseConfig;
