// Firebase Configuration - v9 Compat Mode
// Note: Firebase API keys are safe to expose in client-side code (publicly visible).
// They identify your project, but security is handled via Firebase Security Rules (Firestore/Storage) and App Check.
// Do not commit service account keys (private keys) which are for backend only.
const firebaseConfig = {
  apiKey: "AIzaSyBbcUi02rCzwZOVY3uRloGKk21-fC7IFDk",
  authDomain: "sia-project-2458a.firebaseapp.com",
  projectId: "sia-project-2458a",
  storageBucket: "sia-project-2458a.firebasestorage.app",
  messagingSenderId: "415064406442",
  appId: "1:415064406442:web:c1550b2aad4d331b8b53d3",
  measurementId: "G-4F3VZ10MX1",
};

// Initialize Firebase (v9 compat mode)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Make services available globally
window.db = db;
window.auth = auth;
window.storage = storage;
