/**
 * Auth Guard
 * Protects pages that require authentication.
 * Redirects to sign in page if no user is found.
 */

(function() {
    // Determine path to signin page based on current location
    function getSigninPath() {
        // If we are in public root (index.html) or a subfolder like /profile/
        // We need to handle this dynamically or assume a structure.
        // For /profile/profile.html, signin is at ../sign in/signin.html
        
        const path = window.location.pathname;
        if (path.includes('/profile/') || path.includes('/Test/')) {
            return '../sign in/signin.html';
        }
        // Add more specific paths if needed
        return './sign in/signin.html';
    }

    // Wait for Firebase to initialize
    const checkFirebase = setInterval(() => {
        if (window.firebase && window.firebase.auth) {
            clearInterval(checkFirebase);
            
            firebase.auth().onAuthStateChanged((user) => {
                if (!user) {
                    console.log("User not authenticated. Redirecting...");
                    // Store current URL to redirect back after login (optional future enhancement)
                    sessionStorage.setItem('redirectUrl', window.location.href);
                    window.location.href = getSigninPath();
                }
            });
        }
    }, 100);
})();
