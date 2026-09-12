import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, set, update, get, onValue, Database } from 'firebase/database';
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
  deleteCustomerKhataBySyncId,
  recalculateAllCustomerBalances,
  clearAllKhataRecords,
  getProductByBarcode,
  addProduct,
  updateProduct,
  upsertCustomer,
  upsertExpense,
  addVendor,
  upsertCloudPurchaseOrder
} from './db';
import { Product, Expense, Customer, Vendor, PurchaseOrder, CustomerKhataEntry } from './types';

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

let dbInstance: Database | null = null;
let isIngesting = false;

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

    if (!silent) console.log(`Syncing ${unsynced.length} transaction(s) to Firebase...`);
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

    if (!silent) console.log(`Successfully synced ${count} transactions.`);
    return { success: true, syncedCount: count, status: "ONLINE" };
  } catch (err) {
    console.error("Sync transaction failed:", err);
    return { success: false, syncedCount: 0, status: "OFFLINE" };
  }
}

export async function deleteSaleFromCloud(saleId: number) {
  if (!dbInstance) return;
  try {
    await set(ref(dbInstance, `sales/${saleId}`), null);
  } catch (err) {
    console.warn(`Failed to delete sale #${saleId} from cloud:`, err);
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
    const updates: Record<string, unknown> = {};
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
  if (!dbInstance) {
    if (!silent) console.log("Sync skipped: Firebase DB offline (No .env credentials).");
    return { success: false, status: "OFFLINE" };
  }
  try {
    const expenses = getAllExpenses() as Expense[];
    const expensesRef = ref(dbInstance, 'expenses');
    const expensesMap: Record<string, unknown> = {};
    for (const e of expenses) {
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
  if (!dbInstance) {
    if (!silent) console.log("Sync skipped: Firebase DB offline (No .env credentials).");
    return { success: false, status: "OFFLINE" };
  }
  try {
    recalculateAllCustomerBalances();
    const customers = getAllCustomers() as Customer[];
    const updates: Record<string, unknown> = {};
    for (const c of customers) {
      updates[`customers/${c.id}`] = {
        id: c.id,
        name: c.name,
        phone: c.phone || '',
        email: c.email || '',
        points: c.points || 0,
        balance: c.balance || 0
      };
    }
    if (Object.keys(updates).length > 0) {
      await update(ref(dbInstance), updates);
    }
    return { success: true, status: "ONLINE" };
  } catch (err) {
    console.error("Sync customers failed:", err);
    return { success: false, status: "OFFLINE" };
  }
}

export async function syncCustomerKhataToCloud(silent = false) {
  if (!dbInstance) {
    if (!silent) console.log("Sync skipped: Firebase DB offline (No .env credentials).");
    return { success: false, status: "OFFLINE" };
  }
  try {
    const entries = getAllCustomerKhataEntries() as (CustomerKhataEntry & { sync_id?: string })[];
    const updates: Record<string, unknown> = {};

    // Fetch deleted khata keys to avoid re-uploading deleted items
    const deletedKeys: Set<string> = new Set();
    try {
      const delSnap = await get(ref(dbInstance, 'deleted_khata_entries'));
      if (delSnap.exists() && delSnap.val()) {
        const val = delSnap.val();
        if (typeof val === 'object' && val !== null) {
          for (const [cId, keysObj] of Object.entries(val)) {
            if (keysObj && typeof keysObj === 'object') {
              for (const k of Object.keys(keysObj)) {
                deletedKeys.add(k);
              }
            } else if (keysObj === true) {
              deletedKeys.add(cId);
            }
          }
        }
      }
    } catch (dErr) {
      console.warn("Could not check deleted_khata_entries:", dErr);
    }

    for (const e of entries) {
      if (!e || !e.customer_id) continue;
      const custKey = e.customer_id.toString();
      const syncKey = e.sync_id || (e.id ? `khata_${e.id}` : `khata_${e.type}_${e.amount}_${e.timestamp}`);
      
      // Never re-upload an entry that was marked deleted in cloud or local
      if (deletedKeys.has(syncKey) || (e.sync_id && deletedKeys.has(e.sync_id))) {
        continue;
      }
      
      updates[`customer_khata/${custKey}/${syncKey}`] = {
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

    if (Object.keys(updates).length > 0) {
      await update(ref(dbInstance), updates);
    }

    return { success: true, status: "ONLINE" };
  } catch (err) {
    console.error("Sync customer khata failed:", err);
    return { success: false, status: "OFFLINE" };
  }
}

export async function deleteCustomerKhataEntryFromCloud(customerId: number, syncId?: string) {
  if (!dbInstance) return;
  try {
    if (syncId) {
      // Remove from customer_khata and register tombstone in deleted_khata_entries
      await set(ref(dbInstance, `customer_khata/${customerId}/${syncId}`), null);
      await set(ref(dbInstance, `deleted_khata_entries/${customerId}/${syncId}`), true);
    }
  } catch (err) {
    console.warn("Delete khata entry from cloud warning:", err);
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
  if (!dbInstance) {
    if (!silent) console.log("Sync skipped: Firebase DB offline (No .env credentials).");
    return { success: false, status: "OFFLINE" };
  }
  try {
    const vendors = getAllVendors() as Vendor[];
    const pos = getAllPurchaseOrders() as PurchaseOrder[];
    const vendorsRef = ref(dbInstance, 'vendors');
    const posRef = ref(dbInstance, 'purchase_orders');

    const vMap: Record<string, unknown> = {};
    for (const v of vendors) {
      vMap[v.id] = {
        id: v.id,
        name: v.name,
        contact: v.contact || '',
        category: v.category || ''
      };
    }
    await set(vendorsRef, vMap);

    const poMap: Record<string, unknown> = {};
    for (const po of pos) {
      poMap[po.id] = {
        id: po.id,
        vendor_id: po.vendor_id,
        vendor_name: po.vendor_name,
        contact_person: po.vendor_name || '',
        phone: '',
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
  if (isIngesting) {
    return;
  }
  isIngesting = true;

  try {
    // 1. Ingest Products
    const productsSnap = await get(ref(dbInstance, 'products'));
    if (productsSnap.exists()) {
      const data = productsSnap.val();
      if (typeof data === 'object' && data !== null) {
        const products = Object.values(data);
        for (const p of products as Record<string, unknown>[]) {
          if (!p || typeof p !== 'object') continue;
          const barcode = typeof p.barcode === 'string' ? p.barcode : '';
          const name = typeof p.name === 'string' ? p.name : '';
          if (!barcode || !name) continue;

          const existing = getProductByBarcode(barcode) as Product | undefined;
          if (existing) {
            updateProduct(existing.id, {
              name,
              barcode,
              price: Number(p.price) || 0,
              stock: Number(p.stock) || 0,
              category: typeof p.category === 'string' ? p.category : 'General',
              cost_price: Number(p.cost_price) || 0,
            });
          } else {
            addProduct({
              name,
              barcode,
              price: Number(p.price) || 0,
              stock: Number(p.stock) || 0,
              category: typeof p.category === 'string' ? p.category : 'General',
              cost_price: Number(p.cost_price) || 0,
            });
          }
        }
      }
    }

    // 2. Ingest Customers
    const customersSnap = await get(ref(dbInstance, 'customers'));
    if (customersSnap.exists()) {
      const data = customersSnap.val();
      const cloudCustomers: Record<string, unknown>[] = Array.isArray(data)
        ? data.filter(Boolean)
        : (typeof data === 'object' && data !== null)
          ? Object.entries(data).map(([k, v]) => ({ id: k, ...(typeof v === 'object' && v !== null ? v : {}) }))
          : [];

      for (const c of cloudCustomers) {
        if (!c || (!c.phone && !c.name)) continue;
        const custId = Number(c.id);
        const validId = !isNaN(custId) && custId > 0 ? custId : undefined;
        const cleanPhone = c.phone && String(c.phone).trim().length > 0 ? String(c.phone).trim() : undefined;

        try {
          upsertCustomer({
            id: validId,
            name: typeof c.name === 'string' ? c.name : `Customer #${c.id}`,
            phone: cleanPhone,
            email: typeof c.email === 'string' ? c.email : '',
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
      if (typeof data === 'object' && data !== null) {
        const expenses = Object.values(data);
        const localExpenses = getAllExpenses() as Expense[];
        const localIdSet = new Set(localExpenses.map(e => e.id));
        const localMatchSet = new Set(localExpenses.map(e => `${e.amount}-${e.description?.trim().toLowerCase()}-${e.timestamp?.substring(0, 16)}`));
        
        for (const exp of expenses as Record<string, unknown>[]) {
          if (!exp || !exp.amount) continue;
          const expId = Number(exp.id);
          const hasValidId = !isNaN(expId) && expId > 0;
          const desc = typeof exp.description === 'string' ? exp.description : '';
          const timestamp = typeof exp.timestamp === 'string' ? exp.timestamp : '';
          const key = `${exp.amount}-${desc.trim().toLowerCase()}-${timestamp.substring(0, 16)}`;
          
          // If already exists locally by id or by exact details and timestamp, skip
          if (hasValidId && localIdSet.has(expId)) continue;
          if (localMatchSet.has(key)) continue;

          upsertExpense({
            id: hasValidId ? expId : undefined,
            amount: Number(exp.amount) || 0,
            description: desc || 'Mobile Expense',
            category: typeof exp.category === 'string' ? exp.category : 'General',
            loggedBy: typeof exp.logged_by === 'string' ? exp.logged_by : 'Mobile Admin',
            timestamp: timestamp || undefined,
          });

          if (hasValidId) localIdSet.add(expId);
          localMatchSet.add(key);
        }
      }
    }

    // 4. Ingest Vendors & Purchase Orders
    const vendorsCloudSnap = await get(ref(dbInstance, 'vendors'));
    if (vendorsCloudSnap.exists()) {
      const vData = vendorsCloudSnap.val();
      if (typeof vData === 'object' && vData !== null) {
        const cloudVendors = Object.values(vData);
        const localVendors = getAllVendors() as Vendor[];
        for (const cv of cloudVendors as Record<string, unknown>[]) {
          if (!cv || !cv.name) continue;
          const vName = String(cv.name);
          const existing = localVendors.find(v => v.name?.toLowerCase() === vName.toLowerCase());
          if (!existing) {
            addVendor({
              name: vName,
              contact: typeof cv.contact === 'string' ? cv.contact : '',
              category: typeof cv.category === 'string' ? cv.category : 'General',
            });
          }
        }
      }
    }

    const posSnap = await get(ref(dbInstance, 'purchase_orders'));
    if (posSnap.exists()) {
      const data = posSnap.val();
      if (typeof data === 'object' && data !== null) {
        const pos = Object.values(data);
        for (const po of pos as Record<string, unknown>[]) {
          if (!po || !po.vendor_name) continue;
          try {
            upsertCloudPurchaseOrder(po);
          } catch (err) {
            console.warn(`Failed to upsert cloud PO for vendor ${po.vendor_name}:`, err);
          }
        }
      }
    }

    // 5. Ingest Sales (e.g. from Mobile POS)
    const salesSnap = await get(ref(dbInstance, 'sales'));
    if (salesSnap.exists()) {
      const sData = salesSnap.val();
      const cloudSales: Record<string, unknown>[] = [];
      if (Array.isArray(sData)) {
        for (let i = 0; i < sData.length; i++) {
          if (sData[i]) cloudSales.push({ id: i, ...sData[i] });
        }
      } else if (typeof sData === 'object' && sData !== null) {
        for (const [k, v] of Object.entries(sData)) {
          if (v && typeof v === 'object') {
            cloudSales.push({ id: (v as Record<string, unknown>).id || k, ...(v as Record<string, unknown>) });
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
    // First, process any deleted khata entries from cloud tombstones
    try {
      const delKhataSnap = await get(ref(dbInstance, 'deleted_khata_entries'));
      if (delKhataSnap.exists() && delKhataSnap.val()) {
        const delVal = delKhataSnap.val();
        if (typeof delVal === 'object' && delVal !== null) {
          for (const [cId, keys] of Object.entries(delVal)) {
            if (keys && typeof keys === 'object') {
              for (const k of Object.keys(keys)) {
                deleteCustomerKhataBySyncId(k);
              }
            } else if (keys === true) {
              deleteCustomerKhataBySyncId(cId);
            }
          }
        }
      }
    } catch (dErr) {
      console.warn("Failed to process cloud deleted khata entries:", dErr);
    }

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
              upsertCloudKhataEntry({ customer_id: Number(custId) || custId, ...e });
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
  } finally {
    isIngesting = false;
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
      // Debounced cloud ingestion to prevent continuous memory allocations
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      const triggerDebouncedIngest = () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          ingestCloudDataToLocal().catch(err => console.warn("Debounced ingest error:", err));
        }, 1200);
      };

      onValue(ref(dbInstance, 'sales'), triggerDebouncedIngest);
      onValue(ref(dbInstance, 'products'), triggerDebouncedIngest);
      onValue(ref(dbInstance, 'customers'), triggerDebouncedIngest);
      onValue(ref(dbInstance, 'customer_khata'), triggerDebouncedIngest);
      onValue(ref(dbInstance, 'deleted_khata_entries'), triggerDebouncedIngest);
      onValue(ref(dbInstance, 'expenses'), triggerDebouncedIngest);
      onValue(ref(dbInstance, 'vendors'), triggerDebouncedIngest);
      onValue(ref(dbInstance, 'purchase_orders'), triggerDebouncedIngest);

      // Realtime listener for Remote Print Requests sent from Mobile POS
      onValue(ref(dbInstance, 'print_requests'), async (snap) => {
        if (!snap.exists() || !snap.val()) return;
        const requests = snap.val();
        if (typeof requests !== 'object') return;

        for (const [key, req] of Object.entries(requests)) {
          const printJob = req as { status?: string; items?: { name?: string; qty?: number; price?: number }[]; payment?: { cashierName?: string }; sale_id?: number };
          if (printJob && printJob.status === 'PENDING') {
            try {
              // Import printer dynamically to avoid circular dependencies
              const { printReceipt } = await import('./printer');
              const items = Array.isArray(printJob.items) ? printJob.items : [];
              const payment = printJob.payment || {};
              const saleId = printJob.sale_id;
              const cashierName = payment.cashierName || 'Mobile Cashier';

              console.log(`[Remote Print] Printing receipt for Sale #${saleId} requested from mobile...`);
              await printReceipt(items, payment, saleId, cashierName);

              // Mark print job as COMPLETED and remove from queue
              if (dbInstance) {
                await set(ref(dbInstance, `print_requests/${key}`), null);
              }
            } catch (pErr) {
              console.error(`[Remote Print] Failed to print receipt for job ${key}:`, pErr);
              if (dbInstance) {
                await set(ref(dbInstance, `print_requests/${key}/status`), 'FAILED');
              }
            }
          }
        }
      });
    } catch (e) {
      console.warn("Realtime cloud listener registration error:", e);
    }
  } else if (!dbInstance && onStatusChange) {
    onStatusChange("OFFLINE");
  }

  // Periodic background cloud push every 45 seconds (lightweight schedule)
  setInterval(async () => {
    try {
      await syncSalesToCloud(true);
      await syncProductsToCloud(true);
      await syncExpensesToCloud(true);
      await syncCustomersToCloud(true);
      await syncCustomerKhataToCloud(true);
      await syncVendorsToCloud(true);
    } catch (err) {
      console.warn("Background cloud sync error:", err);
    }
  }, 45000);
}
