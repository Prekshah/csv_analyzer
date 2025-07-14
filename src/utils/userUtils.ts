// User identification utilities for collaborative editing

import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export const generateUserId = (): string => {
  let userId = localStorage.getItem('hypothesis_userId');
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('hypothesis_userId', userId);
  }
  return userId;
};

export const getUserDisplayName = (): string => {
  let displayName = localStorage.getItem('hypothesis_userDisplayName');
  if (!displayName) {
    displayName = `User ${Date.now()}`;
    localStorage.setItem('hypothesis_userDisplayName', displayName);
  }
  return displayName;
};

export const updateUserDisplayName = (newName: string): void => {
  localStorage.setItem('hypothesis_userDisplayName', newName);
};

export const getCurrentUser = () => {
  return {
    id: generateUserId(),
    name: getUserDisplayName()
  };
};

export const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

export const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString();
};

// Helper function to manually save a user to Firestore
export async function saveUserToFirestore(uid: string, email: string, displayName?: string, photoURL?: string): Promise<void> {
  try {
    await setDoc(doc(db, 'users', uid), {
      uid,
      email,
      displayName: displayName || email.split('@')[0],
      photoURL: photoURL || ''
    }, { merge: true });
    console.log(`[userUtils] User ${email} saved to Firestore successfully`);
  } catch (error) {
    console.error(`[userUtils] Error saving user to Firestore:`, error);
    throw error;
  }
}

// Helper function to list all users in the collection (for debugging)
export async function listAllUsers(): Promise<void> {
  try {
    const usersRef = collection(db, 'users');
    const querySnapshot = await getDocs(usersRef);
    
    console.log(`[userUtils] Found ${querySnapshot.size} users in collection:`);
    querySnapshot.forEach((doc) => {
      console.log(`[userUtils] User:`, doc.data());
    });
  } catch (error) {
    console.error(`[userUtils] Error listing users:`, error);
  }
}

export async function getUidByEmail(email: string): Promise<string | null> {
  console.log(`[userUtils] Looking up UID for email: ${email}`);
  
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);
    
    console.log(`[userUtils] Query result: ${querySnapshot.size} documents found`);
    
    if (!querySnapshot.empty) {
      const userData = querySnapshot.docs[0].data();
      console.log(`[userUtils] Found user data:`, userData);
      return userData.uid;
    }
    
    console.log(`[userUtils] No user found with email: ${email}`);
    
    // Try to check if this email is valid for the company domain
    if (!email.endsWith('@games24x7.com')) {
      console.log(`[userUtils] Email ${email} is not a company email`);
      return null;
    }
    
    // If user not found but it's a company email, create a pending user entry
    console.log(`[userUtils] Company email ${email} not found - creating pending user`);
    return await createPendingUser(email);
    
  } catch (error) {
    console.error(`[userUtils] Error looking up user by email:`, error);
    return null;
  }
}

/**
 * Creates a pending user entry for a company email that hasn't signed in yet
 */
export async function createPendingUser(email: string): Promise<string> {
  // Generate a deterministic pending UID based on email
  const pendingUid = `pending_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
  
  console.log(`[userUtils] Creating pending user with UID: ${pendingUid}`);
  
  try {
    const userDocRef = doc(db, 'users', pendingUid);
    await setDoc(userDocRef, {
      uid: pendingUid,
      email: email,
      displayName: email.split('@')[0], // Use part before @ as display name
      isPending: true,
      createdAt: new Date(),
      pendingInvites: [] // Track which campaigns they're invited to
      // photoURL is omitted since we don't have a value
    });
    
    console.log(`[userUtils] Successfully created pending user: ${pendingUid}`);
    return pendingUid;
    
  } catch (error) {
    console.error(`[userUtils] Error creating pending user:`, error);
    throw error;
  }
}

/**
 * Converts a pending user to a real user when they sign in
 */
export async function convertPendingUser(email: string, realUid: string, displayName?: string, photoURL?: string): Promise<void> {
  const pendingUid = `pending_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
  
  console.log(`[userUtils] Converting pending user ${pendingUid} to real user ${realUid}`);
  
  try {
    const usersRef = collection(db, 'users');
    const pendingUserQuery = query(usersRef, where('uid', '==', pendingUid));
    const pendingUserSnapshot = await getDocs(pendingUserQuery);
    
    if (!pendingUserSnapshot.empty) {
      const pendingUserData = pendingUserSnapshot.docs[0].data();
      console.log(`[userUtils] Found pending user data:`, pendingUserData);
      
      // Create the real user document
      const realUserDocRef = doc(db, 'users', realUid);
      const userData: any = {
        uid: realUid,
        email: email,
        displayName: displayName || email.split('@')[0],
        isPending: false,
        createdAt: new Date(),
        convertedFrom: pendingUid,
        pendingInvites: pendingUserData.pendingInvites || []
      };
      
      // Only include photoURL if it has a value
      if (photoURL) {
        userData.photoURL = photoURL;
      }
      
      await setDoc(realUserDocRef, userData);
      
      // TODO: Update all campaigns that reference the pending UID to use the real UID
      // This would require updating the collaborators object in all campaigns
      
      console.log(`[userUtils] Successfully converted pending user to real user: ${realUid}`);
    } else {
      console.log(`[userUtils] No pending user found for email: ${email}`);
    }
    
  } catch (error) {
    console.error(`[userUtils] Error converting pending user:`, error);
    throw error;
  }
}