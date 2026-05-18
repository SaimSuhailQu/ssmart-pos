import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, set } from 'firebase/database';
import { getUnsyncedSales, markSaleAsSynced } from './db';

// Default / fallback Firebase configuration so the app never crashes
const firebaseConfig = {
  apiKey: "AIzaSyBBXuvZ1GCj9v-ZfgIFdmxT7fqBck1GJ6c",
  authDomain: "ssmart-c6e43.firebaseapp.com",
  databaseURL: "https://ssmart-c6e43-default-rtdb.firebaseio.com/",
  projectId: "ssmart-c6e43",
  storageBucket: "ssmart-c6e43.firebasestorage.app",
  messagingSenderId: "3113728357",
  appId: "1:3113728357:web:9f26cd9bf162ab9f60c98c",
  measurementId: "G-9LVJLM3R6H"
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
