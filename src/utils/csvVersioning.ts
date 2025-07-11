import { CSVFileVersion, CSVAnalysis, TabState, CampaignCSVState } from '../types/Campaign';

// Utility to generate SHA-256 hash of CSV content
export const generateCSVContentHash = async (csvContent: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(csvContent);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Convert File to base64 string for storage
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:text/csv;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

// Convert base64 string back to File
export const base64ToFile = (base64: string, fileName: string, mimeType: string = 'text/csv'): File => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  return new File([blob], fileName, { type: mimeType });
};

// Create a new CSV file version
export const createCSVFileVersion = async (
  file: File,
  analysis: CSVAnalysis,
  uploadedBy: string
): Promise<CSVFileVersion> => {
  const csvContent = await file.text();
  const contentHash = await generateCSVContentHash(csvContent);
  const base64Content = await fileToBase64(file);
  
  return {
    id: `csv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    fileName: file.name,
    contentHash,
    fileSize: file.size,
    uploadedAt: new Date(),
    uploadedBy,
    isActive: true,
    csvContent: base64Content,
    analysis
  };
};

// Check if a CSV with the same content already exists
export const findExistingCSVVersion = (
  contentHash: string,
  csvVersions: Record<string, CSVFileVersion>
): CSVFileVersion | null => {
  for (const version of Object.values(csvVersions)) {
    if (version.contentHash === contentHash) {
      return version;
    }
  }
  return null;
};

// Create default tab state
export const createDefaultTabState = (uploadedBy: string): TabState => ({
  selectedDependentMetric: '',
  manualMetricInput: '',
  powerAnalysisState: {
    selectedMetric: '',
    alpha: '0.05',
    beta: '0.2',
    mde: '5',
    customMde: '',
    mdeType: 'percentage',
    testType: 'two-tailed',
    numPaths: '2',
    customPaths: '',
    allocationRatios: [
      { name: 'Control', ratio: '50' },
      { name: 'Variant A', ratio: '50' }
    ]
  },
  calculatedSampleSize: '',
  calculatedVariance: '',
  lastUpdatedAt: new Date(),
  lastUpdatedBy: uploadedBy
});

// Create default campaign CSV state
export const createDefaultCampaignCSVState = (
  csvVersionId: string,
  uploadedBy: string
): CampaignCSVState => ({
  csvVersionId,
  activeTab: 0,
  tabStates: createDefaultTabState(uploadedBy)
});

// Update tab state with new values
export const updateTabState = (
  currentState: TabState,
  updates: Partial<TabState>,
  updatedBy: string
): TabState => ({
  ...currentState,
  ...updates,
  lastUpdatedAt: new Date(),
  lastUpdatedBy: updatedBy
});

// Update power analysis state within tab state
export const updatePowerAnalysisState = (
  currentTabState: TabState,
  powerAnalysisUpdates: Partial<TabState['powerAnalysisState']>,
  updatedBy: string
): TabState => ({
  ...currentTabState,
  powerAnalysisState: {
    ...currentTabState.powerAnalysisState,
    ...powerAnalysisUpdates
  },
  lastUpdatedAt: new Date(),
  lastUpdatedBy: updatedBy
});

// Generate a unique identifier for CSV versions
export const generateCSVVersionId = (): string => {
  return `csv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Validate CSV file version data
export const validateCSVFileVersion = (version: CSVFileVersion): boolean => {
  return !!(
    version.id &&
    version.fileName &&
    version.contentHash &&
    version.fileSize > 0 &&
    version.uploadedAt &&
    version.uploadedBy
  );
};

// Get active CSV version from campaign
export const getActiveCsvVersion = (
  csvVersions: Record<string, CSVFileVersion>,
  activeCsvVersionId?: string
): CSVFileVersion | null => {
  if (activeCsvVersionId && csvVersions[activeCsvVersionId]) {
    return csvVersions[activeCsvVersionId];
  }
  
  // Fallback to first active version
  for (const version of Object.values(csvVersions)) {
    if (version.isActive) {
      return version;
    }
  }
  
  return null;
};

// Set active CSV version
export const setActiveCsvVersion = (
  csvVersions: Record<string, CSVFileVersion>,
  newActiveVersionId: string
): Record<string, CSVFileVersion> => {
  const updated = { ...csvVersions };
  
  // Deactivate all versions
  Object.keys(updated).forEach(id => {
    updated[id] = { ...updated[id], isActive: false };
  });
  
  // Activate the selected version
  if (updated[newActiveVersionId]) {
    updated[newActiveVersionId] = { ...updated[newActiveVersionId], isActive: true };
  }
  
  return updated;
};

// Clean up old CSV versions (keep only the last 5 versions)
export const cleanupOldCSVVersions = (
  csvVersions: Record<string, CSVFileVersion>,
  maxVersions: number = 5
): Record<string, CSVFileVersion> => {
  const versions = Object.values(csvVersions);
  if (versions.length <= maxVersions) {
    return csvVersions;
  }
  
  // Sort by upload date (newest first)
  const sortedVersions = versions.sort((a, b) => 
    new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
  
  // Keep only the newest versions
  const versionsToKeep = sortedVersions.slice(0, maxVersions);
  
  const cleaned: Record<string, CSVFileVersion> = {};
  versionsToKeep.forEach(version => {
    cleaned[version.id] = version;
  });
  
  return cleaned;
};

// Export CSV file version as downloadable file
export const exportCSVFileVersion = (version: CSVFileVersion): void => {
  if (!version.csvContent) {
    throw new Error('CSV content not available for download');
  }
  
  const file = base64ToFile(version.csvContent, version.fileName);
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = version.fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}; 