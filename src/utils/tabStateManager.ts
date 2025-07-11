import { 
  TabState, 
  CampaignCSVState, 
  CSVFileVersion 
} from '../types/Campaign';
import { 
  createDefaultTabState, 
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
  
  // CSV-specific state management
  getCSVState(campaignId: string, csvVersionId: string): CampaignCSVState | null;
  setCSVState(campaignId: string, csvVersionId: string, state: CampaignCSVState): void;
  
  // Tab state management
  getTabState(campaignId: string, csvVersionId: string): TabState | null;
  setTabState(campaignId: string, csvVersionId: string, tabState: TabState): void;
  
  // Active tab management
  getActiveTab(campaignId: string, csvVersionId: string): number;
  setActiveTab(campaignId: string, csvVersionId: string, tabIndex: number, updatedBy: string): void;
  
  // Power analysis state management
  getPowerAnalysisState(campaignId: string, csvVersionId: string): TabState['powerAnalysisState'] | null;
  setPowerAnalysisState(
    campaignId: string, 
    csvVersionId: string, 
    powerAnalysisState: Partial<TabState['powerAnalysisState']>, 
    updatedBy: string
  ): void;
  
  // Utility methods
  initializeCSVState(campaignId: string, csvVersionId: string, uploadedBy: string): CampaignCSVState;
  clearCampaignState(campaignId: string): void;
  clearCSVState(campaignId: string, csvVersionId: string): void;
  
  // Collaboration support
  subscribeToStateChanges(
    campaignId: string, 
    csvVersionId: string, 
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
  
  // Generate key for specific CSV state
  private getCSVStateKey(campaignId: string, csvVersionId: string): string {
    return `${TAB_STATE_PREFIX}${campaignId}_${csvVersionId}`;
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
  
  // Set campaign state in localStorage
  setCampaignState(campaignId: string, state: Record<string, CampaignCSVState>): void {
    try {
      const key = this.getCampaignStateKey(campaignId);
      const serialized = this.serializeStates(state);
      localStorage.setItem(key, JSON.stringify(serialized));
      
      // Notify listeners
      this.notifyStateChange(campaignId, state);
    } catch (error) {
      console.error('Error saving campaign state:', error);
    }
  }
  
  // Get CSV-specific state
  getCSVState(campaignId: string, csvVersionId: string): CampaignCSVState | null {
    const campaignState = this.getCampaignState(campaignId);
    return campaignState[csvVersionId] || null;
  }
  
  // Set CSV-specific state
  setCSVState(campaignId: string, csvVersionId: string, state: CampaignCSVState): void {
    const campaignState = this.getCampaignState(campaignId);
    campaignState[csvVersionId] = state;
    this.setCampaignState(campaignId, campaignState);
  }
  
  // Get tab state for specific CSV
  getTabState(campaignId: string, csvVersionId: string): TabState | null {
    const csvState = this.getCSVState(campaignId, csvVersionId);
    return csvState?.tabStates || null;
  }
  
  // Set tab state for specific CSV
  setTabState(campaignId: string, csvVersionId: string, tabState: TabState): void {
    const csvState = this.getCSVState(campaignId, csvVersionId);
    if (csvState) {
      csvState.tabStates = tabState;
      this.setCSVState(campaignId, csvVersionId, csvState);
    }
  }
  
  // Get active tab index
  getActiveTab(campaignId: string, csvVersionId: string): number {
    const csvState = this.getCSVState(campaignId, csvVersionId);
    return csvState?.activeTab || 0;
  }
  
  // Set active tab index
  setActiveTab(campaignId: string, csvVersionId: string, tabIndex: number, updatedBy: string): void {
    const csvState = this.getCSVState(campaignId, csvVersionId);
    if (csvState) {
      csvState.activeTab = tabIndex;
      csvState.tabStates = updateTabState(csvState.tabStates, {}, updatedBy);
      this.setCSVState(campaignId, csvVersionId, csvState);
    }
  }
  
  // Get power analysis state
  getPowerAnalysisState(campaignId: string, csvVersionId: string): TabState['powerAnalysisState'] | null {
    const tabState = this.getTabState(campaignId, csvVersionId);
    return tabState?.powerAnalysisState || null;
  }
  
  // Set power analysis state
  setPowerAnalysisState(
    campaignId: string, 
    csvVersionId: string, 
    powerAnalysisState: Partial<TabState['powerAnalysisState']>, 
    updatedBy: string
  ): void {
    const csvState = this.getCSVState(campaignId, csvVersionId);
    if (csvState) {
      csvState.tabStates = updatePowerAnalysisState(csvState.tabStates, powerAnalysisState, updatedBy);
      this.setCSVState(campaignId, csvVersionId, csvState);
    }
  }
  
  // Initialize CSV state
  initializeCSVState(campaignId: string, csvVersionId: string, uploadedBy: string): CampaignCSVState {
    const existingState = this.getCSVState(campaignId, csvVersionId);
    if (existingState) {
      return existingState;
    }
    
    const newState = createDefaultCampaignCSVState(csvVersionId, uploadedBy);
    this.setCSVState(campaignId, csvVersionId, newState);
    return newState;
  }
  
  // Clear campaign state
  clearCampaignState(campaignId: string): void {
    const key = this.getCampaignStateKey(campaignId);
    localStorage.removeItem(key);
  }
  
  // Clear CSV state
  clearCSVState(campaignId: string, csvVersionId: string): void {
    const campaignState = this.getCampaignState(campaignId);
    delete campaignState[csvVersionId];
    this.setCampaignState(campaignId, campaignState);
  }
  
  // Subscribe to state changes
  subscribeToStateChanges(
    campaignId: string, 
    csvVersionId: string, 
    callback: (state: CampaignCSVState) => void
  ): () => void {
    const key = this.getCSVStateKey(campaignId, csvVersionId);
    
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
        
        // Create a default CSV state for migration
        const migrationCsvId = `migrated_${Date.now()}`;
        const defaultState = createDefaultCampaignCSVState(migrationCsvId, 'system');
        
        if (powerAnalysisState) {
          const parsed = JSON.parse(powerAnalysisState);
          defaultState.tabStates.powerAnalysisState = { ...defaultState.tabStates.powerAnalysisState, ...parsed };
          sessionStorage.removeItem(powerAnalysisKey);
        }
        
        this.setCSVState(campaignId, migrationCsvId, defaultState);
        console.log(`Migration completed for campaign ${campaignId}`);
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
  
  private getLastUpdatedTime(data: any): number {
    if (data.tabStates?.lastUpdatedAt) {
      return new Date(data.tabStates.lastUpdatedAt).getTime();
    }
    return 0;
  }
  
  private notifyStateChange(campaignId: string, states: Record<string, CampaignCSVState>): void {
    Object.keys(states).forEach(csvVersionId => {
      const key = this.getCSVStateKey(campaignId, csvVersionId);
      const listeners = this.stateChangeListeners.get(key);
      if (listeners) {
        listeners.forEach(callback => callback(states[csvVersionId]));
      }
    });
  }
}

// Export singleton instance
export const tabStateManager = new TabStateManagerImpl();

// Export utility functions for external use
export const initializeTabStateForCampaign = (campaignId: string, csvVersionId: string, uploadedBy: string): CampaignCSVState => {
  return tabStateManager.initializeCSVState(campaignId, csvVersionId, uploadedBy);
};

export const getTabStateForCampaign = (campaignId: string, csvVersionId: string): TabState | null => {
  return tabStateManager.getTabState(campaignId, csvVersionId);
};

export const updateTabStateForCampaign = (
  campaignId: string, 
  csvVersionId: string, 
  updates: Partial<TabState>, 
  updatedBy: string
): void => {
  const currentState = tabStateManager.getTabState(campaignId, csvVersionId);
  if (currentState) {
    const newState = updateTabState(currentState, updates, updatedBy);
    tabStateManager.setTabState(campaignId, csvVersionId, newState);
  }
};

export const switchActiveTab = (campaignId: string, csvVersionId: string, tabIndex: number, updatedBy: string): void => {
  tabStateManager.setActiveTab(campaignId, csvVersionId, tabIndex, updatedBy);
};

export const updatePowerAnalysisStateForCampaign = (
  campaignId: string, 
  csvVersionId: string, 
  updates: Partial<TabState['powerAnalysisState']>, 
  updatedBy: string
): void => {
  tabStateManager.setPowerAnalysisState(campaignId, csvVersionId, updates, updatedBy);
}; 