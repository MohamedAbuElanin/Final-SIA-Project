const functions = require("firebase-functions");
const admin = require("firebase-admin");
const {logActivity} = require("./activityLog");

/**
 * Handles Big Five test submission.
 */
exports.submitBigFive = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }

  const uid = context.auth.uid;
  const {answers, scores} = data;

  if (!scores) {
    throw new functions.https.HttpsError("invalid-argument", "Scores are required.");
  }

  const db = admin.firestore();
  const timestamp = admin.firestore.FieldValue.serverTimestamp();

  try {
    const attemptId = db.collection("users").doc(uid).collection("bigFive").doc().id;
    await db.collection("users").doc(uid).collection("bigFive").doc(attemptId).set({
      answers: answers || {},
      scores,
      submittedAt: timestamp,
    });

    await db.collection("users").doc(uid).update({
      "latestTestResults.bigFive": scores,
      "latestTestResults.bigFiveDate": timestamp,
    });

    await logActivity(uid, "big_five_submission", {attemptId});

    return {success: true, attemptId};
  } catch (error) {
    console.error("Error submitting Big Five:", error);
    throw new functions.https.HttpsError("internal", "Failed to save test results.");
  }
});

/**
 * Handles Holland test submission.
 */
exports.submitHolland = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }

  const uid = context.auth.uid;
  const {answers, scores} = data;

  if (!scores) {
    throw new functions.https.HttpsError("invalid-argument", "Scores are required.");
  }

  const db = admin.firestore();
  const timestamp = admin.firestore.FieldValue.serverTimestamp();

  try {
    const attemptId = db.collection("users").doc(uid).collection("holland").doc().id;
    await db.collection("users").doc(uid).collection("holland").doc(attemptId).set({
      answers: answers || {},
      scores,
      submittedAt: timestamp,
    });

    await db.collection("users").doc(uid).update({
      "latestTestResults.holland": scores,
      "latestTestResults.hollandDate": timestamp,
    });

    await logActivity(uid, "holland_submission", {attemptId});

    return {success: true, attemptId};
  } catch (error) {
    console.error("Error submitting Holland:", error);
    throw new functions.https.HttpsError("internal", "Failed to save test results.");
  }
});
