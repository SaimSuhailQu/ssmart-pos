import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, set, onValue } from 'firebase/database';
import { 
  getUnsyncedSales, 
  markSaleAsSynced, 
  getAllProducts, 
  getAllExpenses, 
  getAllCustomers, 
  getAllVendors, 
  getAllPurchaseOrders,
  getProductByBarcode,
  addProduct,
  updateProduct,
  getCustomerByPhone,
  addCustomer,
  updateCustomer
} from './db';
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

export async function syncExpensesToCloud(silent = false) {
  if (!dbInstance) return { success: false, status: "OFFLINE" };
  try {
    const expenses = getAllExpenses();
    const expensesRef = ref(dbInstance, 'expenses');
    const expensesMap: Record<string, any> = {};
    for (const e of expenses as any[]) {
      expensesMap[e.id] = {
        id: e.id,
        amount: e.amount,
        description: e.description,
        category: e.category,
        logged_by: e.logged_by,
        timestamp: e.timestamp
      };
    }
    await set(expensesRef, expensesMap);
    return { success: true, status: "ONLINE" };
  } catch (err) {
    console.error("Sync expenses failed:", err);
    return { success: false, status: "OFFLINE" };
  }
}

export async function syncCustomersToCloud(silent = false) {
  if (!dbInstance) return { success: false, status: "OFFLINE" };
  try {
    const customers = getAllCustomers();
    const customersRef = ref(dbInstance, 'customers');
    const custMap: Record<string, any> = {};
    for (const c of customers as any[]) {
      custMap[c.id] = {
        id: c.id,
        name: c.name,
        phone: c.phone || '',
        email: c.email || '',
        points: c.points || 0,
        balance: c.balance || 0
      };
    }
    await set(customersRef, custMap);
    return { success: true, status: "ONLINE" };
  } catch (err) {
    console.error("Sync customers failed:", err);
    return { success: false, status: "OFFLINE" };
  }
}

export async function syncVendorsToCloud(silent = false) {
  if (!dbInstance) return { success: false, status: "OFFLINE" };
  try {
    const vendors = getAllVendors();
    const pos = getAllPurchaseOrders();
    const vendorsRef = ref(dbInstance, 'vendors');
    const posRef = ref(dbInstance, 'purchase_orders');

    const vMap: Record<string, any> = {};
    for (const v of vendors as any[]) {
      vMap[v.id] = {
        id: v.id,
        name: v.name,
        contact: v.contact || '',
        category: v.category || ''
      };
    }
    await set(vendorsRef, vMap);

    const poMap: Record<string, any> = {};
    for (const po of pos as any[]) {
      poMap[po.id] = {
        id: po.id,
        vendor_id: po.vendor_id,
        vendor_name: po.vendor_name,
        status: po.status,
        total_cost: po.total_cost,
        paid_amount: po.paid_amount || 0,
        payment_status: po.payment_status || 'Unpaid',
        timestamp: po.timestamp,
        items: po.items || [],
        payments: po.payments || [],
        order_entries: po.order_entries || []
      };
    }
    await set(posRef, poMap);

    return { success: true, status: "ONLINE" };
  } catch (err) {
    console.error("Sync vendors failed:", err);
    return { success: false, status: "OFFLINE" };
  }
}

// Start periodic background sync worker & bidirectional realtime sync
export function startSyncWorker(onStatusChange?: (status: string) => void) {
  if (dbInstance && onStatusChange) {
    const connectedRef = ref(dbInstance, ".info/connected");
    onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        console.log("Firebase status: Connected (Online)");
        onStatusChange("ONLINE");
        // Initial full sync on connect/reconnect
        syncSalesToCloud();
        syncProductsToCloud();
        syncExpensesToCloud();
        syncCustomersToCloud();
        syncVendorsToCloud();
      } else {
        console.log("Firebase status: Disconnected (Offline)");
        onStatusChange("OFFLINE");
      }
    });

    // --- Bidirectional Sync: Listen for Mobile Updates in Real-time ---
    try {
      // 1. Mobile Products Updates -> Local SQLite
      onValue(ref(dbInstance, 'products'), (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
        const products = Object.values(data);
        for (const p of products as any[]) {
          if (!p || !p.barcode || !p.name) continue;
          const existing = getProductByBarcode(p.barcode) as any;
          if (existing) {
            updateProduct(existing.id, {
              name: p.name,
              barcode: p.barcode,
              price: Number(p.price) || 0,
              stock: Number(p.stock) || 0,
              category: p.category || 'General',
              cost_price: Number(p.cost_price) || 0,
            });
          } else {
            addProduct({
              name: p.name,
              barcode: p.barcode,
              price: Number(p.price) || 0,
              stock: Number(p.stock) || 0,
              category: p.category || 'General',
              cost_price: Number(p.cost_price) || 0,
            });
          }
        }
      });

      // 2. Mobile Customers Updates -> Local SQLite
      onValue(ref(dbInstance, 'customers'), (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
        const customers = Object.values(data);
        for (const c of customers as any[]) {
          if (!c || !c.phone) continue;
          const existing = getCustomerByPhone(c.phone) as any;
          if (existing) {
            updateCustomer(existing.id, {
              name: c.name || existing.name,
              phone: c.phone,
              email: c.email || '',
              points: Number(c.points) || 0,
            });
          } else if (c.name) {
            addCustomer({
              name: c.name,
              phone: c.phone,
              email: c.email || '',
              points: Number(c.points) || 0,
            });
          }
        }
      });
    } catch (e) {
      console.warn("Realtime cloud listener registration error:", e);
    }
  } else if (!dbInstance && onStatusChange) {
    onStatusChange("OFFLINE");
  }

  // Periodic background cloud push every 30 seconds
  setInterval(async () => {
    try {
      await syncSalesToCloud(true);
      await syncProductsToCloud(true);
      await syncExpensesToCloud(true);
      await syncCustomersToCloud(true);
      await syncVendorsToCloud(true);
    } catch (err) {
      console.warn("Background cloud sync error:", err);
    }
  }, 30000);
}
