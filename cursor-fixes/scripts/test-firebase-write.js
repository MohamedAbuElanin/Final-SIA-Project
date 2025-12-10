/**
 * Test Script: Firebase Write Operations
 * 
 * This script verifies that client data can be written to Firebase
 * after the domain change fix.
 * 
 * Run this in browser console on the deployed site.
 */

async function testFirebaseWrite() {
    console.log('=== Firebase Write Test ===\n');
    
    const user = firebase.auth().currentUser;
    if (!user) {
        console.error('✗ User not authenticated. Please sign in first.');
        return;
    }
    
    console.log('✓ User authenticated:', user.email);
    
    // Test 1: Write to users collection
    try {
        const testData = {
            testWrite: true,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            testDomain: window.location.hostname
        };
        
        await firebase.firestore().collection('users').doc(user.uid).set({
            ...testData
        }, { merge: true });
        
        console.log('✓ Write to users collection successful');
    } catch (error) {
        console.error('✗ Write to users collection failed:', error);
        console.error('  Error code:', error.code);
        console.error('  Error message:', error.message);
    }
    
    // Test 2: Write to activityLogs subcollection
    try {
        await firebase.firestore()
            .collection('users')
            .doc(user.uid)
            .collection('activityLogs')
            .add({
                action: 'Test Write Operation',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                testDomain: window.location.hostname
            });
        
        console.log('✓ Write to activityLogs subcollection successful');
    } catch (error) {
        console.error('✗ Write to activityLogs failed:', error);
        console.error('  Error code:', error.code);
    }
    
    // Test 3: Write to TestsResults collection
    try {
        await firebase.firestore().collection('TestsResults').doc(user.uid).set({
            testWrite: true,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        console.log('✓ Write to TestsResults collection successful');
    } catch (error) {
        console.error('✗ Write to TestsResults failed:', error);
        console.error('  Error code:', error.code);
    }
    
    // Test 4: Verify Firebase config
    console.log('\n=== Firebase Configuration ===');
    console.log('Auth Domain:', firebase.app().options.authDomain);
    console.log('Project ID:', firebase.app().options.projectId);
    console.log('Current Hostname:', window.location.hostname);
    
    console.log('\n=== Test Complete ===');
    console.log('Check Firebase Console to verify data was written.');
}

// Run test
testFirebaseWrite();

