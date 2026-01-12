const functions = require("firebase-functions");
const api = require("./src/api");

exports.api = functions.https.onRequest(api);

// Export Triggers
const {onUserTestUpdate, onManualAnalysisTrigger} = require("./src/triggers");
exports.onUserTestUpdate = onUserTestUpdate;
exports.onManualAnalysisTrigger = onManualAnalysisTrigger;
