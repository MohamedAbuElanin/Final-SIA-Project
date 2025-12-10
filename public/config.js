const CONFIG = {
    // Check if we are running locally (localhost or 127.0.0.1)
    // If local, assume backend is on port 5000.
    // If production (different hostname), use relative path '/api' which should be handled by Firebase Rewrites.
    API_BASE_URL: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:5000/api'
        : '/api',
    
    // Standalone Express server endpoint (for /submit-test)
    SERVER_BASE_URL: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:5000'
        : window.location.origin
};
