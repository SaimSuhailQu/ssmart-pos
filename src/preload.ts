// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  getAllProducts: () => ipcRenderer.invoke('get-all-products'),
  getProduct: (barcode: string) => ipcRenderer.invoke('get-product', barcode),
  getNextSaleId: () => ipcRenderer.invoke('get-next-sale-id'),
  checkout: (data: any) => ipcRenderer.invoke('checkout', data),
  addProduct: (product: any) => ipcRenderer.invoke('add-product', product),
  updateProduct: (id: number, product: any) => ipcRenderer.invoke('update-product', id, product),
  deleteProduct: (id: number) => ipcRenderer.invoke('delete-product', id),
  printBarcode: (product: any) => ipcRenderer.invoke('print-barcode', product),
  getAllCustomers: () => ipcRenderer.invoke('get-all-customers'),
  getCustomerByPhone: (phone: string) => ipcRenderer.invoke('get-customer-by-phone', phone),
  addCustomer: (customer: any) => ipcRenderer.invoke('add-customer', customer),
  updateCustomer: (id: number, customer: any) => ipcRenderer.invoke('update-customer', id, customer),
  deleteCustomer: (id: number) => ipcRenderer.invoke('delete-customer', id),
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
  deleteExpense: (id: number) => ipcRenderer.invoke('delete-expense', id),

  // User Management
  getAllUsers: () => ipcRenderer.invoke('get-all-users'),
  addUser: (user: any) => ipcRenderer.invoke('add-user', user),
  updateUser: (id: number, user: any) => ipcRenderer.invoke('update-user', id, user),
  deleteUser: (id: number) => ipcRenderer.invoke('delete-user', id)
});
