/* ============================================================
   SIA API Service Layer - Centralized API Management
   ============================================================
   
   Purpose:
   - Single source of truth for all API calls
   - Environment-aware URL resolution
   - Comprehensive error handling
   - Request/response logging
   - Automatic retry logic
   ============================================================ */

// ==========================================
// API CONFIGURATION
// ==========================================

const API_CONFIG = {
    // API Prefix - Single source of truth (NO leading slash for URL construction)
    PREFIX: 'api',
    
    // Base URLs for different environments
    BASE_URLS: {
        local: 'http://localhost:5000',
        production: window.CONFIG?.BACKEND_URL || 'https://your-backend-url.railway.app'
    },
    
    // Determine current environment
    getCurrentEnvironment() {
        const hostname = window.location.hostname;
        return (hostname === 'localhost' || hostname === '127.0.0.1') ? 'local' : 'production';
    },
    
    // Get base URL for current environment
    getBaseUrl() {
        const env = this.getCurrentEnvironment();
        const url = this.BASE_URLS[env];
        
        // Validate URL is set
        if (!url || url === 'https://your-backend-url.railway.app') {
            console.warn('[API Config] Backend URL not configured. Using localhost fallback.');
            return this.BASE_URLS.local;
        }
        
        return url;
    },
    
    // Get full API URL - CRITICAL: Prevents double slashes and malformed URLs
    getApiUrl(endpoint) {
        // Normalize endpoint (remove leading/trailing slashes)
        const cleanEndpoint = endpoint.replace(/^\/+|\/+$/g, '');
        
        if (!cleanEndpoint) {
            throw new Error('API endpoint cannot be empty');
        }
        
        // Get base URL and normalize (remove trailing slash)
        const baseUrl = this.getBaseUrl().replace(/\/+$/, '');
        const prefix = this.PREFIX.replace(/^\/+|\/+$/g, '');
        
        // Construct URL: baseUrl/prefix/endpoint
        const fullUrl = `${baseUrl}/${prefix}/${cleanEndpoint}`;
        
        // Validate URL format
        try {
            new URL(fullUrl);
        } catch (error) {
            console.error('[API Config] Invalid URL constructed:', fullUrl);
            throw new Error(`Invalid API URL: ${fullUrl}`);
        }
        
        return fullUrl;
    },
    
    // Debug: Log current configuration
    debug() {
        console.group('[API Config] Current Configuration');
        console.log('Environment:', this.getCurrentEnvironment());
        console.log('Base URL:', this.getBaseUrl());
        console.log('Prefix:', this.PREFIX);
        console.log('Example URL:', this.getApiUrl('health'));
        console.groupEnd();
    }
};

// ==========================================
// ERROR CLASSIFICATION
// ==========================================

class APIError extends Error {
    constructor(message, code, status, originalError) {
        super(message);
        this.name = 'APIError';
        this.code = code;
        this.status = status;
        this.originalError = originalError;
    }
}

// Error types
const ErrorTypes = {
    NETWORK_ERROR: 'NETWORK_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    SERVER_ERROR: 'SERVER_ERROR',
    INVALID_RESPONSE: 'INVALID_RESPONSE',
    TIMEOUT: 'TIMEOUT'
};

// ==========================================
// API SERVICE CLASS
// ==========================================

class APIService {
    constructor() {
        this.defaultHeaders = {
            'Content-Type': 'application/json'
        };
        this.timeout = 30000; // 30 seconds
    }
    
    /**
     * Get authentication token
     */
    async getAuthToken() {
        try {
            // Try to get from Firebase Auth
            if (window.auth && window.auth.currentUser) {
                return await window.auth.currentUser.getIdToken();
            }
            
            // Fallback to localStorage
            const token = localStorage.getItem('authToken');
            if (token) return token;
            
            throw new Error('No authentication token available');
        } catch (error) {
            console.error('[API Service] Error getting auth token:', error);
            throw error;
        }
    }
    
    /**
     * Check if API server is available
     */
    async checkHealth() {
        try {
            const healthUrl = API_CONFIG.getApiUrl('health');
            const response = await fetch(healthUrl, {
                method: 'GET',
                headers: this.defaultHeaders,
                signal: AbortSignal.timeout(5000) // 5 second timeout for health check
            });
            
            return response.ok;
        } catch (error) {
            console.warn('[API Service] Health check failed:', error.message);
            return false;
        }
    }
    
    /**
     * Make API request with comprehensive error handling
     */
    async request(endpoint, options = {}) {
        const {
            method = 'GET',
            body = null,
            requiresAuth = true,
            retries = 0,
            timeout = this.timeout
        } = options;
        
        // Validate endpoint
        if (!endpoint || typeof endpoint !== 'string') {
            throw new APIError(
                'Invalid endpoint',
                ErrorTypes.INVALID_RESPONSE,
                0,
                new Error(`Endpoint must be a non-empty string, got: ${typeof endpoint}`)
            );
        }
        
        const url = API_CONFIG.getApiUrl(endpoint);
        
        // Validate URL was constructed correctly
        if (!url || !url.startsWith('http')) {
            throw new APIError(
                `Invalid API URL constructed: ${url}`,
                ErrorTypes.NETWORK_ERROR,
                0,
                new Error('URL construction failed')
            );
        }
        
        // Prepare headers
        const headers = { ...this.defaultHeaders };
        
        // Add auth token if required
        if (requiresAuth) {
            try {
                const token = await this.getAuthToken();
                headers['Authorization'] = `Bearer ${token}`;
            } catch (authError) {
                throw new APIError(
                    'Authentication required',
                    ErrorTypes.UNAUTHORIZED,
                    401,
                    authError
                );
            }
        }
        
        // Prepare request options
        const requestOptions = {
            method,
            headers,
            signal: AbortSignal.timeout(timeout)
        };
        
        if (body && method !== 'GET') {
            requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
        }
        
        // Generate unique request ID using crypto.randomUUID() if available, fallback to timestamp + random
        const requestId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
            ? crypto.randomUUID() 
            : `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Log request with full context
        console.group(`[API Service] [${requestId}] ${method} ${endpoint}`);
        console.log('URL:', url);
        console.log('Environment:', API_CONFIG.getCurrentEnvironment());
        console.log('Options:', { 
            ...requestOptions, 
            body: body ? '[REDACTED]' : null,
            requiresAuth,
            retries,
            timeout 
        });
        
        let lastError;
        
        // Retry logic
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                if (attempt > 0) {
                    console.log(`[API Service] Retry attempt ${attempt}/${retries}`);
                    // Exponential backoff
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                }
                
                const response = await fetch(url, requestOptions);
                
                // Handle different status codes
                if (!response.ok) {
                    let errorData;
                    try {
                        errorData = await response.json();
                    } catch {
                        errorData = { message: response.statusText };
                    }
                    
                    const errorMessage = errorData.message || `HTTP ${response.status}: ${response.statusText}`;
                    
                    switch (response.status) {
                        case 401:
                            throw new APIError(
                                errorMessage,
                                ErrorTypes.UNAUTHORIZED,
                                401,
                                errorData
                            );
                        case 403:
                            throw new APIError(
                                errorMessage,
                                ErrorTypes.FORBIDDEN,
                                403,
                                errorData
                            );
                        case 404:
                            throw new APIError(
                                `Endpoint not found: ${endpoint}`,
                                ErrorTypes.NOT_FOUND,
                                404,
                                errorData
                            );
                        case 500:
                        case 502:
                        case 503:
                            throw new APIError(
                                errorMessage,
                                ErrorTypes.SERVER_ERROR,
                                response.status,
                                errorData
                            );
                        default:
                            throw new APIError(
                                errorMessage,
                                ErrorTypes.SERVER_ERROR,
                                response.status,
                                errorData
                            );
                    }
                }
                
                // Parse response
                let data;
                try {
                    data = await response.json();
                } catch (parseError) {
                    const text = await response.text();
                    console.error(`[API Service] ❌ [${requestId}] JSON parse error`);
                    console.error(`[API Service] ❌ [${requestId}] Response text:`, text.substring(0, 200));
                    throw new APIError(
                        'Invalid JSON response from server',
                        ErrorTypes.INVALID_RESPONSE,
                        response.status,
                        parseError
                    );
                }
                
                console.log(`[API Service] ✅ [${requestId}] Success`);
                console.log(`[API Service] ✅ [${requestId}] Response:`, data);
                console.groupEnd();
                
                return data;
                
            } catch (error) {
                lastError = error;
                
                // Don't retry on certain errors (401, 403, 404)
                if (error instanceof APIError) {
                    if (error.code === ErrorTypes.UNAUTHORIZED || 
                        error.code === ErrorTypes.FORBIDDEN ||
                        error.code === ErrorTypes.NOT_FOUND) {
                        console.error(`[API Service] ❌ [${requestId}] Error (no retry):`, error.message);
                        console.error(`[API Service] ❌ [${requestId}] Status:`, error.status);
                        console.error(`[API Service] ❌ [${requestId}] Code:`, error.code);
                        console.groupEnd();
                        throw error;
                    }
                }
                
                // Network errors can be retried
                if (error.name === 'AbortError' || error.name === 'TypeError') {
                    console.warn(`⚠️ Network error (attempt ${attempt + 1}/${retries + 1}):`, error.message);
                    if (attempt < retries) continue;
                }
                
                // If we've exhausted retries or it's a non-retryable error
                if (attempt === retries) {
                    if (error.name === 'AbortError') {
                        throw new APIError(
                            'Request timeout',
                            ErrorTypes.TIMEOUT,
                            0,
                            error
                        );
                    } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
                        throw new APIError(
                            'Network error: Unable to reach server',
                            ErrorTypes.NETWORK_ERROR,
                            0,
                            error
                        );
                    } else {
                        throw error instanceof APIError ? error : new APIError(
                            error.message || 'Unknown error',
                            ErrorTypes.SERVER_ERROR,
                            0,
                            error
                        );
                    }
                }
            }
        }
        
        console.groupEnd();
        throw lastError;
    }
    
    // Convenience methods
    async get(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'GET' });
    }
    
    async post(endpoint, body, options = {}) {
        return this.request(endpoint, { ...options, method: 'POST', body });
    }
    
    async put(endpoint, body, options = {}) {
        return this.request(endpoint, { ...options, method: 'PUT', body });
    }
    
    async delete(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'DELETE' });
    }
}

// ==========================================
// EXPORT SINGLETON INSTANCE
// ==========================================

const apiService = new APIService();

// Make available globally
window.APIService = apiService;
window.APIError = APIError;
window.ErrorTypes = ErrorTypes;

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { apiService, APIError, ErrorTypes, API_CONFIG };
}

