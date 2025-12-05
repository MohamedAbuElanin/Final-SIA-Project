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
    const pathPrefix = getPathPrefix(); // Moved to top to avoid ReferenceError
    
    // Common HTML for Logged In State
    const loggedInHtml = `
        <a href="${pathPrefix}profile/profile.html" class="btn-nav btn-nav--signin">Profile</a>
        <button onclick="handleGlobalLogout()" class="btn-nav btn-nav--signup">Logout</button>
    `;

    // Common HTML for Logged Out State
    const loggedOutHtml = `
        <a href="${pathPrefix}sign in/signin.html" class="btn-nav btn-nav--signin">Sign In</a>
        <a href="${pathPrefix}sign up/signup.html" class="btn-nav btn-nav--signup">Sign Up</a>
    `;

    const content = user ? loggedInHtml : loggedOutHtml;

    if (navAuth) navAuth.innerHTML = content;
    if (drawerAuth) drawerAuth.innerHTML = content;
}

function getPathPrefix() {
    const path = window.location.pathname;
    
    // Check depth based on known subdirectory names
    const subdirs = ['/profile/', '/Test/', '/About/', '/sign in/', '/sign up/', '/reset/', '/admin/', '/errors/'];
    if (subdirs.some(subdir => path.includes(subdir))) {
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
    const pathPrefix = getPathPrefix(); // Moved to top to avoid ReferenceError
    
    // Common HTML for Logged In State
    const loggedInHtml = `
        <a href="${pathPrefix}profile/profile.html" class="btn-nav btn-nav--signin">Profile</a>
        <button onclick="handleGlobalLogout()" class="btn-nav btn-nav--signup">Logout</button>
    `;

    // Common HTML for Logged Out State
    const loggedOutHtml = `
        <a href="${pathPrefix}sign in/signin.html" class="btn-nav btn-nav--signin">Sign In</a>
        <a href="${pathPrefix}sign up/signup.html" class="btn-nav btn-nav--signup">Sign Up</a>
    `;

    const content = user ? loggedInHtml : loggedOutHtml;

    if (navAuth) navAuth.innerHTML = content;
    if (drawerAuth) drawerAuth.innerHTML = content;
}

function getPathPrefix() {
    const path = window.location.pathname;
    
    // Check depth based on known subdirectory names
    const subdirs = ['/profile/', '/Test/', '/About/', '/sign in/', '/sign up/', '/reset/', '/admin/', '/errors/'];
    if (subdirs.some(subdir => path.includes(subdir))) {
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
