import { db } from '../config/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  addDoc,
  serverTimestamp,
  Unsubscribe
} from 'firebase/firestore';
import { Campaign } from '../types/Campaign';

const CAMPAIGNS_COLLECTION = 'campaigns';

export const createCampaign = async (campaign: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>, userId: string): Promise<string> => {
  console.log('[firestoreCampaignService] createCampaign campaign:', campaign, 'userId:', userId);
  if (!campaign || Object.keys(campaign).length === 0) {
    console.error('[firestoreCampaignService] ERROR: campaign is empty, aborting Firestore write.');
    throw new Error('Internal error: campaign data is empty.');
  }
  const campaignsRef = collection(db, CAMPAIGNS_COLLECTION);
  const collaboratorIds = Object.keys(campaign.collaborators || { [userId]: {} });
  const docRef = await addDoc(campaignsRef, {
    ...campaign,
    collaboratorIds,
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const getCampaign = async (id: string): Promise<Campaign | null> => {
  const docRef = doc(db, CAMPAIGNS_COLLECTION, id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Campaign;
  }
  return null;
};

export const updateCampaign = async (id: string, updates: Partial<Campaign>): Promise<void> => {
  const docRef = doc(db, CAMPAIGNS_COLLECTION, id);
  let collaboratorIds;
  if (updates.collaborators) {
    collaboratorIds = Object.keys(updates.collaborators);
  }
  await updateDoc(docRef, {
    ...updates,
    ...(collaboratorIds ? { collaboratorIds } : {}),
    updatedAt: serverTimestamp(),
  });
};

export const deleteCampaign = async (id: string): Promise<void> => {
  const docRef = doc(db, CAMPAIGNS_COLLECTION, id);
  await deleteDoc(docRef);
};

export const getUserCampaigns = async (userId: string): Promise<Campaign[]> => {
  const campaignsRef = collection(db, CAMPAIGNS_COLLECTION);
  const q = query(campaignsRef, where('collaboratorIds', 'array-contains', userId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Campaign));
};

export const subscribeToUserCampaigns = (userId: string, callback: (campaigns: Campaign[]) => void): Unsubscribe => {
  const campaignsRef = collection(db, CAMPAIGNS_COLLECTION);
  const q = query(campaignsRef, where('collaboratorIds', 'array-contains', userId));
  return onSnapshot(q, (querySnapshot) => {
    const campaigns = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Campaign));
    callback(campaigns);
  });
};

export const subscribeToCampaign = (id: string, callback: (campaign: Campaign | null) => void): Unsubscribe => {
  const docRef = doc(db, CAMPAIGNS_COLLECTION, id);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() } as Campaign);
    } else {
      callback(null);
    }
  });
};

export const subscribeToPowerAnalysisData = (campaignId: string, callback: (data: any, updatedBy: string) => void): Unsubscribe => {
  const docRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      const csvAnalysis = data.csvAnalysis || {};
      // Try to get the displayName of the last updater from collaborators
      let updatedBy = 'Unknown';
      if (data.updatedBy && data.collaborators && data.collaborators[data.updatedBy]?.user?.displayName) {
        updatedBy = data.collaborators[data.updatedBy].user.displayName;
      }
      callback(csvAnalysis, updatedBy);
    }
  });
}; 