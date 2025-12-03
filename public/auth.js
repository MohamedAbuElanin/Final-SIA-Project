/**
 * Global Firebase Auth Listener
 * Handles UI updates based on authentication state across the entire website.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Wait for Firebase to initialize
    const checkFirebase = setInterval(() => {
        if (window.firebase) {
            clearInterval(checkFirebase);
            initAuthListener();
        }
    }, 100);
});

function initAuthListener() {
    firebase.auth().onAuthStateChanged((user) => {
        updateGlobalAuthUI(user);
        
        // Dispatch a custom event for other scripts to hook into if needed
        const event = new CustomEvent('auth-state-changed', { detail: { user } });
        document.dispatchEvent(event);
    });
}

function updateGlobalAuthUI(user) {
    const navAuth = document.getElementById('navAuth');
    const drawerAuth = document.querySelector('.drawer-auth');
    
    // Common HTML for Logged In State
    const loggedInHtml = `
        <a href="/profile/profile.html" class="btn-nav btn-nav--signin">Profile</a>
        <button onclick="handleGlobalLogout()" class="btn-nav btn-nav--signup">Logout</button>
    `;

    // Common HTML for Logged Out State
    // Note: Adjust paths if needed based on current page location, 
    // but absolute paths or root-relative paths are safer if hosted at root.
    // Using relative paths assuming this script is used in pages at different depths might be tricky.
    // Let's try to detect depth or use root relative if possible. 
    // For now, I'll use the paths that seem to work in main.js, but make them more robust.
    
    // Actually, main.js used:
    // <a href="./sign in/signin.html" ...
    // <a href="./sign up/signup.html" ...
    // This works for index.html but might fail for pages in subdirs.
    // I will use a helper to get the correct path prefix.
    
    const pathPrefix = getPathPrefix();

    const loggedOutHtml = `
        <a href="${pathPrefix}sign in/signin.html" class="btn-nav btn-nav--signin">Sign In</a>
        <a href="${pathPrefix}sign up/signup.html" class="btn-nav btn-nav--signup">Sign Up</a>
    `;

    const content = user ? loggedInHtml : loggedOutHtml;

    if (navAuth) navAuth.innerHTML = content;
    if (drawerAuth) drawerAuth.innerHTML = content;
}

function getPathPrefix() {
    // Simple check: if we are in a subdirectory like /profile/ or /Test/, we need to go up.
    // index.html is at root.
    const path = window.location.pathname;
    if (path.includes('/profile/') || path.includes('/Test/') || path.includes('/About/') || path.includes('/sign in/') || path.includes('/sign up/') || path.includes('/reset/')) {
        return '../';
    }
    return './';
}

window.handleGlobalLogout = function() {
    firebase.auth().signOut().then(() => {
        // Redirect to home or sign in page after logout
        window.location.href = getPathPrefix() + 'index.html';
    }).catch((error) => {
        console.error('Logout error:', error);
    });
};
