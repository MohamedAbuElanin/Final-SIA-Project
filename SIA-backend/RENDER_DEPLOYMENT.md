# Render Deployment Guide

## Environment Variables Setup

This backend reads Firebase service account credentials from environment variables instead of local JSON files.

### Required Environment Variables

Set the following environment variables in your Render dashboard:

1. **FIREBASE_SERVICE_ACCOUNT** (Required)
   - Type: `Secret File` or `Environment Variable`
   - Value: JSON string of your Firebase service account key
   - Example format:
   ```json
   {
     "type": "service_account",
     "project_id": "sia-993a7",
     "private_key_id": "...",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
     "client_email": "firebase-adminsdk-...@sia-993a7.iam.gserviceaccount.com",
     "client_id": "...",
     "auth_uri": "https://accounts.google.com/o/oauth2/auth",
     "token_uri": "https://oauth2.googleapis.com/token",
     "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
     "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/...",
     "universe_domain": "googleapis.com"
   }
   ```
   - **Important:** When pasting the JSON, ensure it's a single-line string or properly escaped
   - In Render, you can paste the entire JSON object as-is

2. **GEMINI_API_KEY** (Required)
   - Type: `Secret`
   - Value: Your Google Gemini API key

3. **PORT** (Optional)
   - Type: `Environment Variable`
   - Value: Port number (defaults to 5000 if not set)
   - Render automatically sets this, but you can override if needed

4. **NODE_ENV** (Optional)
   - Type: `Environment Variable`
   - Value: `production` (for production deployments)

5. **ALLOWED_ORIGINS** (Optional)
   - Type: `Environment Variable`
   - Value: Comma-separated list of allowed origins for CORS
   - Example: `https://sia-993a7.web.app,https://sia-993a7.firebaseapp.com`

### How to Get Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`sia-993a7`)
3. Go to **Project Settings** → **Service Accounts**
4. Click **Generate New Private Key**
5. Download the JSON file
6. Copy the entire contents of the JSON file
7. Paste it as the value for `FIREBASE_SERVICE_ACCOUNT` in Render

### Setting Environment Variables in Render

1. Go to your Render dashboard
2. Navigate to your service
3. Go to **Environment** tab
4. Click **Add Environment Variable**
5. Add each variable:
   - **Key:** `FIREBASE_SERVICE_ACCOUNT`
   - **Value:** Paste the entire JSON content (as a single string)
   - **Type:** `Secret` (recommended for security)
6. Repeat for other required variables

### Important Notes

- **Never commit service account JSON files to Git** - They are already in `.gitignore`
- The code automatically parses the JSON string from the environment variable
- If `FIREBASE_SERVICE_ACCOUNT` is not set, the app will attempt to use application default credentials (for Firebase Functions only)
- For cloud deployments (Render, Railway, etc.), `FIREBASE_SERVICE_ACCOUNT` is required

### Verification

After setting environment variables, the server should log:
```
Firebase Admin initialized with service account from FIREBASE_SERVICE_ACCOUNT environment variable
Firebase Admin initialized successfully
```

If you see errors, check:
1. The JSON is valid and properly formatted
2. All required fields are present (project_id, private_key, client_email)
3. The private key includes the full `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` markers

