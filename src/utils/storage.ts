import { Campaign, CampaignData, ProposalData } from '../types/Campaign';
import { getCurrentUser } from './userUtils';

const STORAGE_PREFIX = 'hypothesis_campaign_';
const CAMPAIGNS_LIST_KEY = 'hypothesis_campaigns_list';
const RECENT_CAMPAIGNS_KEY = 'hypothesis_recent_campaigns';

// Default proposal data
export const getDefaultProposalData = (): ProposalData => ({
  title: '',
  architects: '',
  date: new Date().toISOString().split('T')[0],
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
  comments: '',
});

// Generate unique campaign ID
export const generateCampaignId = (): string => {
  return `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Validate campaign name
export const validateCampaignName = (name: string, existingCampaigns: Campaign[]): { isValid: boolean; error?: string } => {
  // Check if name is empty or only whitespace
  if (!name || !name.trim()) {
    return { isValid: false, error: 'Campaign name cannot be empty' };
  }

  // Check if name starts with a special character
  if (!/^[a-zA-Z0-9]/.test(name)) {
    return { isValid: false, error: 'Campaign name must start with a letter or number' };
  }

  // Check for duplicate names (case insensitive)
  const normalizedName = name.toLowerCase();
  const isDuplicate = existingCampaigns.some(campaign => 
    campaign.name.toLowerCase() === normalizedName
  );
  
  if (isDuplicate) {
    return { isValid: false, error: 'A campaign with this name already exists' };
  }

  return { isValid: true };
};

// Create new campaign
export const createCampaign = (name: string, description: string = ''): Campaign => {
  const user = getCurrentUser();
  const now = new Date();
  
  // Validate campaign name
  const existingCampaigns = getAllCampaigns();
  const validation = validateCampaignName(name, existingCampaigns);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }
  
  return {
    id: generateCampaignId(),
    name,
    description,
    createdAt: now,
    updatedAt: now,
    createdBy: user.id,
    collaborators: {
      [user.id]: {
        user: {
          uid: user.id,
          email: 'unknown@games24x7.com',
          displayName: user.name,
          photoURL: undefined
        },
        role: 'owner',
        addedAt: now,
        addedBy: user.id
      }
    },
    isPublic: false
  };
};

// Save campaign data to localStorage
export const saveCampaignData = (campaign: Campaign, proposalData: ProposalData): void => {
  const now = new Date().toISOString();
  
  const updatedCampaign: Campaign = {
    ...campaign,
    updatedAt: new Date()
  };
  
  const campaignData: CampaignData = {
    campaign: updatedCampaign,
    proposalData,
    version: Date.now()
  };
  
  // Save individual campaign data
  localStorage.setItem(`${STORAGE_PREFIX}${campaign.id}`, JSON.stringify(campaignData));
  
  // Update campaigns list
  updateCampaignsList(updatedCampaign);
  
  // Update recent campaigns
  updateRecentCampaigns(campaign.id);
};

// Load campaign data from localStorage
export const loadCampaignData = (campaignId: string): CampaignData | null => {
  try {
    const data = localStorage.getItem(`${STORAGE_PREFIX}${campaignId}`);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading campaign data:', error);
  }
  return null;
};

// Get all available campaigns
export const getAllCampaigns = (): Campaign[] => {
  try {
    const campaignsData = localStorage.getItem(CAMPAIGNS_LIST_KEY);
    if (campaignsData) {
      return JSON.parse(campaignsData);
    }
  } catch (error) {
    console.error('Error loading campaigns list:', error);
  }
  return [];
};

// Update campaigns list
const updateCampaignsList = (campaign: Campaign): void => {
  const campaigns = getAllCampaigns();
  const existingIndex = campaigns.findIndex(c => c.id === campaign.id);
  
  if (existingIndex >= 0) {
    campaigns[existingIndex] = campaign;
  } else {
    campaigns.push(campaign);
  }
  
  // Sort by last modified (most recent first)
  campaigns.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  
  localStorage.setItem(CAMPAIGNS_LIST_KEY, JSON.stringify(campaigns));
};

// Get recent campaigns (last 5)
export const getRecentCampaigns = (): string[] => {
  try {
    const recentData = localStorage.getItem(RECENT_CAMPAIGNS_KEY);
    if (recentData) {
      return JSON.parse(recentData);
    }
  } catch (error) {
    console.error('Error loading recent campaigns:', error);
  }
  return [];
};

// Update recent campaigns list
const updateRecentCampaigns = (campaignId: string): void => {
  let recent = getRecentCampaigns();
  
  // Remove if already exists
  recent = recent.filter(id => id !== campaignId);
  
  // Add to beginning
  recent.unshift(campaignId);
  
  // Keep only last 5
  recent = recent.slice(0, 5);
  
  localStorage.setItem(RECENT_CAMPAIGNS_KEY, JSON.stringify(recent));
};

// Delete campaign
export const deleteCampaign = (campaignId: string): void => {
  // Remove campaign data
  localStorage.removeItem(`${STORAGE_PREFIX}${campaignId}`);
  
  // Remove from campaigns list
  const campaigns = getAllCampaigns().filter(c => c.id !== campaignId);
  localStorage.setItem(CAMPAIGNS_LIST_KEY, JSON.stringify(campaigns));
  
  // Remove from recent campaigns
  const recent = getRecentCampaigns().filter(id => id !== campaignId);
  localStorage.setItem(RECENT_CAMPAIGNS_KEY, JSON.stringify(recent));
};

// Check for conflicts (when loading a campaign that might have been modified elsewhere)
export const checkForConflicts = (campaignId: string, currentVersion: number): CampaignData | null => {
  const savedData = loadCampaignData(campaignId);
  
  if (savedData && savedData.version > currentVersion) {
    return savedData;
  }
  
  return null;
};

// Debounce utility for auto-save
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}; 