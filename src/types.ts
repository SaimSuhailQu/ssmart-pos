export interface Expense {
  id: number;
  amount: number;
  description: string;
  category: string;
  logged_by: string;
  timestamp: string;
  synced: number;
}

export interface Product {
  id: number;
  name: string;
  barcode: string;
  price: number;
  stock: number;
  category: string;
  cost_price: number;
}

export interface CartItem extends Product {
  qty: number;
}

export interface PaymentEntry {
  method: string;
  amount: number;
}

export interface PaymentData {
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  payments: PaymentEntry[];
  change: number;
  customerId?: number;
}

export interface CustomerKhataEntry {
  id: number;
  customer_id: number;
  sale_id?: number;
  type: 'LOAN' | 'PAYMENT';
  amount: number;
  notes?: string;
  payment_method?: string;
  timestamp: string;
  sale_total?: number;
}

export interface Customer {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  points: number;
  balance?: number;
}

export interface Vendor {
  id: number;
  name: string;
  contact?: string;
  category?: string;
}

export interface PurchaseOrderItem {
  id: number;
  po_id: number;
  product_id: number;
  qty: number;
  cost_price: number;
  product_name?: string;
  product_barcode?: string;
}

export interface VendorPayment {
  id: number;
  po_id: number;
  vendor_id: number;
  amount: number;
  payment_method: string;
  notes?: string;
  timestamp: string;
  vendor_name?: string;
}

export interface VendorOrderEntry {
  id: number;
  po_id: number;
  vendor_id: number;
  amount: number;
  notes?: string;
  timestamp: string;
  vendor_name?: string;
}

export interface PurchaseOrder {
  id: number;
  vendor_id: number;
  status: 'Pending' | 'Received' | 'Cancelled';
  total_cost: number;
  paid_amount?: number;
  payment_status?: 'Unpaid' | 'Partially Paid' | 'Paid';
  notes?: string;
  timestamp: string;
  vendor_name?: string;
  items?: PurchaseOrderItem[];
  payments?: VendorPayment[];
  order_entries?: VendorOrderEntry[];
}

export interface User {
  id: number;
  pin: string;
  name: string;
  role: 'Cashier' | 'Manager' | 'Admin';
}

export interface Shift {
  id: number;
  user_id: number;
  clock_in: string;
  clock_out?: string;
}

export interface SaleItemDetails {
  id: number;
  sale_id: number;
  product_id: number;
  qty: number;
  price: number;
  returned_qty: number;
  product_name: string;
  product_barcode: string;
  product_category: string;
}

export interface Sale {
  id: number;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  payment_method: string;
  amount_tendered: number;
  change_given: number;
  timestamp: string;
  synced: number;
  user_id?: number;
  cashier_name?: string;
  status: 'Completed' | 'Returned' | 'Partially Returned';
  refund_amount: number;
  items?: SaleItemDetails[];
}

declare global {
  interface Window {
    api: {
      getAllProducts: () => Promise<Product[]>;
      getProduct: (barcode: string) => Promise<Product | undefined>;
      getNextSaleId: () => Promise<number>;
      checkout: (data: { items: CartItem[], paymentData: PaymentData, userId?: number, cashierName?: string }) => Promise<{ success: boolean; saleId: number }>;
      addProduct: (product: Omit<Product, 'id'>) => Promise<number>;
      bulkAddProducts: (productsList: Array<Omit<Product, 'id'>>) => Promise<number>;
      updateProduct: (id: number, product: Omit<Product, 'id'>) => Promise<boolean>;
      bulkUpdateProducts: (updates: Array<{ id: number; cost_price: number; price: number; stock: number; category?: string }>) => Promise<boolean>;
      deleteProduct: (id: number) => Promise<boolean>;
      printReceipt: (data: { items: CartItem[]; paymentData: PaymentData; saleId?: number; cashierName?: string }) => Promise<boolean>;
      printBarcode: (product: Product) => Promise<boolean>;
      
      // Sales History & Returns
      getAllSales: () => Promise<Sale[]>;
      returnSaleItems: (saleId: number, returnsList: { productId: number, qtyToReturn: number }[]) => Promise<boolean>;
      
      // CRM & Customer Khata / Loan
      getAllCustomers: () => Promise<Customer[]>;
      getCustomerByPhone: (phone: string) => Promise<Customer | undefined>;
      addCustomer: (customer: Omit<Customer, 'id' | 'points' | 'balance'> & { points?: number, balance?: number }) => Promise<number>;
      updateCustomer: (id: number, customer: Omit<Customer, 'id'>) => Promise<boolean>;
      deleteCustomer: (id: number) => Promise<boolean>;
      getCustomerKhata: (customerId: number) => Promise<CustomerKhataEntry[]>;
      addCustomerLoanPayment: (data: { customerId: number, amount: number, paymentMethod?: string, notes?: string }) => Promise<boolean>;
      addCustomerLoanEntry: (data: { customerId: number, amount: number, notes?: string }) => Promise<boolean>;
      clearAllKhata: () => Promise<{ success: boolean, message?: string, error?: string }>;

      // Users & Shifts
      verifyUserPin: (pin: string) => Promise<{ id: number, name: string, role: string } | undefined>;
      clockIn: (userId: number) => Promise<number>;
      clockOut: (shiftId: number) => Promise<boolean>;
      getActiveShift: (userId: number) => Promise<Shift | undefined>;
      onSyncStatusChanged: (callback: (status: string) => void) => void;
      getSalesAnalytics: () => Promise<any>;

      // Expense Tracking
      getAllExpenses: () => Promise<Expense[]>;
      addExpense: (expense: { amount: number, description: string, category: string, loggedBy: string }) => Promise<number>;
      updateExpense: (id: number, expense: { amount: number, description: string, category: string, loggedBy: string }) => Promise<boolean>;
      deleteExpense: (id: number) => Promise<boolean>;
      
      // User Management
      getAllUsers: () => Promise<User[]>;
      addUser: (user: Omit<User, 'id'>) => Promise<number>;
      updateUser: (id: number, user: Omit<User, 'id'>) => Promise<boolean>;
      deleteUser: (id: number) => Promise<boolean>;

      // Vendors & Purchase Orders
      getAllVendors: () => Promise<Vendor[]>;
      addVendor: (vendor: Omit<Vendor, 'id'>) => Promise<number>;
      updateVendor: (id: number, vendor: Omit<Vendor, 'id'>) => Promise<boolean>;
      deleteVendor: (id: number) => Promise<boolean>;
      getAllPurchaseOrders: () => Promise<PurchaseOrder[]>;
      createPurchaseOrder: (vendorId: number, items: any[], customTotalCost?: number, notes?: string) => Promise<number>;
      receivePurchaseOrder: (poId: number) => Promise<boolean>;
      deletePurchaseOrder: (poId: number) => Promise<boolean>;
      addVendorPayment: (payment: { poId: number, vendorId: number, amount: number, paymentMethod?: string, notes?: string }) => Promise<boolean>;
      getVendorPayments: (vendorId?: number) => Promise<VendorPayment[]>;
      getVendorOrderEntries: (vendorId?: number) => Promise<VendorOrderEntry[]>;

      // WhatsApp Background Automation
      sendWhatsAppMessage: (toPhone: string, messageText: string, config?: { phoneNumberId?: string, accessToken?: string }) => Promise<{ success: boolean; error?: string }>;
    }
  }
}
