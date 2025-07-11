import { 
  TabState, 
  CampaignCSVState
} from '../types/Campaign';
import { 
  createDefaultCampaignCSVState, 
  updateTabState, 
  updatePowerAnalysisState 
} from './csvVersioning';

// Local storage keys
const CAMPAIGN_STATE_PREFIX = 'campaign_state_';
const TAB_STATE_PREFIX = 'tab_state_';

// Interface for tab state manager
export interface TabStateManager {
  // Campaign-level state management
  getCampaignState(campaignId: string): Record<string, CampaignCSVState>;
  setCampaignState(campaignId: string, state: Record<string, CampaignCSVState>): void;
  
  // CSV-specific state management (using content hash for precise matching)
  getCSVState(campaignId: string, csvContentHash: string): CampaignCSVState | null;
  setCSVState(campaignId: string, csvContentHash: string, state: CampaignCSVState): void;
  
  // Tab state management
  getTabState(campaignId: string, csvContentHash: string): TabState | null;
  setTabState(campaignId: string, csvContentHash: string, tabState: TabState): void;
  
  // Active tab management
  getActiveTab(campaignId: string, csvContentHash: string): number;
  setActiveTab(campaignId: string, csvContentHash: string, tabIndex: number, updatedBy: string): void;
  
  // Power analysis state management
  getPowerAnalysisState(campaignId: string, csvContentHash: string): TabState['powerAnalysisState'] | null;
  setPowerAnalysisState(
    campaignId: string, 
    csvContentHash: string, 
    powerAnalysisState: Partial<TabState['powerAnalysisState']>, 
    updatedBy: string
  ): void;
  
  // Utility methods
  initializeCSVState(campaignId: string, csvContentHash: string, csvVersionId: string, uploadedBy: string): CampaignCSVState;
  clearCampaignState(campaignId: string): void;
  clearCSVState(campaignId: string, csvContentHash: string): void;
  
  // Collaboration support
  subscribeToStateChanges(
    campaignId: string, 
    csvContentHash: string, 
    callback: (state: CampaignCSVState) => void
  ): () => void;
  
  // Migration and cleanup
  migrateFromSessionStorage(campaignId: string): void;
  cleanupOldStates(maxAge: number): void;
}

// Implementation of tab state manager
class TabStateManagerImpl implements TabStateManager {
  private stateChangeListeners: Map<string, Set<(state: CampaignCSVState) => void>> = new Map();
  
  // Generate key for campaign state
  private getCampaignStateKey(campaignId: string): string {
    return `${CAMPAIGN_STATE_PREFIX}${campaignId}`;
  }
  
  // Generate key for specific CSV state using composite key with content hash
  private getCSVStateKey(campaignId: string, csvContentHash: string): string {
    return `${TAB_STATE_PREFIX}${campaignId}::${csvContentHash}`;
  }
  
  // Generate composite key for direct CSV state access
  private getCompositeKey(campaignId: string, csvContentHash: string): string {
    return `${campaignId}::${csvContentHash}`;
  }
  
  // Get campaign state from localStorage
  getCampaignState(campaignId: string): Record<string, CampaignCSVState> {
    try {
      const key = this.getCampaignStateKey(campaignId);
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert date strings back to Date objects
        return this.deserializeStates(parsed);
      }
    } catch (error) {
      console.error('Error loading campaign state:', error);
    }
    return {};
  }
  
  // Set campaign state in localStorage (legacy method - mainly for backward compatibility)
  setCampaignState(campaignId: string, state: Record<string, CampaignCSVState>): void {
    try {
      const key = this.getCampaignStateKey(campaignId);
      const serialized = this.serializeStates(state);
      localStorage.setItem(key, JSON.stringify(serialized));
    } catch (error) {
      console.error('Error saving campaign state:', error);
    }
  }
  
  // Get CSV-specific state using content hash
  getCSVState(campaignId: string, csvContentHash: string): CampaignCSVState | null {
    try {
      const key = this.getCSVStateKey(campaignId, csvContentHash);
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        return this.deserializeSingleState(parsed);
      }
    } catch (error) {
      console.error('Error loading CSV state:', error);
    }
    return null;
  }
  
  // Set CSV-specific state using content hash
  setCSVState(campaignId: string, csvContentHash: string, state: CampaignCSVState): void {
    try {
      const key = this.getCSVStateKey(campaignId, csvContentHash);
      const serialized = this.serializeSingleState(state);
      localStorage.setItem(key, JSON.stringify(serialized));
    } catch (error) {
      console.error('Error saving CSV state:', error);
    }
  }
  
  // Get tab state for specific CSV using content hash
  getTabState(campaignId: string, csvContentHash: string): TabState | null {
    const csvState = this.getCSVState(campaignId, csvContentHash);
    return csvState?.tabStates || null;
  }
  
  // Set tab state for specific CSV using content hash
  setTabState(campaignId: string, csvContentHash: string, tabState: TabState): void {
    const csvState = this.getCSVState(campaignId, csvContentHash);
    if (csvState) {
      csvState.tabStates = tabState;
      this.setCSVState(campaignId, csvContentHash, csvState);
    }
  }
  
  // Get active tab index using content hash
  getActiveTab(campaignId: string, csvContentHash: string): number {
    const csvState = this.getCSVState(campaignId, csvContentHash);
    return csvState?.activeTab || 0;
  }
  
  // Set active tab index using content hash
  setActiveTab(campaignId: string, csvContentHash: string, tabIndex: number, updatedBy: string): void {
    const csvState = this.getCSVState(campaignId, csvContentHash);
    if (csvState) {
      csvState.activeTab = tabIndex;
      csvState.tabStates = updateTabState(csvState.tabStates, {}, updatedBy);
      this.setCSVState(campaignId, csvContentHash, csvState);
    }
  }
  
  // Get power analysis state using content hash
  getPowerAnalysisState(campaignId: string, csvContentHash: string): TabState['powerAnalysisState'] | null {
    const tabState = this.getTabState(campaignId, csvContentHash);
    return tabState?.powerAnalysisState || null;
  }
  
  // Set power analysis state using content hash
  setPowerAnalysisState(
    campaignId: string, 
    csvContentHash: string, 
    powerAnalysisState: Partial<TabState['powerAnalysisState']>, 
    updatedBy: string
  ): void {
    const csvState = this.getCSVState(campaignId, csvContentHash);
    if (csvState) {
      csvState.tabStates = updatePowerAnalysisState(csvState.tabStates, powerAnalysisState, updatedBy);
      this.setCSVState(campaignId, csvContentHash, csvState);
    }
  }
  
  // Initialize CSV state using content hash
  initializeCSVState(campaignId: string, csvContentHash: string, csvVersionId: string, uploadedBy: string): CampaignCSVState {
    const existingState = this.getCSVState(campaignId, csvContentHash);
    if (existingState) {
      return existingState;
    }
    
    const newState = createDefaultCampaignCSVState(csvVersionId, uploadedBy);
    this.setCSVState(campaignId, csvContentHash, newState);
    return newState;
  }
  
  // Clear campaign state (removes all CSV states for a campaign)
  clearCampaignState(campaignId: string): void {
    // Remove all keys that start with the campaign prefix
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${TAB_STATE_PREFIX}${campaignId}::`)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // Also remove the legacy campaign state key
    const legacyKey = this.getCampaignStateKey(campaignId);
    localStorage.removeItem(legacyKey);
  }
  
  // Clear specific CSV state using content hash
  clearCSVState(campaignId: string, csvContentHash: string): void {
    const key = this.getCSVStateKey(campaignId, csvContentHash);
    localStorage.removeItem(key);
  }
  
  // Subscribe to state changes using content hash
  subscribeToStateChanges(
    campaignId: string, 
    csvContentHash: string, 
    callback: (state: CampaignCSVState) => void
  ): () => void {
    const key = this.getCSVStateKey(campaignId, csvContentHash);
    
    if (!this.stateChangeListeners.has(key)) {
      this.stateChangeListeners.set(key, new Set());
    }
    
    this.stateChangeListeners.get(key)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const listeners = this.stateChangeListeners.get(key);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.stateChangeListeners.delete(key);
        }
      }
    };
  }
  
  // Migrate from session storage (for backward compatibility)
  migrateFromSessionStorage(campaignId: string): void {
    try {
      // Migrate power analysis state
      const powerAnalysisKey = `powerAnalysisState_${campaignId}`;
      const powerAnalysisState = sessionStorage.getItem(powerAnalysisKey);
      
      // Migrate proposal state
      const proposalKey = `proposalState_${campaignId}`;
      const proposalState = sessionStorage.getItem(proposalKey);
      
      if (powerAnalysisState || proposalState) {
        console.log(`Migrating session storage data for campaign ${campaignId}`);
        
        // Create a migration hash for old data
        const migrationHash = `migrated_${Date.now()}`;
        const migrationCsvId = `migrated_${Date.now()}`;
        const defaultState = createDefaultCampaignCSVState(migrationCsvId, 'system');
        
        if (powerAnalysisState) {
          const parsed = JSON.parse(powerAnalysisState);
          defaultState.tabStates.powerAnalysisState = { ...defaultState.tabStates.powerAnalysisState, ...parsed };
          sessionStorage.removeItem(powerAnalysisKey);
        }
        
        this.setCSVState(campaignId, migrationHash, defaultState);
        console.log(`Migration completed for campaign ${campaignId} with hash ${migrationHash}`);
      }
    } catch (error) {
      console.error('Error migrating from session storage:', error);
    }
  }
  
  // Clean up old states
  cleanupOldStates(maxAge: number = 30 * 24 * 60 * 60 * 1000): void { // 30 days default
    const now = Date.now();
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(CAMPAIGN_STATE_PREFIX) || key.startsWith(TAB_STATE_PREFIX))) {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const parsed = JSON.parse(stored);
            const lastUpdated = this.getLastUpdatedTime(parsed);
            if (now - lastUpdated > maxAge) {
              keysToRemove.push(key);
            }
          }
        } catch (error) {
          // Remove invalid entries
          keysToRemove.push(key);
        }
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`Cleaned up ${keysToRemove.length} old state entries`);
  }
  
  // Helper methods
  private serializeStates(states: Record<string, CampaignCSVState>): any {
    const serialized: any = {};
    Object.keys(states).forEach(key => {
      serialized[key] = {
        ...states[key],
        tabStates: {
          ...states[key].tabStates,
          lastUpdatedAt: states[key].tabStates.lastUpdatedAt.toISOString()
        }
      };
    });
    return serialized;
  }
  
  private deserializeStates(serialized: any): Record<string, CampaignCSVState> {
    const deserialized: Record<string, CampaignCSVState> = {};
    Object.keys(serialized).forEach(key => {
      deserialized[key] = {
        ...serialized[key],
        tabStates: {
          ...serialized[key].tabStates,
          lastUpdatedAt: new Date(serialized[key].tabStates.lastUpdatedAt)
        }
      };
    });
    return deserialized;
  }

  private serializeSingleState(state: CampaignCSVState): any {
    return {
      ...state,
      tabStates: {
        ...state.tabStates,
        lastUpdatedAt: state.tabStates.lastUpdatedAt.toISOString()
      }
    };
  }

  private deserializeSingleState(serialized: any): CampaignCSVState {
    return {
      ...serialized,
      tabStates: {
        ...serialized.tabStates,
        lastUpdatedAt: new Date(serialized.tabStates.lastUpdatedAt)
      }
    };
  }
  
  private getLastUpdatedTime(data: any): number {
    if (data.tabStates?.lastUpdatedAt) {
      return new Date(data.tabStates.lastUpdatedAt).getTime();
    }
    return 0;
  }
  
  // Note: Notification is now handled per individual CSV state, not batch
}

// Export singleton instance
export const tabStateManager = new TabStateManagerImpl();

// Export utility functions for external use
export const initializeTabStateForCampaign = (campaignId: string, csvContentHash: string, csvVersionId: string, uploadedBy: string): CampaignCSVState => {
  return tabStateManager.initializeCSVState(campaignId, csvContentHash, csvVersionId, uploadedBy);
};

export const getTabStateForCampaign = (campaignId: string, csvContentHash: string): TabState | null => {
  return tabStateManager.getTabState(campaignId, csvContentHash);
};

export const updateTabStateForCampaign = (
  campaignId: string, 
  csvContentHash: string, 
  updates: Partial<TabState>, 
  updatedBy: string
): void => {
  const currentState = tabStateManager.getTabState(campaignId, csvContentHash);
  if (currentState) {
    const newState = updateTabState(currentState, updates, updatedBy);
    tabStateManager.setTabState(campaignId, csvContentHash, newState);
  }
};

export const switchActiveTab = (campaignId: string, csvContentHash: string, tabIndex: number, updatedBy: string): void => {
  tabStateManager.setActiveTab(campaignId, csvContentHash, tabIndex, updatedBy);
};

export const updatePowerAnalysisStateForCampaign = (
  campaignId: string, 
  csvContentHash: string, 
  updates: Partial<TabState['powerAnalysisState']>, 
  updatedBy: string
): void => {
  tabStateManager.setPowerAnalysisState(campaignId, csvContentHash, updates, updatedBy);
}; 