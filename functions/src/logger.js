/**
 * Production-safe logger utility
 * FIXED: Conditional logging - only logs in development or for critical errors
 * Prevents sensitive information from being logged in production
 */

const isDevelopment = process.env.NODE_ENV !== "production";

/**
 * Log info messages (only in development)
 */
function log(...args) {
  if (isDevelopment) {
    console.log(...args);
  }
}

/**
 * Log error messages (always logged, but sanitized in production)
 */
function error(...args) {
  if (isDevelopment) {
    console.error(...args);
  } else {
    // In production, only log error type, not full stack traces
    const sanitized = args.map((arg) => {
      if (arg instanceof Error) {
        return {
          message: arg.message,
          name: arg.name,
        };
      }
      return typeof arg === "string" ? arg.substring(0, 200) : arg;
    });
    console.error(...sanitized);
  }
}

/**
 * Log warning messages (only in development)
 */
function warn(...args) {
  if (isDevelopment) {
    console.warn(...args);
  }
}

module.exports = {log, error, warn};

