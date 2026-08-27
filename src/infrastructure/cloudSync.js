import { collection, doc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { db as firestore } from './firebase';
import { db as dexie } from '../lib/db.js';

let currentUser = null;
let syncInterval = null;

/**
 * Initiates the background sync daemon when a user logs in.
 */
export function startCloudSync(userId) {
  if (!firestore) return;
  if (currentUser === userId) return;
  currentUser = userId;
  
  // Perform an immediate bidirectional sync
  performSync();
  
  // Set up periodic sync every 5 minutes (in case app stays open)
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(() => {
    performSync();
  }, 5 * 60 * 1000);
}

/**
 * Stops syncing completely
 */
export function stopCloudSync() {
  currentUser = null;
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

/**
 * Executes a full bidirectional sync
 * 1. Pushes local walks that aren't marked as synced up to Firestore
 * 2. Pulls all walks from Firestore down to local Dexie
 */
async function performSync() {
  if (!currentUser || !firestore) return;
  
  try {
    const userWalksRef = collection(firestore, 'users', currentUser, 'walks');
    
    // -------------------------------------------------------------
    // PUSH (Local -> Cloud)
    // -------------------------------------------------------------
    const localWalks = await dexie.walks.toArray();
    const unsyncedWalks = localWalks.filter(w => !w.syncedWithCloud);
    
    if (unsyncedWalks.length > 0) {
      const batch = writeBatch(firestore);
      
      unsyncedWalks.forEach(walk => {
        // Use Dexie's auto-increment ID as the document ID for simplicity, 
        // stringified, to prevent duplicates safely.
        const docRef = doc(userWalksRef, walk.id.toString());
        // Strip sensitive/unwanted fields, flag as synced
        const cloudData = {
          ...walk,
          syncedWithCloud: true
        };
        batch.set(docRef, cloudData, { merge: true });
      });
      
      await batch.commit();
      
      // Mark as synced locally
      for (const walk of unsyncedWalks) {
        await dexie.walks.update(walk.id, { syncedWithCloud: true });
      }
      console.log(`Synced ${unsyncedWalks.length} walks to cloud.`);
    }

    // -------------------------------------------------------------
    // PULL (Cloud -> Local)
    // -------------------------------------------------------------
    const cloudSnapshot = await getDocs(userWalksRef);
    const cloudWalks = [];
    cloudSnapshot.forEach((doc) => {
      cloudWalks.push({ ...doc.data(), id: Number(doc.id) }); // Restore numeric ID
    });
    
    // Add walks found in cloud that don't exist locally
    let addedLocally = 0;
    for (const cloudWalk of cloudWalks) {
      const existsLocally = await dexie.walks.get(cloudWalk.id);
      if (!existsLocally) {
        await dexie.walks.add(cloudWalk);
        addedLocally++;
      }
    }
    
    if (addedLocally > 0) {
      console.log(`Pulled ${addedLocally} walks from cloud.`);
    }

  } catch (error) {
    console.error('Initial Cloud Sync Failed - Network may be offline:', error);
  }
}
