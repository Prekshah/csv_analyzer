import { BroadcastMessage, UserPresence, FieldLock, CollaborationState } from '../types/Campaign';
import { getCurrentUser } from './userUtils';

// User colors for visual distinction
const USER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
];

// Get a consistent color for a user
export const getUserColor = (userId: string): string => {
  // Use hash of userId to get consistent color
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
};

// Broadcast channel manager
export class CollaborationManager {
  private channel: BroadcastChannel | null = null;
  private campaignId: string | null = null;
  private currentUser = getCurrentUser();
  private collaborationState: CollaborationState = {
    activeUsers: new Map(),
    fieldLocks: new Map(),
    recentActivity: []
  };
  private listeners: Array<(state: CollaborationState) => void> = [];
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Add current user to active users
    this.addActiveUser({
      userId: this.currentUser.id,
      userName: this.currentUser.name,
      currentField: null,
      lastActivity: Date.now(),
      color: getUserColor(this.currentUser.id)
    });
  }

  // Initialize collaboration for a campaign
  initializeCampaign(campaignId: string) {
    this.cleanup();
    this.campaignId = campaignId;
    this.channel = new BroadcastChannel(`hypothesis-campaign-${campaignId}`);
    
    // Set up message listener
    this.channel.onmessage = (event: MessageEvent<BroadcastMessage>) => {
      this.handleBroadcastMessage(event.data);
    };

    // Announce user joining
    this.sendMessage({
      type: 'USER_JOIN',
      campaignId,
      userId: this.currentUser.id,
      userName: this.currentUser.name,
      timestamp: Date.now()
    });

    // Start heartbeat to maintain presence
    this.startHeartbeat();
  }

  // Clean up resources
  cleanup() {
    if (this.channel) {
      // Announce user leaving
      if (this.campaignId) {
            this.sendMessage({
      type: 'USER_LEAVE',
      campaignId: this.campaignId,
      userId: this.currentUser.id,
      userName: this.currentUser.name,
      timestamp: Date.now()
    });
      }
      this.channel.close();
      this.channel = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.campaignId = null;
    this.collaborationState.activeUsers.clear();
    this.collaborationState.fieldLocks.clear();
    this.collaborationState.recentActivity = [];
  }

  // Add listener for collaboration state changes
  addListener(listener: (state: CollaborationState) => void) {
    this.listeners.push(listener);
  }

  // Remove listener
  removeListener(listener: (state: CollaborationState) => void) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  // Notify all listeners of state changes
  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.collaborationState));
  }

  // Handle incoming broadcast messages
  private handleBroadcastMessage(message: BroadcastMessage) {
    // Ignore messages from self
    if (message.userId === this.currentUser.id) return;

    switch (message.type) {
      case 'FIELD_UPDATE':
        this.handleFieldUpdate(message);
        break;
      case 'FIELD_FOCUS':
        this.handleFieldFocus(message);
        break;
      case 'FIELD_BLUR':
        this.handleFieldBlur(message);
        break;
      case 'USER_JOIN':
        this.handleUserJoin(message);
        break;
      case 'USER_LEAVE':
        this.handleUserLeave(message);
        break;
      case 'CONFLICT_DETECTED':
        this.handleConflictDetected(message);
        break;
      case 'OVERRIDE_ATTEMPT':
        this.handleOverrideAttempt(message);
        break;
    }

    // Add to recent activity
    this.collaborationState.recentActivity.unshift(message);
    if (this.collaborationState.recentActivity.length > 50) {
      this.collaborationState.recentActivity = this.collaborationState.recentActivity.slice(0, 50);
    }

    this.notifyListeners();
  }

  // Handle field updates from other users
  private handleFieldUpdate(message: BroadcastMessage) {
    if (message.data?.fieldName && message.data?.fieldValue !== undefined) {
      // Add to recent activity for UI updates
      this.collaborationState.recentActivity.unshift(message);
      
      // Keep only last 50 activities
      if (this.collaborationState.recentActivity.length > 50) {
        this.collaborationState.recentActivity = this.collaborationState.recentActivity.slice(0, 50);
      }
      
      // Update field lock
      this.updateFieldLock(message.data.fieldName, message.userId, message.userName);
      
      // Update user presence
      this.updateUserPresence(message.userId, message.userName, message.data.fieldName);
      
      this.notifyListeners();
    }
  }

  // Handle field focus events
  private handleFieldFocus(message: BroadcastMessage) {
    if (message.data?.fieldName) {
      this.updateFieldLock(message.data.fieldName, message.userId, message.userName);
      this.updateUserPresence(message.userId, message.userName, message.data.fieldName);
    }
  }

  // Handle field blur events
  private handleFieldBlur(message: BroadcastMessage) {
    if (message.data?.fieldName) {
      this.removeFieldLock(message.data.fieldName, message.userId);
      this.updateUserPresence(message.userId, message.userName, null);
    }
  }

  // Handle user joining
  private handleUserJoin(message: BroadcastMessage) {
    this.addActiveUser({
      userId: message.userId,
      userName: message.userName,
      currentField: null,
      lastActivity: message.timestamp,
      color: getUserColor(message.userId)
    });
  }

  // Handle user leaving
  private handleUserLeave(message: BroadcastMessage) {
    this.removeActiveUser(message.userId);
  }

  // Handle conflict detection
  private handleConflictDetected(message: BroadcastMessage) {
    // This will be handled by the main component
  }

  // Handle override attempt
  private handleOverrideAttempt(message: BroadcastMessage) {
    if (message.data?.fieldName && message.data?.originalUser) {
      // Add to recent activity for UI notifications
      this.collaborationState.recentActivity.unshift({
        type: 'OVERRIDE_ATTEMPT',
        campaignId: message.campaignId,
        userId: message.userId,
        userName: message.userName,
        timestamp: message.timestamp,
        data: message.data
      });

      // Keep only last 50 activities
      if (this.collaborationState.recentActivity.length > 50) {
        this.collaborationState.recentActivity = this.collaborationState.recentActivity.slice(0, 50);
      }

      this.notifyListeners();
    }
  }

  // Public methods for the component to use
  
  // Broadcast field update
  broadcastFieldUpdate(fieldName: string, fieldValue: string, previousValue?: string) {
    if (!this.campaignId) {
      return;
    }

    this.sendMessage({
      type: 'FIELD_UPDATE',
      campaignId: this.campaignId,
      userId: this.currentUser.id,
      userName: this.currentUser.name,
      timestamp: Date.now(),
      data: {
        fieldName,
        fieldValue,
        previousValue
      }
    });

    this.notifyListeners();
  }

  // Broadcast field focus
  broadcastFieldFocus(fieldName: string) {
    if (!this.campaignId) return;

    this.sendMessage({
      type: 'FIELD_FOCUS',
      campaignId: this.campaignId,
      userId: this.currentUser.id,
      userName: this.currentUser.name,
      timestamp: Date.now(),
      data: { fieldName }
    });

    // Update local state
    this.updateFieldLock(fieldName, this.currentUser.id, this.currentUser.name);
    this.updateUserPresence(this.currentUser.id, this.currentUser.name, fieldName);
    this.notifyListeners();
  }

  // Broadcast field blur
  broadcastFieldBlur(fieldName: string) {
    if (!this.campaignId) return;

    this.sendMessage({
      type: 'FIELD_BLUR',
      campaignId: this.campaignId,
      userId: this.currentUser.id,
      userName: this.currentUser.name,
      timestamp: Date.now(),
      data: { fieldName }
    });

    // Update local state
    this.removeFieldLock(fieldName, this.currentUser.id);
    this.updateUserPresence(this.currentUser.id, this.currentUser.name, null);
    this.notifyListeners();
  }

  // Get current collaboration state
  getCollaborationState(): CollaborationState {
    return this.collaborationState;
  }

  // Check if field is locked by another user
  isFieldLocked(fieldName: string): FieldLock | null {
    const lock = this.collaborationState.fieldLocks.get(fieldName);
    if (lock && lock.userId !== this.currentUser.id && lock.isActive) {
      // Check if lock is still valid (within 30 seconds)
      if (Date.now() - lock.timestamp < 30000) {
        return lock;
      } else {
        // Remove expired lock
        this.collaborationState.fieldLocks.delete(fieldName);
        this.notifyListeners();
      }
    }
    return null;
  }

  // Get users currently editing
  getActiveUsers(): UserPresence[] {
    return Array.from(this.collaborationState.activeUsers.values())
      .filter(user => user.userId !== this.currentUser.id);
  }

  // Get current user
  getCurrentUser(): { id: string; name: string } {
    return this.currentUser;
  }

  // Get current campaign ID
  getCurrentCampaignId(): string | null {
    return this.campaignId;
  }

  // Public method to broadcast custom messages
  broadcastMessage(message: BroadcastMessage) {
    if (this.channel) {
      this.channel.postMessage(message);
    }
  }

  // Private helper methods

  private sendMessage(message: BroadcastMessage) {
    if (this.channel) {
      this.channel.postMessage(message);
    }
  }

  private updateFieldLock(fieldName: string, userId: string, userName: string) {
    this.collaborationState.fieldLocks.set(fieldName, {
      fieldName,
      userId,
      userName,
      timestamp: Date.now(),
      isActive: true
    });
  }

  private removeFieldLock(fieldName: string, userId: string) {
    const lock = this.collaborationState.fieldLocks.get(fieldName);
    if (lock && lock.userId === userId) {
      this.collaborationState.fieldLocks.delete(fieldName);
    }
  }

  private updateUserPresence(userId: string, userName: string, currentField: string | null) {
    this.collaborationState.activeUsers.set(userId, {
      userId,
      userName,
      currentField,
      lastActivity: Date.now(),
      color: getUserColor(userId)
    });
  }

  private addActiveUser(presence: UserPresence) {
    this.collaborationState.activeUsers.set(presence.userId, presence);
  }

  private removeActiveUser(userId: string) {
    this.collaborationState.activeUsers.delete(userId);
    
    // Remove all locks by this user
    Array.from(this.collaborationState.fieldLocks.entries()).forEach(([fieldName, lock]) => {
      if (lock.userId === userId) {
        this.collaborationState.fieldLocks.delete(fieldName);
      }
    });
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      // Clean up inactive users (haven't been seen in 2 minutes)
      const now = Date.now();
      Array.from(this.collaborationState.activeUsers.entries()).forEach(([userId, presence]) => {
        if (now - presence.lastActivity > 120000 && userId !== this.currentUser.id) {
          this.removeActiveUser(userId);
        }
      });

      // Clean up expired field locks
      Array.from(this.collaborationState.fieldLocks.entries()).forEach(([fieldName, lock]) => {
        if (now - lock.timestamp > 30000) {
          this.collaborationState.fieldLocks.delete(fieldName);
        }
      });

      this.notifyListeners();
    }, 10000); // Check every 10 seconds
  }
}

// Global collaboration manager instance
export const collaborationManager = new CollaborationManager(); 