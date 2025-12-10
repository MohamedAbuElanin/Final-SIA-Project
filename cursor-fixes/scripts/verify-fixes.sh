#!/bin/bash
# Verification Checklist Script
# Run this after deploying fixes to verify everything works

echo "=== SIA Fix Verification Checklist ==="
echo ""

# Check if Firebase config is correct
echo "1. Checking Firebase configuration..."
if grep -q "sia-993a7" public/firebase-config.js; then
    echo "   ✓ Firebase project ID matches"
else
    echo "   ✗ Firebase project ID mismatch"
fi

# Check if auth-state.js exists
echo "2. Checking auth-state.js..."
if [ -f "public/auth-state.js" ]; then
    echo "   ✓ auth-state.js exists"
else
    echo "   ✗ auth-state.js missing"
fi

# Check if duplicate code removed from auth.js
echo "3. Checking for duplicate code in auth.js..."
LINES=$(wc -l < public/auth.js)
if [ "$LINES" -lt 70 ]; then
    echo "   ✓ Duplicate code removed (file has $LINES lines)"
else
    echo "   ✗ Duplicate code may still exist (file has $LINES lines)"
fi

# Check if admin.js undefined variable fixed
echo "4. Checking admin.js for undefined variable..."
if grep -q "const thirtyDaysAgo" functions/src/admin.js; then
    echo "   ✓ thirtyDaysAgo variable defined"
else
    echo "   ✗ thirtyDaysAgo variable not found"
fi

# Check if hardcoded API key removed
echo "5. Checking for hardcoded API key..."
if grep -q "AIzaSyAtY70sfw-CUUQ12TntqnmxTjH5yPt6XFU" functions/src/helpers.js; then
    echo "   ✗ Hardcoded API key still present"
else
    echo "   ✓ Hardcoded API key removed"
fi

# Check if storage rules fixed
echo "6. Checking storage rules..."
if grep -q "allow read: if request.auth != null" storage.rules; then
    echo "   ✓ Storage read access restricted"
else
    echo "   ✗ Storage read access still public"
fi

# Check if Firestore rules have admin checks
echo "7. Checking Firestore rules for admin checks..."
if grep -q "isAdmin()" firestore.rules; then
    echo "   ✓ Admin checks in Firestore rules"
else
    echo "   ✗ Admin checks missing in Firestore rules"
fi

echo ""
echo "=== Manual Verification Required ==="
echo "1. Test Profile page access (should not redirect when authenticated)"
echo "2. Test Test page access (should not redirect when authenticated)"
echo "3. Test Firebase write operations (sign up, save profile)"
echo "4. Test admin area access (should require admin role)"
echo "5. Check Firebase Console -> Authentication -> Authorized domains"
echo "   - sia-993a7.firebaseapp.com should be listed"
echo "   - sia-993a7.web.app should be listed"

