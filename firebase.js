// Firebase v12 compat initialization
const firebaseConfig = {
    apiKey: "AIzaSyBbcUi02rCzwZOVY3uRloGKk21-fC7IFDk",
    authDomain: "sia-project-2458a.firebaseapp.com",
    projectId: "sia-project-2458a",
    storageBucket: "sia-project-2458a.firebasestorage.app",
    messagingSenderId: "415064406442",
    appId: "1:415064406442:web:c1550b2aad4d331b8b53d3",
    measurementId: "G-4F3VZ10MX1"
};

// Initialize Firebase (compat mode)
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
