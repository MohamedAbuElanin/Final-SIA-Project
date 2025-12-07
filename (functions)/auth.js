const functions = require("firebase-functions");
const admin = require("firebase-admin");
// Initialize Firebase Admin only once
if (!admin.apps.length) {
  admin.initializeApp();
}
const {logActivity} = require("./activityLog");

/**
 * Triggered when a new user is created in Firebase Auth.
 * Creates a corresponding document in Firestore 'users' collection.
 */
exports.onUserCreated = functions.auth.user().onCreate(async (user) => {
  const {uid, email, displayName, photoURL} = user;
  const db = admin.firestore();

  try {
    await db.collection("users").doc(uid).set({
      email: email || "",
      displayName: displayName || "New User",
      photoURL: photoURL || "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: admin.firestore.FieldValue.serverTimestamp(),
      roles: ["user"], // Default role
      preferences: {},
    });

    await logActivity(uid, "user_signup", {email});
    console.log(`User profile created for ${uid}`);
  } catch (error) {
    console.error(`Error creating user profile for ${uid}:`, error);
  }
});

/**
 * HTTP Callable to get the current user's full profile from Firestore.
 */
exports.getUserProfile = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
  }

  const uid = context.auth.uid;
  const db = admin.firestore();

  try {
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError("not-found", "User profile not found.");
    }

    return userDoc.data();
  } catch (error) {
    console.error("Error fetching user profile:", error);
    throw new functions.https.HttpsError("internal", "Unable to fetch user profile.");
  }
});
