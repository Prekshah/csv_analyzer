import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as serviceAccount from '../serviceAccountKey.json';

// Initialize Firebase Admin SDK
initializeApp({
  credential: cert(serviceAccount as any)
});

const db = getFirestore();

async function patchOldCampaigns() {
  console.log('🔧 Starting campaign patching process...');
  
  const campaignsRef = db.collection('campaigns');
  const snapshot = await campaignsRef.get();
  let patchedCount = 0;
  
  console.log(`📊 Found ${snapshot.size} campaigns to check`);
  
  for (const doc of snapshot.docs) {
    const campaignId = doc.id;
    const campaign = doc.data();
    
    console.log(`\n---------------------`);
    console.log(`🔍 [DEBUG] campaignId: ${campaignId}`);
    console.log(`👤 createdBy: ${campaign.createdBy}`);
    console.log(`👥 collaborators:`, campaign.collaborators);
    console.log(`📋 collaboratorIds:`, campaign.collaboratorIds);

    const missingCollaborators = !campaign.collaborators || Object.keys(campaign.collaborators).length === 0;
    const missingCollaboratorIds = !campaign.collaboratorIds || campaign.collaboratorIds.length === 0;
    const creatorNotInCollaborators = !Object.prototype.hasOwnProperty.call(campaign.collaborators || {}, campaign.createdBy);
    
    console.log(`🔍 [CHECK] missingCollaborators=${missingCollaborators}, missingCollaboratorIds=${missingCollaboratorIds}, creatorNotInCollaborators=${creatorNotInCollaborators}`);

    if (missingCollaborators || missingCollaboratorIds || creatorNotInCollaborators) {
      // Build new collaborators object
      const newCollaborators = {
        ...campaign.collaborators,
        [campaign.createdBy]: {
          user: {
            uid: campaign.createdBy,
            email: campaign.createdByEmail || 'unknown@games24x7.com',
            displayName: campaign.createdByName || 'Owner',
            photoURL: campaign.createdByPhotoURL || null
          },
          role: 'owner',
          addedAt: new Date(),
          addedBy: campaign.createdBy
        }
      };
      
      // Build new collaboratorIds array
      const newCollaboratorIds = Array.from(new Set([
        ...(campaign.collaboratorIds || []),
        campaign.createdBy
      ]));
      
      await doc.ref.update({
        collaborators: newCollaborators,
        collaboratorIds: newCollaboratorIds
      });
      
      console.log(`✅ [PATCHED] ${campaignId}`);
      patchedCount++;
    } else {
      console.log(`⏭️  [SKIPPED] Campaign already properly configured: ${campaignId}`);
    }
  }
  
  console.log(`\n🎉 [SUMMARY] Total campaigns scanned: ${snapshot.size}, patched: ${patchedCount}`);
  return patchedCount;
}

// Run the patch script
patchOldCampaigns()
  .then((count) => {
    console.log(`\n✅ Final Patch Complete. Total campaigns patched: ${count}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Patch failed:', err);
    process.exit(1);
  }); 