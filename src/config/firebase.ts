import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDxAejh0IgKKAE8uSUsdDyc0Yqr2DN2o7U",
  authDomain: "csv-analyzer-app.firebaseapp.com",
  projectId: "csv-analyzer-app",
  storageBucket: "csv-analyzer-app.appspot.com",
  messagingSenderId: "120532689711",
  appId: "1:120532689711:web:39e81ab5887a7e440cf7da"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Auth
export const auth = getAuth(app);

// Set auth persistence to local so user stays logged in after refresh
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error('[Firebase] Failed to set auth persistence:', err);
});

// Configure Google Auth Provider with domain restriction
export const googleProvider = new GoogleAuthProvider();

// CRITICAL: Restrict to company domain only
googleProvider.setCustomParameters({
  hd: 'games24x7.com', // Hosted domain restriction - only allows @games24x7.com accounts
  prompt: 'select_account' // Always show account selection
});

// Additional security: Request specific scopes
googleProvider.addScope('email');
googleProvider.addScope('profile');

// Company domain for validation
export const COMPANY_DOMAIN = 'games24x7.com';

// Helper function to validate company email
export const isCompanyEmail = (email: string): boolean => {
  return email.toLowerCase().endsWith(`@${COMPANY_DOMAIN.toLowerCase()}`);
};

// Development mode setup (if needed)
// Uncomment these lines if you want to use Firebase emulators in development
// if (process.env.NODE_ENV === 'development') {
//   connectAuthEmulator(auth, 'http://localhost:9099');
//   connectFirestoreEmulator(db, 'localhost', 8080);
// }

export default app; 