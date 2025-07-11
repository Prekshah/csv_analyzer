import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  EnhancedProposalData
} from '../types/Campaign';
import { 
  subscribeToEnhancedProposalData,
  updateProposalField,
  restoreFieldFromHistory,
  initializeEnhancedProposal
} from '../utils/firestoreProposalService';

interface UseProposalSyncOptions {
  debounceMs?: number;
  softBlockThresholdMs?: number;
}

interface FieldState {
  isEditing: boolean;
  pendingValue: string;
  lastLocalUpdate: Date | null;
  lastServerValue: string;
  isDirty: boolean; // Track if field has unsaved changes
}

interface SoftBlockWarning {
  fieldName: keyof EnhancedProposalData;
  lastUpdatedBy: string;
  lastUpdatedAt: Date;
  timeSinceUpdate: number;
}

// Helper function to initialize field state
const initializeFieldState = (serverValue: string = ''): FieldState => ({
  isEditing: false,
  pendingValue: '',
  lastLocalUpdate: null,
  lastServerValue: serverValue,
  isDirty: false
});

// Helper function to get user-friendly field names
const getFieldDisplayName = (fieldName: keyof EnhancedProposalData): string => {
  const fieldNameMap: Record<keyof EnhancedProposalData, string> = {
    title: 'Title',
    architects: 'Architects',
    date: 'Date',
    businessProblem: 'Business Problem',
    whyThisMatters: 'Why This Matters',
    quantifyImpact: 'Quantify Impact',
    potentialBenefit: 'Potential Benefit',
    previousWork: 'Previous Work',
    researchQuestion: 'Research Question',
    nullHypothesis: 'Null Hypothesis',
    alternativeHypothesis: 'Alternative Hypothesis',
    studyType: 'Study Type',
    targetPopulation: 'Target Population',
    samplingStrategy: 'Sampling Strategy',
    eda: 'EDA',
    mde: 'MDE',
    power: 'Power',
    significanceLevel: 'Significance Level',
    standardDeviation: 'Standard Deviation',
    sampleSize: 'Sample Size',
    usersPerDay: 'Users Per Day',
    expectedDays: 'Expected Days',
    primaryMetrics: 'Primary Metrics',
    secondaryMetrics: 'Secondary Metrics',
    guardrailMetrics: 'Guardrail Metrics',
    potentialRisks: 'Potential Risks',
    sanityChecks: 'Sanity Checks',
    statisticalTests: 'Statistical Tests',
    segments: 'Segments',
    fwerCorrection: 'FWER Correction',
    comments: 'Comments'
  };
  
  return fieldNameMap[fieldName] || fieldName;
};

export const useProposalSync = (
  campaignId: string | null,
  options: UseProposalSyncOptions = {}
) => {
  const { 
    debounceMs = 1000, 
    softBlockThresholdMs = 5 * 60 * 1000 // 5 minutes
  } = options;
  
  const { user } = useAuth();
  const [proposalData, setProposalData] = useState<EnhancedProposalData | null>(null);
  const [fieldStates, setFieldStates] = useState<Record<string, FieldState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Debounce timers for field updates
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});
  
  // Initialize proposal data
  useEffect(() => {
    if (!campaignId || !user) {
      setLoading(false);
      return;
    }
    
    const initializeData = async () => {
      try {
        setLoading(true);
        await initializeEnhancedProposal(campaignId, {
          uid: user.uid,
          displayName: user.displayName || 'Unknown User'
        });
        console.log('[useProposalSync] Successfully initialized proposal');
      } catch (error) {
        console.error('[useProposalSync] Error initializing proposal:', error);
        // Don't set error for initialization issues - they're often temporary
        console.log('[useProposalSync] Will retry initialization on next data update');
      } finally {
        setLoading(false);
      }
    };
    
    initializeData();
  }, [campaignId, user]);
  
  // Subscribe to real-time updates
  useEffect(() => {
    if (!campaignId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    const unsubscribe = subscribeToEnhancedProposalData(campaignId, (data) => {
      setProposalData(data);
      setLoading(false);
      
      if (!data) {
        // Don't set error for missing data - it's normal during initialization
        console.log('[useProposalSync] No proposal data found, will initialize');
        // Try to initialize if data is null
        if (user) {
          initializeEnhancedProposal(campaignId, {
            uid: user.uid,
            displayName: user.displayName || 'Unknown User'
          }).catch(error => {
            console.error('[useProposalSync] Error initializing proposal:', error);
          });
        }
      } else {
        // Update field states with new server values, but preserve editing states
        setFieldStates(prev => {
          const updated = { ...prev };
          
          Object.keys(data).forEach(key => {
            const fieldKey = key as keyof EnhancedProposalData;
            const serverValue = data[fieldKey]?.value || '';
            const currentFieldState = updated[fieldKey];
            
            // Initialize field state if it doesn't exist
            if (!currentFieldState) {
              updated[fieldKey] = initializeFieldState(serverValue);
              return;
            }
            
            // If the field is dirty (has unsaved changes), preserve the pending value
            if (currentFieldState.isDirty) {
              updated[fieldKey] = {
                ...currentFieldState,
                lastServerValue: serverValue
              };
              return;
            }
            
            // If the field is not dirty, update with server value
            updated[fieldKey] = {
              ...currentFieldState,
              lastServerValue: serverValue,
              pendingValue: serverValue,
              isEditing: false,
              isDirty: false
            };
          });
          
          return updated;
        });
      }
    });
    
    return unsubscribe;
  }, [campaignId, user]);
  
  // Get current user info
  const getCurrentUser = useCallback(() => {
    if (!user) {
      throw new Error('User not authenticated');
    }
    return {
      uid: user.uid,
      displayName: user.displayName || 'Unknown User'
    };
  }, [user]);
  
  // Check for soft block warnings
  const getSoftBlockWarning = useCallback((
    fieldName: keyof EnhancedProposalData
  ): SoftBlockWarning | null => {
    if (!proposalData || !user) return null;
    
    const field = proposalData[fieldName];
    if (!field) return null;
    
    const now = new Date();
    const lastUpdatedAt = field.lastUpdatedAt instanceof Date 
      ? field.lastUpdatedAt 
      : (typeof field.lastUpdatedAt === 'string' || typeof field.lastUpdatedAt === 'number') 
        ? new Date(field.lastUpdatedAt)
        : new Date();
    
    const timeSinceUpdate = now.getTime() - lastUpdatedAt.getTime();
    
    // Show warning if someone else updated within threshold
    if (field.lastUpdatedBy.uid !== user.uid && timeSinceUpdate < softBlockThresholdMs) {
      return {
        fieldName,
        lastUpdatedBy: field.lastUpdatedBy.displayName,
        lastUpdatedAt,
        timeSinceUpdate
      };
    }
    
    return null;
  }, [proposalData, user, softBlockThresholdMs]);
  
  // Update field with debouncing
  const updateField = useCallback(async (
    fieldName: keyof EnhancedProposalData,
    value: string,
    immediate: boolean = false
  ) => {
    if (!campaignId || !user) return;
    
    const currentUser = getCurrentUser();
    
    // Update local state immediately for responsive UI
    setFieldStates(prev => {
      const currentFieldState = prev[fieldName] || initializeFieldState();
      const serverValue = proposalData?.[fieldName]?.value || '';
      
      return {
        ...prev,
        [fieldName]: {
          isEditing: true,
          pendingValue: value,
          lastLocalUpdate: new Date(),
          lastServerValue: currentFieldState.lastServerValue || serverValue,
          isDirty: true // Mark field as dirty when user makes changes
        }
      };
    });
    
    // Clear existing debounce timer for this field
    if (debounceTimers.current[fieldName]) {
      clearTimeout(debounceTimers.current[fieldName]);
    }
    
    const updateFunction = async () => {
      try {
        await updateProposalField(campaignId, fieldName, value, currentUser);
        
        // Update field state after successful save
        setFieldStates(prev => ({
          ...prev,
          [fieldName]: {
            ...prev[fieldName],
            isEditing: false,
            isDirty: false, // Clear dirty flag after successful save
            lastLocalUpdate: new Date()
          }
        }));
        
        setError(null);
        
      } catch (error) {
        console.error(`[useProposalSync] Error updating field ${fieldName}:`, error);
        
        const fieldDisplayName = getFieldDisplayName(fieldName);
        let errorMessage = `Unable to save changes to ${fieldDisplayName}. Please try again.`;
        
        if (error instanceof Error) {
          const errorMsg = error.message.toLowerCase();
          
          if (errorMsg.includes('permission') || errorMsg.includes('denied') || errorMsg.includes('insufficient')) {
            errorMessage = `You don't have permission to update ${fieldDisplayName}. Please check your access rights.`;
          } else if (errorMsg.includes('network') || errorMsg.includes('unavailable')) {
            errorMessage = `Network error while updating ${fieldDisplayName}. Please check your connection.`;
          } else if (errorMsg.includes('not found') || errorMsg.includes('does not exist')) {
            errorMessage = `Campaign not found. Please refresh the page and try again.`;
          } else if (errorMsg.includes('auth') || errorMsg.includes('unauthenticated')) {
            errorMessage = `Authentication error. Please log in again.`;
          }
          
          console.error(`[useProposalSync] Full error details:`, {
            message: error.message,
            code: (error as any).code,
            stack: error.stack
          });
        }
        
        setError(errorMessage);
        
        // Keep field marked as dirty on error
        setFieldStates(prev => ({
          ...prev,
          [fieldName]: {
            ...prev[fieldName],
            isEditing: false,
            isDirty: true // Keep dirty flag on error
          }
        }));
      }
    };
    
    if (immediate) {
      await updateFunction();
    } else {
      debounceTimers.current[fieldName] = setTimeout(updateFunction, debounceMs);
    }
  }, [campaignId, user, getCurrentUser, debounceMs, proposalData]);
  
  // Get field value (pending or current)
  const getFieldValue = useCallback((fieldName: keyof EnhancedProposalData): string => {
    const fieldState = fieldStates[fieldName];
    const serverValue = proposalData?.[fieldName]?.value || '';
    
    // If field is dirty or being edited, return pending value
    if (fieldState?.isDirty || fieldState?.isEditing) {
      return fieldState.pendingValue;
    }
    
    // Otherwise use the server value
    return serverValue;
  }, [proposalData, fieldStates]);
  
  // Check if field is currently being edited
  const isFieldEditing = useCallback((fieldName: keyof EnhancedProposalData): boolean => {
    return fieldStates[fieldName]?.isEditing || false;
  }, [fieldStates]);
  
  // Get field metadata
  const getFieldMetadata = useCallback((fieldName: keyof EnhancedProposalData) => {
    const field = proposalData?.[fieldName];
    if (!field) return null;
    
    // Check if field has been actually touched by a user
    const hasHistory = (field.history || []).length > 0;
    
    // Check if field has a non-default value
    const isDefaultValue = (fieldName: keyof EnhancedProposalData, value: string): boolean => {
      const defaultValues: Record<keyof EnhancedProposalData, string> = {
        title: '',
        architects: '',
        date: '', // We'll handle date separately since it's dynamic
        businessProblem: '',
        whyThisMatters: '',
        quantifyImpact: '',
        potentialBenefit: '',
        previousWork: '',
        researchQuestion: '',
        nullHypothesis: '',
        alternativeHypothesis: '',
        studyType: '',
        targetPopulation: '',
        samplingStrategy: '',
        eda: '',
        mde: '5',
        power: '0.8',
        significanceLevel: '0.05',
        standardDeviation: '',
        sampleSize: '',
        usersPerDay: '',
        expectedDays: '',
        primaryMetrics: '',
        secondaryMetrics: '',
        guardrailMetrics: '',
        potentialRisks: '',
        sanityChecks: '',
        statisticalTests: '',
        segments: '',
        fwerCorrection: 'Bonferroni Correction',
        comments: ''
      };
      
      // Special handling for date field - consider it default if it's today's date or empty
      if (fieldName === 'date') {
        const today = new Date().toISOString().split('T')[0];
        return value === '' || value === today;
      }
      
      return value === defaultValues[fieldName];
    };
    
    const hasNonDefaultValue = !isDefaultValue(fieldName, field.value);
    
    // Only show metadata if field has been actually touched
    if (!hasHistory && !hasNonDefaultValue) {
      return null;
    }
    
    return {
      lastUpdatedAt: field.lastUpdatedAt instanceof Date 
        ? field.lastUpdatedAt 
        : (typeof field.lastUpdatedAt === 'string' || typeof field.lastUpdatedAt === 'number') 
          ? new Date(field.lastUpdatedAt)
          : new Date(),
      lastUpdatedBy: field.lastUpdatedBy,
      history: field.history || [],
      hasHistory: hasHistory
    };
  }, [proposalData]);
  
  // Restore field from history
  const restoreField = useCallback(async (
    fieldName: keyof EnhancedProposalData,
    historyIndex: number
  ) => {
    if (!campaignId || !user) return;
    
    try {
      const currentUser = getCurrentUser();
      await restoreFieldFromHistory(campaignId, fieldName, historyIndex, currentUser);
      setError(null);
    } catch (error) {
      console.error(`[useProposalSync] Error restoring field ${fieldName}:`, error);
      const fieldDisplayName = getFieldDisplayName(fieldName);
      setError(`Unable to restore ${fieldDisplayName} from history. Please try again.`);
    }
  }, [campaignId, user, getCurrentUser]);
  
  // Cleanup debounce timers on unmount
  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);
  
  return {
    proposalData,
    loading,
    error,
    updateField,
    restoreField,
    getFieldValue,
    isFieldEditing,
    getFieldMetadata,
    getSoftBlockWarning,
    clearError: () => setError(null)
  };
}; 