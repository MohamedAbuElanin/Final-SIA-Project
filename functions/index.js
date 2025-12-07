const {setGlobalOptions} = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize Admin SDK once
admin.initializeApp();

// Set global options for functions
setGlobalOptions({maxInstances: 10});

// Import modules
const auth = require("./auth");
const tests = require("./tests");
const resources = require("./resources");
const gemini = require("./gemini");

// Export functions
exports.onUserCreated = auth.onUserCreated;
exports.getUserProfile = auth.getUserProfile;

exports.submitBigFive = tests.submitBigFive;
exports.submitHolland = tests.submitHolland;

exports.fetchUserResources = resources.fetchUserResources;

exports.getGeminiRecommendations = gemini.getGeminiRecommendations;
