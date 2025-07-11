import { 
  doc, 
  updateDoc, 
  onSnapshot, 
  serverTimestamp,
  getDoc,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  Campaign, 
  CSVFileVersion, 
  CampaignCSVState, 
  TabState 
} from '../types/Campaign';
import { 
  createCSVFileVersion, 
  findExistingCSVVersion, 
  setActiveCsvVersion, 
  cleanupOldCSVVersions 
} from './csvVersioning';
import { tabStateManager } from './tabStateManager';

const CAMPAIGNS_COLLECTION = 'campaigns';

// Enhanced CSV storage service
export class FirestoreCSVService {
  
  // Add or update CSV version in campaign
  async addCSVVersion(
    campaignId: string, 
    file: File, 
    analysis: any, 
    uploadedBy: string
  ): Promise<CSVFileVersion> {
    try {
      // Create CSV file version
      const csvVersion = await createCSVFileVersion(file, analysis, uploadedBy);
      
      // Get current campaign
      const campaignRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
      const campaignDoc = await getDoc(campaignRef);
      
      if (!campaignDoc.exists()) {
        throw new Error(`Campaign ${campaignId} not found`);
      }
      
      const campaignData = campaignDoc.data() as Campaign;
      const csvVersions = campaignData.csvVersions || {};
      const csvStates = campaignData.csvStates || {};
      
      // Check if CSV with same content already exists
      const existingVersion = findExistingCSVVersion(csvVersion.contentHash, csvVersions);
      
      if (existingVersion) {
        // CSV already exists, just activate it
        const updatedVersions = setActiveCsvVersion(csvVersions, existingVersion.id);
        
        await updateDoc(campaignRef, {
          csvVersions: updatedVersions,
          activeCsvVersionId: existingVersion.id,
          updatedAt: serverTimestamp(),
          updatedBy: uploadedBy
        });
        
        console.log(`Activated existing CSV version: ${existingVersion.id}`);
        return existingVersion;
      }
      
      // Add new CSV version
      csvVersions[csvVersion.id] = csvVersion;
      
      // Set as active version (deactivate others)
      const updatedVersions = setActiveCsvVersion(csvVersions, csvVersion.id);
      
      // Initialize state for new CSV using content hash
      const initialState = tabStateManager.initializeCSVState(campaignId, csvVersion.contentHash, csvVersion.id, uploadedBy);
      csvStates[csvVersion.id] = initialState;
      
      // Clean up old versions (keep only last 5)
      const cleanedVersions = cleanupOldCSVVersions(updatedVersions, 5);
      
      // Update campaign in Firestore
      await updateDoc(campaignRef, {
        csvVersions: cleanedVersions,
        csvStates: csvStates,
        activeCsvVersionId: csvVersion.id,
        updatedAt: serverTimestamp(),
        updatedBy: uploadedBy
      });
      
      console.log(`Added new CSV version: ${csvVersion.id}`);
      return csvVersion;
      
    } catch (error) {
      console.error('Error adding CSV version:', error);
      throw error;
    }
  }
  
  // Switch active CSV version
  async switchActiveCsvVersion(
    campaignId: string, 
    csvVersionId: string, 
    updatedBy: string
  ): Promise<void> {
    try {
      const campaignRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
      const campaignDoc = await getDoc(campaignRef);
      
      if (!campaignDoc.exists()) {
        throw new Error(`Campaign ${campaignId} not found`);
      }
      
      const campaignData = campaignDoc.data() as Campaign;
      const csvVersions = campaignData.csvVersions || {};
      
      if (!csvVersions[csvVersionId]) {
        throw new Error(`CSV version ${csvVersionId} not found`);
      }
      
      // Set as active version
      const updatedVersions = setActiveCsvVersion(csvVersions, csvVersionId);
      
      await updateDoc(campaignRef, {
        csvVersions: updatedVersions,
        activeCsvVersionId: csvVersionId,
        updatedAt: serverTimestamp(),
        updatedBy: updatedBy
      });
      
      console.log(`Switched to CSV version: ${csvVersionId}`);
      
    } catch (error) {
      console.error('Error switching CSV version:', error);
      throw error;
    }
  }
  
  // Update CSV state (tab states, active tab, etc.)
  async updateCSVState(
    campaignId: string, 
    csvVersionId: string, 
    state: CampaignCSVState, 
    updatedBy: string
  ): Promise<void> {
    try {
      const campaignRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
      const campaignDoc = await getDoc(campaignRef);
      
      if (!campaignDoc.exists()) {
        throw new Error(`Campaign ${campaignId} not found`);
      }
      
      const campaignData = campaignDoc.data() as Campaign;
      const csvStates = campaignData.csvStates || {};
      
      // Update the specific CSV state
      csvStates[csvVersionId] = {
        ...state,
        tabStates: {
          ...state.tabStates,
          lastUpdatedAt: new Date(),
          lastUpdatedBy: updatedBy
        }
      };
      
      await updateDoc(campaignRef, {
        csvStates: csvStates,
        updatedAt: serverTimestamp(),
        updatedBy: updatedBy
      });
      
      console.log(`Updated CSV state for version: ${csvVersionId}`);
      
    } catch (error) {
      console.error('Error updating CSV state:', error);
      throw error;
    }
  }
  
  // Update tab state for specific CSV
  async updateTabState(
    campaignId: string, 
    csvVersionId: string, 
    tabState: TabState, 
    updatedBy: string
  ): Promise<void> {
    try {
      const campaignRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
      const campaignDoc = await getDoc(campaignRef);
      
      if (!campaignDoc.exists()) {
        throw new Error(`Campaign ${campaignId} not found`);
      }
      
      const campaignData = campaignDoc.data() as Campaign;
      const csvStates = campaignData.csvStates || {};
      
      if (!csvStates[csvVersionId]) {
        // Initialize state if it doesn't exist - use csvVersionId as fallback hash
        csvStates[csvVersionId] = tabStateManager.initializeCSVState(campaignId, csvVersionId, csvVersionId, updatedBy);
      }
      
      // Update tab state
      csvStates[csvVersionId].tabStates = {
        ...tabState,
        lastUpdatedAt: new Date(),
        lastUpdatedBy: updatedBy
      };
      
      await updateDoc(campaignRef, {
        csvStates: csvStates,
        updatedAt: serverTimestamp(),
        updatedBy: updatedBy
      });
      
      console.log(`Updated tab state for CSV version: ${csvVersionId}`);
      
    } catch (error) {
      console.error('Error updating tab state:', error);
      throw error;
    }
  }
  
  // Update active tab for specific CSV
  async updateActiveTab(
    campaignId: string, 
    csvVersionId: string, 
    activeTab: number, 
    updatedBy: string
  ): Promise<void> {
    try {
      const campaignRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
      const campaignDoc = await getDoc(campaignRef);
      
      if (!campaignDoc.exists()) {
        throw new Error(`Campaign ${campaignId} not found`);
      }
      
      const campaignData = campaignDoc.data() as Campaign;
      const csvStates = campaignData.csvStates || {};
      
      if (!csvStates[csvVersionId]) {
        // Use csvVersionId as fallback hash for legacy compatibility
        csvStates[csvVersionId] = tabStateManager.initializeCSVState(campaignId, csvVersionId, csvVersionId, updatedBy);
      }
      
      // Update active tab
      csvStates[csvVersionId].activeTab = activeTab;
      csvStates[csvVersionId].tabStates.lastUpdatedAt = new Date();
      csvStates[csvVersionId].tabStates.lastUpdatedBy = updatedBy;
      
      await updateDoc(campaignRef, {
        csvStates: csvStates,
        updatedAt: serverTimestamp(),
        updatedBy: updatedBy
      });
      
      console.log(`Updated active tab to ${activeTab} for CSV version: ${csvVersionId}`);
      
    } catch (error) {
      console.error('Error updating active tab:', error);
      throw error;
    }
  }
  
  // Remove CSV version
  async removeCSVVersion(
    campaignId: string, 
    csvVersionId: string, 
    updatedBy: string
  ): Promise<void> {
    try {
      const campaignRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
      const campaignDoc = await getDoc(campaignRef);
      
      if (!campaignDoc.exists()) {
        throw new Error(`Campaign ${campaignId} not found`);
      }
      
      const campaignData = campaignDoc.data() as Campaign;
      const csvVersions = campaignData.csvVersions || {};
      const csvStates = campaignData.csvStates || {};
      
      // Remove version and state
      delete csvVersions[csvVersionId];
      delete csvStates[csvVersionId];
      
      // If this was the active version, activate another one
      let newActiveCsvVersionId = campaignData.activeCsvVersionId;
      if (campaignData.activeCsvVersionId === csvVersionId) {
        const remainingVersions = Object.keys(csvVersions);
        newActiveCsvVersionId = remainingVersions.length > 0 ? remainingVersions[0] : undefined;
        
        if (newActiveCsvVersionId) {
          csvVersions[newActiveCsvVersionId].isActive = true;
        }
      }
      
      await updateDoc(campaignRef, {
        csvVersions: csvVersions,
        csvStates: csvStates,
        activeCsvVersionId: newActiveCsvVersionId,
        updatedAt: serverTimestamp(),
        updatedBy: updatedBy
      });
      
      console.log(`Removed CSV version: ${csvVersionId}`);
      
    } catch (error) {
      console.error('Error removing CSV version:', error);
      throw error;
    }
  }
  
  // Subscribe to CSV versions and states changes
  subscribeToCsvVersionsAndStates(
    campaignId: string, 
    callback: (csvVersions: Record<string, CSVFileVersion>, csvStates: Record<string, CampaignCSVState>, activeCsvVersionId?: string) => void
  ): Unsubscribe {
    const campaignRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
    
    return onSnapshot(campaignRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data() as Campaign;
        const csvVersions = data.csvVersions || {};
        const csvStates = data.csvStates || {};
        const activeCsvVersionId = data.activeCsvVersionId;
        
        callback(csvVersions, csvStates, activeCsvVersionId);
      } else {
        callback({}, {}, undefined);
      }
    });
  }
  
  // Subscribe to specific CSV state changes
  subscribeToCSVState(
    campaignId: string, 
    csvVersionId: string, 
    callback: (state: CampaignCSVState | null) => void
  ): Unsubscribe {
    const campaignRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
    
    return onSnapshot(campaignRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data() as Campaign;
        const csvStates = data.csvStates || {};
        const state = csvStates[csvVersionId] || null;
        
        callback(state);
      } else {
        callback(null);
      }
    });
  }
  
  // Get CSV file content for download
  async getCSVFileContent(campaignId: string, csvVersionId: string): Promise<string | null> {
    try {
      const campaignRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
      const campaignDoc = await getDoc(campaignRef);
      
      if (!campaignDoc.exists()) {
        throw new Error(`Campaign ${campaignId} not found`);
      }
      
      const campaignData = campaignDoc.data() as Campaign;
      const csvVersions = campaignData.csvVersions || {};
      const csvVersion = csvVersions[csvVersionId];
      
      if (!csvVersion) {
        throw new Error(`CSV version ${csvVersionId} not found`);
      }
      
      return csvVersion.csvContent || null;
      
    } catch (error) {
      console.error('Error getting CSV file content:', error);
      return null;
    }
  }
}

// Export singleton instance
export const firestoreCSVService = new FirestoreCSVService();

// Export convenience functions
export const addCSVToCampaign = (campaignId: string, file: File, analysis: any, uploadedBy: string) => {
  return firestoreCSVService.addCSVVersion(campaignId, file, analysis, uploadedBy);
};

export const switchCampaignCSVVersion = (campaignId: string, csvVersionId: string, updatedBy: string) => {
  return firestoreCSVService.switchActiveCsvVersion(campaignId, csvVersionId, updatedBy);
};

export const updateCampaignCSVState = (campaignId: string, csvVersionId: string, state: CampaignCSVState, updatedBy: string) => {
  return firestoreCSVService.updateCSVState(campaignId, csvVersionId, state, updatedBy);
};

export const updateCampaignTabState = (campaignId: string, csvVersionId: string, tabState: TabState, updatedBy: string) => {
  return firestoreCSVService.updateTabState(campaignId, csvVersionId, tabState, updatedBy);
};

export const updateCampaignActiveTab = (campaignId: string, csvVersionId: string, activeTab: number, updatedBy: string) => {
  return firestoreCSVService.updateActiveTab(campaignId, csvVersionId, activeTab, updatedBy);
};

export const subscribeToCSVVersionsAndStates = (
  campaignId: string, 
  callback: (csvVersions: Record<string, CSVFileVersion>, csvStates: Record<string, CampaignCSVState>, activeCsvVersionId?: string) => void
) => {
  return firestoreCSVService.subscribeToCsvVersionsAndStates(campaignId, callback);
};

export const subscribeToCSVState = (
  campaignId: string, 
  csvVersionId: string, 
  callback: (state: CampaignCSVState | null) => void
) => {
  return firestoreCSVService.subscribeToCSVState(campaignId, csvVersionId, callback);
};

export const getCSVContentForDownload = (campaignId: string, csvVersionId: string) => {
  return firestoreCSVService.getCSVFileContent(campaignId, csvVersionId);
}; 