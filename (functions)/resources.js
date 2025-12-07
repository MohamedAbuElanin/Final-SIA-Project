const functions = require("firebase-functions");
const admin = require("firebase-admin");
const {logActivity} = require("./activityLog");

/**
 * Fetches recommended resources for the user.
 */
exports.fetchUserResources = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }

  const uid = context.auth.uid;
  const db = admin.firestore();

  try {
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError("not-found", "User profile not found.");
    }
    // Logic to filter resources could rely on userData
    // const userData = userDoc.data();

    const resources = {
      books: [],
      courses: [],
      roadmaps: [],
      videos: [],
    };

    const fetchCollection = async (colName, limit = 5) => {
      const snap = await db.collection(colName).limit(limit).get();
      return snap.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    };

    resources.books = await fetchCollection("books");
    resources.courses = await fetchCollection("courses");
    resources.roadmaps = await fetchCollection("roadmaps");

    await logActivity(uid, "fetch_resources", {});

    return resources;
  } catch (error) {
    console.error("Error fetching resources:", error);
    throw new functions.https.HttpsError("internal", "Unable to fetch resources.");
  }
});
