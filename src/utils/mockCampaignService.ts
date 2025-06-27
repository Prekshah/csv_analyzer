import { Campaign } from '../types/Campaign';

const CAMPAIGNS_KEY = 'mock_campaigns';

function getCampaignsFromStorage(): Campaign[] {
  const data = localStorage.getItem(CAMPAIGNS_KEY);
  return data ? JSON.parse(data) : [];
}

function saveCampaignsToStorage(campaigns: Campaign[]) {
  localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(campaigns));
}

export const createCampaign = async (campaign: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>, userId: string): Promise<string> => {
  const campaigns = getCampaignsFromStorage();
  const id = Math.random().toString(36).substr(2, 9);
  const now = new Date();
  const newCampaign: Campaign = {
    ...campaign,
    id,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
  };
  campaigns.push(newCampaign);
  saveCampaignsToStorage(campaigns);
  return id;
};

export const getCampaign = async (id: string): Promise<Campaign | null> => {
  const campaigns = getCampaignsFromStorage();
  return campaigns.find(c => c.id === id) || null;
};

export const updateCampaign = async (id: string, updates: Partial<Campaign>): Promise<void> => {
  const campaigns = getCampaignsFromStorage();
  const idx = campaigns.findIndex(c => c.id === id);
  if (idx !== -1) {
    campaigns[idx] = {
      ...campaigns[idx],
      ...updates,
      updatedAt: new Date(),
    };
    saveCampaignsToStorage(campaigns);
  }
};

export const deleteCampaign = async (id: string): Promise<void> => {
  let campaigns = getCampaignsFromStorage();
  campaigns = campaigns.filter(c => c.id !== id);
  saveCampaignsToStorage(campaigns);
};

export const getUserCampaigns = async (userId: string): Promise<Campaign[]> => {
  const campaigns = getCampaignsFromStorage();
  return campaigns.filter(c => c.collaboratorIds && c.collaboratorIds.includes(userId));
};

export const subscribeToUserCampaigns = (userId: string, callback: (campaigns: Campaign[]) => void): (() => void) => {
  // For mock, just call once
  getUserCampaigns(userId).then(callback);
  // No real-time updates, so return a no-op unsubscribe
  return () => {};
};

export const subscribeToCampaign = (id: string, callback: (campaign: Campaign | null) => void): (() => void) => {
  getCampaign(id).then(callback);
  return () => {};
};

export const subscribeToPowerAnalysisData = (campaignId: string, callback: (data: any, updatedBy: string) => void): (() => void) => {
  getCampaign(campaignId).then(campaign => {
    if (campaign) {
      const csvAnalysis = (campaign as any).csvAnalysis || {};
      let updatedBy = 'Unknown';
      if (
        'updatedBy' in campaign &&
        typeof campaign.updatedBy === 'string' &&
        campaign.updatedBy &&
        campaign.collaborators &&
        campaign.collaborators[campaign.updatedBy]?.user?.displayName
      ) {
        updatedBy = campaign.collaborators[campaign.updatedBy].user.displayName;
      }
      callback(csvAnalysis, updatedBy);
    }
  });
  return () => {};
}; 