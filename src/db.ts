import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

// Setup database in user data directory
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'mart-pos.db');

export const db = new Database(dbPath);

export function initDb() {
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      barcode TEXT UNIQUE NOT NULL,
      price REAL NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      category TEXT NOT NULL DEFAULT 'General'
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subtotal REAL NOT NULL,
      tax REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'Cash',
      amount_tendered REAL NOT NULL DEFAULT 0,
      change_given REAL NOT NULL DEFAULT 0,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      synced BOOLEAN DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      qty INTEGER NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      method TEXT NOT NULL,
      amount REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id)
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT UNIQUE,
      email TEXT,
      points INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pin TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Cashier' -- Cashier, Manager, Admin
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      clock_in DATETIME DEFAULT CURRENT_TIMESTAMP,
      clock_out DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact TEXT,
      category TEXT
    );

    CREATE TABLE IF NOT EXISTS store_branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT
    );
  `);

  // Seed default admin and cashier if users table is empty
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    db.prepare('INSERT INTO users (pin, name, role) VALUES (?, ?, ?)').run('1234', 'Default Cashier', 'Cashier');
    db.prepare('INSERT INTO users (pin, name, role) VALUES (?, ?, ?)').run('9999', 'Admin Manager', 'Admin');
  }

  // Seed some dummy customers
  const custCount = db.prepare('SELECT COUNT(*) as count FROM customers').get() as { count: number };
  if (custCount.count === 0) {
    db.prepare('INSERT INTO customers (name, phone, email, points) VALUES (?, ?, ?, ?)').run('John Doe', '1234567890', 'john@example.com', 120);
    db.prepare('INSERT INTO customers (name, phone, email, points) VALUES (?, ?, ?, ?)').run('Jane Smith', '0987654321', 'jane@example.com', 45);
  }

  // Seed some dummy vendors
  const vendCount = db.prepare('SELECT COUNT(*) as count FROM vendors').get() as { count: number };
  if (vendCount.count === 0) {
    db.prepare('INSERT INTO vendors (name, contact, category) VALUES (?, ?, ?)').run('Zara Mall Branch', 'zara@mall.com', 'Apparel');
    db.prepare('INSERT INTO vendors (name, contact, category) VALUES (?, ?, ?)').run('Starbucks Coffee', 'starbucks@mall.com', 'Food & Beverage');
  }

  // Simple migration to add category if it's missing from previous schema
  try {
    db.prepare("SELECT category FROM products LIMIT 1").get();
  } catch (e) {
    db.exec("ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT 'General'");
  }

  // Simple migration for sales table
  try {
    db.prepare("SELECT payment_method FROM sales LIMIT 1").get();
  } catch (e) {
    db.exec(`
      ALTER TABLE sales ADD COLUMN subtotal REAL NOT NULL DEFAULT 0;
      ALTER TABLE sales ADD COLUMN tax REAL NOT NULL DEFAULT 0;
      ALTER TABLE sales ADD COLUMN discount REAL NOT NULL DEFAULT 0;
      ALTER TABLE sales ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'Cash';
      ALTER TABLE sales ADD COLUMN amount_tendered REAL NOT NULL DEFAULT 0;
      ALTER TABLE sales ADD COLUMN change_given REAL NOT NULL DEFAULT 0;
    `);
  }

  // Simple migration to add user_id to sales table
  try {
    db.prepare("SELECT user_id FROM sales LIMIT 1").get();
  } catch (e) {
    try {
      db.exec("ALTER TABLE sales ADD COLUMN user_id INTEGER;");
    } catch (err) {
      console.error("Migration error adding user_id:", err);
    }
  }

  // Seed dummy products if empty
  const count = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
  if (count.count === 0) {
    const insert = db.prepare('INSERT INTO products (name, barcode, price, stock, category) VALUES (?, ?, ?, ?, ?)');
    const insertMany = db.transaction((products: any[]) => {
      for (const product of products) {
        insert.run(product.name, product.barcode, product.price, product.stock, product.category);
      }
    });

    insertMany([
      // Drinks
      { name: 'Coca Cola 1.5L', barcode: '123456789012', price: 2.50, stock: 100, category: 'Drinks' },
      { name: 'Red Bull Energy', barcode: '111222333444', price: 3.00, stock: 80, category: 'Drinks' },
      { name: 'Orange Juice 1L', barcode: '222333444555', price: 4.50, stock: 40, category: 'Drinks' },
      { name: 'Mineral Water', barcode: '333444555666', price: 1.00, stock: 200, category: 'Drinks' },
      // Snacks
      { name: 'Lays Classic Chips', barcode: '098765432109', price: 1.99, stock: 50, category: 'Snacks' },
      { name: 'Snickers Bar', barcode: '555666777888', price: 1.25, stock: 120, category: 'Snacks' },
      { name: 'Doritos Nacho', barcode: '444555666777', price: 2.50, stock: 60, category: 'Snacks' },
      { name: 'Oreo Cookies', barcode: '777888999000', price: 3.50, stock: 45, category: 'Snacks' },
      // Groceries
      { name: 'Fresh Milk 2L', barcode: '888999000111', price: 3.20, stock: 30, category: 'Groceries' },
      { name: 'White Bread', barcode: '999000111222', price: 2.00, stock: 25, category: 'Groceries' },
      { name: 'Free Range Eggs', barcode: '000111222333', price: 4.99, stock: 40, category: 'Groceries' },
      // Electronics
      { name: 'AA Batteries 4pk', barcode: '101010101010', price: 5.99, stock: 150, category: 'Electronics' },
      { name: 'USB-C Cable', barcode: '202020202020', price: 12.99, stock: 35, category: 'Electronics' },
      // Fast Add
      { name: 'Plastic Bag', barcode: '000000000001', price: 0.10, stock: 9999, category: 'General' },
    ]);
  }
}

// Data Access Methods
export function getProductByBarcode(barcode: string) {
  return db.prepare('SELECT * FROM products WHERE barcode = ?').get(barcode);
}

export function getAllProducts() {
  return db.prepare('SELECT * FROM products').all();
}

export function saveSale(items: any[], paymentData: { subtotal: number, tax: number, discount: number, total: number, payments: any[], change: number, userId?: number }) {
  const insertSale = db.prepare('INSERT INTO sales (subtotal, tax, discount, total, payment_method, amount_tendered, change_given, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const insertSaleItem = db.prepare('INSERT INTO sale_items (sale_id, product_id, qty, price) VALUES (?, ?, ?, ?)');
  const insertPayment = db.prepare('INSERT INTO payments (sale_id, method, amount) VALUES (?, ?, ?)');
  const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');

  let saleId = 0;
  
  const transaction = db.transaction(() => {
    // For legacy compatibility in the sales table, we log the primary method or 'Split'
    const primaryMethod = paymentData.payments.length > 1 ? 'Split' : paymentData.payments[0]?.method || 'Unknown';
    const totalTendered = paymentData.payments.reduce((sum, p) => sum + p.amount, 0);

    const info = insertSale.run(paymentData.subtotal, paymentData.tax, paymentData.discount, paymentData.total, primaryMethod, totalTendered, paymentData.change, paymentData.userId || null);
    saleId = info.lastInsertRowid as number;

    for (const item of items) {
      insertSaleItem.run(saleId, item.id, item.qty, item.price);
      updateStock.run(item.qty, item.id);
    }

    for (const p of paymentData.payments) {
      insertPayment.run(saleId, p.method, p.amount);
    }
  });

  transaction();
  return saleId;
}

export function addProduct(product: Omit<any, 'id'>) {
  const insert = db.prepare('INSERT INTO products (name, barcode, price, stock, category) VALUES (?, ?, ?, ?, ?)');
  const info = insert.run(product.name, product.barcode, product.price, product.stock, product.category);
  return info.lastInsertRowid;
}

export function updateProduct(id: number, product: Omit<any, 'id'>) {
  const update = db.prepare('UPDATE products SET name = ?, barcode = ?, price = ?, stock = ?, category = ? WHERE id = ?');
  const info = update.run(product.name, product.barcode, product.price, product.stock, product.category, id);
  return info.changes > 0;
}

export function deleteProduct(id: number) {
  // Be careful: if a product is deleted, what happens to sale_items referencing it? 
  // Ideally we should use soft deletes, but for simplicity we'll hard delete.
  const del = db.prepare('DELETE FROM products WHERE id = ?');
  const info = del.run(id);
  return info.changes > 0;
}

// --- Customer Data Access ---
export function getAllCustomers() {
  return db.prepare('SELECT * FROM customers').all();
}

export function getCustomerById(id: number) {
  return db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
}

export function getCustomerByPhone(phone: string) {
  return db.prepare('SELECT * FROM customers WHERE phone = ?').get(phone);
}

export function addCustomer(customer: { name: string, phone: string, email: string, points?: number }) {
  const insert = db.prepare('INSERT INTO customers (name, phone, email, points) VALUES (?, ?, ?, ?)');
  const info = insert.run(customer.name, customer.phone, customer.email, customer.points || 0);
  return info.lastInsertRowid;
}

export function updateCustomer(id: number, customer: { name: string, phone: string, email: string, points: number }) {
  const update = db.prepare('UPDATE customers SET name = ?, phone = ?, email = ?, points = ? WHERE id = ?');
  const info = update.run(customer.name, customer.phone, customer.email, customer.points, id);
  return info.changes > 0;
}

export function deleteCustomer(id: number) {
  return db.prepare('DELETE FROM customers WHERE id = ?').run(id).changes > 0;
}

// --- User & Shift Data Access ---
export function verifyUserPin(pin: string) {
  return db.prepare('SELECT id, name, role FROM users WHERE pin = ?').get(pin);
}

export function clockIn(userId: number) {
  const insert = db.prepare('INSERT INTO shifts (user_id) VALUES (?)');
  const info = insert.run(userId);
  return info.lastInsertRowid;
}

export function clockOut(shiftId: number) {
  const update = db.prepare('UPDATE shifts SET clock_out = CURRENT_TIMESTAMP WHERE id = ?');
  return update.run(shiftId).changes > 0;
}

export function getActiveShift(userId: number) {
  return db.prepare('SELECT * FROM shifts WHERE user_id = ? AND clock_out IS NULL ORDER BY id DESC LIMIT 1').get(userId);
}

// --- Sync & Cloud Integration ---
export function getUnsyncedSales() {
  const sales = db.prepare(`
    SELECT s.*, u.name as user_name 
    FROM sales s
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.synced = 0
  `).all() as any[];
  return sales.map(sale => {
    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id);
    const payments = db.prepare('SELECT * FROM payments WHERE sale_id = ?').all(sale.id);
    return { ...sale, items, payments };
  });
}

export function markSaleAsSynced(saleId: number) {
  return db.prepare('UPDATE sales SET synced = 1 WHERE id = ?').run(saleId).changes > 0;
}

// --- Vendors & Branches Data Access ---
export function getAllVendors() {
  return db.prepare('SELECT * FROM vendors').all();
}

export function addVendor(vendor: { name: string, contact: string, category: string }) {
  const insert = db.prepare('INSERT INTO vendors (name, contact, category) VALUES (?, ?, ?)');
  return insert.run(vendor.name, vendor.contact, vendor.category).lastInsertRowid;
}

export function getStoreBranches() {
  return db.prepare('SELECT * FROM store_branches').all();
}

// --- Analytics & Financial Reporting ---
export function getSalesAnalytics() {
  const totalRevenue = db.prepare('SELECT SUM(total) as revenue FROM sales').get() as { revenue: number | null };
  const totalOrders = db.prepare('SELECT COUNT(*) as count FROM sales').get() as { count: number };
  const avgTicket = db.prepare('SELECT AVG(total) as avgTicket FROM sales').get() as { avgTicket: number | null };

  const salesByMethod = db.prepare(`
    SELECT payment_method as method, SUM(total) as value 
    FROM sales 
    GROUP BY payment_method
  `).all();

  const topProducts = db.prepare(`
    SELECT p.name, SUM(si.qty) as qty, SUM(si.qty * si.price) as revenue
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    GROUP BY si.product_id
    ORDER BY qty DESC
    LIMIT 5
  `).all();

  const dailyTrend = db.prepare(`
    SELECT strftime('%Y-%m-%d', timestamp) as date, SUM(total) as revenue
    FROM sales
    WHERE timestamp >= date('now', '-7 days')
    GROUP BY date
    ORDER BY date ASC
  `).all();

  return {
    summary: {
      totalRevenue: totalRevenue.revenue || 0,
      totalOrders: totalOrders.count || 0,
      avgTicket: avgTicket.avgTicket || 0
    },
    salesByMethod,
    topProducts,
    dailyTrend
  };
}

// --- In-App User/PIN Dashboard APIs ---
export function getAllUsers() {
  return db.prepare('SELECT id, name, pin, role FROM users').all();
}

export function addUser(user: { name: string, pin: string, role: string }) {
  const insert = db.prepare('INSERT INTO users (name, pin, role) VALUES (?, ?, ?)');
  return insert.run(user.name, user.pin, user.role).lastInsertRowid;
}

export function updateUser(id: number, user: { name: string, pin: string, role: string }) {
  const update = db.prepare('UPDATE users SET name = ?, pin = ?, role = ? WHERE id = ?');
  return update.run(user.name, user.pin, user.role, id).changes > 0;
}

export function deleteUser(id: number) {
  return db.prepare('DELETE FROM users WHERE id = ?').run(id).changes > 0;
}
