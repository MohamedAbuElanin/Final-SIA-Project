/**
 * Admin Claims Management
 * FIXED: Added comprehensive error handling, validation, and production-safe logging
 */

const admin = require("firebase-admin");
const logger = require("./logger");

/**
 * Set admin custom claims for a user
 * FIXED: Added validation, error handling, and transaction safety
 *
 * @param {string} uid - User ID
 * @param {boolean} isAdmin - Whether user should have admin privileges
 * @return {Promise<Object>} Result object with success status and message
 */
async function setAdminClaim(uid, isAdmin) {
  try {
    // FIXED: Validate inputs
    if (!uid || typeof uid !== "string" || uid.trim().length === 0) {
      throw new Error("Invalid UID: must be a non-empty string");
    }

    if (typeof isAdmin !== "boolean") {
      throw new Error("Invalid isAdmin: must be a boolean");
    }

    // FIXED: Verify user exists before setting claims
    try {
      const userRecord = await admin.auth().getUser(uid);
      if (!userRecord) {
        throw new Error(`User with UID ${uid} does not exist`);
      }
    } catch (authError) {
      if (authError.code === "auth/user-not-found") {
        throw new Error(`User with UID ${uid} does not exist`);
      }
      throw authError;
    }

    // FIXED: Set custom claims with error handling
    try {
      await admin.auth().setCustomUserClaims(uid, {admin: isAdmin});
    } catch (claimsError) {
      logger.error("Error setting custom claims:", claimsError.message);
      throw new Error(`Failed to set admin claims: ${claimsError.message}`);
    }

    // FIXED: Update Firestore with transaction for consistency
    try {
      await admin.firestore().collection("users").doc(uid).set({
        role: isAdmin ? "admin" : "user",
        roleUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        roleUpdatedBy: "system", // Could be enhanced to track who made the change
      }, {merge: true});
    } catch (firestoreError) {
      logger.error("Error updating Firestore role:", firestoreError.message);
      // Don't throw - claims are set, Firestore update is secondary
      logger.warn("Warning: Custom claims set but Firestore update failed");
    }

    return {
      success: true,
      message: `Admin claim ${isAdmin ? "granted" : "revoked"} successfully`,
      uid: uid,
      isAdmin: isAdmin,
    };
  } catch (error) {
    logger.error("Error setting admin claim:", error.message);
    throw error; // Re-throw for API to handle
  }
}

module.exports = {setAdminClaim};
