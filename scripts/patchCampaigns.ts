import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as serviceAccount from '../serviceAccountKey.json';

initializeApp({
  credential: cert(serviceAccount as any)
});

const db = getFirestore();

async function patchCampaigns() {
  const campaignsRef = db.collection('campaigns');
  const snapshot = await campaignsRef.get();
  let patched = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const docRef = doc.ref;

    const createdBy = data.createdBy;
    const collaborators = data.collaborators || {};
    const collaboratorIds: string[] = Array.isArray(data.collaboratorIds) ? data.collaboratorIds : [];

    let shouldPatch = false;

    // Ensure the createdBy user is in collaborators
    if (!collaborators[createdBy]) {
      collaborators[createdBy] = {
        user: {
          uid: createdBy,
          email: data.createdByEmail || 'unknown@games24x7.com',
          displayName: data.createdByName || 'Owner',
          photoURL: data.createdByPhotoURL || null
        },
        role: 'owner',
        addedAt: new Date(),
        addedBy: createdBy
      };
      shouldPatch = true;
    }

    // Ensure the UID is in collaboratorIds
    if (!collaboratorIds.includes(createdBy)) {
      collaboratorIds.push(createdBy);
      shouldPatch = true;
    }

    if (shouldPatch) {
      await docRef.update({
        collaborators,
        collaboratorIds
      });
      console.log(`✅ Patched campaign: ${doc.id}`);
      patched++;
    }
  }

  console.log(`\n✅ Final Patch Complete. Total campaigns patched: ${patched}`);
}

patchCampaigns().catch(console.error);
