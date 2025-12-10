const admin = require('firebase-admin');
const functions = require('firebase-functions');

/**
 * Cloud Function to set admin custom claims
 * This should be called by an existing admin to grant admin privileges to a user
 * 
 * Usage (from admin dashboard or via API):
 * POST /api/admin/set-role
 * Body: { uid: "user-uid", role: "admin" }
 */
async function setAdminClaim(uid, isAdmin) {
    try {
        await admin.auth().setCustomUserClaims(uid, { admin: isAdmin });
        
        // Also update Firestore users collection for fallback check
        await admin.firestore().collection('users').doc(uid).set({
            role: isAdmin ? 'admin' : 'user',
            roleUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        return { success: true, message: `Admin claim ${isAdmin ? 'granted' : 'revoked'} successfully` };
    } catch (error) {
        console.error('Error setting admin claim:', error);
        throw error;
    }
}

module.exports = { setAdminClaim };

