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
}

export interface Customer {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  points: number;
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
      checkout: (data: { items: CartItem[], paymentData: PaymentData, userId?: number }) => Promise<{ success: boolean; saleId: number }>;
      addProduct: (product: Omit<Product, 'id'>) => Promise<number>;
      updateProduct: (id: number, product: Omit<Product, 'id'>) => Promise<boolean>;
      deleteProduct: (id: number) => Promise<boolean>;
      printBarcode: (product: Product) => Promise<boolean>;
      
      // Sales History & Returns
      getAllSales: () => Promise<Sale[]>;
      returnSaleItems: (saleId: number, returnsList: { productId: number, qtyToReturn: number }[]) => Promise<boolean>;
      
      // CRM
      getAllCustomers: () => Promise<Customer[]>;
      getCustomerByPhone: (phone: string) => Promise<Customer | undefined>;
      addCustomer: (customer: Omit<Customer, 'id' | 'points'> & { points?: number }) => Promise<number>;
      updateCustomer: (id: number, customer: Omit<Customer, 'id'>) => Promise<boolean>;
      deleteCustomer: (id: number) => Promise<boolean>;

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
      deleteExpense: (id: number) => Promise<boolean>;
      
      // User Management
      getAllUsers: () => Promise<User[]>;
      addUser: (user: Omit<User, 'id'>) => Promise<number>;
      updateUser: (id: number, user: Omit<User, 'id'>) => Promise<boolean>;
      deleteUser: (id: number) => Promise<boolean>;
    }
  }
}

