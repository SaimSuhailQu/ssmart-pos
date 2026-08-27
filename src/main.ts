import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { initDb, getAllProducts, getProductByBarcode, saveSale, getNextSaleId, addProduct, updateProduct, deleteProduct, bulkUpdateProducts, bulkAddProducts,
  getAllCustomers, getCustomerByPhone, addCustomer, updateCustomer, deleteCustomer,
  getCustomerKhataEntries, addCustomerLoanPayment, addCustomerLoanEntry,
  verifyUserPin, clockIn, clockOut, getActiveShift, getSalesAnalytics,
  getAllUsers, addUser, updateUser, deleteUser, getAllSales, returnSaleItems,
  getAllExpenses, addExpense, updateExpense, deleteExpense,
  getAllVendors, addVendor, updateVendor, deleteVendor,
  getAllPurchaseOrders, createPurchaseOrder, receivePurchaseOrder, deletePurchaseOrder,
  addVendorPayment, getVendorPayments, getVendorOrderEntries } from './db';
import { printReceipt, printBarcode } from './printer';
import { startSyncWorker, syncProductsToCloud, syncCustomersToCloud, syncCustomerKhataToCloud } from './syncEngine';
import { sendWhatsAppMessage } from './whatsappService';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Enable GPU acceleration and rasterization switches for high performance
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-native-gpu-memory-buffers');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  // Create the browser window with optimized webPreferences
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
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

ipcMain.handle('get-product', (event, barcode) => {
  return getProductByBarcode(barcode);
});

ipcMain.handle('get-next-sale-id', () => {
  return getNextSaleId();
});

ipcMain.handle('checkout', async (event, data) => {
  try {
    const saleId = saveSale(data.items, { ...data.paymentData, userId: data.userId });
    
    // Trigger physical print in background without blocking the instant UI checkout
    printReceipt(data.items, data.paymentData, saleId, data.cashierName).catch(printErr => {
      console.warn('Background receipt print warning:', printErr);
    });

    if (data.paymentData?.customerId || data.paymentData?.paymentMethod === 'Credit / Loan') {
      syncCustomerKhataToCloud(true).catch(e => console.warn('Khata sync err on checkout:', e));
      syncCustomersToCloud(true).catch(e => console.warn('Customer sync err on checkout:', e));
    }

    return { success: true, saleId };
  } catch (err: any) {
    console.error('Checkout error:', err);
    throw new Error(err.message);
  }
});

ipcMain.handle('add-product', async (event, product) => {
  try {
    const result = addProduct(product);
    syncProductsToCloud().catch(err => console.warn("Cloud product sync failed on add:", err));
    return result;
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.message?.includes('UNIQUE constraint failed: products.barcode')) {
      throw new Error(`A product with barcode "${product.barcode}" already exists! Please use a unique barcode.`);
    }
    throw new Error(err.message || 'Failed to add product');
  }
});

ipcMain.handle('update-product', async (event, id, product) => {
  try {
    const result = updateProduct(id, product);
    syncProductsToCloud().catch(err => console.warn("Cloud product sync failed on update:", err));
    return result;
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.message?.includes('UNIQUE constraint failed: products.barcode')) {
      throw new Error(`A product with barcode "${product.barcode}" already exists! Please use a unique barcode.`);
    }
    throw new Error(err.message || 'Failed to update product');
  }
});

ipcMain.handle('bulk-update-products', async (event, updates) => {
  const result = bulkUpdateProducts(updates);
  syncProductsToCloud().catch(err => console.warn("Cloud product sync failed on bulk update:", err));
  return result;
});

ipcMain.handle('bulk-add-products', async (event, productsList) => {
  const result = bulkAddProducts(productsList);
  syncProductsToCloud().catch(err => console.warn("Cloud product sync failed on bulk add:", err));
  return result;
});

ipcMain.handle('delete-product', async (event, id) => {
  const result = deleteProduct(id);
  syncProductsToCloud().catch(err => console.warn("Cloud product sync failed on delete:", err));
  return result;
});

ipcMain.handle('print-barcode', async (event, product) => {
  try {
    await printBarcode(product);
    return true;
  } catch (err) {
    console.error('Print barcode error:', err);
    return false;
  }
});

ipcMain.handle('print-receipt', async (event, data) => {
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

ipcMain.handle('get-customer-by-phone', (event, phone) => {
  return getCustomerByPhone(phone);
});

ipcMain.handle('add-customer', async (event, customer) => {
  const res = addCustomer(customer);
  syncCustomersToCloud(true);
  return res;
});

ipcMain.handle('update-customer', async (event, id, customer) => {
  const res = updateCustomer(id, customer);
  syncCustomersToCloud(true);
  return res;
});

ipcMain.handle('delete-customer', async (event, id) => {
  const res = deleteCustomer(id);
  syncCustomersToCloud(true);
  return res;
});

ipcMain.handle('get-customer-khata', (event, customerId) => {
  return getCustomerKhataEntries(customerId);
});

ipcMain.handle('add-customer-loan-payment', async (event, data) => {
  const res = addCustomerLoanPayment(data);
  syncCustomerKhataToCloud(true);
  syncCustomersToCloud(true);
  return res;
});

ipcMain.handle('add-customer-loan-entry', async (event, data) => {
  const res = addCustomerLoanEntry(data);
  syncCustomerKhataToCloud(true);
  syncCustomersToCloud(true);
  return res;
});

// Users & Shifts IPC Handlers
ipcMain.handle('verify-user-pin', (event, pin) => {
  return verifyUserPin(pin);
});

ipcMain.handle('clock-in', (event, userId) => {
  return clockIn(userId);
});

ipcMain.handle('clock-out', (event, shiftId) => {
  return clockOut(shiftId);
});

ipcMain.handle('get-active-shift', (event, userId) => {
  return getActiveShift(userId);
});

ipcMain.handle('get-sales-analytics', () => {
  return getSalesAnalytics();
});

ipcMain.handle('get-all-sales', () => {
  return getAllSales();
});

ipcMain.handle('return-sale-items', (event, saleId, returnsList) => {
  return returnSaleItems(saleId, returnsList);
});

// User Management IPC Handlers
ipcMain.handle('get-all-users', () => {
  return getAllUsers();
});

ipcMain.handle('add-user', (event, user) => {
  return addUser(user);
});

ipcMain.handle('update-user', (event, id, user) => {
  return updateUser(id, user);
});

ipcMain.handle('delete-user', (event, id) => {
  return deleteUser(id);
});

// --- Expense Tracking IPC Handlers ---
ipcMain.handle('get-all-expenses', () => {
  return getAllExpenses();
});

ipcMain.handle('add-expense', (event, expense) => {
  return addExpense(expense);
});

ipcMain.handle('update-expense', (event, id, expense) => {
  return updateExpense(id, expense);
});

ipcMain.handle('delete-expense', (event, id) => {
  return deleteExpense(id);
});

// --- Vendors & Purchase Orders IPC Handlers ---
ipcMain.handle('get-all-vendors', () => {
  return getAllVendors();
});

ipcMain.handle('add-vendor', (event, vendor) => {
  return addVendor(vendor);
});

ipcMain.handle('update-vendor', (event, id, vendor) => {
  return updateVendor(id, vendor);
});

ipcMain.handle('delete-vendor', (event, id) => {
  return deleteVendor(id);
});

ipcMain.handle('get-all-purchase-orders', () => {
  return getAllPurchaseOrders();
});

ipcMain.handle('create-purchase-order', (event, vendorId, items, customTotalCost, notes) => {
  return createPurchaseOrder(vendorId, items, customTotalCost, notes);
});

ipcMain.handle('receive-purchase-order', (event, poId) => {
  return receivePurchaseOrder(poId);
});

ipcMain.handle('delete-purchase-order', (event, poId) => {
  return deletePurchaseOrder(poId);
});

ipcMain.handle('add-vendor-payment', (event, payment) => {
  return addVendorPayment(payment);
});

ipcMain.handle('get-vendor-payments', (event, vendorId) => {
  return getVendorPayments(vendorId);
});

ipcMain.handle('get-vendor-order-entries', (event, vendorId) => {
  return getVendorOrderEntries(vendorId);
});

// --- WhatsApp Background Automation IPC ---
ipcMain.handle('send-whatsapp-message', async (event, toPhone, messageText, config) => {
  return await sendWhatsAppMessage(toPhone, messageText, config);
});
