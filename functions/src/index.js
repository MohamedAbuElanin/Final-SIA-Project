const functions = require("firebase-functions");
const api = require("./api");

// Export the API function
exports.api = functions.https.onRequest(api);
