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

export const subscribeToProposalData = (
  campaignId: string,
  callback: (proposalData: ProposalData | null) => void
): Unsubscribe => {
  const proposalRef = getProposalRef(campaignId);
  return onSnapshot(proposalRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      delete data.updatedAt;
      callback(data as ProposalData);
    } else {
      callback(null);
    }
  });
};

export const updateProposalData = async (campaignId: string, updates: Partial<ProposalData>) => {
  const proposalRef = getProposalRef(campaignId);
  await updateDoc(proposalRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}; 