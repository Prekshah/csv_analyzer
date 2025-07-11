import * as admin from 'firebase-admin';
import * as serviceAccount from '../serviceAccountKey.json';

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount)
});

const db = admin.firestore();
const CAMPAIGNS_COLLECTION = 'campaigns';

async function patchCampaigns() {
  console.log('Starting campaign patch...');
  const campaignsRef = db.collection(CAMPAIGNS_COLLECTION);
  const snapshot = await campaignsRef.get();
  
  let patchedCount = 0;
  for (const docSnapshot of snapshot.docs) {
    const campaignId = docSnapshot.id;
    const data = docSnapshot.data();
    
    console.log(`\nChecking campaign ${campaignId}:`);
    console.log('Current data:', {
      createdBy: data.createdBy,
      collaborators: data.collaborators,
      collaboratorIds: data.collaboratorIds
    });
    
    // Check if collaborators or collaboratorIds are missing/empty
    const needsPatch = !data.collaborators || 
                      Object.keys(data.collaborators).length === 0 ||
                      !data.collaboratorIds ||
                      data.collaboratorIds.length === 0;
    
    if (needsPatch && data.createdBy) {
      console.log(`Patching campaign ${campaignId}...`);
      
      // Ensure creator is a collaborator
      const collaborators = {
        [data.createdBy]: {
        role: 'owner',
        addedAt: new Date(),
          addedBy: data.createdBy,
          user: {
            uid: data.createdBy,
            email: 'unknown@games24x7.com', // Default email since we don't have it
            displayName: 'Owner',
            photoURL: undefined
          }
        }
      };
      
      const collaboratorIds = [data.createdBy];
      
      // Update the campaign
      await campaignsRef.doc(campaignId).update({
        collaborators,
        collaboratorIds
      });
      
      console.log('Updated with:', {
        collaborators,
        collaboratorIds
      });
      
      patchedCount++;
    } else {
      console.log('No patch needed');
    }
  }

  console.log(`\nPatch complete. Updated ${patchedCount} of ${snapshot.size} campaigns.`);
  process.exit(0);
}

// Run the patch
patchCampaigns().catch(console.error);
