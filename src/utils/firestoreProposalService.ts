import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { 
  ProposalData, 
  EnhancedProposalData, 
  ProposalField, 
  ProposalFieldHistory
} from '../types/Campaign';

const PROPOSALS_COLLECTION = 'campaigns';
const PROPOSAL_DOC = 'proposal';
const TEMPLATE_DOC = 'template';

// Helper function to check campaign permissions
export const checkCampaignPermissions = async (campaignId: string): Promise<boolean> => {
  try {
    console.log(`[ProposalService] Checking permissions for campaign ${campaignId}`);
    const campaignRef = doc(db, 'campaigns', campaignId);
    const campaignDoc = await getDoc(campaignRef);
    
    if (!campaignDoc.exists()) {
      console.error(`[ProposalService] Campaign ${campaignId} does not exist`);
      return false;
    }
    
    const campaignData = campaignDoc.data();
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      console.error(`[ProposalService] User not authenticated`);
      return false;
    }
    
    console.log(`[ProposalService] Campaign data:`, {
      id: campaignId,
      createdBy: campaignData.createdBy,
      collaboratorIds: campaignData.collaboratorIds,
      collaborators: campaignData.collaborators
    });
    console.log(`[ProposalService] Current user:`, {
      uid: currentUser.uid,
      email: currentUser.email,
      emailVerified: currentUser.emailVerified,
      providerId: currentUser.providerId
    });
    
    // Case-insensitive UID comparison
    const isCollaborator = campaignData.collaboratorIds && campaignData.collaboratorIds.some((id: string) => 
      id.toLowerCase() === currentUser.uid.toLowerCase()
    );
    console.log(`[ProposalService] Is collaborator:`, isCollaborator);
    
    if (!isCollaborator) {
      console.error(`[ProposalService] User ${currentUser.uid} (${currentUser.email}) is not a collaborator on campaign ${campaignId}`);
      console.log(`[ProposalService] Available collaborators:`, campaignData.collaborators);
    }
    
    return isCollaborator;
  } catch (error) {
    console.error(`[ProposalService] Error checking permissions:`, error);
    return false;
  }
};

// Convert legacy ProposalData to EnhancedProposalData
export const convertToEnhancedProposal = (
  legacyData: ProposalData,
  currentUser: { uid: string; displayName: string }
): EnhancedProposalData => {
  const now = serverTimestamp();
  const enhancedData: EnhancedProposalData = {} as EnhancedProposalData;
  
  Object.keys(legacyData).forEach((key) => {
    const fieldKey = key as keyof ProposalData;
    enhancedData[fieldKey] = {
      value: legacyData[fieldKey],
      lastUpdatedAt: now,
      lastUpdatedBy: currentUser,
      history: []
    };
  });
  
  return enhancedData;
};

// Convert EnhancedProposalData to legacy ProposalData for backward compatibility
export const convertToLegacyProposal = (enhancedData: EnhancedProposalData): ProposalData => {
  const legacyData: ProposalData = {} as ProposalData;
  
  Object.keys(enhancedData).forEach((key) => {
    const fieldKey = key as keyof EnhancedProposalData;
    legacyData[fieldKey] = enhancedData[fieldKey].value;
  });
  
  return legacyData;
};

// Create default enhanced proposal field
export const createDefaultProposalField = (
  value: string = '',
  currentUser: { uid: string; displayName: string }
): ProposalField => ({
  value,
  lastUpdatedAt: serverTimestamp(),
  lastUpdatedBy: currentUser,
  history: []
});

// Get default enhanced proposal data
export const getDefaultEnhancedProposalData = (
  currentUser: { uid: string; displayName: string }
): EnhancedProposalData => ({
  title: createDefaultProposalField('', currentUser),
  architects: createDefaultProposalField('', currentUser),
  date: createDefaultProposalField(new Date().toISOString().split('T')[0], currentUser),
  businessProblem: createDefaultProposalField('', currentUser),
  whyThisMatters: createDefaultProposalField('', currentUser),
  quantifyImpact: createDefaultProposalField('', currentUser),
  potentialBenefit: createDefaultProposalField('', currentUser),
  previousWork: createDefaultProposalField('', currentUser),
  researchQuestion: createDefaultProposalField('', currentUser),
  nullHypothesis: createDefaultProposalField('', currentUser),
  alternativeHypothesis: createDefaultProposalField('', currentUser),
  studyType: createDefaultProposalField('', currentUser),
  targetPopulation: createDefaultProposalField('', currentUser),
  samplingStrategy: createDefaultProposalField('', currentUser),
  eda: createDefaultProposalField('', currentUser),
  mde: createDefaultProposalField('5', currentUser),
  power: createDefaultProposalField('0.8', currentUser),
  significanceLevel: createDefaultProposalField('0.05', currentUser),
  standardDeviation: createDefaultProposalField('', currentUser),
  sampleSize: createDefaultProposalField('', currentUser),
  usersPerDay: createDefaultProposalField('', currentUser),
  expectedDays: createDefaultProposalField('', currentUser),
  primaryMetrics: createDefaultProposalField('', currentUser),
  secondaryMetrics: createDefaultProposalField('', currentUser),
  guardrailMetrics: createDefaultProposalField('', currentUser),
  potentialRisks: createDefaultProposalField('', currentUser),
  sanityChecks: createDefaultProposalField('', currentUser),
  statisticalTests: createDefaultProposalField('', currentUser),
  segments: createDefaultProposalField('', currentUser),
  fwerCorrection: createDefaultProposalField('Bonferroni Correction', currentUser),
  comments: createDefaultProposalField('', currentUser)
});

// Update a specific field with versioning
export const updateProposalField = async (
  campaignId: string,
  fieldName: keyof EnhancedProposalData,
  newValue: string,
  currentUser: { uid: string; displayName: string }
): Promise<void> => {
  try {
    console.log(`[ProposalService] Updating field ${fieldName} for campaign ${campaignId}`);
    console.log(`[ProposalService] Current user:`, currentUser);
    console.log(`[ProposalService] New value:`, newValue);
    
    // Check permissions first
    const hasPermission = await checkCampaignPermissions(campaignId);
    if (!hasPermission) {
      throw new Error(`User does not have permission to update campaign ${campaignId}`);
    }
    
    const proposalRef = doc(db, PROPOSALS_COLLECTION, campaignId, PROPOSAL_DOC, TEMPLATE_DOC);
    console.log(`[ProposalService] Document path: ${PROPOSALS_COLLECTION}/${campaignId}/${PROPOSAL_DOC}/${TEMPLATE_DOC}`);
    
    // Get current data to preserve history
    const currentDoc = await getDoc(proposalRef);
    console.log(`[ProposalService] Document exists:`, currentDoc.exists());
    
    if (!currentDoc.exists()) {
      console.log(`[ProposalService] Document doesn't exist, initializing proposal`);
      // Initialize the entire proposal document with default values
      const defaultData = getDefaultEnhancedProposalData(currentUser);
      // Update the specific field with the new value
      defaultData[fieldName] = {
        value: newValue,
        lastUpdatedAt: serverTimestamp(),
        lastUpdatedBy: currentUser,
        history: []
      };
      await setDoc(proposalRef, defaultData);
      console.log(`[ProposalService] Initialized proposal document with field ${fieldName}`);
      return;
  }
    
    const currentData = currentDoc.data() as EnhancedProposalData;
    console.log(`[ProposalService] Current data exists:`, !!currentData);
    
    if (!currentData || !currentData[fieldName]) {
      console.log(`[ProposalService] Field ${fieldName} doesn't exist, creating it`);
      // If field doesn't exist, create it
      const newField = createDefaultProposalField(newValue, currentUser);
      await updateDoc(proposalRef, {
        [fieldName]: newField
      });
      console.log(`[ProposalService] Created field ${fieldName}`);
      return;
    }
    
    const currentField = currentData[fieldName];
    console.log(`[ProposalService] Current field value:`, currentField.value);
    
    // Don't update if value hasn't changed
    if (currentField.value === newValue) {
      console.log(`[ProposalService] Value hasn't changed, skipping update`);
      return;
    }
    
    // Prepare history entry from current value
    const historyEntry: ProposalFieldHistory = {
      value: currentField.value,
      updatedAt: currentField.lastUpdatedAt,
      updatedBy: currentField.lastUpdatedBy
    };
    
    // Limit history to last 3 entries
    const currentHistory = currentField.history || [];
    const newHistory = [historyEntry, ...currentHistory].slice(0, 3);
    
    // Create updated field
    const updatedField: ProposalField = {
      value: newValue,
      lastUpdatedAt: serverTimestamp(),
      lastUpdatedBy: currentUser,
      history: newHistory
    };
    
    console.log(`[ProposalService] Updating field with:`, updatedField);
    
    // Update in Firestore
    await updateDoc(proposalRef, {
      [fieldName]: updatedField
    });
    
    console.log(`[ProposalService] Successfully updated field ${fieldName}`);
  } catch (error) {
    console.error(`[ProposalService] Error updating field ${fieldName}:`, error);
    console.error(`[ProposalService] Error details:`, {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: (error as any).code,
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
};

// Subscribe to enhanced proposal data with real-time updates
export const subscribeToEnhancedProposalData = (
  campaignId: string,
  callback: (data: EnhancedProposalData | null) => void
): (() => void) => {
  const proposalRef = doc(db, PROPOSALS_COLLECTION, campaignId, PROPOSAL_DOC, TEMPLATE_DOC);
  
  return onSnapshot(proposalRef, async (docSnapshot) => {
    if (docSnapshot.exists()) {
      const data = docSnapshot.data() as EnhancedProposalData;
      
      // Convert Firestore Timestamps to Date objects for easier handling
      const processedData: EnhancedProposalData = {} as EnhancedProposalData;
      
      Object.keys(data).forEach((key) => {
        const fieldKey = key as keyof EnhancedProposalData;
        const field = data[fieldKey];
        
        processedData[fieldKey] = {
          ...field,
          lastUpdatedAt: field.lastUpdatedAt instanceof Timestamp 
            ? field.lastUpdatedAt.toDate() 
            : field.lastUpdatedAt,
          history: field.history?.map(h => ({
            ...h,
            updatedAt: h.updatedAt instanceof Timestamp 
              ? h.updatedAt.toDate() 
              : h.updatedAt
          })) || []
        };
      });
      
      callback(processedData);
    } else {
      // Document doesn't exist - initialize it silently
      const currentUser = auth.currentUser;
      if (currentUser) {
        const userInfo = {
          uid: currentUser.uid,
          displayName: currentUser.displayName || 'Unknown User'
        };
        try {
          await initializeEnhancedProposal(campaignId, userInfo);
          console.log(`[ProposalService] Successfully initialized proposal for campaign ${campaignId}`);
          // Don't call callback here - let the onSnapshot trigger again with the new data
        } catch (error) {
          // Only log initialization errors, don't propagate them to UI
          console.warn(`[ProposalService] Error initializing proposal:`, error);
          callback(null);
        }
      } else {
        callback(null);
      }
    }
  }, (error) => {
    // Only log subscription errors, don't propagate them to UI unless they're critical
    console.warn(`[ProposalService] Error subscribing to proposal data:`, error);
    if (error.code !== 'permission-denied') {
      callback(null);
    }
  });
};

// Restore a field value from history
export const restoreFieldFromHistory = async (
  campaignId: string,
  fieldName: keyof EnhancedProposalData,
  historyIndex: number,
  currentUser: { uid: string; displayName: string }
): Promise<void> => {
  try {
    const proposalRef = doc(db, PROPOSALS_COLLECTION, campaignId, PROPOSAL_DOC, TEMPLATE_DOC);
    
    // Get current data
    const currentDoc = await getDoc(proposalRef);
    const currentData = currentDoc.data() as EnhancedProposalData;
    
    if (!currentData || !currentData[fieldName] || !currentData[fieldName].history) {
      throw new Error('No history available for this field');
    }
    
    const currentField = currentData[fieldName];
    const historyEntry = currentField.history![historyIndex];
    
    if (!historyEntry) {
      throw new Error('Invalid history index');
    }
    
    // Update field with restored value (this will automatically add current value to history)
    await updateProposalField(campaignId, fieldName, historyEntry.value, currentUser);
    
    console.log(`[ProposalService] Restored field ${fieldName} from history index ${historyIndex}`);
  } catch (error) {
    console.error(`[ProposalService] Error restoring field from history:`, error);
    throw error;
  }
};

// Initialize enhanced proposal data for a campaign
export const initializeEnhancedProposal = async (
  campaignId: string,
  currentUser: { uid: string; displayName: string }
): Promise<void> => {
  try {
    console.log(`[ProposalService] Initializing enhanced proposal for campaign ${campaignId}`);
    
    // Check permissions first
    const hasPermission = await checkCampaignPermissions(campaignId);
    if (!hasPermission) {
      throw new Error(`User does not have permission to access campaign ${campaignId}`);
    }
    
    const proposalRef = doc(db, PROPOSALS_COLLECTION, campaignId, PROPOSAL_DOC, TEMPLATE_DOC);
    console.log(`[ProposalService] Proposal document path: ${PROPOSALS_COLLECTION}/${campaignId}/${PROPOSAL_DOC}/${TEMPLATE_DOC}`);
    
    // Check if proposal already exists
    const existingDoc = await getDoc(proposalRef);
    if (existingDoc.exists()) {
      console.log(`[ProposalService] Enhanced proposal already exists for campaign ${campaignId}`);
      return;
    }
    
    console.log(`[ProposalService] Creating new enhanced proposal document`);
    
    // Create new enhanced proposal
    const defaultData = getDefaultEnhancedProposalData(currentUser);
    await setDoc(proposalRef, defaultData);
    
    console.log(`[ProposalService] Successfully initialized enhanced proposal for campaign ${campaignId}`);
  } catch (error) {
    console.error(`[ProposalService] Error initializing enhanced proposal:`, error);
    console.error(`[ProposalService] Error details:`, {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: (error as any).code,
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
};

// Legacy functions for backward compatibility
export const subscribeToProposalData = (
  campaignId: string,
  callback: (data: ProposalData | null) => void
): (() => void) => {
  return subscribeToEnhancedProposalData(campaignId, (enhancedData) => {
    if (enhancedData) {
      const legacyData = convertToLegacyProposal(enhancedData);
      callback(legacyData);
      } else {
        callback(null);
      }
    });
};

export const updateProposal = async (
  campaignId: string,
  updates: Partial<ProposalData>
): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User not authenticated');
  }
  
  const userInfo = {
    uid: currentUser.uid,
    displayName: currentUser.displayName || 'Unknown User'
  };
  
  // Update each field individually to maintain proper versioning
  for (const [fieldName, value] of Object.entries(updates)) {
    if (value !== undefined) {
      await updateProposalField(
        campaignId,
        fieldName as keyof EnhancedProposalData,
        String(value),
        userInfo
      );
    }
  }
}; 