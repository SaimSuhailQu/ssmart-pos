import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { CartItem } from './types';
import { initDb, getAllProducts, getProductByBarcode, saveSale, getNextSaleId, addProduct, updateProduct, deleteProduct, bulkUpdateProducts, bulkAddProducts,
  getAllCustomers, getCustomerByPhone, addCustomer, updateCustomer, deleteCustomer,
  getCustomerKhataEntries, addCustomerLoanPayment, addCustomerLoanEntry, updateCustomerKhataEntry, deleteCustomerKhataEntry,
  verifyUserPin, clockIn, clockOut, getActiveShift, getSalesAnalytics,
  getAllUsers, addUser, updateUser, deleteUser, changeUserPin, getAllSales, deleteSale, returnSaleItems,
  getAllExpenses, addExpense, updateExpense, deleteExpense,
  getAllVendors, addVendor, updateVendor, deleteVendor,  getAllPurchaseOrders, createPurchaseOrder, receivePurchaseOrder, deletePurchaseOrder,
  addVendorPayment, deleteVendorPayment, updateVendorPayment, deleteVendorOrderEntry, updateVendorOrderEntry,
  getVendorPayments, getVendorOrderEntries, addManualDailyClosingSale, getSetting, setSetting } from './db';
import { printReceipt, printBarcode, printBarcodesBatchA4 } from './printer';
import { startSyncWorker, setTenant, syncProductsToCloud, syncCustomersToCloud, syncCustomerKhataToCloud, deleteCustomerKhataEntryFromCloud, clearAllKhataFromCloudAndLocal, syncVendorsToCloud, syncExpensesToCloud, syncSalesToCloud, deleteSaleFromCloud } from './syncEngine';
import { sendWhatsAppMessage } from './whatsappService';
import { setupAutoUpdater, checkForUpdatesManual, quitAndInstallUpdate } from './updater';
import { checkLicense, computeFingerprint, scheduleRevalidation, shutdownLicensing, LicenseState } from './licensing';
import { registerLicensingIpc } from './main/licensing/ipc';
import { evaluateLicense } from './main/licensing/licenseManager';
import {
  initPrintSpooler,
  registerTransport,
  createNetworkTransport,
  createBluetoothStubTransport,
  getQueueStatus,
  retryFailedJobs,
} from './main/printing/printSpooler';
import { enqueueReceiptJob, getConfiguredTransport } from './main/printing/receiptAdapter';
import { vInt, vNum, vStr, vOptStr, vObj, vArr } from './main/validate';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Production resilience: never let an unhandled error silently kill the POS.
process.on('uncaughtException', (err) => {
  console.error('[POS] Uncaught exception (app kept alive):', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[POS] Unhandled promise rejection (app kept alive):', reason);
});

// Prevent accidental multi-instance launches that would corrupt the SQLite file
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

// Memory and GPU optimization switches for low RAM consumption
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256 --expose-gc');
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-speech-api');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

let mainWindow: BrowserWindow | null = null;

// Result of the startup license check; sent to the renderer once it loads.
let initialLicenseState: LicenseState | null = null;
let licenseBlocked = false;
let syncStarted = false;

/**
 * Start the cloud sync worker exactly once, after tenant routing is known.
 * Must run after setTenant() so every cloud path is correctly scoped.
 */
function startCloudSync(): void {
  if (syncStarted) return;
  syncStarted = true;
  startSyncWorker((status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sync-status-changed', status);
    }
  });
}

function sendLicenseState(): void {
  if (mainWindow && !mainWindow.isDestroyed() && initialLicenseState) {
    mainWindow.webContents.send('license-state', initialLicenseState);
    if (licenseBlocked) {
      mainWindow.webContents.send('license-revoked');
    }
  }
}

/**
 * (Re)register print transports from the `printer.transport` setting.
 * Format: `network:<host>[:port]` for LAN thermal printers (default port
 * 9100). Bluetooth always registers a stub that fails with a clear
 * "use mobile" message so jobs queue safely instead of crashing the sale.
 */
function configurePrinterTransports(): void {
  registerTransport('bluetooth', createBluetoothStubTransport());
  const transport = getConfiguredTransport();
  if (transport) {
    const [, host = '', portStr] = transport.split(':');
    const port = Number(portStr) || 9100;
    if (host) registerTransport(transport, createNetworkTransport(host, port));
  }
}

const createWindow = () => {
  const iconPath = process.platform === 'win32'
    ? path.join(__dirname, '../../assets/icon.ico')
    : path.join(__dirname, '../../assets/icon.png');
  const fallbackIconPath = path.join(process.cwd(), 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png');
  const resolvedIcon = fs.existsSync(iconPath) ? iconPath : fallbackIconPath;

  // Create the browser window with optimized memory-efficient webPreferences
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: resolvedIcon,
    backgroundColor: '#0b0c10',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
      devTools: process.env.NODE_ENV === 'development',
      spellcheck: false,
      sandbox: false,
      contextIsolation: true,
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Push the license decision to the renderer as soon as it is listening.
  mainWindow.webContents.on('did-finish-load', () => {
    sendLicenseState();
  });

  // Open the DevTools in development if needed manually with Ctrl+Shift+I
  // if (process.env.NODE_ENV === 'development') {
  //   mainWindow.webContents.openDevTools();
  // }

  // Self-heal: reload the renderer instead of dying if it crashes
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[POS] Renderer crashed:', details.reason, '- reloading...');
    if (!mainWindow?.isDestroyed()) {
      mainWindow?.webContents.reload();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

app.on('ready', () => {
  // Initialize SQLite
  initDb();

  // Fail-safe print spooler: SQLite-persisted queue with retry/backoff.
  initPrintSpooler();
  configurePrinterTransports();

  // Device-locked licensing check (blocks the UI when expired/revoked)
  checkLicense()
    .then((state) => {
      initialLicenseState = state;
      licenseBlocked = state.status === 'expired';
      // Route cloud sync for this device: master -> legacy root (data intact),
      // sold copy -> its tenant subtree. Must precede startCloudSync().
      setTenant(state.tenantId ?? null);
      startCloudSync();
      sendLicenseState();
      scheduleRevalidation((next) => {
        initialLicenseState = next;
        const nowBlocked = next.status === 'expired';
        if (nowBlocked && !licenseBlocked && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('license-revoked');
        }
        licenseBlocked = nowBlocked;
      });
    })
    .catch((err) => {
      console.warn('[Licensing] check failed, continuing in trial/offline mode:', err);
      initialLicenseState = {
        status: 'trial',
        mode: 'trial',
        fingerprint: 'unknown',
        platform: process.platform,
        checkedAt: new Date().toISOString(),
        error: 'check_failed',
      };
      licenseBlocked = false;
      setTenant(null);
      startCloudSync();
      sendLicenseState();
    });

  createWindow();

  // Focus the existing window when a second launch is attempted
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // Initialize auto updater for background silent OTA updates
  setupAutoUpdater(mainWindow);

  // NOTE: the cloud sync worker is started from the license-check callbacks
  // above (after tenant routing is resolved), not here.
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers
ipcMain.handle('get-all-products', () => {
  return getAllProducts();
});

ipcMain.handle('get-product', (_event, barcode: unknown) => {
  return getProductByBarcode(vStr(barcode, 'barcode', 64));
});

ipcMain.handle('get-next-sale-id', () => {
  return getNextSaleId();
});

ipcMain.handle('checkout', async (_event, data: unknown) => {
  try {
    const d = vObj<{ items: unknown; paymentData: unknown; userId: unknown; cashierName: unknown }>(data, 'checkout');
    const items = vArr<CartItem>(d.items, 'items', 1000);
    const paymentData = vObj<Record<string, unknown>>(d.paymentData, 'paymentData');
    const userId = d.userId === undefined ? undefined : vInt(d.userId, 'userId', { min: 1 });
    const cashierName = d.cashierName === undefined ? undefined : vStr(d.cashierName, 'cashierName', 120);
    const saleId = saveSale(items, {
      subtotal: vNum(paymentData.subtotal, 'subtotal'),
      tax: vNum(paymentData.tax ?? 0, 'tax'),
      discount: vNum(paymentData.discount ?? 0, 'discount'),
      total: vNum(paymentData.total, 'total'),
      payments: vArr(paymentData.payments ?? [], 'payments', 10),
      change: vNum(paymentData.change ?? 0, 'change'),
      userId,
      customerId: paymentData.customerId === undefined ? undefined : vInt(paymentData.customerId, 'customerId', { min: 1 }),
    });

    // Receipt: ESC/POS spooler when a network printer is configured,
    // otherwise the legacy OS-driver HTML path (unchanged behavior).
    if (!paymentData.skipReceipt) {
      const jobId = enqueueReceiptJob(items, paymentData, saleId, cashierName);
      if (jobId === null) {
        printReceipt(items, paymentData, saleId, cashierName).catch(printErr => {
          console.warn('Background receipt print warning:', printErr);
        });
      }
    }

    if (paymentData.customerId || paymentData.paymentMethod === 'Credit / Loan') {
      syncCustomerKhataToCloud(true).catch(e => console.warn('Khata sync err on checkout:', e));
      syncCustomersToCloud(true).catch(e => console.warn('Customer sync err on checkout:', e));
    }

    return { success: true, saleId };
  } catch (err: unknown) {
    console.error('Checkout error:', err);
    const errMessage = err instanceof Error ? err.message : String(err);
    throw new Error(errMessage);
  }
});

ipcMain.handle('add-manual-closing-sale', async (_event, data: unknown) => {
  try {
    const d = vObj<{ total: unknown; cashAmount: unknown; onlineAmount: unknown; notes: unknown; date: unknown; cashierName: unknown }>(data, 'closing sale');
    const saleId = addManualDailyClosingSale({
      total: vNum(d.total, 'total'),
      cashAmount: d.cashAmount === undefined ? undefined : vNum(d.cashAmount, 'cashAmount'),
      onlineAmount: d.onlineAmount === undefined ? undefined : vNum(d.onlineAmount, 'onlineAmount'),
      notes: vOptStr(d.notes, 'notes', 500),
      date: vOptStr(d.date, 'date', 20),
      cashierName: vOptStr(d.cashierName, 'cashierName', 120),
    });
    syncSalesToCloud(true).catch(e => console.warn('Sync sales error on manual closing:', e));
    return { success: true, saleId };
  } catch (err: unknown) {
    console.error('Add manual closing sale error:', err);
    const errMessage = err instanceof Error ? err.message : String(err);
    throw new Error(errMessage);
  }
});

ipcMain.handle('add-product', async (_event, product: unknown) => {
  const p = vObj<Record<string, unknown>>(product, 'product');
  const name = vStr(p.name, 'name', 120);
  const barcode = vStr(p.barcode, 'barcode', 64);
  try {
    const result = addProduct({ ...p, name, barcode } as Parameters<typeof addProduct>[0]);
    syncProductsToCloud().catch(err => console.warn("Cloud product sync failed on add:", err));
    return result;
  } catch (err: unknown) {
    const errorObj = err as { code?: string; message?: string };
    if (errorObj.code === 'SQLITE_CONSTRAINT_UNIQUE' || errorObj.message?.includes('UNIQUE constraint failed: products.barcode')) {
      throw new Error(`A product with barcode "${barcode}" already exists! Please use a unique barcode.`);
    }
    throw new Error(errorObj.message || 'Failed to add product');
  }
});

ipcMain.handle('update-product', async (_event, id: unknown, product: unknown) => {
  const pid = vInt(id, 'id', { min: 1 });
  const p = vObj<Record<string, unknown>>(product, 'product');
  const name = vStr(p.name, 'name', 120);
  const barcode = vStr(p.barcode, 'barcode', 64);
  try {
    const result = updateProduct(pid, { ...p, name, barcode } as Parameters<typeof updateProduct>[1]);
    syncProductsToCloud().catch(err => console.warn("Cloud product sync failed on update:", err));
    return result;
  } catch (err: unknown) {
    const errorObj = err as { code?: string; message?: string };
    if (errorObj.code === 'SQLITE_CONSTRAINT_UNIQUE' || errorObj.message?.includes('UNIQUE constraint failed: products.barcode')) {
      throw new Error(`A product with barcode "${barcode}" already exists! Please use a unique barcode.`);
    }
    throw new Error(errorObj.message || 'Failed to update product');
  }
});

ipcMain.handle('bulk-update-products', async (_event, updates: unknown) => {
  const result = bulkUpdateProducts(vArr(updates, 'updates', 5000));
  syncProductsToCloud().catch(err => console.warn("Cloud product sync failed on bulk update:", err));
  return result;
});

ipcMain.handle('bulk-add-products', async (_event, productsList: unknown) => {
  const result = bulkAddProducts(vArr(productsList, 'productsList', 5000));
  syncProductsToCloud().catch(err => console.warn("Cloud product sync failed on bulk add:", err));
  return result;
});

ipcMain.handle('delete-product', async (_event, id: unknown) => {
  const result = deleteProduct(vInt(id, 'id', { min: 1 }));
  syncProductsToCloud().catch(err => console.warn("Cloud product sync failed on delete:", err));
  return result;
});

ipcMain.handle('print-barcode', async (_event, product: unknown, count?: unknown) => {
  try {
    const p = vObj<Record<string, unknown>>(product, 'product');
    await printBarcode(
      { name: vOptStr(p.name, 'name', 120), barcode: vStr(p.barcode, 'barcode', 64), price: p.price === undefined ? undefined : vStr(String(p.price), 'price', 20) },
      count === undefined ? undefined : vInt(count, 'count', { min: 1, max: 500 }),
    );
    return true;
  } catch (err) {
    console.error('Print barcode error:', err);
    return false;
  }
});

ipcMain.handle('print-barcodes-batch-a4', async (_event, items: Array<{ name: string; barcode: string; price: number | string; count: number }>) => {
  try {
    const result = await printBarcodesBatchA4(items);
    return result;
  } catch (err) {
    console.error('Print barcodes batch A4 error:', err);
    return false;
  }
});

ipcMain.handle('print-receipt', async (_event, data) => {
  try {
    const jobId = enqueueReceiptJob(data.items, data.paymentData, data.saleId, data.cashierName);
    if (jobId !== null) return true;
    await printReceipt(data.items, data.paymentData, data.saleId, data.cashierName);
    return true;
  } catch (err) {
    console.error('Print receipt error:', err);
    return false;
  }
});

// --- Print spooler IPC ---
ipcMain.handle('get-print-queue-status', () => getQueueStatus());

ipcMain.handle('retry-print-queue', () => retryFailedJobs());

ipcMain.handle('get-printer-settings', () => ({
  transport: getSetting('printer.transport') ?? '',
  storeName: getSetting('store.name') ?? 'SS MART',
}));

ipcMain.handle('save-printer-settings', (_event, settings: { transport?: string; storeName?: string }) => {
  const transport = String(settings?.transport ?? '').trim();
  // Strict format: '' (OS driver) or network:<host>[:port]
  if (transport !== '' && !/^network:[A-Za-z0-9._-]+(?::\d{1,5})?$/.test(transport)) {
    throw new Error('Printer must be empty (OS driver) or network:<host>[:port].');
  }
  setSetting('printer.transport', transport);
  if (settings?.storeName !== undefined) {
    const name = String(settings.storeName).slice(0, 60);
    setSetting('store.name', name);
  }
  configurePrinterTransports();
  return true;
});

// CRM IPC Handlers
ipcMain.handle('get-all-customers', () => {
  return getAllCustomers();
});

ipcMain.handle('get-customer-by-phone', (_event, phone: unknown) => {
  return getCustomerByPhone(vStr(phone, 'phone', 20));
});

ipcMain.handle('add-customer', async (_event, customer: unknown) => {
  const c = vObj<Record<string, unknown>>(customer, 'customer');
  const res = addCustomer({ ...c, name: vStr(c.name, 'name', 120), phone: vStr(c.phone, 'phone', 20) } as Parameters<typeof addCustomer>[0]);
  syncCustomersToCloud(true).catch(err => console.warn('Sync customer failed:', err));
  return res;
});

ipcMain.handle('update-customer', async (_event, id: unknown, customer: unknown) => {
  const c = vObj<Record<string, unknown>>(customer, 'customer');
  const res = updateCustomer(vInt(id, 'id', { min: 1 }), { ...c, name: vStr(c.name, 'name', 120) } as Parameters<typeof updateCustomer>[1]);
  syncCustomersToCloud(true).catch(err => console.warn('Sync customer failed:', err));
  return res;
});

ipcMain.handle('delete-customer', async (_event, id: unknown) => {
  const res = deleteCustomer(vInt(id, 'id', { min: 1 }));
  syncCustomersToCloud(true).catch(err => console.warn('Sync customer failed:', err));
  return res;
});

ipcMain.handle('get-customer-khata', (_event, customerId: unknown) => {
  return getCustomerKhataEntries(vInt(customerId, 'customerId', { min: 1 }));
});

ipcMain.handle('add-customer-loan-payment', async (_event, data: unknown) => {
  const d = vObj<{ customerId: unknown; amount: unknown }>(data, 'loan payment');
  const res = addCustomerLoanPayment({ ...d, customerId: vInt(d.customerId, 'customerId', { min: 1 }), amount: vNum(d.amount, 'amount') } as Parameters<typeof addCustomerLoanPayment>[0]);
  syncCustomerKhataToCloud(true).catch(err => console.warn('Sync khata failed:', err));
  syncCustomersToCloud(true).catch(err => console.warn('Sync customer failed:', err));
  return res;
});

ipcMain.handle('add-customer-loan-entry', async (_event, data: unknown) => {
  const d = vObj<{ customerId: unknown; amount: unknown }>(data, 'loan entry');
  const res = addCustomerLoanEntry({ ...d, customerId: vInt(d.customerId, 'customerId', { min: 1 }), amount: vNum(d.amount, 'amount') } as Parameters<typeof addCustomerLoanEntry>[0]);
  syncCustomerKhataToCloud(true).catch(err => console.warn('Sync khata failed:', err));
  syncCustomersToCloud(true).catch(err => console.warn('Sync customer failed:', err));
  return res;
});

ipcMain.handle('update-customer-khata-entry', async (_event, data) => {
  const res = updateCustomerKhataEntry(data);
  syncCustomerKhataToCloud(true).catch(err => console.warn('Sync khata failed:', err));
  syncCustomersToCloud(true).catch(err => console.warn('Sync customer failed:', err));
  return res;
});

ipcMain.handle('delete-customer-khata-entry', async (_event, id: unknown) => {
  const res = deleteCustomerKhataEntry(vInt(id, 'id', { min: 1 }));
  deleteCustomerKhataEntryFromCloud(res.customerId, res.syncId).catch(err => console.warn('Delete khata cloud failed:', err));
  syncCustomersToCloud(true).catch(err => console.warn('Sync customer failed:', err));
  return res;
});

ipcMain.handle('clear-all-khata', async () => {
  return await clearAllKhataFromCloudAndLocal();
});

// Users & Shifts IPC Handlers
// The main process tracks the logged-in session so authorization decisions
// (e.g. bypassing the 30-minute edit window) are made server-side — the
// renderer can never grant itself privileges via IPC arguments.
let sessionUser: { id: number; role: string } | null = null;

ipcMain.handle('verify-user-pin', (_event, pin: unknown) => {
  const user = verifyUserPin(vStr(pin, 'pin', 12));
  sessionUser = user ? { id: user.id, role: user.role } : sessionUser;
  return user;
});

ipcMain.handle('logout', () => {
  sessionUser = null;
  return true;
});

ipcMain.handle('change-user-pin', (_event, userId: unknown, newPin: unknown) => {
  const uid = vInt(userId, 'userId', { min: 1 });
  // Users may only change their own PIN; Admins may change anyone's.
  if (!sessionUser || (sessionUser.id !== uid && sessionUser.role !== 'Admin')) {
    throw new Error('Not authorized to change this PIN.');
  }
  return changeUserPin(uid, vStr(newPin, 'newPin', 12));
});

ipcMain.handle('clock-in', (_event, userId: unknown) => {
  return clockIn(vInt(userId, 'userId', { min: 1 }));
});

ipcMain.handle('clock-out', (_event, shiftId: unknown) => {
  return clockOut(vInt(shiftId, 'shiftId', { min: 1 }));
});

ipcMain.handle('get-active-shift', (_event, userId: unknown) => {
  return getActiveShift(vInt(userId, 'userId', { min: 1 }));
});

ipcMain.handle('get-sales-analytics', () => {
  return getSalesAnalytics();
});

ipcMain.handle('get-all-sales', () => {
  return getAllSales();
});

ipcMain.handle('return-sale-items', (_event, saleId: unknown, returnsList: unknown) => {
  return returnSaleItems(vInt(saleId, 'saleId', { min: 1 }), vArr(returnsList, 'returnsList', 1000));
});

ipcMain.handle('delete-sale', async (_event, saleId: unknown) => {
  const sid = vInt(saleId, 'saleId', { min: 1 });
  const res = deleteSale(sid);
  deleteSaleFromCloud(sid).catch(err => console.warn('Delete sale from cloud failed:', err));
  return res;
});

// User Management IPC Handlers
ipcMain.handle('get-all-users', () => {
  return getAllUsers();
});

ipcMain.handle('add-user', (_event, user) => {
  return addUser(user);
});

ipcMain.handle('update-user', (_event, id: number, user) => {
  return updateUser(id, user);
});

ipcMain.handle('delete-user', (_event, id: number) => {
  return deleteUser(id);
});

// --- Expense Tracking IPC Handlers ---
ipcMain.handle('get-all-expenses', () => {
  return getAllExpenses();
});

ipcMain.handle('add-expense', async (_event, expense: unknown) => {
  const e = vObj<{ amount: unknown; description: unknown }>(expense, 'expense');
  const res = addExpense({ ...e, amount: vNum(e.amount, 'amount'), description: vStr(e.description, 'description', 500) } as Parameters<typeof addExpense>[0]);
  syncExpensesToCloud(true).catch(err => console.warn('Sync expenses failed:', err));
  return res;
});

ipcMain.handle('update-expense', async (_event, id: unknown, expense: unknown) => {
  const e = vObj<{ amount: unknown; description: unknown }>(expense, 'expense');
  const res = updateExpense(vInt(id, 'id', { min: 1 }), { ...e, amount: vNum(e.amount, 'amount'), description: vStr(e.description, 'description', 500) } as Parameters<typeof updateExpense>[1]);
  syncExpensesToCloud(true).catch(err => console.warn('Sync expenses failed:', err));
  return res;
});

ipcMain.handle('delete-expense', async (_event, id: unknown) => {
  const res = deleteExpense(vInt(id, 'id', { min: 1 }));
  syncExpensesToCloud(true).catch(err => console.warn('Sync expenses failed:', err));
  return res;
});

// --- Vendors & Purchase Orders IPC Handlers ---
ipcMain.handle('get-all-vendors', () => {
  return getAllVendors();
});

ipcMain.handle('add-vendor', async (_event, vendor: unknown) => {
  const v = vObj<{ name: unknown }>(vendor, 'vendor');
  const res = addVendor({ ...v, name: vStr(v.name, 'name', 120) } as Parameters<typeof addVendor>[0]);
  syncVendorsToCloud(true).catch(err => console.warn('Sync vendors failed:', err));
  return res;
});

ipcMain.handle('update-vendor', async (_event, id: unknown, vendor: unknown) => {
  const v = vObj<{ name: unknown }>(vendor, 'vendor');
  const res = updateVendor(vInt(id, 'id', { min: 1 }), { ...v, name: vStr(v.name, 'name', 120) } as Parameters<typeof updateVendor>[1]);
  syncVendorsToCloud(true).catch(err => console.warn('Sync vendors failed:', err));
  return res;
});

ipcMain.handle('delete-vendor', async (_event, id: unknown) => {
  const res = deleteVendor(vInt(id, 'id', { min: 1 }));
  syncVendorsToCloud(true).catch(err => console.warn('Sync vendors failed:', err));
  return res;
});

ipcMain.handle('get-all-purchase-orders', () => {
  return getAllPurchaseOrders();
});

ipcMain.handle('create-purchase-order', async (_event, vendorId: unknown, items: unknown, customTotalCost?: unknown, notes?: unknown, billUrl?: unknown) => {
  const res = createPurchaseOrder(
    vInt(vendorId, 'vendorId', { min: 1 }),
    vArr(items, 'items', 2000),
    customTotalCost === undefined ? undefined : vNum(customTotalCost, 'customTotalCost'),
    vOptStr(notes, 'notes', 1000),
    vOptStr(billUrl, 'billUrl', 500),
  );
  syncVendorsToCloud(true).catch(err => console.warn('Sync vendors failed:', err));
  return res;
});

ipcMain.handle('receive-purchase-order', async (_event, poId: unknown) => {
  const res = receivePurchaseOrder(vInt(poId, 'poId', { min: 1 }));
  syncVendorsToCloud(true).catch(err => console.warn('Sync vendors failed:', err));
  syncProductsToCloud().catch(err => console.warn('Sync products failed:', err));
  return res;
});

ipcMain.handle('delete-purchase-order', async (_event, poId: number) => {
  // Only an Admin session may bypass the 30-minute edit window; the flag is
  // decided here, never accepted from the renderer.
  const res = deletePurchaseOrder(poId, sessionUser?.role === 'Admin');
  syncVendorsToCloud(true).catch(err => console.warn('Sync vendors failed:', err));
  return res;
});

ipcMain.handle('add-vendor-payment', async (_event, payment: unknown) => {
  const p = vObj<{ poId: unknown; vendorId: unknown; amount: unknown }>(payment, 'payment');
  const res = addVendorPayment({
    ...p,
    poId: vInt(p.poId, 'poId', { min: 1 }),
    vendorId: vInt(p.vendorId, 'vendorId', { min: 1 }),
    amount: vNum(p.amount, 'amount'),
  } as Parameters<typeof addVendorPayment>[0]);
  syncVendorsToCloud(true).catch(err => console.warn('Sync vendors failed:', err));
  return res;
});

ipcMain.handle('delete-vendor-payment', async (_event, paymentId: number) => {
  const res = deleteVendorPayment(paymentId, sessionUser?.role === 'Admin');
  syncVendorsToCloud(true).catch(err => console.warn('Sync vendors failed:', err));
  return res;
});

ipcMain.handle('update-vendor-payment', async (_event, paymentId: number, updateData) => {
  const res = updateVendorPayment(paymentId, updateData, sessionUser?.role === 'Admin');
  syncVendorsToCloud(true).catch(err => console.warn('Sync vendors failed:', err));
  return res;
});

ipcMain.handle('delete-vendor-order-entry', async (_event, entryId: number) => {
  const res = deleteVendorOrderEntry(entryId, sessionUser?.role === 'Admin');
  syncVendorsToCloud(true).catch(err => console.warn('Sync vendors failed:', err));
  return res;
});

ipcMain.handle('update-vendor-order-entry', async (_event, entryId: number, updateData) => {
  const res = updateVendorOrderEntry(entryId, updateData, sessionUser?.role === 'Admin');
  syncVendorsToCloud(true).catch(err => console.warn('Sync vendors failed:', err));
  return res;
});

ipcMain.handle('get-vendor-payments', (_event, vendorId?: unknown) => {
  return getVendorPayments(vendorId === undefined ? undefined : vInt(vendorId, 'vendorId', { min: 1 }));
});

ipcMain.handle('get-vendor-order-entries', (_event, vendorId?: unknown) => {
  return getVendorOrderEntries(vendorId === undefined ? undefined : vInt(vendorId, 'vendorId', { min: 1 }));
});

// --- WhatsApp Background Automation IPC ---
ipcMain.handle('send-whatsapp-message', async (_event, toPhone: unknown, messageText: unknown, config: unknown) => {
  return await sendWhatsAppMessage(vStr(toPhone, 'toPhone', 20), vStr(messageText, 'messageText', 4000), config as Parameters<typeof sendWhatsAppMessage>[2]);
});

// --- Auto-Updater IPC ---
ipcMain.handle('check-for-updates', () => {
  return checkForUpdatesManual();
});

ipcMain.handle('quit-and-install-update', () => {
  quitAndInstallUpdate();
});

// --- Licensing IPC ---
// Unified tiered handlers (offline product key → Firebase → trial + grace).
// After activation/deactivation the cached startup state is refreshed and
// pushed to the renderer immediately.
registerLicensingIpc((state) => {
  initialLicenseState = state;
  licenseBlocked = state.status === 'expired';
  sendLicenseState();
});

ipcMain.handle('get-license-state', () => {
  return evaluateLicense();
});

ipcMain.handle('get-device-fingerprint', () => {
  return computeFingerprint();
});

app.on('will-quit', (): void => {
  void shutdownLicensing().catch(() => undefined);
});

