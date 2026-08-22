import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, set, onValue } from 'firebase/database';
import { getUnsyncedSales, markSaleAsSynced, getAllProducts } from './db';
import { Product } from './types';

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
  // Only initialize if configuration credentials are provided and not already initialized
  if (firebaseConfig.apiKey && (firebaseConfig.projectId || firebaseConfig.databaseURL)) {
    if (getApps().length === 0) {
      const app = initializeApp(firebaseConfig);
      dbInstance = getDatabase(app);
      console.log("Firebase sync engine initialized successfully.");
    } else {
      dbInstance = getDatabase();
    }
  } else {
    console.log("Firebase credentials not configured. Running in Offline-Only Mode.");
  }
} catch (err) {
  console.error("Firebase failed to initialize (Offline Mode):", err);
}

export async function syncSalesToCloud(silent = false) {
  if (!dbInstance) {
    if (!silent) console.log("Sync skipped: Firebase DB offline (No .env credentials).");
    return { success: false, syncedCount: 0, status: "OFFLINE" };
  }

  try {
    const unsynced = getUnsyncedSales();
    if (unsynced.length === 0) {
      return { success: true, syncedCount: 0, status: "ONLINE" };
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
    return { success: true, syncedCount: count, status: "ONLINE" };
  } catch (err) {
    console.error("Sync transaction failed:", err);
    return { success: false, syncedCount: 0, status: "OFFLINE" };
  }
}

export async function syncProductsToCloud(silent = false) {
  if (!dbInstance) {
    if (!silent) console.log("Sync skipped: Firebase DB offline (No .env credentials).");
    return { success: false, status: "OFFLINE" };
  }

  try {
    const products = getAllProducts() as Product[];
    const productsRef = ref(dbInstance, 'products');
    
    const productsMap: Record<string, any> = {};
    for (const p of products) {
      productsMap[p.id] = {
        id: p.id,
        name: p.name,
        barcode: p.barcode,
        price: p.price,
        stock: p.stock,
        category: p.category,
        cost_price: p.cost_price || 0
      };
    }

    await set(productsRef, productsMap);
    console.log(`Successfully synced ${products.length} products to Firebase.`);
    return { success: true, status: "ONLINE" };
  } catch (err) {
    console.error("Sync products failed:", err);
    return { success: false, status: "OFFLINE" };
  }
}

// Start periodic background sync worker (every 15 seconds)
export function startSyncWorker(onStatusChange?: (status: string) => void) {
  if (dbInstance && onStatusChange) {
    const connectedRef = ref(dbInstance, ".info/connected");
    onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        console.log("Firebase status: Connected (Online)");
        onStatusChange("ONLINE");
        // Initial sync on connect/reconnect
        syncSalesToCloud();
        syncProductsToCloud();
      } else {
        console.log("Firebase status: Disconnected (Offline)");
        onStatusChange("OFFLINE");
      }
    });
  } else if (!dbInstance && onStatusChange) {
    onStatusChange("OFFLINE");
  }

  // Sync unsynced sales periodically in the background (every 60 seconds)
  setInterval(async () => {
    try {
      await syncSalesToCloud(true);
    } catch (err) {
      console.warn("Background sales sync error:", err);
    }
  }, 60000);
}
