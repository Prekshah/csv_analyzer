import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  TextField,
  Typography,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Grid,
  SelectChangeEvent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Alert,
  Chip,
  Divider,
  Card,
  CardContent,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import SyncIcon from '@mui/icons-material/Sync';
import ErrorIcon from '@mui/icons-material/Error';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import PeopleIcon from '@mui/icons-material/People';
import Tooltip from '@mui/material/Tooltip';
import Badge from '@mui/material/Badge';
import { styled } from '@mui/material/styles';
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import { Campaign, ConflictData, SaveStatus, ProposalData, CollaborationState, UserPresence, EnhancedProposalData } from '../types/Campaign';
import { 
  createCampaign, 
  saveCampaignData, 
  loadCampaignData, 
  getAllCampaigns, 
  getDefaultProposalData,
} from '../utils/storage';
import { formatRelativeTime } from '../utils/userUtils';
import { collaborationManager } from '../utils/collaboration';
import { EnhancedProposalField } from './EnhancedProposalField';
import {
  subscribeToProposalData
} from '../utils/firestoreProposalService';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToPowerAnalysisData } from '../utils/firestoreCampaignService';
import { useProposalSync } from '../hooks/useProposalSync';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  margin: theme.spacing(2),
  backgroundColor: '#fff',
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 'bold',
  marginBottom: theme.spacing(2),
  marginTop: theme.spacing(2),
}));

// Add a debug component near the top after the StyledPaper and SectionTitle definitions
const DebugInfo = styled(Box)(({ theme }) => ({
  position: 'fixed',
  top: 10,
  right: 10,
  backgroundColor: '#f5f5f5',
  padding: theme.spacing(1),
  borderRadius: theme.spacing(1),
  fontSize: '12px',
  maxWidth: '300px',
  maxHeight: '200px',
  overflow: 'auto',
  zIndex: 1000,
  border: '1px solid #ccc'
}));

// ProposalData interface is now imported from types/Campaign.ts

interface HypothesisTestingProposalProps {
  campaignId?: string;
  calculatedSampleSize: string;
  calculatedVariance: string;
  powerAnalysisValues: {
    mde: string;
    mdeType: 'absolute' | 'percentage';
    power: string;
    significanceLevel: string;
    selectedMetric: string;
    variance: string;
  } | null;
}

const HypothesisTestingProposal: React.FC<HypothesisTestingProposalProps> = ({ 
  campaignId,
  calculatedSampleSize,
  calculatedVariance,
  powerAnalysisValues
}) => {
  // Campaign state
  const [currentCampaign, setCurrentCampaign] = useState<Campaign | null>(null);
  const [availableCampaigns, setAvailableCampaigns] = useState<Campaign[]>([]);
  const [proposalData, setProposalData] = useState<ProposalData>(getDefaultProposalData());
  
  // UI state
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [openDialog, setOpenDialog] = useState(false);
  const [emptyFields, setEmptyFields] = useState<string[]>([]);
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignDescription, setNewCampaignDescription] = useState('');
  const [conflictData, setConflictData] = useState<ConflictData | null>(null);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  
  // Collaboration state
  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);
  const [overrideNotifications, setOverrideNotifications] = useState<string[]>([]);

  // Auth context
  const { user } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Enhanced proposal sync hook
  const {
    proposalData: enhancedProposalData,
    loading: proposalLoading,
    error: proposalError,
    updateField,
    restoreField,
    getFieldValue,
    isFieldEditing,
    getFieldMetadata,
    getSoftBlockWarning,
    clearError
  } = useProposalSync(campaignId || null, {
    debounceMs: 1000,
    softBlockThresholdMs: 5 * 60 * 1000 // 5 minutes
  });

  // In the main component function, right before the renderEnhancedField helper function
  // Debug info component
  const renderDebugInfo = () => {
    if (!user || !campaignId) return null;
    
    return (
      <DebugInfo>
        <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block' }}>
          Debug Info:
        </Typography>
        <Typography variant="caption" sx={{ display: 'block' }}>
          User ID: {user.uid}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block' }}>
          Campaign ID: {campaignId}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block' }}>
          User Email: {user.email}
        </Typography>
        {currentCampaign && (
          <>
            <Typography variant="caption" sx={{ display: 'block', mt: 1, fontWeight: 'bold' }}>
              Campaign Info:
            </Typography>
            <Typography variant="caption" sx={{ display: 'block' }}>
              Name: {currentCampaign.name}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block' }}>
              Created By: {currentCampaign.createdBy}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block' }}>
              Collaborator IDs: {JSON.stringify(currentCampaign.collaboratorIds)}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block' }}>
              Is User in collaboratorIds: {currentCampaign.collaboratorIds?.includes(user.uid) ? 'YES' : 'NO'}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block' }}>
              User Role: {currentCampaign.collaborators?.[user.uid]?.role || 'NONE'}
            </Typography>
            {proposalError && (
              <Typography variant="caption" sx={{ display: 'block', color: 'red', mt: 1 }}>
                Error: {proposalError}
              </Typography>
            )}
            {currentCampaign && !currentCampaign.collaboratorIds?.includes(user.uid) && (
              <Button 
                size="small" 
                variant="contained" 
                sx={{ mt: 1, fontSize: '10px' }}
                onClick={async () => {
                  try {
                    const { updateCampaign } = await import('../utils/firestoreCampaignService');
                    const newCollaboratorIds = Object.keys(currentCampaign.collaborators || {});
                    if (!newCollaboratorIds.includes(user.uid)) {
                      newCollaboratorIds.push(user.uid);
                    }
                    await updateCampaign(currentCampaign.id, {
                      collaboratorIds: newCollaboratorIds
                    }, user.uid);
                    alert('Campaign permissions fixed! Please refresh the page.');
                  } catch (error) {
                    console.error('Failed to fix permissions:', error);
                    alert('Failed to fix permissions: ' + (error instanceof Error ? error.message : 'Unknown error'));
                  }
                }}
              >
                Fix Permissions
              </Button>
            )}
          </>
        )}
      </DebugInfo>
    );
  };

  // Helper function to render enhanced fields
  const renderEnhancedField = (
    fieldName: keyof EnhancedProposalData,
    label: string,
    options: {
      type?: 'input' | 'textarea' | 'select';
      placeholder?: string;
      rows?: number;
      selectOptions?: string[];
      disabled?: boolean;
      helperText?: string;
      InputLabelProps?: any;
      onChange?: (value: string) => void;
    } = {}
  ) => {
    const { 
      type = 'input', 
      placeholder, 
      rows = 3, 
      selectOptions = [], 
      disabled = false,
      helperText,
      InputLabelProps,
      onChange: customOnChange
    } = options;
    
    const handleChange = (value: string) => {
      updateField(fieldName, value);
      if (customOnChange) {
        customOnChange(value);
      }
    };
    
    return (
      <EnhancedProposalField
        fieldName={fieldName}
        label={label}
        value={getFieldValue(fieldName)}
        placeholder={placeholder}
        type={type}
        options={selectOptions}
        rows={rows}
        isEditing={isFieldEditing(fieldName)}
        metadata={getFieldMetadata(fieldName)}
        softBlockWarning={getSoftBlockWarning(fieldName)}
        onChange={handleChange}
        onRestoreFromHistory={(historyIndex) => restoreField(fieldName, historyIndex)}
        disabled={disabled}
        fullWidth={true}
        helperText={helperText}
        InputLabelProps={InputLabelProps}
      />
    );
  };

  // Campaign management functions
  const loadCampaign = async (campaignId: string) => {
    // Find the campaign from availableCampaigns
    const campaign = availableCampaigns.find(c => c.id === campaignId) || null;
    setCurrentCampaign(campaign);
    setSaveStatus('saving');
    // Subscribe to proposal data in Firestore
    if (proposalUnsubscribeRef.current) proposalUnsubscribeRef.current();
    proposalUnsubscribeRef.current = subscribeToProposalData(campaignId, (data) => {
      if (data) {
        setProposalData(data);
        setSaveStatus('saved');
      } else {
        setProposalData(getDefaultProposalData());
        setSaveStatus('saved');
      }
    });
  };

  // Keep a ref to unsubscribe from Firestore listener
  const proposalUnsubscribeRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    return () => {
      if (proposalUnsubscribeRef.current) proposalUnsubscribeRef.current();
    };
  }, []);

  // Note: debouncedSave is not used in enhanced proposal sync mode
  // Enhanced proposal sync handles saving automatically through updateField

  const createNewCampaign = (name: string, description: string = '') => {
    const campaign = createCampaign(name, description);
    const defaultData = getDefaultProposalData();
    
    // Save the new campaign
    saveCampaignData(campaign, defaultData);
    
    // Update state
    setCurrentCampaign(campaign);
    setProposalData(defaultData);
    
    // Initialize collaboration for new campaign
    collaborationManager.initializeCampaign(campaign.id);
    
    // Refresh campaigns list
    const updatedCampaigns = getAllCampaigns();
    setAvailableCampaigns(updatedCampaigns);
  };

  const handleCampaignSelect = (event: SelectChangeEvent) => {
    const value = event.target.value;
    if (value === 'new') {
      setShowCampaignDialog(true);
    } else if (value) {
      loadCampaign(value);
    }
  };

  const handleCreateCampaign = () => {
    if (newCampaignName.trim()) {
      createNewCampaign(newCampaignName.trim(), newCampaignDescription.trim());
      setNewCampaignName('');
      setNewCampaignDescription('');
      setShowCampaignDialog(false);
    }
  };

  // Load available campaigns on mount
  useEffect(() => {
    const campaigns = getAllCampaigns();
    setAvailableCampaigns(campaigns);
    
    // If campaignId is provided as prop, use it; otherwise load the most recent campaign
    if (campaignId) {
      loadCampaign(campaignId);
    } else if (campaigns.length > 0 && !currentCampaign) {
      loadCampaign(campaigns[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  // Set up collaboration listener
  useEffect(() => {
    const handleCollaborationUpdate = (state: CollaborationState) => {
      setActiveUsers(collaborationManager.getActiveUsers());

      // Handle incoming field updates from other users
      const currentUser = collaborationManager.getCurrentUser();
      const recentFieldUpdate = state.recentActivity.find(
        activity => 
          activity.type === 'FIELD_UPDATE' && 
          activity.userId !== currentUser.id && // Not from current user
          activity.timestamp > Date.now() - 5000 // Within last 5 seconds
      );
      
      if (recentFieldUpdate && recentFieldUpdate.data?.fieldName && recentFieldUpdate.data?.fieldValue !== undefined) {
        const fieldName = recentFieldUpdate.data.fieldName as keyof ProposalData;
        const fieldValue = recentFieldUpdate.data.fieldValue;
        
        // Update the proposal data directly
        setProposalData(prev => {
          if (prev[fieldName] !== fieldValue) {
            return { ...prev, [fieldName]: fieldValue };
          }
          return prev;
        });
      }
      
      // Check for override notifications
      const recentOverride = state.recentActivity.find(
        activity => 
          activity.type === 'OVERRIDE_ATTEMPT' && 
          activity.data?.originalUser === currentUser.name &&
          activity.timestamp > Date.now() - 10000 // Within last 10 seconds
      );
      
      if (recentOverride && recentOverride.data?.fieldName) {
        const fieldDisplayName = recentOverride.data.fieldName
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase())
          .trim();
        
        const notification = `${recentOverride.userName} has taken over editing the "${fieldDisplayName}" field`;
        
        setOverrideNotifications(prev => {
          if (!prev.includes(notification)) {
            return [notification, ...prev.slice(0, 4)]; // Keep only 5 notifications
          }
          return prev;
        });
        
        // Auto-remove notification after 8 seconds
        setTimeout(() => {
          setOverrideNotifications(prev => prev.filter(n => n !== notification));
        }, 8000);
    }
    };

    collaborationManager.addListener(handleCollaborationUpdate);
    
    return () => {
      collaborationManager.removeListener(handleCollaborationUpdate);
      collaborationManager.cleanup();
  };
  }, []);

  // Manual refresh function
  const handleRefresh = () => {
    if (currentCampaign) {
      const campaignData = loadCampaignData(currentCampaign.id);
      if (campaignData) {
        setProposalData(campaignData.proposalData);
      }
      
      // Force collaboration state refresh
      collaborationManager.initializeCampaign(currentCampaign.id);
    }
  };

  // Update values when PowerAnalysis values change
  useEffect(() => {
    if (powerAnalysisValues && campaignId) {
      const effectiveMde = powerAnalysisValues.mde || '5';
      const effectivePower = powerAnalysisValues.power || '0.8';
      const effectiveSignificanceLevel = powerAnalysisValues.significanceLevel || '0.05';
      
      // Update enhanced proposal fields
      updateField('mde', effectiveMde);
      updateField('power', effectivePower);
      updateField('significanceLevel', effectiveSignificanceLevel);
      
      if (powerAnalysisValues.selectedMetric) {
        updateField('primaryMetrics', powerAnalysisValues.selectedMetric);
      }
      
      if (calculatedVariance) {
        updateField('standardDeviation', Math.sqrt(parseFloat(calculatedVariance)).toFixed(4));
      }
      
      if (calculatedSampleSize) {
        updateField('sampleSize', calculatedSampleSize);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [powerAnalysisValues, calculatedSampleSize, calculatedVariance, campaignId]);

  // Calculate expectedDays when usersPerDay and sampleSize are available
  useEffect(() => {
    const currentUsersPerDay = getFieldValue('usersPerDay');
    const currentSampleSize = getFieldValue('sampleSize');
    
    if (currentUsersPerDay && currentSampleSize && campaignId) {
      const usersPerDayNum = parseFloat(currentUsersPerDay);
      const sampleSizeNum = parseFloat(currentSampleSize);
      
      if (!isNaN(usersPerDayNum) && !isNaN(sampleSizeNum) && usersPerDayNum > 0) {
        const expectedDays = Math.ceil(sampleSizeNum / usersPerDayNum);
        updateField('expectedDays', expectedDays.toString());
      }
    }
  }, [getFieldValue, updateField, campaignId]);

  const handleExportConfirmation = () => {
    // Check for empty fields
    const empty = Object.entries(proposalData).reduce((acc: string[], [key, value]) => {
      if (!value || value.trim() === '') {
        // Convert camelCase to Title Case for display
        const fieldName = key.replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase());
        acc.push(fieldName);
      }
      return acc;
    }, []);

    if (empty.length > 0) {
      setEmptyFields(empty);
      setOpenDialog(true);
    } else {
      // If no empty fields, export directly
      performExport();
    }
  };

  const handleDialogClose = () => {
    setOpenDialog(false);
  };

  // Conflict resolution functions
  const handleConflictResolution = (action: 'use-latest' | 'keep-mine' | 'show-diff') => {
    if (!conflictData) return;
    
    switch (action) {
      case 'use-latest':
        setCurrentCampaign(conflictData.saved.campaign);
        setProposalData(conflictData.saved.proposalData);
        break;
      case 'keep-mine':
        // Save current version as the latest
        if (currentCampaign) {
          saveCampaignData(currentCampaign, proposalData);
        }
        break;
      case 'show-diff':
        // For now, just show an alert with basic diff info
        alert(`Differences detected:\nYour version: ${conflictData.current.campaign?.updatedAt}\nLatest version: ${conflictData.saved.campaign.updatedAt}`);
        return; // Don't close dialog
    }
    
    setShowConflictDialog(false);
    setConflictData(null);
  };

  // Save status component
  const SaveStatusIndicator = () => {
    const getStatusIcon = () => {
      switch (saveStatus) {
        case 'saving':
          return <SyncIcon className="animate-spin" />;
        case 'saved':
          return <CheckIcon />;
        case 'error':
          return <ErrorIcon />;
        case 'conflict':
          return <ErrorIcon />;
        default:
          return <CheckIcon />;
      }
    };

    const getStatusColor = () => {
      switch (saveStatus) {
        case 'saving':
          return 'default';
        case 'saved':
          return 'success';
        case 'error':
        case 'conflict':
          return 'error';
        default:
          return 'default';
      }
    };

    const getStatusLabel = () => {
      switch (saveStatus) {
        case 'saving':
          return 'Saving...';
        case 'saved':
          return 'Saved';
        case 'error':
          return 'Save Error';
        case 'conflict':
          return 'Conflict';
        default:
          return 'Saved';
      }
    };

    return (
      <Chip
        icon={getStatusIcon()}
        label={getStatusLabel()}
        color={getStatusColor() as any}
        size="small"
        sx={{ position: 'fixed', top: 20, right: 20, zIndex: 1000 }}
      />
    );
  };

  const performExport = () => {
    // Create sections for the Word document
    const sections = [
      {
        title: 'Hypothesis Testing Proposal',
        content: [
          { label: 'Experiment/Analysis Title', value: proposalData.title },
          { label: 'Experiment Architects', value: proposalData.architects },
          { label: 'Date', value: proposalData.date }
        ]
      },
      {
        title: '1. Business Context',
        content: [
          { label: 'Business Problem', value: proposalData.businessProblem },
          { label: 'Why This Matters', value: proposalData.whyThisMatters },
          { label: 'Quantify the Impact', value: proposalData.quantifyImpact },
          { label: 'Potential Benefit', value: proposalData.potentialBenefit },
          { label: 'Previous Work/Findings', value: proposalData.previousWork }
        ]
      },
      {
        title: '2. Research Question and Hypotheses',
        content: [
          { label: 'Research Question', value: proposalData.researchQuestion },
          { label: 'Null Hypothesis (H0)', value: proposalData.nullHypothesis },
          { label: 'Alternative Hypothesis (H1)', value: proposalData.alternativeHypothesis }
        ]
      },
      {
        title: '3. Study Design',
        content: [
          { label: 'Type of Study', value: proposalData.studyType },
          { label: 'Target Population', value: proposalData.targetPopulation },
          { label: 'Sampling Strategy', value: proposalData.samplingStrategy },
          { label: 'Exploratory Data Analysis (EDA)', value: proposalData.eda }
        ]
      },
      {
        title: '4. Sample Size and Power Analysis',
        content: [
          { label: 'Minimum Detectable Effect (MDE)', value: proposalData.mde + '%' },
          { label: 'Statistical Power', value: proposalData.power },
          { label: 'Significance Level (α)', value: proposalData.significanceLevel },
          { label: 'Standard Deviation', value: proposalData.standardDeviation },
          { label: 'Total Required Sample Size', value: proposalData.sampleSize },
          { label: 'Average Users Per Day', value: proposalData.usersPerDay },
          { label: 'Expected Days to Reach Sample Size', value: proposalData.expectedDays + ' days' },
          { label: 'Sample Size Summary', value: proposalData.usersPerDay && proposalData.sampleSize ? 
            `With an average of ${proposalData.usersPerDay} users per day and a sample size of ${proposalData.sampleSize}, we expect to reach the required sample size in ${proposalData.expectedDays} days.` : 
            'Not calculated' }
        ]
      },
      {
        title: '5. Statistical Analysis Plan',
        content: [
          { label: 'Primary Metric(s)', value: proposalData.primaryMetrics },
          { label: 'Secondary Metric(s)', value: proposalData.secondaryMetrics },
          { label: 'Guardrail Metric(s)', value: proposalData.guardrailMetrics },
          { label: 'Sanity Check Metric(s)', value: proposalData.sanityChecks },
          { label: 'Statistical Test(s)', value: proposalData.statisticalTests },
          { label: 'Potential Risks', value: proposalData.potentialRisks }
        ]
      },
      {
        title: '6. Segmentation and Multiple Comparisons',
        content: [
          { label: 'Potential Segments', value: proposalData.segments },
          { label: 'FWER Correction Method', value: proposalData.fwerCorrection }
        ]
      },
    ];

    // Create the document
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // Title
          new Paragraph({
            text: "Hypothesis Testing Proposal",
            heading: HeadingLevel.TITLE,
            spacing: {
              after: 400
            }
          }),
          
          // Generate content for each section
          ...sections.flatMap(section => [
            // Section Title
            new Paragraph({
              text: section.title,
              heading: HeadingLevel.HEADING_1,
              spacing: {
                before: 400,
                after: 200
              }
            }),
            
            // Section Content
            ...section.content.map(item => [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${item.label}: `,
                    bold: true
                  }),
                  new TextRun({
                    text: item.value || 'Not specified',
                    bold: false
                  })
                ],
                spacing: {
                  before: 200,
                  after: 200
                }
              })
            ]).flat()
          ]).flat()
        ]
      }]
    });

    // Generate and save the document
    Packer.toBlob(doc).then(blob => {
      saveAs(blob, 'hypothesis-testing-proposal.docx');
      setOpenDialog(false);
    });
  };

  // Replace all session/local storage usage with campaign-specific keys
  const getInitialProposalState = () => {
    if (campaignId) {
      const sessionState = sessionStorage.getItem(`proposalState_${campaignId}`);
      if (sessionState) {
        return JSON.parse(sessionState);
      }
    }
    return getDefaultProposalData();
  };

  // Use useEffect to reset state and listeners when campaignId changes
  useEffect(() => {
    // Reset state when campaignId changes
    setProposalData(getInitialProposalState());
    // TODO: Unsubscribe from previous Firestore listeners and subscribe to new campaign if needed
    // Return cleanup function to unsubscribe
    return () => {
      // Unsubscribe logic here
      if (proposalUnsubscribeRef.current) proposalUnsubscribeRef.current();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  // Save state to sessionStorage whenever proposalData changes
  useEffect(() => {
    if (campaignId) {
      sessionStorage.setItem(`proposalState_${campaignId}`, JSON.stringify(proposalData));
    }
  }, [proposalData, campaignId]);

  // In the effect/listener for Power Analysis value changes:
  useEffect(() => {
    if (!currentCampaign) return;
    // Subscribe to Power Analysis values for this campaign
    const unsubscribe = subscribeToPowerAnalysisData(currentCampaign.id, (data: any, updatedBy: string) => {
      // For each imported field, if value changed and updatedBy is not current user, update proposal and set notification
      const importedFields = [
        { key: 'sampleSize', label: 'Sample Size' },
        { key: 'standardDeviation', label: 'Standard Deviation' },
        { key: 'mde', label: 'MDE' },
        { key: 'power', label: 'Power' },
        { key: 'significanceLevel', label: 'Significance Level' }
      ];
      importedFields.forEach(({ key }) => {
        if (proposalData[key as keyof ProposalData] !== data[key] && updatedBy !== user?.displayName) {
          setProposalData(prev => ({ ...prev, [key as keyof ProposalData]: data[key] }));
          // setFieldUpdateInfo(prev => ({ ...prev, [key]: { by: updatedBy, ts: Date.now() } })); // Removed
          setTimeout(() => {
            // setFieldUpdateInfo(prev => { // Removed
            //   const copy = { ...prev }; // Removed
            //   delete copy[key]; // Removed
            //   return copy; // Removed
            // }); // Removed
          }, 6000);
        }
      });
    });
    return () => unsubscribe && unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCampaign, proposalData, user]);

  // DEV ONLY: To clear local Firestore cache, run in console:
  // indexedDB.deleteDatabase('firebase-firestore-database') // <- for dev only

  // In the useEffect for subscribing to proposal data:
  useEffect(() => {
    if (!currentCampaign) return;
    let unsub: (() => void) | null = null;
    unsub = subscribeToProposalData(currentCampaign.id, (data) => {
      if (data === null) {
        console.warn(`[Proposal] No proposal document found for campaign ${currentCampaign.id}`);
        setProposalData(getDefaultProposalData()); // or set to null and handle in UI
        return;
      }
      setProposalData(data);
    });
    return () => {
      if (unsub) unsub();
    };
  }, [currentCampaign]);

  // Handle field update
  // Note: handleFieldUpdate is not used in enhanced proposal sync mode
  // Enhanced proposal sync handles field updates automatically through updateField

  // Show loading state while enhanced proposal data is loading
  if (proposalLoading) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography>Loading proposal data...</Typography>
        {process.env.NODE_ENV === 'development' && renderDebugInfo()}
      </Box>
    );
  }

  // Show error state if there's no data and not loading
  if (!enhancedProposalData && !proposalLoading) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="error">No proposal data found. Please try refreshing the page.</Typography>
        {process.env.NODE_ENV === 'development' && renderDebugInfo()}
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: '1200px', margin: 'auto', padding: 2 }}>
      {/* Error Messages */}
      {errorMessage && (
        <Alert 
          severity="error" 
          onClose={() => setErrorMessage('')}
          sx={{ mb: 2 }}
        >
          {errorMessage}
        </Alert>
      )}
      {process.env.NODE_ENV === 'development' && renderDebugInfo()}
      
      {/* Save Status Indicator */}
      <SaveStatusIndicator />
      
      {/* Override Notifications */}
      {overrideNotifications.map((notification, index) => (
        <Alert 
          key={index}
          severity="warning" 
          sx={{ mb: 1 }}
          onClose={() => setOverrideNotifications(prev => prev.filter((_, i) => i !== index))}
        >
          {notification}
        </Alert>
      ))}
      
      {/* Enhanced Proposal Error - Only show critical errors */}
      {proposalError && !proposalError.includes('Missing or insufficient permissions') && !proposalError.includes('No proposal data found') && (
        <Alert 
          severity="error" 
          sx={{ mb: 1 }}
          onClose={clearError}
        >
          {proposalError}
        </Alert>
      )}
      
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4" gutterBottom sx={{ mb: 0 }}>
        Hypothesis Testing Proposal
      </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Active Users Badge */}
          {activeUsers.length > 0 && (
            <Tooltip title={`${activeUsers.length} user${activeUsers.length > 1 ? 's' : ''} active: ${activeUsers.map(u => u.userName).join(', ')}`}>
              <Badge badgeContent={activeUsers.length} color="primary">
                <PeopleIcon color="action" />
              </Badge>
            </Tooltip>
          )}
          
          {/* Refresh Button */}
          <Tooltip title="Refresh to get latest updates from other users">
            <Button
              variant="outlined"
              onClick={handleRefresh}
              color="primary"
              startIcon={<RefreshIcon />}
              sx={{
                borderWidth: 2,
                '&:hover': {
                  borderWidth: 2,
                  bgcolor: 'primary.50'
                }
              }}
            >
              Refresh
            </Button>
          </Tooltip>
        </Box>
      </Box>

      {/* Campaign Management Section - only show when no campaignId is provided */}
      {!campaignId && (
      <Card sx={{ mb: 3, bgcolor: 'background.paper' }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Campaign</InputLabel>
                <Select
                  value={currentCampaign?.id || ''}
                  onChange={handleCampaignSelect}
                  label="Campaign"
                >
                  {availableCampaigns.map(campaign => (
                    <MenuItem key={campaign.id} value={campaign.id}>
                      <Box>
                        <Typography variant="body1">{campaign.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {campaign.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                  <Divider />
                  <MenuItem value="new">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AddIcon fontSize="small" />
                      <Typography>Create New Campaign</Typography>
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              {currentCampaign && (
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Last modified:</strong> {currentCampaign.updatedAt ? formatRelativeTime(
                      currentCampaign.updatedAt instanceof Date 
                        ? currentCampaign.updatedAt.toISOString() 
                        : currentCampaign.updatedAt
                    ) : 'Unknown'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>By:</strong> {(currentCampaign.createdBy && currentCampaign.collaborators[currentCampaign.createdBy]?.user.displayName) || 'Unknown'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Created:</strong> {currentCampaign.createdAt ? formatRelativeTime(
                      currentCampaign.createdAt instanceof Date 
                        ? currentCampaign.createdAt.toISOString() 
                        : currentCampaign.createdAt
                    ) : 'Unknown'}
                  </Typography>
                  
                  {/* Active Users Indicator */}
                  {activeUsers.length > 0 && (
                    <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Active users:</strong>
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {activeUsers.slice(0, 3).map((user) => (
                          <Chip
                            key={user.userId}
                            size="small"
                            avatar={
                              <Box
                                sx={{
                                  width: 16,
                                  height: 16,
                                  borderRadius: '50%',
                                  bgcolor: user.color,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.6rem',
                                  fontWeight: 'bold',
                                  color: 'white',
                                }}
                              >
                                {user.userName.charAt(0).toUpperCase()}
                              </Box>
                            }
                            label={user.userName.split(' ')[0]}
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              bgcolor: `${user.color}20`,
                              border: `1px solid ${user.color}`,
                            }}
                          />
                        ))}
                        {(activeUsers.length > 3 &&
                          (activeUsers.some(u => u.userId === user?.uid) ||
                            activeUsers.some(u => u.userId === currentCampaign?.createdBy))
                        ) && (
                          <Chip
                            size="small"
                            label={`+${activeUsers.length - 3}`}
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        )}
                      </Box>
                    </Box>
                  )}
                </Box>
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      )}

      {/* Campaign info display when campaignId is provided */}
      {campaignId && currentCampaign && (
        <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 'bold' }}>
            Campaign: {currentCampaign.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {currentCampaign.description}
          </Typography>
        </Box>
      )}

      <StyledPaper>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            {renderEnhancedField('title', 'Experiment/Analysis Title', {
              placeholder: 'Enter a descriptive title for your experiment'
            })}
          </Grid>
          <Grid item xs={12} md={6}>
            {renderEnhancedField('architects', 'Experiment Architects', {
              placeholder: 'Names of people designing the experiment'
            })}
          </Grid>
          <Grid item xs={12} md={6}>
            {renderEnhancedField('date', 'Date', {
              type: 'input',
              placeholder: new Date().toISOString().split('T')[0],
              InputLabelProps: { shrink: true }
            })}
          </Grid>
        </Grid>
      </StyledPaper>

      <StyledPaper>
        <SectionTitle variant="h6">1. Business Context</SectionTitle>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            {renderEnhancedField('businessProblem', 'Business Problem', {
              type: 'textarea',
              rows: 3,
              placeholder: 'Describe the business problem you are trying to solve'
            })}
          </Grid>
          <Grid item xs={12}>
            {renderEnhancedField('whyThisMatters', 'Why This Matters', {
              type: 'textarea',
              rows: 3,
              placeholder: 'Explain why solving this problem is important'
            })}
          </Grid>
          <Grid item xs={12}>
            {renderEnhancedField('quantifyImpact', 'Quantify the Impact', {
              type: 'textarea',
              rows: 2,
              placeholder: 'How will you measure the impact of this experiment?'
            })}
          </Grid>
          <Grid item xs={12}>
            {renderEnhancedField('potentialBenefit', 'Potential Benefit', {
              type: 'textarea',
              rows: 2,
              placeholder: 'What are the expected benefits if the experiment succeeds?'
            })}
          </Grid>
          <Grid item xs={12}>
            {renderEnhancedField('previousWork', 'Previous Work/Findings', {
              type: 'textarea',
              rows: 3,
              placeholder: 'Any previous experiments or research related to this problem'
            })}
          </Grid>
        </Grid>
      </StyledPaper>

      <StyledPaper>
        <SectionTitle variant="h6">2. Research Question and Hypotheses</SectionTitle>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            {renderEnhancedField('researchQuestion', 'Research Question', {
              type: 'textarea',
              rows: 2,
              placeholder: 'What specific question are you trying to answer?'
            })}
          </Grid>
          <Grid item xs={12}>
            {renderEnhancedField('nullHypothesis', 'Null Hypothesis (H0)', {
              type: 'textarea',
              rows: 2,
              placeholder: 'State your null hypothesis (e.g., "There is no difference between treatments")'
            })}
          </Grid>
          <Grid item xs={12}>
            {renderEnhancedField('alternativeHypothesis', 'Alternative Hypothesis (H1)', {
              type: 'textarea',
              rows: 2,
              placeholder: 'State your alternative hypothesis (e.g., "Treatment A performs better than Treatment B")'
            })}
          </Grid>
        </Grid>
      </StyledPaper>

      <StyledPaper>
        <SectionTitle variant="h6">3. Study Design</SectionTitle>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            {renderEnhancedField('studyType', 'Type of Study', {
              type: 'select',
              selectOptions: ['A/B Test', 'Multi-Armed Bandit (MAB)', 'Factorial Test'],
              placeholder: 'Select the type of study'
            })}
          </Grid>
          <Grid item xs={12}>
            {renderEnhancedField('targetPopulation', 'Target Population', {
              type: 'textarea',
              rows: 2,
              placeholder: 'Describe the target population for your experiment'
            })}
          </Grid>
          <Grid item xs={12}>
            {renderEnhancedField('samplingStrategy', 'Sampling Strategy', {
              type: 'textarea',
              rows: 2,
              placeholder: 'How will you sample users for the experiment?'
            })}
          </Grid>
          <Grid item xs={12}>
            {renderEnhancedField('eda', 'Exploratory Data Analysis (EDA)', {
              type: 'textarea',
              rows: 3,
              placeholder: 'Describe your plan for exploratory data analysis'
            })}
          </Grid>
        </Grid>
      </StyledPaper>

      <StyledPaper>
        <SectionTitle variant="h6">4. Sample Size and Power Analysis</SectionTitle>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            {renderEnhancedField('mde', 'Minimum Detectable Effect (MDE)', {
              helperText: powerAnalysisValues?.mde 
                  ? `Value from Power Analysis: ${powerAnalysisValues.mde}${powerAnalysisValues?.mdeType === 'percentage' ? '%' : ''}`
                : "Run Power Analysis to set this value",
              disabled: !powerAnalysisValues?.mde
            })}
          </Grid>
          <Grid item xs={12} md={6}>
            {renderEnhancedField('power', 'Statistical Power', {
              helperText: powerAnalysisValues?.power 
                  ? `Value from Power Analysis: ${powerAnalysisValues.power}`
                : "Run Power Analysis to set this value",
              disabled: !powerAnalysisValues?.power
            })}
          </Grid>
          <Grid item xs={12} md={6}>
            {renderEnhancedField('significanceLevel', 'Significance Level (α)', {
              helperText: powerAnalysisValues?.significanceLevel 
                  ? `Value from Power Analysis: ${powerAnalysisValues.significanceLevel}`
                : "Run Power Analysis to set this value",
              disabled: !powerAnalysisValues?.significanceLevel
            })}
          </Grid>
          <Grid item xs={12} md={6}>
            {renderEnhancedField('standardDeviation', 'Standard Deviation', {
              helperText: calculatedVariance
                  ? `Value from Power Analysis: ${Math.sqrt(parseFloat(calculatedVariance)).toFixed(4)}`
                : "Run Power Analysis to calculate",
              disabled: true
            })}
          </Grid>
          <Grid item xs={12} md={6}>
            {renderEnhancedField('sampleSize', 'Total Required Sample Size', {
              helperText: calculatedSampleSize 
                  ? `Value from Power Analysis: ${calculatedSampleSize}`
                : "Run Power Analysis to calculate",
              disabled: true
            })}
          </Grid>
          <Grid item xs={12} md={6}>
            {renderEnhancedField('usersPerDay', 'Users Per Day', {
              placeholder: 'e.g., 1200',
              helperText: 'Enter the average number of users per day',
              onChange: (value) => {
                // Trigger expectedDays recalculation when usersPerDay changes
                const currentSampleSize = getFieldValue('sampleSize');
                if (value && currentSampleSize) {
                  const usersPerDayNum = parseFloat(value);
                  const sampleSizeNum = parseFloat(currentSampleSize);
                  
                  if (!isNaN(usersPerDayNum) && !isNaN(sampleSizeNum) && usersPerDayNum > 0) {
                    const expectedDays = Math.ceil(sampleSizeNum / usersPerDayNum);
                    setTimeout(() => updateField('expectedDays', expectedDays.toString()), 100);
                  }
                }
              }
            })}
          </Grid>
          <Grid item xs={12} md={6}>
            {renderEnhancedField('expectedDays', 'Expected Days to Reach Sample Size', {
              helperText: getFieldValue('usersPerDay') && getFieldValue('sampleSize')
                ? `With ${getFieldValue('usersPerDay')} users per day and a sample size of ${getFieldValue('sampleSize')}, we expect to reach the required sample size in ${getFieldValue('expectedDays')} days.`
                : "Will be calculated based on Users Per Day and Sample Size",
              disabled: true
            })}
          </Grid>
        </Grid>
      </StyledPaper>

      <StyledPaper>
        <SectionTitle variant="h6">5. Statistical Analysis Plan</SectionTitle>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            {renderEnhancedField('primaryMetrics', 'Primary Metric(s)', {
              type: 'textarea',
              rows: 2,
              placeholder: 'List the primary metrics you will analyze (e.g., conversion rate, revenue per user)'
            })}
          </Grid>
          <Grid item xs={12}>
            {renderEnhancedField('secondaryMetrics', 'Secondary Metric(s)', {
              type: 'textarea',
              rows: 2,
              placeholder: 'List secondary metrics that provide additional insights'
            })}
          </Grid>
          <Grid item xs={12}>
            {renderEnhancedField('guardrailMetrics', 'Guardrail Metric(s)', {
              type: 'textarea',
              rows: 2,
              placeholder: 'Metrics to ensure the experiment does not harm the user experience'
            })}
          </Grid>
          <Grid item xs={12}>
            {renderEnhancedField('sanityChecks', 'Sanity Check Metric(s)', {
              type: 'textarea',
              rows: 3,
              placeholder: 'Metrics to validate that the experiment is running correctly'
            })}
          </Grid>
          <Grid item xs={12}>
            {renderEnhancedField('statisticalTests', 'Statistical Test(s)', {
              type: 'textarea',
              rows: 2,
              placeholder: 'Which statistical tests will you use? (e.g., t-test, chi-square, Mann-Whitney U)'
            })}
          </Grid>
          <Grid item xs={12}>
            {renderEnhancedField('potentialRisks', 'Potential Risks', {
              type: 'textarea',
              rows: 3,
              placeholder: 'What are the potential risks of this experiment and how will you mitigate them?'
            })}
          </Grid>
        </Grid>
      </StyledPaper>

      <StyledPaper>
        <SectionTitle variant="h6">6. Segmentation and Multiple Comparisons</SectionTitle>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            {renderEnhancedField('segments', 'Potential Segments', {
              type: 'textarea',
              rows: 3,
              placeholder: 'Describe any user segments you plan to analyze separately (e.g., new vs. returning users, mobile vs. desktop)'
            })}
          </Grid>
          <Grid item xs={12}>
            {renderEnhancedField('fwerCorrection', 'FWER Correction Method', {
              type: 'select',
              selectOptions: ['Bonferroni Correction', 'False Discovery Rate (FDR)', 'None'],
              placeholder: 'Select the multiple comparison correction method'
            })}
          </Grid>
        </Grid>
      </StyledPaper>
      
      <StyledPaper>
        <SectionTitle variant="h6">7. Additional Comments</SectionTitle>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            {renderEnhancedField('comments', 'Comments', {
              type: 'textarea',
              rows: 4,
              placeholder: 'Any additional comments, considerations, or notes about the experiment'
            })}
          </Grid>
        </Grid>
      </StyledPaper>

      <Box sx={{ mt: 3, mb: 3, display: 'flex', justifyContent: 'center' }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleExportConfirmation}
          size="large"
        >
          Export Proposal
        </Button>
      </Box>

      {/* Export Confirmation Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleDialogClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {"Incomplete Fields Detected"}
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            The following fields are empty:
          </Alert>
          <DialogContentText id="alert-dialog-description">
            <ul>
              {emptyFields.map((field, index) => (
                <li key={index}>{field}</li>
              ))}
            </ul>
            Would you like to export the proposal anyway?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} color="primary">
            Cancel
          </Button>
          <Button onClick={performExport} color="primary" autoFocus>
            Export Anyway
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Campaign Dialog */}
      <Dialog
        open={showCampaignDialog}
        onClose={() => setShowCampaignDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Campaign</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Campaign Name"
              value={newCampaignName}
              onChange={(e) => setNewCampaignName(e.target.value)}
              placeholder="e.g., Q4 Checkout Optimization"
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Description (Optional)"
              value={newCampaignDescription}
              onChange={(e) => setNewCampaignDescription(e.target.value)}
              placeholder="Brief description of the campaign goals"
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCampaignDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateCampaign} 
            variant="contained"
            disabled={!newCampaignName.trim()}
          >
            Create Campaign
          </Button>
        </DialogActions>
      </Dialog>

      {/* Conflict Resolution Dialog */}
      <Dialog
        open={showConflictDialog}
        onClose={() => setShowConflictDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Campaign Conflict Detected</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This campaign has been modified elsewhere. Choose how to proceed:
          </Alert>
          {conflictData && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                <strong>Your Version:</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Last modified: {conflictData.current.campaign?.updatedAt ? 
                  formatRelativeTime(
                    conflictData.current.campaign.updatedAt instanceof Date 
                      ? conflictData.current.campaign.updatedAt.toISOString() 
                      : conflictData.current.campaign.updatedAt
                  ) : 'Unknown'}
              </Typography>
              
              <Typography variant="subtitle2" gutterBottom>
                <strong>Latest Version:</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Last modified: {formatRelativeTime(
                  conflictData.saved.campaign.updatedAt instanceof Date 
                    ? conflictData.saved.campaign.updatedAt.toISOString() 
                    : conflictData.saved.campaign.updatedAt
                )} by {conflictData.saved.campaign.collaborators[conflictData.saved.campaign.createdBy]?.user.displayName || 'Unknown'}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleConflictResolution('show-diff')}>
            Show Differences
          </Button>
          <Button onClick={() => handleConflictResolution('keep-mine')} color="primary">
            Keep My Version
          </Button>
          <Button onClick={() => handleConflictResolution('use-latest')} color="primary" variant="contained">
            Use Latest Version
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default HypothesisTestingProposal; 