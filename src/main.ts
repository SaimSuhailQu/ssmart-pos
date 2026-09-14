import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { initDb, getAllProducts, getProductByBarcode, saveSale, getNextSaleId, addProduct, updateProduct, deleteProduct, bulkUpdateProducts, bulkAddProducts,
  getAllCustomers, getCustomerByPhone, addCustomer, updateCustomer, deleteCustomer,
  getCustomerKhataEntries, addCustomerLoanPayment, addCustomerLoanEntry, updateCustomerKhataEntry, deleteCustomerKhataEntry,
  verifyUserPin, clockIn, clockOut, getActiveShift, getSalesAnalytics,
  getAllUsers, addUser, updateUser, deleteUser, getAllSales, deleteSale, returnSaleItems,
  getAllExpenses, addExpense, updateExpense, deleteExpense,
  getAllVendors, addVendor, updateVendor, deleteVendor,
  getAllPurchaseOrders, createPurchaseOrder, receivePurchaseOrder, deletePurchaseOrder,
  addVendorPayment, deleteVendorPayment, updateVendorPayment, deleteVendorOrderEntry, updateVendorOrderEntry,
  getVendorPayments, getVendorOrderEntries, addManualDailyClosingSale } from './db';
import { printReceipt, printBarcode } from './printer';
import { startSyncWorker, syncProductsToCloud, syncCustomersToCloud, syncCustomerKhataToCloud, deleteCustomerKhataEntryFromCloud, clearAllKhataFromCloudAndLocal, syncVendorsToCloud, syncExpensesToCloud, syncSalesToCloud, deleteSaleFromCloud } from './syncEngine';
import { sendWhatsAppMessage } from './whatsappService';
import { setupAutoUpdater, checkForUpdatesManual, quitAndInstallUpdate } from './updater';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Memory and GPU optimization switches for low RAM consumption
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256 --expose-gc');
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-speech-api');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

let mainWindow: BrowserWindow | null = null;

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
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
};

app.on('ready', () => {
  // Initialize SQLite
  initDb();
  
  createWindow();

  // Initialize auto updater for background silent OTA updates
  setupAutoUpdater(mainWindow);

  // Start background Sync worker to Firebase and broadcast status changes to Renderer
  startSyncWorker((status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sync-status-changed', status);
    }
  });
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

ipcMain.handle('get-product', (_event, barcode: string) => {
  return getProductByBarcode(barcode);
});

ipcMain.handle('get-next-sale-id', () => {
  return getNextSaleId();
});

ipcMain.handle('checkout', async (_event, data) => {
  try {
    const saleId = saveSale(data.items, { ...data.paymentData, userId: data.userId });
    
    // Trigger physical print in background if not explicitly skipped
    if (!data.paymentData?.skipReceipt) {
      printReceipt(data.items, data.paymentData, saleId, data.cashierName).catch(printErr => {
        console.warn('Background receipt print warning:', printErr);
      });
    }

    if (data.paymentData?.customerId || data.paymentData?.paymentMethod === 'Credit / Loan') {
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

ipcMain.handle('add-manual-closing-sale', async (_event, data) => {
  try {
    const saleId = addManualDailyClosingSale(data);
    syncSalesToCloud(true).catch(e => console.warn('Sync sales error on manual closing:', e));
    return { success: true, saleId };
  } catch (err: unknown) {
    console.error('Add manual closing sale error:', err);
    const errMessage = err instanceof Error ? err.message : String(err);
    throw new Error(errMessage);
  }
});

ipcMain.handle('add-product', async (_event, product) => {
  try {
    const result = addProduct(product);
    syncProductsToCloud().catch(err => console.warn("Cloud product sync failed on add:", err));
    return result;
  } catch (err: unknown) {
    const errorObj = err as { code?: string; message?: string };
    if (errorObj.code === 'SQLITE_CONSTRAINT_UNIQUE' || errorObj.message?.includes('UNIQUE constraint failed: products.barcode')) {
      throw new Error(`A product with barcode "${product.barcode}" already exists! Please use a unique barcode.`);
    }
    throw new Error(errorObj.message || 'Failed to add product');
  }
});

ipcMain.handle('update-product', async (_event, id: number, product) => {
  try {
    const result = updateProduct(id, product);
    syncProductsToCloud().catch(err => console.warn("Cloud product sync failed on update:", err));
    return result;
  } catch (err: unknown) {
    const errorObj = err as { code?: string; message?: string };
    if (errorObj.code === 'SQLITE_CONSTRAINT_UNIQUE' || errorObj.message?.includes('UNIQUE constraint failed: products.barcode')) {
      throw new Error(`A product with barcode "${product.barcode}" already exists! Please use a unique barcode.`);
    }
    throw new Error(errorObj.message || 'Failed to update product');
  }
});

ipcMain.handle('bulk-update-products', async (_event, updates) => {
  const result = bulkUpdateProducts(updates);
  syncProductsToCloud().catch(err => console.warn("Cloud product sync failed on bulk update:", err));
  return result;
});

ipcMain.handle('bulk-add-products', async (_event, productsList) => {
  const result = bulkAddProducts(productsList);
  syncProductsToCloud().catch(err => console.warn("Cloud product sync failed on bulk add:", err));
  return result;
});

ipcMain.handle('delete-product', async (_event, id: number) => {
  const result = deleteProduct(id);
  syncProductsToCloud().catch(err => console.warn("Cloud product sync failed on delete:", err));
  return result;
});

ipcMain.handle('print-barcode', async (_event, product) => {
  try {
    await printBarcode(product);
    return true;
  } catch (err) {
    console.error('Print barcode error:', err);
    return false;
  }
});

ipcMain.handle('print-receipt', async (_event, data) => {
  try {
    await printReceipt(data.items, data.paymentData, data.saleId, data.cashierName);
    return true;
  } catch (err) {
    console.error('Print receipt error:', err);
    return false;
  }
});

// CRM IPC Handlers
ipcMain.handle('get-all-customers', () => {
  return getAllCustomers();
});

ipcMain.handle('get-customer-by-phone', (_event, phone: string) => {
  return getCustomerByPhone(phone);
});

ipcMain.handle('add-customer', async (_event, customer) => {
  const res = addCustomer(customer);
  syncCustomersToCloud(true).catch(err => console.warn('Sync customer failed:', err));
  return res;
});

ipcMain.handle('update-customer', async (_event, id: number, customer) => {
  const res = updateCustomer(id, customer);
  syncCustomersToCloud(true).catch(err => console.warn('Sync customer failed:', err));
  return res;
});

ipcMain.handle('delete-customer', async (_event, id: number) => {
  const res = deleteCustomer(id);
  syncCustomersToCloud(true).catch(err => console.warn('Sync customer failed:', err));
  return res;
});

ipcMain.handle('get-customer-khata', (_event, customerId: number) => {
  return getCustomerKhataEntries(customerId);
});

ipcMain.handle('add-customer-loan-payment', async (_event, data) => {
  const res = addCustomerLoanPayment(data);
  syncCustomerKhataToCloud(true).catch(err => console.warn('Sync khata failed:', err));
  syncCustomersToCloud(true).catch(err => console.warn('Sync customer failed:', err));
  return res;
});

ipcMain.handle('add-customer-loan-entry', async (_event, data) => {
  const res = addCustomerLoanEntry(data);
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

ipcMain.handle('delete-customer-khata-entry', async (_event, id: number) => {
  const res = deleteCustomerKhataEntry(id);
  deleteCustomerKhataEntryFromCloud(res.customerId, res.syncId).catch(err => console.warn('Delete khata cloud failed:', err));
  syncCustomersToCloud(true).catch(err => console.warn('Sync customer failed:', err));
  return res;
});

ipcMain.handle('clear-all-khata', async () => {
  return await clearAllKhataFromCloudAndLocal();
});

// Users & Shifts IPC Handlers
ipcMain.handle('verify-user-pin', (_event, pin: string) => {
  return verifyUserPin(pin);
});

ipcMain.handle('clock-in', (_event, userId: number) => {
  return clockIn(userId);
});

ipcMain.handle('clock-out', (_event, shiftId: number) => {
  return clockOut(shiftId);
});

ipcMain.handle('get-active-shift', (_event, userId: number) => {
  return getActiveShift(userId);
});

ipcMain.handle('get-sales-analytics', () => {
  return getSalesAnalytics();
});

ipcMain.handle('get-all-sales', () => {
  return getAllSales();
});

ipcMain.handle('return-sale-items', (_event, saleId: number, returnsList) => {
  return returnSaleItems(saleId, returnsList);
});

ipcMain.handle('delete-sale', async (_event, saleId: number) => {
  const res = deleteSale(saleId);
  deleteSaleFromCloud(saleId).catch(err => console.warn('Delete sale from cloud failed:', err));
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

ipcMain.handle('add-expense', async (_event, expense) => {
  const res = addExpense(expense);
  syncExpensesToCloud(true).catch(err => console.warn('Sync expenses failed:', err));
  return res;
});

ipcMain.handle('update-expense', async (_event, id: number, expense) => {
  const res = updateExpense(id, expense);
  syncExpensesToCloud(true).catch(err => console.warn('Sync expenses failed:', err));
  return res;
});

ipcMain.handle('delete-expense', async (_event, id: number) => {
  const res = deleteExpense(id);
  syncExpensesToCloud(true).catch(err => console.warn('Sync expenses failed:', err));
  return res;
});

// --- Vendors & Purchase Orders IPC Handlers ---
ipcMain.handle('get-all-vendors', () => {
  return getAllVendors();
});

ipcMain.handle('add-vendor', async (_event, vendor) => {
  const res = addVendor(vendor);
  syncVendorsToCloud(true).catch(err => console.warn('Sync vendors failed:', err));
  return res;
});

ipcMain.handle('update-vendor', async (_event, id: number, vendor) => {
  const res = updateVendor(id, vendor);
  syncVendorsToCloud(true).catch(err => console.warn('Sync vendors failed:', err));
  return res;
});

ipcMain.handle('delete-vendor', async (_event, id: number) => {
  const res = deleteVendor(id);
  syncVendorsToCloud(true).catch(err => console.warn('Sync vendors failed:', err));
  return res;
});

ipcMain.handle('get-all-purchase-orders', () => {
  return getAllPurchaseOrders();
});

ipcMain.handle('create-purchase-order', async (_event, vendorId: number, items, customTotalCost?: number, notes?: string) => {
  const res = createPurchaseOrder(vendorId, items, customTotalCost, notes);
  syncVendorsToCloud(true).catch(err => console.warn('Sync vendors failed:', err));
  return res;
});

ipcMain.handle('receive-purchase-order', async (_event, poId: number) => {
  const res = receivePurchaseOrder(poId);
  syncVendorsToCloud(true).catch(err => console.warn('Sync vendors failed:', err));
  syncProductsToCloud().catch(err => console.warn('Sync products failed:', err));
  return res;
});

ipcMain.handle('delete-purchase-order', async (_event, poId: number, bypassTimeCheck?: boolean) => {
  const res = deletePurchaseOrder(poId, bypassTimeCheck);
  syncVendorsToCloud(true).catch(err => console.warn('Sync vendors failed:', err));
  return res;
});

ipcMain.handle('add-vendor-payment', async (_event, payment) => {
  const res = addVendorPayment(payment);
  syncVendorsToCloud(true).catch(err => console.warn('Sync vendors failed:', err));
  return res;
});

ipcMain.handle('delete-vendor-payment', async (_event, paymentId: number, bypassTimeCheck?: boolean) => {
  const res = deleteVendorPayment(paymentId, bypassTimeCheck);
  syncVendorsToCloud(true).catch(err => console.warn('Sync vendors failed:', err));
  return res;
});

ipcMain.handle('update-vendor-payment', async (_event, paymentId: number, updateData, bypassTimeCheck?: boolean) => {
  const res = updateVendorPayment(paymentId, updateData, bypassTimeCheck);
  syncVendorsToCloud(true).catch(err => console.warn('Sync vendors failed:', err));
  return res;
});

ipcMain.handle('delete-vendor-order-entry', async (_event, entryId: number, bypassTimeCheck?: boolean) => {
  const res = deleteVendorOrderEntry(entryId, bypassTimeCheck);
  syncVendorsToCloud(true).catch(err => console.warn('Sync vendors failed:', err));
  return res;
});

ipcMain.handle('update-vendor-order-entry', async (_event, entryId: number, updateData, bypassTimeCheck?: boolean) => {
  const res = updateVendorOrderEntry(entryId, updateData, bypassTimeCheck);
  syncVendorsToCloud(true).catch(err => console.warn('Sync vendors failed:', err));
  return res;
});

ipcMain.handle('get-vendor-payments', (_event, vendorId?: number) => {
  return getVendorPayments(vendorId);
});

ipcMain.handle('get-vendor-order-entries', (_event, vendorId?: number) => {
  return getVendorOrderEntries(vendorId);
});

// --- WhatsApp Background Automation IPC ---
ipcMain.handle('send-whatsapp-message', async (_event, toPhone: string, messageText: string, config) => {
  return await sendWhatsAppMessage(toPhone, messageText, config);
});

// --- Auto-Updater IPC ---
ipcMain.handle('check-for-updates', () => {
  return checkForUpdatesManual();
});

ipcMain.handle('quit-and-install-update', () => {
  quitAndInstallUpdate();
});
