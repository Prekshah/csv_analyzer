import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { Campaign, ConflictData, SaveStatus, ProposalData, CollaborationState, UserPresence } from '../types/Campaign';
import { 
  createCampaign, 
  saveCampaignData, 
  loadCampaignData, 
  getAllCampaigns, 
  getDefaultProposalData,
  debounce,
} from '../utils/storage';
import { formatRelativeTime } from '../utils/userUtils';
import { collaborationManager } from '../utils/collaboration';
import CollaborativeTextField from './CollaborativeTextField';
import {
  subscribeToProposalData,
} from '../utils/firestoreProposalService';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToPowerAnalysisData } from '../utils/firestoreCampaignService';

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
  const [currentVersion, setCurrentVersion] = useState<number>(Date.now());
  
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
  const [fieldUpdateInfo, setFieldUpdateInfo] = useState<{ [field: string]: { by: string, ts: number } }>({});

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

  // Update debouncedSave to use Firestore
  const debouncedSave = useCallback(
    debounce(async (campaign: Campaign, data: ProposalData) => {
      if (campaign) {
        setSaveStatus('saving');
        try {
          await saveCampaignData(campaign, data);
          setCurrentVersion(Date.now());
          setSaveStatus('saved');
        } catch (error) {
          console.error('Error saving proposal data:', error);
          setSaveStatus('error');
        }
      }
    }, 2000),
    []
  );

  const createNewCampaign = (name: string, description: string = '') => {
    const campaign = createCampaign(name, description);
    const defaultData = getDefaultProposalData();
    
    // Save the new campaign
    saveCampaignData(campaign, defaultData);
    
    // Update state
    setCurrentCampaign(campaign);
    setProposalData(defaultData);
    setCurrentVersion(Date.now());
    setSaveStatus('saved');
    
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
    
    // Load the most recent campaign if available
    if (campaigns.length > 0 && !currentCampaign) {
      loadCampaign(campaigns[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        setCurrentVersion(campaignData.version);
        setSaveStatus('saved');
      }
      
      // Force collaboration state refresh
      collaborationManager.initializeCampaign(currentCampaign.id);
    }
  };

  // Helper function to get user initials
  const getUserInitials = (name: string): string => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Update values when PowerAnalysis values change
  useEffect(() => {
    if (powerAnalysisValues && currentCampaign) {
      const effectiveMde = powerAnalysisValues.mde || '5';
      const effectivePower = powerAnalysisValues.power || '0.8';
      const effectiveSignificanceLevel = powerAnalysisValues.significanceLevel || '0.05';
      
      setProposalData(prev => {
        const newData = {
          ...prev,
          mde: effectiveMde,
          power: effectivePower,
          significanceLevel: effectiveSignificanceLevel,
          primaryMetrics: powerAnalysisValues.selectedMetric || prev.primaryMetrics,
          standardDeviation: calculatedVariance ? Math.sqrt(parseFloat(calculatedVariance)).toFixed(4) : prev.standardDeviation,
          sampleSize: calculatedSampleSize || prev.sampleSize
        };

        // Auto-save the updated data
        if (currentCampaign) {
          debouncedSave(currentCampaign, newData);
        }
        return newData;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [powerAnalysisValues, calculatedSampleSize, calculatedVariance, currentCampaign]);

  const handleChange = (field: keyof ProposalData) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent
  ) => {
    const newValue = event.target.value;
    handleFieldUpdate(field, newValue);
  };

  // Update handleFieldUpdate to use Firestore
  const handleFieldUpdate = (field: keyof ProposalData, newValue: string) => {
    if (!field || typeof field !== 'string') {
      return;
    }
    setProposalData(prev => {
      const newData = { ...prev, [field]: newValue };
      if (field === 'usersPerDay' && newValue && prev.sampleSize) {
        const usersPerDay = parseFloat(newValue);
        const sampleSize = parseFloat(prev.sampleSize);
        if (!isNaN(usersPerDay) && !isNaN(sampleSize) && usersPerDay > 0) {
          newData.expectedDays = Math.ceil(sampleSize / usersPerDay).toString();
        }
      }
      if (currentCampaign) {
        debouncedSave(currentCampaign, newData);
      }
      return newData;
    });
  };

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
        setCurrentVersion(conflictData.saved.version);
        setSaveStatus('saved');
        break;
      case 'keep-mine':
        // Save current version as the latest
        if (currentCampaign) {
          saveCampaignData(currentCampaign, proposalData);
          setCurrentVersion(Date.now());
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
    setCurrentVersion(Date.now());
    setSaveStatus('saved');
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
          setFieldUpdateInfo(prev => ({ ...prev, [key]: { by: updatedBy, ts: Date.now() } }));
          setTimeout(() => {
            setFieldUpdateInfo(prev => {
              const copy = { ...prev };
              delete copy[key];
              return copy;
            });
          }, 6000);
        }
      });
    });
    return () => unsubscribe && unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCampaign, proposalData, user]);

  return (
    <Box sx={{ maxWidth: '1200px', margin: 'auto', padding: 2 }}>
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

      {/* Campaign Management Section */}
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
                    <strong>By:</strong> {currentCampaign.createdBy && currentCampaign.collaborators[currentCampaign.createdBy]?.user.displayName || 'Unknown'}
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
                        {activeUsers.length > 3 && (
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

      <StyledPaper>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <CollaborativeTextField
              fieldName="title"
              fullWidth
              label="Experiment/Analysis Title"
              value={proposalData.title}
              onChange={(value) => handleFieldUpdate('title', value)}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <CollaborativeTextField
              fieldName="architects"
              fullWidth
              label="Experiment Architects"
              value={proposalData.architects}
              onChange={(value) => handleFieldUpdate('architects', value)}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <CollaborativeTextField
              fieldName="date"
              fullWidth
              type="date"
              label="Date"
              value={proposalData.date}
              onChange={(value) => handleFieldUpdate('date', value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        </Grid>
      </StyledPaper>

      <StyledPaper>
        <SectionTitle variant="h6">1. Business Context</SectionTitle>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <CollaborativeTextField
              fieldName="businessProblem"
              fullWidth
              multiline
              rows={3}
              label="Business Problem"
              value={proposalData.businessProblem}
              onChange={(value) => handleFieldUpdate('businessProblem', value)}
            />
          </Grid>
          <Grid item xs={12}>
            <CollaborativeTextField
              fieldName="whyThisMatters"
              fullWidth
              multiline
              rows={3}
              label="Why This Matters"
              value={proposalData.whyThisMatters}
              onChange={(value) => handleFieldUpdate('whyThisMatters', value)}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Quantify the Impact"
              value={proposalData.quantifyImpact}
              onChange={handleChange('quantifyImpact')}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Potential Benefit"
              value={proposalData.potentialBenefit}
              onChange={handleChange('potentialBenefit')}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Previous Work/Findings"
              value={proposalData.previousWork}
              onChange={handleChange('previousWork')}
            />
          </Grid>
        </Grid>
      </StyledPaper>

      <StyledPaper>
        <SectionTitle variant="h6">2. Research Question and Hypotheses</SectionTitle>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <CollaborativeTextField
              fieldName="researchQuestion"
              fullWidth
              multiline
              rows={2}
              label="Research Question"
              value={proposalData.researchQuestion}
              onChange={(value) => handleFieldUpdate('researchQuestion', value)}
            />
          </Grid>
          <Grid item xs={12}>
            <CollaborativeTextField
              fieldName="nullHypothesis"
              fullWidth
              multiline
              rows={2}
              label="Null Hypothesis (H0)"
              value={proposalData.nullHypothesis}
              onChange={(value) => handleFieldUpdate('nullHypothesis', value)}
            />
          </Grid>
          <Grid item xs={12}>
            <CollaborativeTextField
              fieldName="alternativeHypothesis"
              fullWidth
              multiline
              rows={2}
              label="Alternative Hypothesis (H1)"
              value={proposalData.alternativeHypothesis}
              onChange={(value) => handleFieldUpdate('alternativeHypothesis', value)}
            />
          </Grid>
        </Grid>
      </StyledPaper>

      <StyledPaper>
        <SectionTitle variant="h6">3. Study Design</SectionTitle>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Type of Study</InputLabel>
              <Select
                value={proposalData.studyType}
                onChange={handleChange('studyType')}
                label="Type of Study"
              >
                <MenuItem value="A/B Test">A/B Test</MenuItem>
                <MenuItem value="MAB">Multi-Armed Bandit (MAB)</MenuItem>
                <MenuItem value="Factorial">Factorial Test</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Target Population"
              value={proposalData.targetPopulation}
              onChange={handleChange('targetPopulation')}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Sampling Strategy"
              value={proposalData.samplingStrategy}
              onChange={handleChange('samplingStrategy')}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Exploratory Data Analysis (EDA)"
              value={proposalData.eda}
              onChange={handleChange('eda')}
            />
          </Grid>
        </Grid>
      </StyledPaper>

      <StyledPaper>
        <SectionTitle variant="h6">4. Sample Size and Power Analysis</SectionTitle>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Box sx={{ position: 'relative' }}>
            <TextField
              fullWidth
              label="Minimum Detectable Effect (MDE)"
              value={proposalData.mde + '%'}
              onChange={handleChange('mde')}
              helperText={powerAnalysisValues?.mde 
                  ? `Value from Power Analysis: ${powerAnalysisValues.mde}${powerAnalysisValues?.mdeType === 'percentage' ? '%' : ''}`
                : "Default: 5%"}
                sx={fieldUpdateInfo.mde ? { backgroundColor: '#fffde7', transition: 'background 0.5s' } : {}}
              />
              {fieldUpdateInfo.mde && (
                <Typography variant="caption" sx={{ color: '#bfa100', fontStyle: 'italic', position: 'absolute', left: 0, top: '100%' }}>
                  Updated by {fieldUpdateInfo.mde.by}
                </Typography>
              )}
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ position: 'relative' }}>
            <TextField
              fullWidth
              label="Statistical Power"
              value={proposalData.power}
              onChange={handleChange('power')}
              helperText={powerAnalysisValues?.power 
                ? `Value from Power Analysis: ${powerAnalysisValues.power}`
                : "Default: 0.8 (80%)"}
                sx={fieldUpdateInfo.power ? { backgroundColor: '#fffde7', transition: 'background 0.5s' } : {}}
              />
              {fieldUpdateInfo.power && (
                <Typography variant="caption" sx={{ color: '#bfa100', fontStyle: 'italic', position: 'absolute', left: 0, top: '100%' }}>
                  Updated by {fieldUpdateInfo.power.by}
                </Typography>
              )}
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ position: 'relative' }}>
            <TextField
              fullWidth
              label="Significance Level (α)"
              value={proposalData.significanceLevel}
              onChange={handleChange('significanceLevel')}
              helperText={powerAnalysisValues?.significanceLevel 
                ? `Value from Power Analysis: ${powerAnalysisValues.significanceLevel}`
                : "Default: 0.05 (5%)"}
                sx={fieldUpdateInfo.significanceLevel ? { backgroundColor: '#fffde7', transition: 'background 0.5s' } : {}}
              />
              {fieldUpdateInfo.significanceLevel && (
                <Typography variant="caption" sx={{ color: '#bfa100', fontStyle: 'italic', position: 'absolute', left: 0, top: '100%' }}>
                  Updated by {fieldUpdateInfo.significanceLevel.by}
                </Typography>
              )}
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ position: 'relative' }}>
            <TextField
              fullWidth
              label="Standard Deviation"
              value={proposalData.standardDeviation}
              onChange={handleChange('standardDeviation')}
              helperText={calculatedVariance
                ? `Value from Power Analysis: ${Math.sqrt(parseFloat(calculatedVariance)).toFixed(4)}`
                : "Run Power Analysis to calculate"}
              disabled // Make the field read-only
                sx={fieldUpdateInfo.standardDeviation ? { backgroundColor: '#fffde7', transition: 'background 0.5s' } : {}}
              />
              {fieldUpdateInfo.standardDeviation && (
                <Typography variant="caption" sx={{ color: '#bfa100', fontStyle: 'italic', position: 'absolute', left: 0, top: '100%' }}>
                  Updated by {fieldUpdateInfo.standardDeviation.by}
                </Typography>
              )}
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ position: 'relative' }}>
            <TextField
              fullWidth
              label="Total Required Sample Size"
              value={proposalData.sampleSize}
              onChange={handleChange('sampleSize')}
              helperText={calculatedSampleSize 
                ? `Value from Power Analysis: ${calculatedSampleSize}`
                : "Run Power Analysis to calculate"}
              disabled // Make the field read-only
                sx={fieldUpdateInfo.sampleSize ? { backgroundColor: '#fffde7', transition: 'background 0.5s' } : {}}
              />
              {fieldUpdateInfo.sampleSize && (
                <Typography variant="caption" sx={{ color: '#bfa100', fontStyle: 'italic', position: 'absolute', left: 0, top: '100%' }}>
                  Updated by {fieldUpdateInfo.sampleSize.by}
                </Typography>
              )}
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <CollaborativeTextField
              fieldName="usersPerDay"
              fullWidth
              label="Users Per Day"
              value={proposalData.usersPerDay}
              onChange={(value) => handleFieldUpdate('usersPerDay', value)}
              placeholder="e.g., 1200"
              type="number"
              helperText="Enter the average number of users per day"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Expected Days to Reach Sample Size"
              value={proposalData.expectedDays}
              InputProps={{
                readOnly: true,
              }}
              helperText={
                proposalData.usersPerDay && proposalData.sampleSize
                  ? `With ${proposalData.usersPerDay} users per day and a sample size of ${proposalData.sampleSize}, we expect to reach the required sample size in ${proposalData.expectedDays} days.`
                  : "Will be calculated based on Users Per Day and Sample Size"
              }
            />
          </Grid>
        </Grid>
      </StyledPaper>

      <StyledPaper>
        <SectionTitle variant="h6">5. Statistical Analysis Plan</SectionTitle>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Primary Metric(s)"
              value={proposalData.primaryMetrics}
              onChange={handleChange('primaryMetrics')}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Secondary Metric(s)"
              value={proposalData.secondaryMetrics}
              onChange={handleChange('secondaryMetrics')}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Guardrail Metric(s)"
              value={proposalData.guardrailMetrics}
              onChange={handleChange('guardrailMetrics')}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Sanity Check Metric(s)"
              value={proposalData.sanityChecks}
              onChange={handleChange('sanityChecks')}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Statistical Test(s)"
              value={proposalData.statisticalTests}
              onChange={handleChange('statisticalTests')}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Potential Risks"
              value={proposalData.potentialRisks}
              onChange={handleChange('potentialRisks')}
            />
          </Grid>
        </Grid>
      </StyledPaper>

      <StyledPaper>
        <SectionTitle variant="h6">6. Segmentation and Multiple Comparisons</SectionTitle>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Potential Segments"
              value={proposalData.segments}
              onChange={handleChange('segments')}
            />
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>FWER Correction Method</InputLabel>
              <Select
                value={proposalData.fwerCorrection}
                onChange={handleChange('fwerCorrection')}
                label="FWER Correction Method"
              >
                <MenuItem value="Bonferroni Correction">Bonferroni Correction</MenuItem>
                <MenuItem value="FDR">False Discovery Rate (FDR)</MenuItem>
                <MenuItem value="None">None</MenuItem>
              </Select>
            </FormControl>
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