# Deployment Instructions for SIA Fixes

## Prerequisites

1. Firebase CLI installed: `npm install -g firebase-tools`
2. Node.js 18+ installed
3. Firebase project access: `sia-993a7`

## Pre-Deployment Checklist

### 1. Set Environment Variables

**CRITICAL: Set Gemini API Key**

```bash
# Option 1: Using Firebase Functions config (legacy)
firebase functions:config:set gemini.key="YOUR_GEMINI_API_KEY"

# Option 2: Using Firebase Secrets (recommended)
firebase functions:secrets:set GEMINI_API_KEY
# When prompted, enter your API key
```

**Verify the key is set:**
```bash
firebase functions:config:get
```

### 2. Add Authorized Domains to Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/project/sia-993a7)
2. Navigate to **Authentication** → **Settings** → **Authorized domains**
3. Ensure these domains are listed:
   - `sia-993a7.firebaseapp.com`
   - `sia-993a7.web.app`
   - `localhost` (for local development)
4. If missing, click **Add domain** and add them

### 3. Update Admin User Role

**Option A: Using Firebase Console (Quick)**
1. Go to Firestore Database
2. Navigate to `users` collection
3. Find your admin user document (by UID or email)
4. Add field: `role` = `"admin"`

**Option B: Using Cloud Function (Recommended)**
1. Deploy functions first (see step 5)
2. Call the API endpoint:
```bash
curl -X POST https://us-central1-sia-993a7.cloudfunctions.net/api/admin/set-role \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"uid": "USER_UID", "role": "admin"}'
```

**Option C: Set Custom Claims (Best for production)**
```javascript
// Run in Firebase Console or via Admin SDK
const admin = require('firebase-admin');
await admin.auth().setCustomUserClaims('USER_UID', { admin: true });
```

## Deployment Steps

### Step 1: Install Dependencies

```bash
# Install function dependencies
cd functions
npm install
cd ..

# Install root dependencies (if any)
npm install
```

### Step 2: Build Functions (if needed)

```bash
cd functions
npm run build  # If you have a build step
cd ..
```

### Step 3: Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

**Verify rules deployed:**
- Check Firebase Console → Firestore → Rules
- Rules should include `isAdmin()` function

### Step 4: Deploy Storage Rules

```bash
firebase deploy --only storage
```

**Verify rules deployed:**
- Check Firebase Console → Storage → Rules
- Read access should require authentication

### Step 5: Deploy Cloud Functions

```bash
firebase deploy --only functions
```

**Verify functions deployed:**
```bash
firebase functions:list
```

Expected functions:
- `api` (HTTP function)

### Step 6: Deploy Hosting

```bash
firebase deploy --only hosting
```

**Verify hosting deployed:**
- Visit: https://sia-993a7.web.app
- Check browser console for errors

### Step 7: Full Deployment (All at once)

```bash
firebase deploy
```

## Post-Deployment Verification

### 1. Test Authentication Flow

1. **Sign In Test:**
   - Visit: https://sia-993a7.web.app/sign%20in/signin.html
   - Sign in with test account
   - Should redirect to profile (not loop)

2. **Profile Page Test:**
   - While authenticated, visit: https://sia-993a7.web.app/profile/profile.html
   - Should NOT redirect to sign in
   - Should display user profile

3. **Test Page Test:**
   - While authenticated, visit: https://sia-993a7.web.app/Test/Test.html
   - Should NOT redirect to sign in
   - Should show test selection

### 2. Test Firebase Writes

1. **Sign Up Test:**
   - Create new account
   - Verify user document created in Firestore `users` collection

2. **Profile Update Test:**
   - Update profile information
   - Verify changes saved to Firestore

3. **Test Submission:**
   - Complete a test
   - Verify results saved to `TestsResults` collection

### 3. Test Admin Access

1. **Admin Login:**
   - Sign in as admin user
   - Visit: https://sia-993a7.web.app/admin/admin.html
   - Should load admin dashboard

2. **Non-Admin Test:**
   - Sign in as regular user
   - Try to access admin endpoints via API
   - Should receive 403 Forbidden

### 4. Check Logs

```bash
# View function logs
firebase functions:log

# View specific function logs
firebase functions:log --only api
```

## Rollback Plan

If something goes wrong:

### Rollback Functions
```bash
# List previous deployments
firebase functions:list --version

# Rollback to previous version (if using versioning)
firebase functions:rollback FUNCTION_NAME
```

### Rollback Hosting
```bash
# List hosting versions
firebase hosting:channel:list

# Rollback to previous version
firebase hosting:rollback
```

### Rollback Rules
```bash
# Revert to previous rules
git checkout HEAD~1 firestore.rules
firebase deploy --only firestore:rules
```

## Troubleshooting

### Issue: "API key not found"
**Solution:** Set the Gemini API key:
```bash
firebase functions:config:set gemini.key="YOUR_KEY"
firebase deploy --only functions
```

### Issue: "Unauthorized domain"
**Solution:** Add domain to Firebase Console → Authentication → Authorized domains

### Issue: "Admin access denied"
**Solution:** 
1. Verify user has `role: 'admin'` in Firestore `users` collection
2. Or set custom claims: `admin.auth().setCustomUserClaims(uid, { admin: true })`

### Issue: "Redirect loop on Profile/Test pages"
**Solution:**
1. Clear browser cache
2. Verify `auth-state.js` is loaded (check Network tab)
3. Check browser console for errors

### Issue: "Firebase writes failing"
**Solution:**
1. Check Firestore rules are deployed
2. Verify user is authenticated
3. Check browser console for error codes
4. Verify authorized domains in Firebase Console

## Environment Variables Reference

| Variable | Location | Purpose |
|----------|----------|---------|
| `GEMINI_API_KEY` | Functions config/secrets | AI analysis generation |
| `GOOGLE_APPLICATION_CREDENTIALS` | Local dev only | Service account key path |

## Support

For issues:
1. Check Firebase Console logs
2. Check browser console errors
3. Review `cursor-fixes/scripts/` test scripts
4. Check `cursor-fixes/reports/` for detailed fix documentation

