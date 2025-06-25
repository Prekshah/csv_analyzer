#!/usr/bin/env node

/**
 * Firebase Setup Test Script
 * 
 * This script helps you verify your Firebase configuration step by step.
 * Run with: node test-firebase-setup.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔥 Firebase Setup Test\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
const envExists = fs.existsSync(envPath);

console.log('1. Environment Variables Check:');
if (envExists) {
  console.log('   ✅ .env file found');
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const requiredVars = [
    'REACT_APP_FIREBASE_API_KEY',
    'REACT_APP_FIREBASE_AUTH_DOMAIN',
    'REACT_APP_FIREBASE_PROJECT_ID',
    'REACT_APP_FIREBASE_STORAGE_BUCKET',
    'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
    'REACT_APP_FIREBASE_APP_ID'
  ];
  
  let missingVars = [];
  requiredVars.forEach(varName => {
    if (!envContent.includes(varName) || envContent.includes(`${varName}=your_`) || envContent.includes(`${varName}=placeholder`)) {
      missingVars.push(varName);
    }
  });
  
  if (missingVars.length === 0) {
    console.log('   ✅ All Firebase environment variables configured');
  } else {
    console.log('   ❌ Missing or placeholder values for:');
    missingVars.forEach(varName => console.log(`      - ${varName}`));
  }
} else {
  console.log('   ❌ .env file not found');
  console.log('   📝 Create .env file with Firebase configuration');
}

console.log('\n2. Firebase Dependencies Check:');
const packageJsonPath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

if (packageJson.dependencies.firebase) {
  console.log('   ✅ Firebase package installed');
} else {
  console.log('   ❌ Firebase package not found');
}

if (packageJson.dependencies['react-firebase-hooks']) {
  console.log('   ✅ React Firebase Hooks installed');
} else {
  console.log('   ❌ React Firebase Hooks not found');
}

console.log('\n3. Firebase Files Check:');
const firebaseConfigPath = path.join(__dirname, 'src', 'config', 'firebase.ts');
const authContextPath = path.join(__dirname, 'src', 'contexts', 'AuthContext.tsx');
const loginScreenPath = path.join(__dirname, 'src', 'components', 'LoginScreen.tsx');
const firestoreRulesPath = path.join(__dirname, 'firestore.rules');

if (fs.existsSync(firebaseConfigPath)) {
  console.log('   ✅ Firebase config file exists');
} else {
  console.log('   ❌ Firebase config file missing');
}

if (fs.existsSync(authContextPath)) {
  console.log('   ✅ Auth context file exists');
} else {
  console.log('   ❌ Auth context file missing');
}

if (fs.existsSync(loginScreenPath)) {
  console.log('   ✅ Login screen component exists');
} else {
  console.log('   ❌ Login screen component missing');
}

if (fs.existsSync(firestoreRulesPath)) {
  console.log('   ✅ Firestore security rules exist');
} else {
  console.log('   ❌ Firestore security rules missing');
}

console.log('\n4. Next Steps:');
if (!envExists) {
  console.log('   1️⃣ Follow FIREBASE_SETUP.md to create Firebase project');
  console.log('   2️⃣ Create .env file with your Firebase configuration');
  console.log('   3️⃣ Run this test again');
} else {
  console.log('   1️⃣ Run: npm start');
  console.log('   2️⃣ Open http://localhost:3000');
  console.log('   3️⃣ You should see the login screen');
  console.log('   4️⃣ Test with @games24x7.com email only');
}

console.log('\n📋 Expected Test Results:');
console.log('   ✅ Login screen appears (no direct app access)');
console.log('   ✅ Google Workspace sign-in button works');
console.log('   ✅ Only @games24x7.com emails allowed');
console.log('   ❌ Personal Gmail accounts rejected');
console.log('   ✅ Profile dropdown shows after login');
console.log('   ✅ Session persists after browser refresh'); 