import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBbcUi02rCzwZOVY3uRloGKk21-fC7IFDk",
    authDomain: "sia-project-2458a.firebaseapp.com",
    projectId: "sia-project-2458a",
    storageBucket: "sia-project-2458a.firebasestorage.app",
    messagingSenderId: "415064406442",
    appId: "1:415064406442:web:c1550b2aad4d331b8b53d3",
    measurementId: "G-4F3VZ10MX1"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
