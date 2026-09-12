// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';
import { 
  CartItem, 
  PaymentData, 
  Product, 
  Customer, 
  User, 
  Vendor, 
  POItemInput, 
  WhatsAppConfig, 
  UpdaterStatusData 
} from './types';

contextBridge.exposeInMainWorld('api', {
  getAllProducts: () => ipcRenderer.invoke('get-all-products'),
  getProduct: (barcode: string) => ipcRenderer.invoke('get-product', barcode),
  getNextSaleId: () => ipcRenderer.invoke('get-next-sale-id'),
  checkout: (data: { items: CartItem[]; paymentData: PaymentData; userId?: number; cashierName?: string }) => ipcRenderer.invoke('checkout', data),
  addManualDailyClosingSale: (data: { total: number; cashAmount?: number; onlineAmount?: number; notes?: string; date?: string; cashierName?: string }) => ipcRenderer.invoke('add-manual-closing-sale', data),
  addProduct: (product: Omit<Product, 'id'>) => ipcRenderer.invoke('add-product', product),
  bulkAddProducts: (productsList: Array<Omit<Product, 'id'>>) => ipcRenderer.invoke('bulk-add-products', productsList),
  updateProduct: (id: number, product: Omit<Product, 'id'>) => ipcRenderer.invoke('update-product', id, product),
  bulkUpdateProducts: (updates: Array<{ id: number; cost_price: number; price: number; stock: number; category?: string }>) => ipcRenderer.invoke('bulk-update-products', updates),
  deleteProduct: (id: number) => ipcRenderer.invoke('delete-product', id),
  printReceipt: (data: { items: CartItem[]; paymentData: PaymentData; saleId?: number; cashierName?: string }) => ipcRenderer.invoke('print-receipt', data),
  printBarcode: (product: Product) => ipcRenderer.invoke('print-barcode', product),
  getAllCustomers: () => ipcRenderer.invoke('get-all-customers'),
  getCustomerByPhone: (phone: string) => ipcRenderer.invoke('get-customer-by-phone', phone),
  addCustomer: (customer: Omit<Customer, 'id' | 'points' | 'balance'> & { points?: number; balance?: number }) => ipcRenderer.invoke('add-customer', customer),
  updateCustomer: (id: number, customer: Omit<Customer, 'id'>) => ipcRenderer.invoke('update-customer', id, customer),
  deleteCustomer: (id: number) => ipcRenderer.invoke('delete-customer', id),
  getCustomerKhata: (customerId: number) => ipcRenderer.invoke('get-customer-khata', customerId),
  addCustomerLoanPayment: (data: { customerId: number; amount: number; paymentMethod?: string; notes?: string }) => ipcRenderer.invoke('add-customer-loan-payment', data),
  addCustomerLoanEntry: (data: { customerId: number; amount: number; notes?: string }) => ipcRenderer.invoke('add-customer-loan-entry', data),
  updateCustomerKhataEntry: (data: { id: number; amount: number; notes?: string; paymentMethod?: string }) => ipcRenderer.invoke('update-customer-khata-entry', data),
  deleteCustomerKhataEntry: (id: number) => ipcRenderer.invoke('delete-customer-khata-entry', id),
  clearAllKhata: () => ipcRenderer.invoke('clear-all-khata'),
  verifyUserPin: (pin: string) => ipcRenderer.invoke('verify-user-pin', pin),
  clockIn: (userId: number) => ipcRenderer.invoke('clock-in', userId),
  clockOut: (shiftId: number) => ipcRenderer.invoke('clock-out', shiftId),
  getActiveShift: (userId: number) => ipcRenderer.invoke('get-active-shift', userId),
  onSyncStatusChanged: (callback: (status: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: string) => callback(status);
    ipcRenderer.on('sync-status-changed', handler);
    return () => {
      ipcRenderer.removeListener('sync-status-changed', handler);
    };
  },
  getSalesAnalytics: () => ipcRenderer.invoke('get-sales-analytics'),
  getAllSales: () => ipcRenderer.invoke('get-all-sales'),
  returnSaleItems: (saleId: number, returnsList: { productId: number; qtyToReturn: number }[]) => ipcRenderer.invoke('return-sale-items', saleId, returnsList),
  deleteSale: (saleId: number) => ipcRenderer.invoke('delete-sale', saleId),
  
  // Expenses tracking
  getAllExpenses: () => ipcRenderer.invoke('get-all-expenses'),
  addExpense: (expense: { amount: number; description: string; category: string; loggedBy: string }) => ipcRenderer.invoke('add-expense', expense),
  updateExpense: (id: number, expense: { amount: number; description: string; category: string; loggedBy: string }) => ipcRenderer.invoke('update-expense', id, expense),
  deleteExpense: (id: number) => ipcRenderer.invoke('delete-expense', id),

  // User Management
  getAllUsers: () => ipcRenderer.invoke('get-all-users'),
  addUser: (user: Omit<User, 'id'>) => ipcRenderer.invoke('add-user', user),
  updateUser: (id: number, user: Omit<User, 'id'>) => ipcRenderer.invoke('update-user', id, user),
  deleteUser: (id: number) => ipcRenderer.invoke('delete-user', id),

  // Vendors & Purchase Orders
  getAllVendors: () => ipcRenderer.invoke('get-all-vendors'),
  addVendor: (vendor: Omit<Vendor, 'id'>) => ipcRenderer.invoke('add-vendor', vendor),
  updateVendor: (id: number, vendor: Omit<Vendor, 'id'>) => ipcRenderer.invoke('update-vendor', id, vendor),
  deleteVendor: (id: number) => ipcRenderer.invoke('delete-vendor', id),
  getAllPurchaseOrders: () => ipcRenderer.invoke('get-all-purchase-orders'),
  createPurchaseOrder: (vendorId: number, items: POItemInput[], customTotalCost?: number, notes?: string) => ipcRenderer.invoke('create-purchase-order', vendorId, items, customTotalCost, notes),
  receivePurchaseOrder: (poId: number) => ipcRenderer.invoke('receive-purchase-order', poId),
  deletePurchaseOrder: (poId: number, bypassTimeCheck?: boolean) => ipcRenderer.invoke('delete-purchase-order', poId, bypassTimeCheck),
  addVendorPayment: (payment: { poId: number; vendorId: number; amount: number; paymentMethod?: string; notes?: string }) => ipcRenderer.invoke('add-vendor-payment', payment),
  deleteVendorPayment: (paymentId: number, bypassTimeCheck?: boolean) => ipcRenderer.invoke('delete-vendor-payment', paymentId, bypassTimeCheck),
  updateVendorPayment: (paymentId: number, updateData: { amount: number; paymentMethod?: string; notes?: string }, bypassTimeCheck?: boolean) => ipcRenderer.invoke('update-vendor-payment', paymentId, updateData, bypassTimeCheck),
  deleteVendorOrderEntry: (entryId: number, bypassTimeCheck?: boolean) => ipcRenderer.invoke('delete-vendor-order-entry', entryId, bypassTimeCheck),
  updateVendorOrderEntry: (entryId: number, updateData: { amount: number; notes?: string }, bypassTimeCheck?: boolean) => ipcRenderer.invoke('update-vendor-order-entry', entryId, updateData, bypassTimeCheck),
  getVendorPayments: (vendorId?: number) => ipcRenderer.invoke('get-vendor-payments', vendorId),
  getVendorOrderEntries: (vendorId?: number) => ipcRenderer.invoke('get-vendor-order-entries', vendorId),

  // WhatsApp Automation
  sendWhatsAppMessage: (toPhone: string, messageText: string, config?: WhatsAppConfig) => ipcRenderer.invoke('send-whatsapp-message', toPhone, messageText, config),

  // Auto-Updater
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  quitAndInstallUpdate: () => ipcRenderer.invoke('quit-and-install-update'),
  onUpdaterStatus: (callback: (data: UpdaterStatusData) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: UpdaterStatusData) => callback(data);
    ipcRenderer.on('updater-status', handler);
    return () => {
      ipcRenderer.removeListener('updater-status', handler);
    };
  }
});
