# 🔥 Firebase Setup Instructions for Phase 3

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter project name: `analytics-collaboration-games24x7`
4. Enable Google Analytics (optional)
5. Click "Create project"

## Step 2: Enable Authentication

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Click on **Google** provider
3. Click **Enable**
4. Add your domain: `games24x7.com` to **Authorized domains**
5. **IMPORTANT**: In **Advanced settings**, add:
   - **Hosted domain**: `games24x7.com`
   - This restricts login to only @games24x7.com accounts

## Step 3: Create Firestore Database

1. In Firebase Console, go to **Firestore Database**
2. Click **Create database**
3. Choose **Start in production mode** (we have custom security rules)
4. Select your preferred location (e.g., `us-central1`)
5. Click **Done**

## Step 4: Set Security Rules

1. In Firestore, go to **Rules** tab
2. Replace the default rules with the content from `firestore.rules`
3. Click **Publish**

## Step 5: Get Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to **Your apps** section
3. Click **Web app** icon (`</>`)
4. Enter app nickname: `analytics-collaboration-web`
5. Click **Register app**
6. Copy the `firebaseConfig` object

## Step 6: Configure Environment Variables

Create a `.env` file in your project root:

```bash
# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=your_api_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id

# Company Domain
REACT_APP_COMPANY_DOMAIN=games24x7.com
```

## Step 7: Test Authentication

1. Run `npm start`
2. You should see the login screen
3. Click "Sign in with Google Workspace"
4. **Only @games24x7.com accounts should be able to log in**
5. Personal Gmail accounts should be rejected

## Security Features Implemented

### ✅ Frontend Security
- Domain restriction in Google Auth provider (`hd: 'games24x7.com'`)
- Email validation after login
- Automatic logout for unauthorized domains
- Session persistence across browser restarts

### ✅ Backend Security (Firestore Rules)
- Only @games24x7.com emails can access any data
- Campaign-level access control via collaborators
- Role-based permissions (owner/editor/viewer)
- Real-time presence restricted to campaign collaborators

### ✅ Authentication Flow
1. **No Access** → Login screen (mandatory)
2. **Google Popup** → Workspace authentication only
3. **Domain Check** → Reject non-company emails
4. **Session Persist** → Stay logged in until logout

## Testing Checklist

- [ ] Only company emails can log in
- [ ] Personal Gmail accounts are rejected
- [ ] Session persists across browser restart
- [ ] Profile dropdown shows user info
- [ ] Logout works correctly
- [ ] All tabs require authentication

## Troubleshooting

### "Access denied" Error
- Ensure you're using a @games24x7.com email
- Check if email is verified in Google Workspace

### "Pop-up blocked" Error
- Allow pop-ups for your domain
- Try different browser

### Firebase Configuration Error
- Double-check all environment variables
- Ensure `.env` file is in project root
- Restart development server after adding .env

## Next Steps for Phase 3

After authentication is working:
1. **Step 3**: Enhanced Data Structure (Firestore collections)
2. **Step 4**: Real-time Sync Migration (replace BroadcastChannel)
3. **Step 5**: Campaign Sharing System
4. **Step 6**: Data Migration from localStorage 