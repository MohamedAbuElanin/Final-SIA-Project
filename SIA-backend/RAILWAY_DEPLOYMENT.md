# Railway Deployment Configuration Guide

## ✅ Package.json Configuration

The `package.json` file is already correctly configured with:
- ✅ `"start": "node server.js"` - Entry point script
- ✅ `"build": "echo 'No build step required for backend'"` - Build script

## 🚂 Railway Configuration Steps

### 1. Root Directory Setting

In your Railway project settings:

1. Go to your Railway project dashboard
2. Navigate to **Settings** → **Service**
3. Under **Root Directory**, set:
   ```
   SIA-backend
   ```
   This tells Railway to use the `SIA-backend` folder as the project root.

### 2. Custom Build Command

In Railway project settings:

1. Go to **Settings** → **Build & Deploy**
2. Under **Custom Build Command**, set:
   ```
   npm run build || echo 'No build step required for backend'
   ```
   This ensures Railway runs the build script during deployment.

### 3. Start Command (Auto-detected)

Railway will automatically detect and use:
```
npm start
```
Which runs: `node server.js`

### 4. Environment Variables

Make sure to set these in Railway → **Variables**:

- `GEMINI_API_KEY` - Your Gemini AI API key
- `FIREBASE_SERVICE_ACCOUNT` - Firebase service account JSON (as a string)
- `PORT` - Railway sets this automatically (don't override)
- `NODE_ENV` - Set to `production` for production deployments
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins (optional)

### 5. Verify Deployment

After configuration:
- Railway will run `npm run build` during build phase
- Railway will run `npm start` to start the server
- Server will listen on Railway's assigned PORT
- Server binds to `0.0.0.0` (configured in server.js)

## ✅ Verification

The build script has been tested and works correctly:
```bash
npm run build
# Output: No build step required for backend
```

## 📝 Notes

- The build script is a no-op (does nothing) since this is a Node.js backend that doesn't require compilation
- Railway will still run the build command, but it will succeed immediately
- The start command (`npm start`) is what actually runs the server

