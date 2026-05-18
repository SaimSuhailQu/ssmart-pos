import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, set } from 'firebase/database';
import { getUnsyncedSales, markSaleAsSynced } from './db';

// Firebase configuration injected at build-time by Vite
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

let dbInstance: any = null;

try {
  // Only initialize if not already initialized
  if (getApps().length === 0) {
    const app = initializeApp(firebaseConfig);
    dbInstance = getDatabase(app);
    console.log("Firebase sync engine initialized successfully.");
  } else {
    dbInstance = getDatabase();
  }
} catch (err) {
  console.error("Firebase failed to initialize (Offline Mode):", err);
}

export async function syncSalesToCloud() {
  if (!dbInstance) {
    console.log("Sync skipped: Firebase DB offline.");
    return { success: false, syncedCount: 0, status: "OFFLINE" };
  }

  try {
    const unsynced = getUnsyncedSales();
    if (unsynced.length === 0) {
      return { success: true, syncedCount: 0, status: "SYNCED" };
    }

    console.log(`Syncing ${unsynced.length} transaction(s) to Firebase...`);
    let count = 0;

    for (const sale of unsynced) {
      // Push transaction to central Realtime Database
      const saleRef = ref(dbInstance, `sales/${sale.id}`);
      await set(saleRef, {
        id: sale.id,
        subtotal: sale.subtotal,
        tax: sale.tax,
        discount: sale.discount,
        total: sale.total,
        payment_method: sale.payment_method,
        amount_tendered: sale.amount_tendered,
        change_given: sale.change_given,
        timestamp: sale.timestamp,
        items: sale.items,
        payments: sale.payments,
        store_branch: "Main Mall Branch #1",
        user_id: sale.user_id,
        user_name: sale.user_name || "Unknown Staff"
      });

      markSaleAsSynced(sale.id);
      count++;
    }

    console.log(`Successfully synced ${count} transactions.`);
    return { success: true, syncedCount: count, status: "SYNCED" };
  } catch (err) {
    console.error("Sync transaction failed:", err);
    return { success: false, syncedCount: 0, status: "DISCONNECTED" };
  }
}

// Start periodic background sync worker (every 15 seconds)
export function startSyncWorker(onStatusChange?: (status: string) => void) {
  setInterval(async () => {
    const res = await syncSalesToCloud();
    if (onStatusChange) {
      onStatusChange(res.status);
    }
  }, 15000);
}
