import { db, auth } from '../config/firebase';
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

export const CAMPAIGNS_COLLECTION = 'campaigns';

export const createCampaign = async (campaign: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>, userId: string): Promise<string> => {
  console.log('[DEBUG][firestoreCampaignService] createCampaign called with:', { campaign, userId });
  const campaignsRef = collection(db, CAMPAIGNS_COLLECTION);

  // Ensure the creator is always a collaborator with role 'owner'
  const collaborators = {
    ...campaign.collaborators,
    [userId]: {
      user: {
        uid: userId,
        email: campaign.collaborators?.[userId]?.user?.email || 'unknown',
        displayName: campaign.collaborators?.[userId]?.user?.displayName || 'Owner',
        photoURL: campaign.collaborators?.[userId]?.user?.photoURL || undefined,
      },
      role: 'owner',
      addedAt: serverTimestamp(),
      addedBy: userId,
    },
  };
  const collaboratorIds = Object.keys(collaborators);
  const docRef = await addDoc(campaignsRef, {
    ...campaign,
    collaborators,
    collaboratorIds,
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  console.log('[DEBUG][firestoreCampaignService] Created campaign with collaborators:', collaborators, 'collaboratorIds:', collaboratorIds);
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

export const updateCampaign = async (id: string, updates: Partial<Campaign>, userId: string): Promise<void> => {
  const docRef = doc(db, CAMPAIGNS_COLLECTION, id);
  let collaborators = updates.collaborators;
  let collaboratorIds;
  if (collaborators) {
    collaboratorIds = Object.keys(collaborators);
    console.log('[firestoreCampaignService] updateCampaign syncing collaborators and collaboratorIds:', collaborators, collaboratorIds);
  }
  await updateDoc(docRef, {
    ...updates,
    ...(collaboratorIds ? { collaboratorIds, collaborators } : {}),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
};

export const deleteCampaign = async (id: string): Promise<void> => {
  const docRef = doc(db, CAMPAIGNS_COLLECTION, id);
  await deleteDoc(docRef);
};

export const getUserCampaigns = async (userId: string): Promise<Campaign[]> => {
  console.log('[DEBUG][firestoreCampaignService] getUserCampaigns called with userId:', userId);
  const campaignsRef = collection(db, CAMPAIGNS_COLLECTION);
  const q = query(campaignsRef, where('collaboratorIds', 'array-contains', userId));
  const querySnapshot = await getDocs(q);
  const campaigns = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Campaign));
  console.log('[DEBUG][firestoreCampaignService] getUserCampaigns result:', campaigns);
  return campaigns;
};

export const subscribeToUserCampaigns = (userId: string, callback: (campaigns: Campaign[]) => void): (() => void) => {
  console.log('[DEBUG][firestoreCampaignService] About to execute query...');
  console.log('[DEBUG][firestoreCampaignService] User ID:', userId);
  console.log('[DEBUG][firestoreCampaignService] User token exists:', !!auth.currentUser);
  
  const q = query(
    collection(db, 'campaigns'),
    where('collaboratorIds', 'array-contains', userId)
  );
  
  console.log('[DEBUG][firestoreCampaignService] Query created, setting up onSnapshot...');
  
  const unsubscribe = onSnapshot(q, 
    (querySnapshot) => {
      console.log('[DEBUG][firestoreCampaignService] Query snapshot received, docs count:', querySnapshot.size);
      
      const campaigns: Campaign[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log('[DEBUG][firestoreCampaignService] Processing document:', doc.id, data);
        
        const campaign: Campaign = {
          id: doc.id,
          name: data.name || '',
          description: data.description || '',
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
          createdBy: data.createdBy || '',
          collaborators: data.collaborators || {},
          collaboratorIds: data.collaboratorIds || [],
          isPublic: data.isPublic || false,
          csvAnalysis: data.csvAnalysis,
          powerAnalysisResults: data.powerAnalysisResults,
          hypothesisTests: data.hypothesisTests
        };
        campaigns.push(campaign);
      });
      
    console.log('[DEBUG][firestoreCampaignService] subscribeToUserCampaigns snapshot result:', campaigns);
    callback(campaigns);
    },
    (error) => {
      console.error('[DEBUG][firestoreCampaignService] Query error:', error);
      console.error('[DEBUG][firestoreCampaignService] Error code:', error.code);
      console.error('[DEBUG][firestoreCampaignService] Error message:', error.message);
      console.error('[DEBUG][firestoreCampaignService] Full error:', error);
    }
  );
  
  return unsubscribe;
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

// One-time script: Patch old campaigns to ensure collaborators/collaboratorIds are present and correct
export const patchOldCampaigns = async () => {
  const campaignsRef = collection(db, CAMPAIGNS_COLLECTION);
  const snapshot = await getDocs(campaignsRef);
  let patchedCount = 0;
  for (const doc of snapshot.docs) {
    const campaignId = doc.id;
    const campaign = doc.data();
    console.log(`---------------------`);
    console.log(`[DEBUG] campaignId: ${campaignId}`);
    console.log(`createdBy: ${campaign.createdBy}`);
    console.log(`collaborators:`, campaign.collaborators);
    console.log(`collaboratorIds:`, campaign.collaboratorIds);

    const missingCollaborators = !campaign.collaborators || Object.keys(campaign.collaborators).length === 0;
    const missingCollaboratorIds = !campaign.collaboratorIds || campaign.collaboratorIds.length === 0;
    console.log(`[CHECK] missingCollaborators=${missingCollaborators}, missingCollaboratorIds=${missingCollaboratorIds}`);

    if (missingCollaborators || !Object.prototype.hasOwnProperty.call(campaign.collaborators || {}, campaign.createdBy)) {
      const newCollaborators = {
        [campaign.createdBy]: {
          role: 'owner',
        },
      };
      const newCollaboratorIds = [campaign.createdBy];
      await updateDoc(doc.ref, {
        collaborators: newCollaborators,
        collaboratorIds: newCollaboratorIds,
      });
      console.log(`[PATCHED] ${campaignId}`);
      patchedCount++;
    } else {
      console.log(`[SKIPPED] Campaign not patched: ${campaignId}`);
    }
  }
  console.log(`[SUMMARY] Total scanned: ${snapshot.size}, patched: ${patchedCount}`);
  return patchedCount;
};


