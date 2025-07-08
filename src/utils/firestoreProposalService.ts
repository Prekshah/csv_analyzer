import { db } from '../config/firebase';
import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  Unsubscribe
} from 'firebase/firestore';
import { ProposalData } from '../types/Campaign';
import { CAMPAIGNS_COLLECTION } from '../utils/firestoreCampaignService';

// Proposal data will be stored as a single document under each campaign: campaigns/{campaignId}/proposal/main

export const getProposalRef = (campaignId: string) =>
  doc(db, 'campaigns', campaignId, 'proposal', 'main');

export const saveProposalData = async (campaignId: string, proposalData: ProposalData) => {
  const proposalRef = getProposalRef(campaignId);
  await setDoc(proposalRef, {
    ...proposalData,
    updatedAt: serverTimestamp(),
  });
};

export const getProposalData = async (campaignId: string): Promise<ProposalData | null> => {
  const proposalRef = getProposalRef(campaignId);
  const docSnap = await getDoc(proposalRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    delete data.updatedAt;
    return data as ProposalData;
  }
  return null;
};

// DEV ONLY: To clear local Firestore cache, run in console:
// indexedDB.deleteDatabase('firebase-firestore-database') // <- for dev only

// Enhanced subscribeToProposalData with existence check and warning
export const subscribeToProposalData = (
  campaignId: string,
  callback: (proposalData: ProposalData | null) => void
): Unsubscribe => {
  const proposalRef = getProposalRef(campaignId);
  let unsub: Unsubscribe | null = null;
  // First, check if the document exists
  getDoc(proposalRef).then((docSnap) => {
    if (!docSnap.exists()) {
      console.warn(`[Firestore] Proposal document does not exist for campaign ${campaignId}`);
      callback(null);
      return;
    }
    // Attach the listener only if the document exists
    unsub = onSnapshot(proposalRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        delete data.updatedAt;
        callback(data as ProposalData);
      } else {
        callback(null);
      }
    });
  });
  // Cleanup
  return () => {
    if (unsub) unsub();
  };
};

export const updateProposalData = async (campaignId: string, updates: Partial<ProposalData>) => {
  const proposalRef = getProposalRef(campaignId);
  await updateDoc(proposalRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

// Enhanced updateProposal to merge updates with existing data
export const updateProposal = async (campaignId: string, updates: Partial<ProposalData>) => {
  const proposalRef = getProposalRef(campaignId);
  // Get the current proposal data
  const docSnap = await getDoc(proposalRef);
  let mergedUpdates: { [key: string]: any } = { ...updates };
  if (docSnap.exists()) {
    const currentData = docSnap.data();
    mergedUpdates = { ...currentData, ...updates };
  }
  // Always include updatedAt
  mergedUpdates.updatedAt = serverTimestamp();
  await updateDoc(proposalRef, mergedUpdates);
  // Also update the parent campaign document's updatedAt timestamp
  const campaignRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
  await updateDoc(campaignRef, {
    updatedAt: serverTimestamp(),
  });
}; 