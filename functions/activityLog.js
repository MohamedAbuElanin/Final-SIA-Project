const admin = require("firebase-admin");
if (!admin.apps.length) {
  admin.initializeApp();
}
/**
 * Logs user activity to the Realtime Database.
 * @param {string} uid - The user ID.
 * @param {string} activityType - The type of activity (e.g., "test_submission", "resource_access").
 * @param {object} details - Additional details about the activity.
 * @return {Promise<void>}
 */
async function logActivity(uid, activityType, details) {
  if (!uid) {
    console.warn("Skipping activity log: No UID provided.");
    return;
  }

  const db = admin.database();
  const timestamp = Date.now();
  const dateStr = new Date().toISOString();

  const activityRef = db.ref(`activityLogs/${uid}`).push();

  try {
    await activityRef.set({
      activityType,
      details,
      timestamp,
      date: dateStr,
    });
  } catch (error) {
    console.error(
        "Error logging activity:",
        error,
    );
  }
}

module.exports = {logActivity};
