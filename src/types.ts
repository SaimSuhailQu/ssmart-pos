export interface Product {
  id: number;
  name: string;
  barcode: string;
  price: number;
  stock: number;
  category: string;
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

declare global {
  interface Window {
    api: {
      getAllProducts: () => Promise<Product[]>;
      getProduct: (barcode: string) => Promise<Product | undefined>;
      checkout: (data: { items: CartItem[], paymentData: PaymentData, userId?: number }) => Promise<{ success: boolean; saleId: number }>;
      addProduct: (product: Omit<Product, 'id'>) => Promise<number>;
      updateProduct: (id: number, product: Omit<Product, 'id'>) => Promise<boolean>;
      deleteProduct: (id: number) => Promise<boolean>;
      printBarcode: (product: Product) => Promise<boolean>;
      
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
      
      // User Management
      getAllUsers: () => Promise<User[]>;
      addUser: (user: Omit<User, 'id'>) => Promise<number>;
      updateUser: (id: number, user: Omit<User, 'id'>) => Promise<boolean>;
      deleteUser: (id: number) => Promise<boolean>;
    }
  }
}

