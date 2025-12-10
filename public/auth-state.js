/**
 * Centralized Auth State Management
 * Provides a single source of truth for authentication state with proper initialization gating
 */

// Global auth state
window.authState = {
    user: null,
    ready: false,
    listeners: []
};

// Initialize auth state listener (single instance)
function initAuthState() {
    if (!window.firebase || !window.firebase.auth) {
        console.warn('Firebase not initialized yet, retrying...');
        setTimeout(initAuthState, 100);
        return;
    }

    firebase.auth().onAuthStateChanged((user) => {
        window.authState.user = user;
        window.authState.ready = true;
        
        // Notify all registered listeners
        window.authState.listeners.forEach(listener => {
            try {
                listener(user);
            } catch (error) {
                console.error('Error in auth state listener:', error);
            }
        });
        
        // Dispatch custom event for backward compatibility
        const event = new CustomEvent('auth-state-changed', { detail: { user } });
        document.dispatchEvent(event);
    });
}

// Register a listener for auth state changes
window.onAuthStateReady = function(callback) {
    if (window.authState.ready) {
        // Auth is already ready, call immediately
        callback(window.authState.user);
    } else {
        // Auth not ready yet, register listener
        window.authState.listeners.push(callback);
    }
};

// Wait for DOM and Firebase to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initAuthState, 100);
    });
} else {
    setTimeout(initAuthState, 100);
}

