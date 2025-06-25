// User identification utilities for collaborative editing

import { collection, query, where, getDocs } from 'firebase/firestore';
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
  let userName = localStorage.getItem('hypothesis_userName');
  if (!userName) {
    userName = prompt('Enter your name for collaboration (this will be shown to other users):') || 'Anonymous User';
    localStorage.setItem('hypothesis_userName', userName);
  }
  return userName;
};

export const updateUserDisplayName = (newName: string): void => {
  localStorage.setItem('hypothesis_userName', newName);
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
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
};

export const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString();
};

export async function getUidByEmail(email: string): Promise<string | null> {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('email', '==', email));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    return querySnapshot.docs[0].data().uid;
  }
  return null;
} 