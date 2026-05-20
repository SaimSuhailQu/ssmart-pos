import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { initDb, getAllProducts, getProductByBarcode, saveSale, getNextSaleId, addProduct, updateProduct, deleteProduct,
  getAllCustomers, getCustomerByPhone, addCustomer, updateCustomer, deleteCustomer,
  verifyUserPin, clockIn, clockOut, getActiveShift, getSalesAnalytics,
  getAllUsers, addUser, updateUser, deleteUser, getAllSales, returnSaleItems,
  getAllExpenses, addExpense, deleteExpense } from './db';
import { printReceipt, printBarcode } from './printer';
import { startSyncWorker } from './syncEngine';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
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
    
    // Attempt silent print
    try {
      await printReceipt(data.items, data.paymentData.total, saleId);
    } catch (printErr) {
      console.error('Print failed during checkout:', printErr);
    }

    return { success: true, saleId };
  } catch (err: any) {
    console.error('Checkout error:', err);
    throw new Error(err.message);
  }
});

ipcMain.handle('add-product', (event, product) => {
  return addProduct(product);
});

ipcMain.handle('update-product', (event, id, product) => {
  return updateProduct(id, product);
});

ipcMain.handle('delete-product', (event, id) => {
  return deleteProduct(id);
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

// CRM IPC Handlers
ipcMain.handle('get-all-customers', () => {
  return getAllCustomers();
});

ipcMain.handle('get-customer-by-phone', (event, phone) => {
  return getCustomerByPhone(phone);
});

ipcMain.handle('add-customer', (event, customer) => {
  return addCustomer(customer);
});

ipcMain.handle('update-customer', (event, id, customer) => {
  return updateCustomer(id, customer);
});

ipcMain.handle('delete-customer', (event, id) => {
  return deleteCustomer(id);
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

ipcMain.handle('delete-expense', (event, id) => {
  return deleteExpense(id);
});
