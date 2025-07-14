// Campaign and collaboration types for Firestore integration

import { FieldValue } from 'firebase/firestore';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

export interface Collaborator {
  user: User;
  role: 'owner' | 'editor' | 'viewer';
  addedAt: Date | FieldValue;
  addedBy: string; // uid of user who added them
}

export interface CampaignMetadata {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // uid
  collaborators: Record<string, Collaborator>; // uid -> Collaborator
  isPublic: boolean;
  tags?: string[];
}

export interface CSVAnalysis {
  rowCount: number;
  columnCount: number;
  columns: string[];
  data: CSVValue[][];
  statistics: Record<string, ColumnStatistics>;
  dependencies: DependencyMetric[];
  dependentMetrics: string[];
  fileName: string;
  fileSize: number;
  uploadedAt: Date;
  // Enhanced fields for versioning and collaboration
  contentHash: string; // SHA-256 hash of CSV content for version identification
  uploadedBy: string; // uid of user who uploaded
  isActive?: boolean; // whether this is the currently active CSV
}

// New interface for CSV file metadata with versioning
export interface CSVFileVersion {
  id: string; // unique identifier for this CSV version
  fileName: string;
  contentHash: string;
  fileSize: number;
  uploadedAt: Date;
  uploadedBy: string;
  isActive: boolean;
  // Store the actual CSV content for easy retrieval
  csvContent?: string; // base64 encoded CSV content
  analysis?: CSVAnalysis;
}

// Tab-specific state for each CSV version
export interface TabState {
  // Summary tab state
  selectedDependentMetric: string;
  manualMetricInput: string;
  
  // Power Analysis tab state
  powerAnalysisState: {
    selectedMetric: string;
    alpha: string;
    beta: string;
    mde: string;
    customMde: string;
    mdeType: 'absolute' | 'percentage';
    testType: string;
    numPaths: string;
    customPaths: string;
    allocationRatios: Array<{name: string; ratio: string}>;
    results?: any;
  };
  
  // Analysis results and UI state
  calculatedSampleSize: string;
  calculatedVariance: string;
  
  // Last updated timestamp and user
  lastUpdatedAt: Date;
  lastUpdatedBy: string;
}

// Campaign state for each CSV version
export interface CampaignCSVState {
  csvVersionId: string;
  activeTab: number;
  tabStates: TabState;
  // Version-specific proposal data overrides (if any)
  proposalDataOverrides?: Partial<ProposalData>;
}

// Enhanced Campaign interface with multi-CSV support
export interface Campaign extends CampaignMetadata {
  // Legacy single CSV support (for backward compatibility)
  csvAnalysis?: CSVAnalysis;
  
  // New multi-CSV support
  csvVersions?: Record<string, CSVFileVersion>; // csvVersionId -> CSVFileVersion
  csvStates?: Record<string, CampaignCSVState>; // csvVersionId -> CampaignCSVState
  activeCsvVersionId?: string; // currently active CSV version
  
  // Other existing fields
  powerAnalysisResults?: PowerAnalysisResult[];
  hypothesisTests?: HypothesisTest[];
  collaboratorIds?: string[];
}

export interface PowerAnalysisResult {
  id: string;
  createdAt: Date;
  createdBy: string;
  parameters: {
    effectSize: number;
    alpha: number;
    power: number;
    sampleSize?: number;
  };
  results: {
    calculatedSampleSize?: number;
    calculatedPower?: number;
    variance?: number;
  };
}

export interface HypothesisTest {
  id: string;
  createdAt: Date;
  createdBy: string;
  testType: 'ttest' | 'anova' | 'chisquare' | 'regression';
  parameters: Record<string, any>;
  results?: Record<string, any>;
  status: 'draft' | 'running' | 'completed' | 'failed';
}

// Re-export existing types that are used in campaigns
export interface CSVValue {
  value: string | number | null;
}

export interface ColumnStatistics {
  type: 'numeric' | 'categorical' | 'date';
  mean?: number;
  median?: number;
  mode?: string | number;
  min?: number;
  max?: number;
  standardDeviation?: number;
  skewness?: number;
  kurtosis?: number;
  percentile25?: number;
  percentile75?: number;
  uniqueValues?: number;
  frequencies?: Record<string, number>;
  nullCount: number;
  missingCount: number;
  totalCount: number;
  completeness: number;
}

export interface DependencyMetric {
  column1: string;
  column2: string;
  type: 'correlation' | 'categorical_association';
  strength: number;
  description: string;
}

// Firestore-style operations interface
export interface CampaignService {
  // Campaign CRUD
  createCampaign(campaign: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>;
  getCampaign(id: string): Promise<Campaign | null>;
  updateCampaign(id: string, updates: Partial<Campaign>): Promise<void>;
  deleteCampaign(id: string): Promise<void>;
  
  // User's campaigns
  getUserCampaigns(userId: string): Promise<Campaign[]>;
  
  // Collaboration
  addCollaborator(campaignId: string, collaborator: Collaborator): Promise<void>;
  removeCollaborator(campaignId: string, userId: string): Promise<void>;
  updateCollaboratorRole(campaignId: string, userId: string, role: Collaborator['role']): Promise<void>;
  
  // Real-time subscriptions (for later Firestore integration)
  subscribeToCampaign(id: string, callback: (campaign: Campaign | null) => void): () => void;
  subscribeToUserCampaigns(userId: string, callback: (campaigns: Campaign[]) => void): () => void;
}

export interface CampaignData {
  campaign: Campaign;
  proposalData: ProposalData;
  version: number;
}

// Enhanced data model for versioned proposal fields
export interface ProposalFieldHistory {
  value: string;
  updatedAt: Date | FieldValue;
  updatedBy: {
    uid: string;
    displayName: string;
  };
}

export interface ProposalField {
  value: string;
  lastUpdatedAt: Date | FieldValue;
  lastUpdatedBy: {
    uid: string;
    displayName: string;
  };
  history?: ProposalFieldHistory[];
}

// Enhanced proposal data with versioned fields
export interface EnhancedProposalData {
  title: ProposalField;
  architects: ProposalField;
  date: ProposalField;
  businessProblem: ProposalField;
  whyThisMatters: ProposalField;
  quantifyImpact: ProposalField;
  potentialBenefit: ProposalField;
  previousWork: ProposalField;
  researchQuestion: ProposalField;
  nullHypothesis: ProposalField;
  alternativeHypothesis: ProposalField;
  studyType: ProposalField;
  targetPopulation: ProposalField;
  samplingStrategy: ProposalField;
  eda: ProposalField;
  mde: ProposalField;
  power: ProposalField;
  significanceLevel: ProposalField;
  standardDeviation: ProposalField;
  sampleSize: ProposalField;
  usersPerDay: ProposalField;
  expectedDays: ProposalField;
  primaryMetrics: ProposalField;
  secondaryMetrics: ProposalField;
  guardrailMetrics: ProposalField;
  potentialRisks: ProposalField;
  sanityChecks: ProposalField;
  statisticalTests: ProposalField;
  segments: ProposalField;
  fwerCorrection: ProposalField;
  comments: ProposalField;
}

// Legacy proposal data interface (keeping for backward compatibility)
export interface ProposalData {
  title: string;
  architects: string;
  date: string;
  businessProblem: string;
  whyThisMatters: string;
  quantifyImpact: string;
  potentialBenefit: string;
  previousWork: string;
  researchQuestion: string;
  nullHypothesis: string;
  alternativeHypothesis: string;
  studyType: string;
  targetPopulation: string;
  samplingStrategy: string;
  eda: string;
  mde: string;
  power: string;
  significanceLevel: string;
  standardDeviation: string;
  sampleSize: string;
  usersPerDay: string;
  expectedDays: string;
  primaryMetrics: string;
  secondaryMetrics: string;
  guardrailMetrics: string;
  potentialRisks: string;
  sanityChecks: string;
  statisticalTests: string;
  segments: string;
  fwerCorrection: string;
  comments: string;
}

// Utility type for field update operations
export interface FieldUpdateOperation {
  fieldName: keyof EnhancedProposalData;
  newValue: string;
  updatedBy: {
    uid: string;
    displayName: string;
  };
  timestamp: Date;
}

export interface ConflictData {
  current: CampaignData;
  saved: CampaignData;
  campaignId: string;
}

export type SaveStatus = 'saved' | 'saving' | 'error' | 'conflict';

// New types for Phase 2: Real-time collaboration
export interface CollaborativeUser {
  id: string;
  name: string;
  color: string;
  lastSeen: string;
}

export interface FieldLock {
  fieldName: string;
  userId: string;
  userName: string;
  timestamp: number;
  isActive: boolean;
}

export interface UserPresence {
  userId: string;
  userName: string;
  currentField: string | null;
  lastActivity: number;
  color: string;
}

export interface BroadcastMessage {
  type: 'FIELD_UPDATE' | 'FIELD_FOCUS' | 'FIELD_BLUR' | 'USER_JOIN' | 'USER_LEAVE' | 'CONFLICT_DETECTED' | 'OVERRIDE_ATTEMPT' | 'CSV_VERSION_SWITCH' | 'TAB_SWITCH' | 'CSV_STATE_UPDATE' | 'TAB_STATE_UPDATE' | 'USER_HEARTBEAT' | 'CSV_UPLOAD';
  campaignId: string;
  userId: string;
  userName: string;
  timestamp: number;
  data?: {
    fieldName?: string;
    fieldValue?: string;
    previousValue?: string;
    lockDuration?: number;
    originalUser?: string;
    // Enhanced collaboration fields
    csvVersionId?: string;
    previousCsvVersionId?: string;
    newCsvVersionId?: string;
    tabIndex?: number;
    state?: any;
    tabState?: any;
    // CSV upload fields
    csvVersion?: CSVFileVersion;
    fileName?: string;
    uploadedBy?: string;
  };
}

export interface CollaborationState {
  activeUsers: Map<string, UserPresence>;
  fieldLocks: Map<string, FieldLock>;
  recentActivity: BroadcastMessage[];
} 