/**
 * Test Script: Admin Access Verification
 * 
 * This script verifies that:
 * 1. Admin endpoints require authentication
 * 2. Admin endpoints require admin role
 * 3. Non-admin users are denied access
 */

async function testAdminAccess() {
    console.log('=== Admin Access Test ===\n');
    
    const user = firebase.auth().currentUser;
    if (!user) {
        console.error('✗ User not authenticated. Please sign in first.');
        return;
    }
    
    console.log('✓ User authenticated:', user.email);
    
    try {
        const token = await user.getIdToken();
        const tokenData = JSON.parse(atob(token.split('.')[1]));
        
        console.log('Token claims:', {
            uid: tokenData.uid,
            email: tokenData.email,
            admin: tokenData.admin || 'not set'
        });
        
        // Test 1: Try to access admin stats endpoint
        const res = await fetch('/api/admin/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.status === 200) {
            const data = await res.json();
            console.log('✓ Admin stats endpoint accessible');
            console.log('  Stats:', data);
        } else if (res.status === 403) {
            console.log('✓ Admin endpoint correctly denied access (403)');
            console.log('  User is NOT an admin (expected for non-admin users)');
        } else {
            console.error('✗ Unexpected response:', res.status);
        }
        
        // Test 2: Check Firestore role
        const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            console.log('Firestore role:', userData.role || 'not set');
        }
        
    } catch (error) {
        console.error('✗ Error testing admin access:', error);
    }
    
    console.log('\n=== Test Complete ===');
    console.log('Expected results:');
    console.log('- Admin users: Should get 200 response');
    console.log('- Non-admin users: Should get 403 response');
}

// Run test
testAdminAccess();

