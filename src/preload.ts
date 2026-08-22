// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  getAllProducts: () => ipcRenderer.invoke('get-all-products'),
  getProduct: (barcode: string) => ipcRenderer.invoke('get-product', barcode),
  getNextSaleId: () => ipcRenderer.invoke('get-next-sale-id'),
  checkout: (data: any) => ipcRenderer.invoke('checkout', data),
  addProduct: (product: any) => ipcRenderer.invoke('add-product', product),
  bulkAddProducts: (productsList: any[]) => ipcRenderer.invoke('bulk-add-products', productsList),
  updateProduct: (id: number, product: any) => ipcRenderer.invoke('update-product', id, product),
  bulkUpdateProducts: (updates: any[]) => ipcRenderer.invoke('bulk-update-products', updates),
  deleteProduct: (id: number) => ipcRenderer.invoke('delete-product', id),
  printReceipt: (data: any) => ipcRenderer.invoke('print-receipt', data),
  printBarcode: (product: any) => ipcRenderer.invoke('print-barcode', product),
  getAllCustomers: () => ipcRenderer.invoke('get-all-customers'),
  getCustomerByPhone: (phone: string) => ipcRenderer.invoke('get-customer-by-phone', phone),
  addCustomer: (customer: any) => ipcRenderer.invoke('add-customer', customer),
  updateCustomer: (id: number, customer: any) => ipcRenderer.invoke('update-customer', id, customer),
  deleteCustomer: (id: number) => ipcRenderer.invoke('delete-customer', id),
  getCustomerKhata: (customerId: number) => ipcRenderer.invoke('get-customer-khata', customerId),
  addCustomerLoanPayment: (data: any) => ipcRenderer.invoke('add-customer-loan-payment', data),
  addCustomerLoanEntry: (data: any) => ipcRenderer.invoke('add-customer-loan-entry', data),
  verifyUserPin: (pin: string) => ipcRenderer.invoke('verify-user-pin', pin),
  clockIn: (userId: number) => ipcRenderer.invoke('clock-in', userId),
  clockOut: (shiftId: number) => ipcRenderer.invoke('clock-out', shiftId),
  getActiveShift: (userId: number) => ipcRenderer.invoke('get-active-shift', userId),
  onSyncStatusChanged: (callback: (status: string) => void) => {
    ipcRenderer.on('sync-status-changed', (event, status) => callback(status));
  },
  getSalesAnalytics: () => ipcRenderer.invoke('get-sales-analytics'),
  getAllSales: () => ipcRenderer.invoke('get-all-sales'),
  returnSaleItems: (saleId: number, returnsList: any[]) => ipcRenderer.invoke('return-sale-items', saleId, returnsList),
  
  // Expenses tracking
  getAllExpenses: () => ipcRenderer.invoke('get-all-expenses'),
  addExpense: (expense: any) => ipcRenderer.invoke('add-expense', expense),
  updateExpense: (id: number, expense: any) => ipcRenderer.invoke('update-expense', id, expense),
  deleteExpense: (id: number) => ipcRenderer.invoke('delete-expense', id),

  // User Management
  getAllUsers: () => ipcRenderer.invoke('get-all-users'),
  addUser: (user: any) => ipcRenderer.invoke('add-user', user),
  updateUser: (id: number, user: any) => ipcRenderer.invoke('update-user', id, user),
  deleteUser: (id: number) => ipcRenderer.invoke('delete-user', id),

  // Vendors & Purchase Orders
  getAllVendors: () => ipcRenderer.invoke('get-all-vendors'),
  addVendor: (vendor: any) => ipcRenderer.invoke('add-vendor', vendor),
  updateVendor: (id: number, vendor: any) => ipcRenderer.invoke('update-vendor', id, vendor),
  deleteVendor: (id: number) => ipcRenderer.invoke('delete-vendor', id),
  getAllPurchaseOrders: () => ipcRenderer.invoke('get-all-purchase-orders'),
  createPurchaseOrder: (vendorId: number, items: any[], customTotalCost?: number, notes?: string) => ipcRenderer.invoke('create-purchase-order', vendorId, items, customTotalCost, notes),
  receivePurchaseOrder: (poId: number) => ipcRenderer.invoke('receive-purchase-order', poId),
  deletePurchaseOrder: (poId: number) => ipcRenderer.invoke('delete-purchase-order', poId),
  addVendorPayment: (payment: any) => ipcRenderer.invoke('add-vendor-payment', payment),
  getVendorPayments: (vendorId?: number) => ipcRenderer.invoke('get-vendor-payments', vendorId),
  getVendorOrderEntries: (vendorId?: number) => ipcRenderer.invoke('get-vendor-order-entries', vendorId),

  // WhatsApp Automation
  sendWhatsAppMessage: (toPhone: string, messageText: string, config?: any) => ipcRenderer.invoke('send-whatsapp-message', toPhone, messageText, config)
});
