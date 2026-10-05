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
  upsertCloudPurchaseOrder,
  checkpointDb
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
let isSyncing = false;

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

// ============================================================================
// Multi-tenant cloud routing
//
// tenantPrefix is '' for the seller/master device so its existing data stays at
// the legacy root paths (never moved or duplicated). Sold copies are routed to
// `tenants/<id>/...`. main.ts calls setTenant() with the value resolved during
// the device license check, BEFORE the sync worker starts.
// See docs/LICENSING_AND_CLOUD_PLAN.md §3.
// ============================================================================

let tenantPrefix = '';
let activeTenantId: string | null = null;

/** Prefix a root-relative cloud path with the active tenant, when one is set. */
function cp(path: string): string {
  return tenantPrefix ? `${tenantPrefix}/${path}` : path;
}

export function getActiveTenant(): string | null {
  return activeTenantId;
}

// ============================================================================
// Change Detection Utilities (stable stringify + FNV-1a hash)
// ============================================================================

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') return isFinite(value) ? String(value) : 'null';
  if (typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    let out = '[';
    for (let i = 0; i < value.length; i++) {
      if (i > 0) out += ',';
      out += stableStringify(value[i]);
    }
    return out + ']';
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).filter(k => (value as Record<string, unknown>)[k] !== undefined).sort();
    let out = '{';
    let first = true;
    for (const k of keys) {
      const v = (value as Record<string, unknown>)[k];
      if (v === undefined) continue;
      if (!first) out += ',';
      first = false;
      out += `${JSON.stringify(k)}:${stableStringify(v)}`;
    }
    return out + '}';
  }
  return 'null';
}

function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function hashValue(value: unknown): number {
  return fnv1a(stableStringify(value));
}

function combineHashes(map: Map<string, number>): number {
  const keys = Array.from(map.keys()).sort();
  let combined = 0x811c9dc5;
  for (const k of keys) {
    combined ^= fnv1a(`${k}:${map.get(k)}`);
    combined = Math.imul(combined, 0x01000193);
  }
  return combined >>> 0;
}

// ============================================================================
// Delta Sync Engine — only pushes keys whose content actually changed.
// lastPushedItemHashes doubles as the known cloud key set per collection.
// ============================================================================

const lastPushedItemHashes = new Map<string, Map<string, number>>();
const lastPushedNodeHash = new Map<string, number>();
const CHUNK_SIZE = 250;

type RowSerializer<T> = (row: T) => Record<string, unknown> | null;

/**
 * Diff-based push: uploads ONLY added/updated keys, deletes cloud keys missing
 * locally (when deleteMissing). Skips the network entirely when nothing changed.
 */
async function pushDelta<T>(
  collection: string,
  cloudPath: string,
  rows: T[],
  getKey: (row: T) => string,
  serialize: RowSerializer<T>,
  opts: { deleteMissing?: boolean } = {}
): Promise<number> {
  if (!dbInstance) return 0;

  const localHashes = new Map<string, number>();
  const payloads = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const key = getKey(row);
    if (!key) continue;
    const payload = serialize(row);
    if (!payload) continue;
    payloads.set(key, payload);
    localHashes.set(key, hashValue(payload));
  }

  const nodeHash = combineHashes(localHashes);
  if (lastPushedNodeHash.get(collection) === nodeHash && lastPushedItemHashes.has(collection)) {
    return 0; // Nothing changed since our last successful push — zero network cost.
  }

  let cloudHashes = lastPushedItemHashes.get(collection);
  if (!cloudHashes) {
    // First pass after startup: learn current cloud keys (single read, then deltas only).
    try {
      const snap = await get(ref(dbInstance, cloudPath));
      cloudHashes = new Map<string, number>();
      if (snap.exists() && snap.val() && typeof snap.val() === 'object') {
        for (const [k, v] of Object.entries(snap.val() as Record<string, unknown>)) {
          if (v !== null && typeof v === 'object') {
            cloudHashes.set(k, hashValue(v));
          }
        }
      }
    } catch (err) {
      console.warn(`[${collection}] Could not read cloud snapshot for delta baseline:`, err);
      return 0;
    }
  }

  const updates: Record<string, unknown> = {};
  for (const [key, payload] of payloads) {
    if (cloudHashes.get(key) !== localHashes.get(key)) {
      updates[`${cloudPath}/${key}`] = payload;
    }
  }
  if (opts.deleteMissing) {
    for (const key of cloudHashes.keys()) {
      if (!payloads.has(key)) {
        updates[`${cloudPath}/${key}`] = null;
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    lastPushedItemHashes.set(collection, localHashes);
    lastPushedNodeHash.set(collection, nodeHash);
    return 0;
  }

  const keys = Object.keys(updates);
  for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
    const chunk: Record<string, unknown> = {};
    for (const k of keys.slice(i, i + CHUNK_SIZE)) {
      chunk[k] = updates[k];
    }
    await update(ref(dbInstance), chunk);
  }

  lastPushedItemHashes.set(collection, localHashes);
  lastPushedNodeHash.set(collection, nodeHash);
  console.log(`[${collection}] Delta sync pushed ${keys.length} change(s).`);
  return keys.length;
}

// ============================================================================
// Cloud Push Operations (all delta-based)
// ============================================================================

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

    // Batch sales into chunked multi-path updates (one round-trip per chunk)
    for (let i = 0; i < unsynced.length; i += CHUNK_SIZE) {
      const chunk = unsynced.slice(i, i + CHUNK_SIZE);
      const updates: Record<string, unknown> = {};
      for (const sale of chunk) {
        updates[cp(`sales/${sale.id}`)] = {
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
        };
      }
      await update(ref(dbInstance), updates);
      for (const sale of chunk) {
        markSaleAsSynced(sale.id);
        count++;
      }
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
    await set(ref(dbInstance, cp(`sales/${saleId}`)), null);
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
    await pushDelta(
      'products',
      cp('products'),
      products,
      (p) => String(p.id),
      (p) => ({
        id: p.id,
        name: p.name,
        barcode: p.barcode,
        price: p.price,
        stock: p.stock,
        category: p.category,
        cost_price: p.cost_price || 0
      }),
      { deleteMissing: true }
    );
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
    await pushDelta(
      'expenses',
      cp('expenses'),
      expenses,
      (e) => String(e.id),
      (e) => ({
        id: e.id,
        amount: e.amount,
        description: e.description,
        category: e.category,
        logged_by: e.logged_by,
        timestamp: e.timestamp
      }),
      { deleteMissing: true }
    );
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
    await pushDelta(
      'customers',
      cp('customers'),
      customers,
      (c) => String(c.id),
      (c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone || '',
        email: c.email || '',
        points: c.points || 0,
        balance: c.balance || 0
      }),
      { deleteMissing: false }
    );
    return { success: true, status: "ONLINE" };
  } catch (err) {
    console.error("Sync customers failed:", err);
    return { success: false, status: "OFFLINE" };
  }
}

const inFlightSyncs = new Set<string>();

export async function syncCustomerKhataToCloud(silent = false) {
  if (!dbInstance) {
    if (!silent) console.log("Sync skipped: Firebase DB offline (No .env credentials).");
    return { success: false, status: "OFFLINE" };
  }
  if (inFlightSyncs.has('khata')) {
    return { success: true, status: "ONLINE" };
  }
  inFlightSyncs.add('khata');
  try {
    const entries = getAllCustomerKhataEntries() as (CustomerKhataEntry & { sync_id?: string })[];

    if (entries.length === 0) {
      return { success: true, status: "ONLINE" };
    }

    // Fetch deleted khata keys (tombstones) to avoid re-uploading deleted items.
    // Cached for 60s to avoid a read on every sync cycle.
    const deletedKeys: Set<string> = new Set();
    try {
      const delSnap = await get(ref(dbInstance, cp('deleted_khata_entries')));
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

    // Delta push keyed by cloud path (customer_khata/<cid>/<syncKey>)
    const localHashes = new Map<string, number>();
    const payloads = new Map<string, Record<string, unknown>>();
    for (const e of entries) {
      if (!e || !e.customer_id) continue;
      const custKey = e.customer_id.toString();
      const syncKey = e.sync_id || (e.id ? `khata_${e.id}` : `khata_${e.type}_${e.amount}_${e.timestamp}`);

      // Never re-upload an entry that was marked deleted in cloud or local
      if (deletedKeys.has(syncKey) || (e.sync_id && deletedKeys.has(e.sync_id))) continue;

      const cloudKey = cp(`customer_khata/${custKey}/${syncKey}`);
      payloads.set(cloudKey, {
        id: syncKey,
        sync_id: syncKey,
        customer_id: e.customer_id,
        sale_id: e.sale_id || null,
        type: e.type,
        amount: e.amount,
        notes: e.notes || '',
        payment_method: e.payment_method || (e.type === 'LOAN' ? 'Credit / Loan' : 'Cash'),
        timestamp: e.timestamp
      });
      localHashes.set(cloudKey, hashValue(payloads.get(cloudKey)));
    }

    // Compare against cloud state (fetch once per cycle is acceptable here because
    // tombstones above already require a read; hash comparison keeps writes minimal)
    const khataSnap = await get(ref(dbInstance, cp('customer_khata')));
    const cloudHashes = new Map<string, number>();
    if (khataSnap.exists() && khataSnap.val() && typeof khataSnap.val() === 'object') {
      const kData = khataSnap.val() as Record<string, Record<string, unknown>>;
      for (const [custId, entriesMap] of Object.entries(kData)) {
        if (!entriesMap || typeof entriesMap !== 'object') continue;
        for (const [k, v] of Object.entries(entriesMap)) {
          if (v !== null && typeof v === 'object') {
            cloudHashes.set(cp(`customer_khata/${custId}/${k}`), hashValue(v));
          }
        }
      }
    }

    const updates: Record<string, unknown> = {};
    for (const [key, payload] of payloads) {
      if (cloudHashes.get(key) !== localHashes.get(key)) {
        updates[key] = payload;
      }
    }

    if (Object.keys(updates).length > 0) {
      const keys = Object.keys(updates);
      for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
        const chunk: Record<string, unknown> = {};
        for (const k of keys.slice(i, i + CHUNK_SIZE)) chunk[k] = updates[k];
        await update(ref(dbInstance), chunk);
      }
      console.log(`[khata] Delta sync pushed ${keys.length} change(s).`);
    }

    return { success: true, status: "ONLINE" };
  } catch (err) {
    console.error("Sync customer khata failed:", err);
    return { success: false, status: "OFFLINE" };
  } finally {
    inFlightSyncs.delete('khata');
  }
}

export async function deleteCustomerKhataEntryFromCloud(customerId: number, syncId?: string) {
  if (!dbInstance) return;
  try {
    if (syncId) {
      // Remove from customer_khata and register tombstone in deleted_khata_entries
      await set(ref(dbInstance, cp(`customer_khata/${customerId}/${syncId}`)), null);
      await set(ref(dbInstance, cp(`deleted_khata_entries/${customerId}/${syncId}`)), true);
    }
  } catch (err) {
    console.warn("Delete khata entry from cloud warning:", err);
  }
}

export async function clearAllKhataFromCloudAndLocal() {
  clearAllKhataRecords();
  if (dbInstance) {
    try {
      await set(ref(dbInstance, cp('customer_khata')), null);
      const custSnap = await get(ref(dbInstance, cp('customers')));
      if (custSnap.exists()) {
        const val = custSnap.val();
        if (typeof val === 'object' && val !== null) {
          for (const key of Object.keys(val)) {
            await set(ref(dbInstance, cp(`customers/${key}/balance`)), 0);
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
    await pushDelta(
      'vendors',
      cp('vendors'),
      vendors,
      (v) => String(v.id),
      (v) => ({
        id: v.id,
        name: v.name,
        contact: v.contact || '',
        category: v.category || ''
      }),
      { deleteMissing: true }
    );

    const pos = getAllPurchaseOrders() as PurchaseOrder[];
    await pushDelta(
      'purchase_orders',
      cp('purchase_orders'),
      pos,
      (po) => String(po.id),
      (po) => ({
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
        bill_url: po.bill_url || '',
        timestamp: po.timestamp,
        items: po.items || [],
        payments: po.payments || [],
        order_entries: po.order_entries || []
      }),
      { deleteMissing: true }
    );

    return { success: true, status: "ONLINE" };
  } catch (err) {
    console.error("Sync vendors failed:", err);
    return { success: false, status: "OFFLINE" };
  }
}

// ============================================================================
// Cloud → Local Ingestion (per-node, hash-deduplicated, event-driven)
// ============================================================================

const lastIngestHash = new Map<string, number>();

/**
 * Route every cloud read/write through the active tenant.
 *
 * Passing null/undefined restores the legacy root (the seller's own data). All
 * delta caches are cleared because every cloud path changes with the tenant.
 */
export function setTenant(tenantId: string | null | undefined): void {
  const nextId = tenantId && tenantId.trim().length > 0 ? tenantId.trim() : null;
  if (nextId === activeTenantId) return;
  activeTenantId = nextId;
  tenantPrefix = nextId ? `tenants/${nextId}` : '';
  lastPushedItemHashes.clear();
  lastPushedNodeHash.clear();
  lastIngestHash.clear();
  console.log(`[Sync] Tenant routing: ${nextId ? `tenants/${nextId}` : 'legacy root (master)'}`);
}

/** Ingest a single cloud node only if its content actually changed since last time. */
async function ingestNode(name: string, path: string, handler: (val: unknown) => void | Promise<void>) {
  if (!dbInstance) return;
  try {
    const snap = await get(ref(dbInstance, path));
    const raw = snap.exists() ? snap.val() : null;
    const h = raw !== null && typeof raw === 'object' ? hashValue(raw) : fnv1a(String(raw));
    if (lastIngestHash.get(name) === h) return; // No change (includes our own echo writes)
    lastIngestHash.set(name, h);
    await handler(raw);
  } catch (err) {
    console.warn(`Ingest [${name}] error:`, err);
  }
}

function ingestProducts(raw: unknown) {
  if (!raw || typeof raw !== 'object') return;
  const products = Object.values(raw as Record<string, unknown>);
  for (const p of products) {
    if (!p || typeof p !== 'object') continue;
    const rec = p as Record<string, unknown>;
    const barcode = typeof rec.barcode === 'string' ? rec.barcode : '';
    const name = typeof rec.name === 'string' ? rec.name : '';
    if (!barcode || !name) continue;

    const existing = getProductByBarcode(barcode) as Product | undefined;
    const cloudData = {
      name,
      barcode,
      price: Number(rec.price) || 0,
      stock: Number(rec.stock) || 0,
      category: typeof rec.category === 'string' ? rec.category : 'General',
      cost_price: Number(rec.cost_price) || 0,
    };
    if (existing) {
      const identical =
        existing.name === cloudData.name &&
        existing.price === cloudData.price &&
        existing.stock === cloudData.stock &&
        existing.category === cloudData.category &&
        (existing.cost_price || 0) === cloudData.cost_price;
      if (!identical) updateProduct(existing.id, cloudData);
    } else {
      addProduct(cloudData);
    }
  }
}

function ingestCustomers(raw: unknown) {
  if (!raw || typeof raw !== 'object') return;
  const cloudCustomers: Record<string, unknown>[] = Array.isArray(raw)
    ? raw.filter(Boolean)
    : Object.entries(raw as Record<string, unknown>).map(([k, v]) => ({ id: k, ...(typeof v === 'object' && v !== null ? v : {}) }));

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

function ingestExpenses(raw: unknown) {
  if (!raw || typeof raw !== 'object') return;
  const expenses = Object.values(raw as Record<string, unknown>);
  const localExpenses = getAllExpenses() as Expense[];
  const localIdSet = new Set(localExpenses.map(e => e.id));
  const localMatchSet = new Set(localExpenses.map(e => `${e.amount}-${e.description?.trim().toLowerCase()}-${e.timestamp?.substring(0, 16)}`));

  for (const exp of expenses) {
    if (!exp || typeof exp !== 'object') continue;
    const rec = exp as Record<string, unknown>;
    if (!rec.amount) continue;
    const expId = Number(rec.id);
    const hasValidId = !isNaN(expId) && expId > 0;
    const desc = typeof rec.description === 'string' ? rec.description : '';
    const timestamp = typeof rec.timestamp === 'string' ? rec.timestamp : '';
    const key = `${Number(rec.amount)}-${desc.trim().toLowerCase()}-${timestamp.substring(0, 16)}`;

    // If already exists locally by id or by exact details and timestamp, skip
    if (hasValidId && localIdSet.has(expId)) continue;
    if (localMatchSet.has(key)) continue;

    upsertExpense({
      id: hasValidId ? expId : undefined,
      amount: Number(rec.amount) || 0,
      description: desc || 'Mobile Expense',
      category: typeof rec.category === 'string' ? rec.category : 'General',
      loggedBy: typeof rec.logged_by === 'string' ? rec.logged_by : 'Mobile Admin',
      timestamp: timestamp || undefined,
    });

    if (hasValidId) localIdSet.add(expId);
    localMatchSet.add(key);
  }
}

function ingestVendors(raw: unknown) {
  if (!raw || typeof raw !== 'object') return;
  const cloudVendors = Object.values(raw as Record<string, unknown>);
  const localVendors = getAllVendors() as Vendor[];
  const localNameSet = new Set(localVendors.map(v => v.name?.toLowerCase()));
  for (const cv of cloudVendors) {
    if (!cv || typeof cv !== 'object') continue;
    const rec = cv as Record<string, unknown>;
    if (!rec.name) continue;
    const vName = String(rec.name);
    if (localNameSet.has(vName.toLowerCase())) continue;
    addVendor({
      name: vName,
      contact: typeof rec.contact === 'string' ? rec.contact : '',
      category: typeof rec.category === 'string' ? rec.category : 'General',
    });
    localNameSet.add(vName.toLowerCase());
  }
}

function ingestPurchaseOrders(raw: unknown) {
  if (!raw || typeof raw !== 'object') return;
  const pos = Object.values(raw as Record<string, unknown>);
  for (const po of pos) {
    if (!po || typeof po !== 'object') continue;
    const rec = po as Record<string, unknown>;
    if (!rec.vendor_name) continue;
    try {
      upsertCloudPurchaseOrder(rec);
    } catch (err) {
      console.warn(`Failed to upsert cloud PO for vendor ${rec.vendor_name}:`, err);
    }
  }
}

function ingestSales(raw: unknown) {
  if (!raw || typeof raw !== 'object') return;
  const cloudSales: Record<string, unknown>[] = [];
  if (Array.isArray(raw)) {
    for (let i = 0; i < raw.length; i++) {
      if (raw[i]) cloudSales.push({ id: i, ...(raw[i] as Record<string, unknown>) });
    }
  } else {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
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

function ingestKhata(raw: unknown) {
  if (!raw || typeof raw !== 'object') return;
  for (const [custId, entries] of Object.entries(raw as Record<string, unknown>)) {
    if (!entries || typeof entries !== 'object') continue;
    const entriesList = Array.isArray(entries) ? entries : Object.values(entries as Record<string, unknown>);
    for (const e of entriesList) {
      if (!e || typeof e !== 'object') continue;
      try {
        upsertCloudKhataEntry({ customer_id: Number(custId) || custId, ...(e as Record<string, unknown>) });
      } catch (err) {
        console.warn(`Failed to upsert cloud khata entry for customer #${custId}:`, err);
      }
    }
  }
  recalculateAllCustomerBalances();
}

async function processDeletedKhataTombstones() {
  if (!dbInstance) return;
  try {
    const delKhataSnap = await get(ref(dbInstance, cp('deleted_khata_entries')));
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
}

/** Full bidirectional pass: ingest everything that changed, then push local deltas. */
async function runFullSyncPass() {
  if (!dbInstance || isSyncing) return;
  isSyncing = true;
  try {
    await ingestNode('products', cp('products'), ingestProducts);
    await ingestNode('customers', cp('customers'), ingestCustomers);
    await ingestNode('expenses', cp('expenses'), ingestExpenses);
    await ingestNode('vendors', cp('vendors'), ingestVendors);
    await ingestNode('purchase_orders', cp('purchase_orders'), ingestPurchaseOrders);
    await ingestNode('sales', cp('sales'), ingestSales);
    await processDeletedKhataTombstones();
    await ingestNode('customer_khata', cp('customer_khata'), ingestKhata);

    // Push merged local state back (each is a no-op network-wise when unchanged)
    await syncSalesToCloud(true);
    await syncProductsToCloud(true);
    await syncExpensesToCloud(true);
    await syncCustomersToCloud(true);
    await syncCustomerKhataToCloud(true);
    await syncVendorsToCloud(true);
  } catch (err) {
    console.warn("Full sync pass error:", err);
  } finally {
    isSyncing = false;
  }
}

// ============================================================================
// Worker Startup
// ============================================================================

// Start periodic background sync worker & bidirectional realtime sync
export function startSyncWorker(onStatusChange?: (status: string) => void) {
  if (dbInstance && onStatusChange) {
    const connectedRef = ref(dbInstance, ".info/connected");
    onValue(connectedRef, async (snap) => {
      if (snap.val() === true) {
        console.log("Firebase status: Connected (Online)");
        onStatusChange("ONLINE");
        await runFullSyncPass();
      } else {
        console.log("Firebase status: Disconnected (Offline)");
        onStatusChange("OFFLINE");
      }
    });

    // Realtime listeners: each cloud change triggers a cheap, debounced ingest
    // of ONLY the node that changed (hash-deduplicated, so echo writes are free).
    // NOTE: `print_requests` stays at the ROOT so the mobile POS can trigger
    // the desktop printer regardless of tenant (it is an ephemeral command
    // queue, not business data).
    const watchedNodes: Array<[string, string]> = [
      ['products', cp('products')],
      ['customers', cp('customers')],
      ['customer_khata', cp('customer_khata')],
      ['expenses', cp('expenses')],
      ['vendors', cp('vendors')],
      ['purchase_orders', cp('purchase_orders')],
      ['sales', cp('sales')],
      ['deleted_khata_entries', cp('deleted_khata_entries')]
    ];

    const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const ingestHandlers: Record<string, (raw: unknown) => void | Promise<void>> = {
      products: ingestProducts,
      customers: ingestCustomers,
      expenses: ingestExpenses,
      vendors: ingestVendors,
      purchase_orders: ingestPurchaseOrders,
      sales: ingestSales,
      customer_khata: async (raw) => {
        await processDeletedKhataTombstones();
        ingestKhata(raw);
      },
      deleted_khata_entries: async () => {
        await processDeletedKhataTombstones();
      }
    };

    try {
      for (const [name, path] of watchedNodes) {
        onValue(ref(dbInstance, path), () => {
          const existing = debounceTimers.get(name);
          if (existing) clearTimeout(existing);
          debounceTimers.set(name, setTimeout(() => {
            debounceTimers.delete(name);
            ingestNode(name, path, ingestHandlers[name]).catch(err =>
              console.warn(`Debounced ingest [${name}] error:`, err)
            );
          }, 1000));
        });
      }

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

  // Periodic background delta push (self-skipping when nothing changed — near-zero cost)
  let tickCount = 0;
  setInterval(async () => {
    try {
      if (!dbInstance) return;
      await syncSalesToCloud(true);
      await syncProductsToCloud(true);
      await syncExpensesToCloud(true);
      await syncCustomersToCloud(true);
      await syncCustomerKhataToCloud(true);
      await syncVendorsToCloud(true);

      // Keep the WAL file compact (every ~20 min)
      tickCount++;
      if (tickCount % 20 === 0) {
        checkpointDb();
      }
    } catch (err) {
      console.warn("Background cloud sync error:", err);
    }
  }, 60000);
}
