import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, set, get, onValue } from 'firebase/database';
import { 
  getUnsyncedSales, 
  markSaleAsSynced, 
  upsertCloudSale,
  getAllProducts, 
  getAllExpenses, 
  getAllCustomers, 
  getAllVendors, 
  getAllPurchaseOrders,
  getAllCustomerKhataEntries,
  upsertCloudKhataEntry,
  recalculateAllCustomerBalances,
  clearAllKhataRecords,
  getProductByBarcode,
  addProduct,
  updateProduct,
  getCustomerByPhone,
  addCustomer,
  updateCustomer,
  upsertCustomer,
  addExpense,
  addVendor
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
    
    // Update individual products rather than wiping/overwriting the entire root node
    const updates: Record<string, any> = {};
    for (const p of products) {
      updates[p.id] = {
        id: p.id,
        name: p.name,
        barcode: p.barcode,
        price: p.price,
        stock: p.stock,
        category: p.category,
        cost_price: p.cost_price || 0
      };
    }

    await set(productsRef, updates);
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
    recalculateAllCustomerBalances();
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

export async function syncCustomerKhataToCloud(silent = false) {
  if (!dbInstance) return { success: false, status: "OFFLINE" };
  try {
    const entries = getAllCustomerKhataEntries();
    const khataMap: Record<string, Record<string, any>> = {};

    for (const e of entries) {
      if (!e || !e.customer_id) continue;
      const custKey = e.customer_id.toString();
      if (!khataMap[custKey]) {
        khataMap[custKey] = {};
      }
      const syncKey = e.sync_id || (e.id ? `khata_${e.id}` : `khata_${e.type}_${e.amount}_${e.timestamp}`);
      khataMap[custKey][syncKey] = {
        id: syncKey,
        sync_id: syncKey,
        customer_id: e.customer_id,
        sale_id: e.sale_id || null,
        type: e.type,
        amount: e.amount,
        notes: e.notes || '',
        payment_method: e.payment_method || (e.type === 'LOAN' ? 'Credit / Loan' : 'Cash'),
        timestamp: e.timestamp
      };
    }

    // Write exact synchronized map for each customer
    for (const [custId, entryDict] of Object.entries(khataMap)) {
      const custKhataRef = ref(dbInstance, `customer_khata/${custId}`);
      await set(custKhataRef, entryDict);
    }

    return { success: true, status: "ONLINE" };
  } catch (err) {
    console.error("Sync customer khata failed:", err);
    return { success: false, status: "OFFLINE" };
  }
}

export async function clearAllKhataFromCloudAndLocal() {
  clearAllKhataRecords();
  if (dbInstance) {
    try {
      await set(ref(dbInstance, 'customer_khata'), null);
      const custSnap = await get(ref(dbInstance, 'customers'));
      if (custSnap.exists()) {
        const val = custSnap.val();
        if (typeof val === 'object' && val !== null) {
          for (const key of Object.keys(val)) {
            await set(ref(dbInstance, `customers/${key}/balance`), 0);
          }
        }
      }
      return { success: true, message: 'All Khata records and balances cleared from cloud and local.' };
    } catch (err) {
      console.error('Failed to clear cloud khata:', err);
      return { success: false, error: String(err) };
    }
  }
  return { success: true, message: 'Cleared locally (offline).' };
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
        contact_person: po.vendor_name || '',
        phone: po.vendor_contact || '',
        status: po.status,
        total_cost: po.total_cost,
        total_amount: po.total_cost,
        paid_amount: po.paid_amount || 0,
        payment_status: po.payment_status || 'Unpaid',
        notes: po.notes || '',
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

// Ingest changes from Firebase Cloud into POS local SQLite database
async function ingestCloudDataToLocal() {
  if (!dbInstance) return;

  try {
    // 1. Ingest Products
    const productsSnap = await get(ref(dbInstance, 'products'));
    if (productsSnap.exists()) {
      const data = productsSnap.val();
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
    }

    // 2. Ingest Customers
    const customersSnap = await get(ref(dbInstance, 'customers'));
    if (customersSnap.exists()) {
      const data = customersSnap.val();
      const cloudCustomers = Array.isArray(data)
        ? data.filter(Boolean)
        : Object.entries(data).map(([k, v]: [string, any]) => ({ id: k, ...v }));

      for (const c of cloudCustomers as any[]) {
        if (!c || (!c.phone && !c.name)) continue;
        const custId = Number(c.id);
        const validId = !isNaN(custId) && custId > 0 ? custId : undefined;
        const cleanPhone = c.phone && String(c.phone).trim().length > 0 ? String(c.phone).trim() : undefined;

        try {
          upsertCustomer({
            id: validId,
            name: c.name || `Customer #${c.id}`,
            phone: cleanPhone,
            email: c.email || '',
            points: Number(c.points) || 0,
            balance: Number(c.balance) || 0
          });
        } catch (err) {
          console.warn(`Failed to upsert cloud customer #${c.id}:`, err);
        }
      }
    }

    // 3. Ingest Expenses
    const expensesSnap = await get(ref(dbInstance, 'expenses'));
    if (expensesSnap.exists()) {
      const data = expensesSnap.val();
      const expenses = Object.values(data);
      const localExpenses = getAllExpenses() as any[];
      const localMap = new Set(localExpenses.map(e => `${e.amount}-${e.description}-${e.timestamp?.substring(0, 16)}`));
      
      for (const exp of expenses as any[]) {
        if (!exp || !exp.amount) continue;
        const key = `${exp.amount}-${exp.description}-${exp.timestamp?.substring(0, 16)}`;
        if (!localMap.has(key)) {
          addExpense({
            amount: Number(exp.amount) || 0,
            description: exp.description || 'Mobile Expense',
            category: exp.category || 'General',
            loggedBy: exp.logged_by || 'Mobile Admin',
          });
        }
      }
    }

    // 4. Ingest Vendors & Purchase Orders
    const vendorsCloudSnap = await get(ref(dbInstance, 'vendors'));
    if (vendorsCloudSnap.exists()) {
      const vData = vendorsCloudSnap.val();
      const cloudVendors = Object.values(vData);
      const localVendors = getAllVendors() as any[];
      for (const cv of cloudVendors as any[]) {
        if (!cv || !cv.name) continue;
        const existing = localVendors.find(v => v.name?.toLowerCase() === cv.name?.toLowerCase());
        if (!existing) {
          addVendor({
            name: cv.name,
            contact: cv.contact || '',
            category: cv.category || 'General',
          });
        }
      }
    }

    const posSnap = await get(ref(dbInstance, 'purchase_orders'));
    if (posSnap.exists()) {
      const data = posSnap.val();
      const pos = Object.values(data);
      for (const po of pos as any[]) {
        if (!po || !po.vendor_name) continue;
        const existingVendors = getAllVendors() as any[];
        let vendor = existingVendors.find(v => v.name?.toLowerCase() === po.vendor_name?.toLowerCase());
        if (!vendor) {
          const newVId = addVendor({
            name: po.vendor_name,
            contact: po.phone || po.contact_person || '',
            category: 'General',
          });
          vendor = { id: newVId, name: po.vendor_name };
        }
      }
    }

    // 5. Ingest Sales (e.g. from Mobile POS)
    const salesSnap = await get(ref(dbInstance, 'sales'));
    if (salesSnap.exists()) {
      const sData = salesSnap.val();
      const cloudSales: any[] = [];
      if (Array.isArray(sData)) {
        for (let i = 0; i < sData.length; i++) {
          if (sData[i]) cloudSales.push({ id: i, ...sData[i] });
        }
      } else if (typeof sData === 'object' && sData !== null) {
        for (const [k, v] of Object.entries(sData)) {
          if (v && typeof v === 'object') {
            cloudSales.push({ id: (v as any).id || k, ...(v as any) });
          }
        }
      }

      for (const sale of cloudSales) {
        if (!sale || sale.id === undefined || sale.id === null) continue;
        try {
          upsertCloudSale(sale);
        } catch (err) {
          console.warn(`Failed to upsert cloud sale #${sale.id}:`, err);
        }
      }
    }

    // 6. Ingest Customer Khata / Udhaar Entries (e.g. from Mobile POS)
    const khataSnap = await get(ref(dbInstance, 'customer_khata'));
    if (khataSnap.exists()) {
      const kData = khataSnap.val();
      if (typeof kData === 'object' && kData !== null) {
        for (const [custId, entries] of Object.entries(kData)) {
          if (!entries || typeof entries !== 'object') continue;
          const entriesList = Array.isArray(entries) ? entries : Object.values(entries);
          for (const e of entriesList) {
            if (!e || typeof e !== 'object') continue;
            try {
              upsertCloudKhataEntry({ customer_id: custId, ...e });
            } catch (err) {
              console.warn(`Failed to upsert cloud khata entry for customer #${custId}:`, err);
            }
          }
        }
      }
      recalculateAllCustomerBalances();
    }
  } catch (err) {
    console.warn("Ingest cloud data to local error:", err);
  }
}

// Start periodic background sync worker & bidirectional realtime sync
export function startSyncWorker(onStatusChange?: (status: string) => void) {
  if (dbInstance && onStatusChange) {
    const connectedRef = ref(dbInstance, ".info/connected");
    onValue(connectedRef, async (snap) => {
      if (snap.val() === true) {
        console.log("Firebase status: Connected (Online)");
        onStatusChange("ONLINE");
        
        // Step 1: First ingest any changes created while mobile was offline / mobile was active
        await ingestCloudDataToLocal();

        // Step 2: Push merged state back to Firebase
        await syncSalesToCloud();
        await syncProductsToCloud();
        await syncExpensesToCloud();
        await syncCustomersToCloud();
        await syncCustomerKhataToCloud();
        await syncVendorsToCloud();
      } else {
        console.log("Firebase status: Disconnected (Offline)");
        onStatusChange("OFFLINE");
      }
    });

    // Realtime listeners for immediate updates from mobile
    try {
      onValue(ref(dbInstance, 'sales'), () => ingestCloudDataToLocal());
      onValue(ref(dbInstance, 'products'), () => ingestCloudDataToLocal());
      onValue(ref(dbInstance, 'customers'), () => ingestCloudDataToLocal());
      onValue(ref(dbInstance, 'customer_khata'), () => ingestCloudDataToLocal());
      onValue(ref(dbInstance, 'expenses'), () => ingestCloudDataToLocal());
      onValue(ref(dbInstance, 'vendors'), () => ingestCloudDataToLocal());
      onValue(ref(dbInstance, 'purchase_orders'), () => ingestCloudDataToLocal());
    } catch (e) {
      console.warn("Realtime cloud listener registration error:", e);
    }
  } else if (!dbInstance && onStatusChange) {
    onStatusChange("OFFLINE");
  }

  // Periodic background cloud push every 30 seconds
  setInterval(async () => {
    try {
      await ingestCloudDataToLocal();
      await syncSalesToCloud(true);
      await syncProductsToCloud(true);
      await syncExpensesToCloud(true);
      await syncCustomersToCloud(true);
      await syncCustomerKhataToCloud(true);
      await syncVendorsToCloud(true);
    } catch (err) {
      console.warn("Background cloud sync error:", err);
    }
  }, 30000);
}
