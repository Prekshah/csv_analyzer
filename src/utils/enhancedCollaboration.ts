import { 
  CollaborationState, 
  UserPresence, 
  FieldLock, 
  BroadcastMessage,
  CSVFileVersion,
  CampaignCSVState,
  TabState
} from '../types/Campaign';
import { getCurrentUser } from './userUtils';

// Enhanced collaboration manager with CSV and tab-specific support
export class EnhancedCollaborationManager {
  private channel: BroadcastChannel | null = null;
  private campaignId: string | null = null;
  private currentCsvVersionId: string | null = null;
  private currentUser = getCurrentUser();
  private collaborationState: CollaborationState = {
    activeUsers: new Map(),
    fieldLocks: new Map(),
    recentActivity: []
  };
  private listeners: Array<(state: CollaborationState) => void> = [];
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private csvStateListeners: Array<(csvVersionId: string, state: CampaignCSVState) => void> = [];
  private tabStateListeners: Array<(csvVersionId: string, tabIndex: number, state: TabState) => void> = [];

  constructor() {
    // Add current user to active users
    this.addActiveUser({
      userId: this.currentUser.id,
      userName: this.currentUser.name,
      currentField: null,
      lastActivity: Date.now(),
      color: this.getUserColor(this.currentUser.id)
    });
  }

  // Initialize collaboration for a campaign and CSV version
  initializeCampaignAndCSV(campaignId: string, csvVersionId: string) {
    this.cleanup();
    this.campaignId = campaignId;
    this.currentCsvVersionId = csvVersionId;
    
    // Create channel for this campaign
    this.channel = new BroadcastChannel(`enhanced-campaign-${campaignId}`);
    
    // Set up message listener
    this.channel.onmessage = (event: MessageEvent<BroadcastMessage>) => {
      this.handleBroadcastMessage(event.data);
    };

    // Announce user joining with CSV context
    this.sendMessage({
      type: 'USER_JOIN',
      campaignId,
      userId: this.currentUser.id,
      userName: this.currentUser.name,
      timestamp: Date.now(),
      data: {
        csvVersionId: csvVersionId
      }
    });

    // Start heartbeat
    this.startHeartbeat();
  }

  // Switch to a different CSV version
  switchCSVVersion(csvVersionId: string) {
    if (this.currentCsvVersionId === csvVersionId) return;
    
    const previousCsvVersionId = this.currentCsvVersionId;
    this.currentCsvVersionId = csvVersionId;

    // Announce CSV version switch
    if (this.campaignId) {
      this.sendMessage({
        type: 'CSV_VERSION_SWITCH',
        campaignId: this.campaignId,
        userId: this.currentUser.id,
        userName: this.currentUser.name,
        timestamp: Date.now(),
        data: {
          previousCsvVersionId: previousCsvVersionId || undefined,
          newCsvVersionId: csvVersionId
        }
      });
    }

    // Clear field locks from previous CSV version
    this.clearFieldLocks();
  }

  // Notify about tab switch
  switchTab(tabIndex: number) {
    if (this.campaignId && this.currentCsvVersionId) {
      this.sendMessage({
        type: 'TAB_SWITCH',
        campaignId: this.campaignId,
        userId: this.currentUser.id,
        userName: this.currentUser.name,
        timestamp: Date.now(),
        data: {
          csvVersionId: this.currentCsvVersionId,
          tabIndex: tabIndex
        }
      });
    }
  }

  // Update CSV state and notify collaborators
  updateCSVState(csvVersionId: string, state: CampaignCSVState) {
    if (this.campaignId) {
      this.sendMessage({
        type: 'CSV_STATE_UPDATE',
        campaignId: this.campaignId,
        userId: this.currentUser.id,
        userName: this.currentUser.name,
        timestamp: Date.now(),
        data: {
          csvVersionId,
          state: state
        }
      });

      // Notify local listeners
      this.csvStateListeners.forEach(listener => {
        listener(csvVersionId, state);
      });
    }
  }

  // Update tab state and notify collaborators
  updateTabState(csvVersionId: string, tabIndex: number, tabState: TabState) {
    if (this.campaignId) {
      this.sendMessage({
        type: 'TAB_STATE_UPDATE',
        campaignId: this.campaignId,
        userId: this.currentUser.id,
        userName: this.currentUser.name,
        timestamp: Date.now(),
        data: {
          csvVersionId,
          tabIndex,
          tabState: tabState
        }
      });

      // Notify local listeners
      this.tabStateListeners.forEach(listener => {
        listener(csvVersionId, tabIndex, tabState);
      });
    }
  }

  // Update field with CSV and tab context
  updateFieldWithContext(
    fieldName: string, 
    fieldValue: string, 
    csvVersionId: string, 
    tabIndex: number
  ) {
    if (this.campaignId) {
      this.sendMessage({
        type: 'FIELD_UPDATE',
        campaignId: this.campaignId,
        userId: this.currentUser.id,
        userName: this.currentUser.name,
        timestamp: Date.now(),
        data: {
          fieldName,
          fieldValue,
          csvVersionId,
          tabIndex
        }
      });
    }
  }

  // Focus field with context
  focusFieldWithContext(fieldName: string, csvVersionId: string, tabIndex: number) {
    if (this.campaignId) {
      this.sendMessage({
        type: 'FIELD_FOCUS',
        campaignId: this.campaignId,
        userId: this.currentUser.id,
        userName: this.currentUser.name,
        timestamp: Date.now(),
        data: {
          fieldName,
          csvVersionId,
          tabIndex
        }
      });
    }
  }

  // Blur field with context
  blurFieldWithContext(fieldName: string, csvVersionId: string, tabIndex: number) {
    if (this.campaignId) {
      this.sendMessage({
        type: 'FIELD_BLUR',
        campaignId: this.campaignId,
        userId: this.currentUser.id,
        userName: this.currentUser.name,
        timestamp: Date.now(),
        data: {
          fieldName,
          csvVersionId,
          tabIndex
        }
      });
    }
  }

  // Subscribe to CSV state changes
  subscribeToCSVStateChanges(callback: (csvVersionId: string, state: CampaignCSVState) => void): () => void {
    this.csvStateListeners.push(callback);
    return () => {
      const index = this.csvStateListeners.indexOf(callback);
      if (index > -1) {
        this.csvStateListeners.splice(index, 1);
      }
    };
  }

  // Subscribe to tab state changes
  subscribeToTabStateChanges(callback: (csvVersionId: string, tabIndex: number, state: TabState) => void): () => void {
    this.tabStateListeners.push(callback);
    return () => {
      const index = this.tabStateListeners.indexOf(callback);
      if (index > -1) {
        this.tabStateListeners.splice(index, 1);
      }
    };
  }

  // Handle broadcast messages
  private handleBroadcastMessage(message: BroadcastMessage) {
    if (message.campaignId !== this.campaignId) return;
    if (message.userId === this.currentUser.id) return; // Ignore our own messages

    switch (message.type) {
      case 'USER_JOIN':
        this.handleUserJoin(message);
        break;
      case 'USER_LEAVE':
        this.handleUserLeave(message);
        break;
      case 'CSV_VERSION_SWITCH':
        this.handleCSVVersionSwitch(message);
        break;
      case 'TAB_SWITCH':
        this.handleTabSwitch(message);
        break;
      case 'CSV_STATE_UPDATE':
        this.handleCSVStateUpdate(message);
        break;
      case 'TAB_STATE_UPDATE':
        this.handleTabStateUpdate(message);
        break;
      case 'FIELD_UPDATE':
        this.handleFieldUpdate(message);
        break;
      case 'FIELD_FOCUS':
        this.handleFieldFocus(message);
        break;
      case 'FIELD_BLUR':
        this.handleFieldBlur(message);
        break;
    }

    // Add to recent activity
    this.addToRecentActivity(message);
    this.notifyListeners();
  }

  // Handle user join
  private handleUserJoin(message: BroadcastMessage) {
    this.addActiveUser({
      userId: message.userId,
      userName: message.userName,
      currentField: null,
      lastActivity: message.timestamp,
      color: this.getUserColor(message.userId)
    });
  }

  // Handle user leave
  private handleUserLeave(message: BroadcastMessage) {
    this.collaborationState.activeUsers.delete(message.userId);
    // Remove field locks from this user
    const locksToRemove: string[] = [];
    this.collaborationState.fieldLocks.forEach((lock, key) => {
      if (lock.userId === message.userId) {
        locksToRemove.push(key);
      }
    });
    locksToRemove.forEach(key => this.collaborationState.fieldLocks.delete(key));
  }

  // Handle CSV version switch
  private handleCSVVersionSwitch(message: BroadcastMessage) {
    const user = this.collaborationState.activeUsers.get(message.userId);
    if (user) {
      user.lastActivity = message.timestamp;
      user.currentField = null; // Clear current field when switching CSV
    }
  }

  // Handle tab switch
  private handleTabSwitch(message: BroadcastMessage) {
    const user = this.collaborationState.activeUsers.get(message.userId);
    if (user) {
      user.lastActivity = message.timestamp;
      user.currentField = null; // Clear current field when switching tabs
    }
  }

  // Handle CSV state update
  private handleCSVStateUpdate(message: BroadcastMessage) {
    if (message.data?.csvVersionId && message.data?.state) {
      this.csvStateListeners.forEach(listener => {
        listener(message.data!.csvVersionId!, message.data!.state);
      });
    }
  }

  // Handle tab state update
  private handleTabStateUpdate(message: BroadcastMessage) {
    if (message.data?.csvVersionId && message.data?.tabIndex !== undefined && message.data?.tabState) {
      this.tabStateListeners.forEach(listener => {
        listener(message.data!.csvVersionId!, message.data!.tabIndex!, message.data!.tabState);
      });
    }
  }

  // Handle field update
  private handleFieldUpdate(message: BroadcastMessage) {
    // Only process if it's for the current CSV version and tab
    if (message.data?.csvVersionId === this.currentCsvVersionId) {
      const user = this.collaborationState.activeUsers.get(message.userId);
      if (user) {
        user.currentField = message.data.fieldName || null;
        user.lastActivity = message.timestamp;
      }
    }
  }

  // Handle field focus
  private handleFieldFocus(message: BroadcastMessage) {
    if (message.data?.csvVersionId === this.currentCsvVersionId && message.data?.fieldName) {
      const fieldKey = this.getFieldKey(message.data.fieldName, message.data.csvVersionId!, message.data.tabIndex);
      
      // Create field lock
      this.collaborationState.fieldLocks.set(fieldKey, {
        fieldName: message.data.fieldName,
        userId: message.userId,
        userName: message.userName,
        timestamp: message.timestamp,
        isActive: true
      });

      // Update user's current field
      const user = this.collaborationState.activeUsers.get(message.userId);
      if (user) {
        user.currentField = message.data.fieldName;
        user.lastActivity = message.timestamp;
      }
    }
  }

  // Handle field blur
  private handleFieldBlur(message: BroadcastMessage) {
    if (message.data?.csvVersionId === this.currentCsvVersionId && message.data?.fieldName) {
      const fieldKey = this.getFieldKey(message.data.fieldName, message.data.csvVersionId!, message.data.tabIndex);
      
      // Remove field lock
      this.collaborationState.fieldLocks.delete(fieldKey);

      // Clear user's current field
      const user = this.collaborationState.activeUsers.get(message.userId);
      if (user && user.currentField === message.data.fieldName) {
        user.currentField = null;
        user.lastActivity = message.timestamp;
      }
    }
  }

  // Generate field key with CSV and tab context
  private getFieldKey(fieldName: string, csvVersionId: string, tabIndex?: number): string {
    return `${fieldName}_${csvVersionId}_${tabIndex || 0}`;
  }

  // Check if field is locked (with context)
  isFieldLockedWithContext(fieldName: string, csvVersionId: string, tabIndex: number): FieldLock | null {
    const fieldKey = this.getFieldKey(fieldName, csvVersionId, tabIndex);
    return this.collaborationState.fieldLocks.get(fieldKey) || null;
  }

  // Get users active on specific CSV version
  getUsersOnCSVVersion(csvVersionId: string): UserPresence[] {
    // For now, return all active users
    // In a more sophisticated implementation, we could track per-CSV presence
    return Array.from(this.collaborationState.activeUsers.values());
  }

  // Get users active on specific tab
  getUsersOnTab(csvVersionId: string, tabIndex: number): UserPresence[] {
    // For now, return all active users
    // In a more sophisticated implementation, we could track per-tab presence
    return Array.from(this.collaborationState.activeUsers.values());
  }

  // Clear field locks
  private clearFieldLocks() {
    this.collaborationState.fieldLocks.clear();
  }

  // Utility methods from base collaboration manager
  private addActiveUser(user: UserPresence) {
    this.collaborationState.activeUsers.set(user.userId, user);
  }

  private getUserColor(userId: string): string {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
    const hash = userId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return colors[Math.abs(hash) % colors.length];
  }

  private sendMessage(message: BroadcastMessage) {
    if (this.channel) {
      this.channel.postMessage(message);
    }
  }

  private addToRecentActivity(message: BroadcastMessage) {
    this.collaborationState.recentActivity.unshift(message);
    // Keep only last 50 activities
    if (this.collaborationState.recentActivity.length > 50) {
      this.collaborationState.recentActivity = this.collaborationState.recentActivity.slice(0, 50);
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.collaborationState));
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.campaignId) {
        this.sendMessage({
          type: 'USER_HEARTBEAT',
          campaignId: this.campaignId,
          userId: this.currentUser.id,
          userName: this.currentUser.name,
          timestamp: Date.now(),
          data: {
            csvVersionId: this.currentCsvVersionId || undefined
          }
        });
      }
    }, 30000); // Every 30 seconds
  }

  // Subscribe to collaboration state changes
  subscribe(callback: (state: CollaborationState) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Get current collaboration state
  getState(): CollaborationState {
    return this.collaborationState;
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser;
  }

  // Cleanup
  cleanup() {
    if (this.channel) {
      this.sendMessage({
        type: 'USER_LEAVE',
        campaignId: this.campaignId!,
        userId: this.currentUser.id,
        userName: this.currentUser.name,
        timestamp: Date.now()
      });
      this.channel.close();
      this.channel = null;
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    this.campaignId = null;
    this.currentCsvVersionId = null;
    this.collaborationState = {
      activeUsers: new Map(),
      fieldLocks: new Map(),
      recentActivity: []
    };
    this.listeners = [];
    this.csvStateListeners = [];
    this.tabStateListeners = [];
  }
}

// Export singleton instance
export const enhancedCollaborationManager = new EnhancedCollaborationManager();

// Export utility functions
export const initializeEnhancedCollaboration = (campaignId: string, csvVersionId: string) => {
  enhancedCollaborationManager.initializeCampaignAndCSV(campaignId, csvVersionId);
};

export const switchCollaborationCSVVersion = (csvVersionId: string) => {
  enhancedCollaborationManager.switchCSVVersion(csvVersionId);
};

export const switchCollaborationTab = (tabIndex: number) => {
  enhancedCollaborationManager.switchTab(tabIndex);
};

export const updateCollaborationCSVState = (csvVersionId: string, state: CampaignCSVState) => {
  enhancedCollaborationManager.updateCSVState(csvVersionId, state);
};

export const updateCollaborationTabState = (csvVersionId: string, tabIndex: number, tabState: TabState) => {
  enhancedCollaborationManager.updateTabState(csvVersionId, tabIndex, tabState);
}; 