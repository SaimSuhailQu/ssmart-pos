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
      category TEXT NOT NULL DEFAULT 'General',
      cost_price REAL NOT NULL DEFAULT 0
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

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      logged_by TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      synced BOOLEAN DEFAULT 0
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

  // Simple migration to add cost_price if it's missing from products table
  try {
    db.prepare("SELECT cost_price FROM products LIMIT 1").get();
  } catch (e) {
    try {
      db.exec("ALTER TABLE products ADD COLUMN cost_price REAL NOT NULL DEFAULT 0;");
      db.exec("UPDATE products SET cost_price = price * 0.7 WHERE cost_price = 0 OR cost_price IS NULL;");
    } catch (err) {
      console.error("Migration error adding cost_price:", err);
    }
  }

  // Simple migration to add status and refund_amount to sales table
  try {
    db.prepare("SELECT status FROM sales LIMIT 1").get();
  } catch (e) {
    try {
      db.exec("ALTER TABLE sales ADD COLUMN status TEXT DEFAULT 'Completed';");
      db.exec("ALTER TABLE sales ADD COLUMN refund_amount REAL DEFAULT 0;");
    } catch (err) {
      console.error("Migration error adding status and refund_amount columns to sales table:", err);
    }
  }

  // Simple migration to add returned_qty to sale_items table
  try {
    db.prepare("SELECT returned_qty FROM sale_items LIMIT 1").get();
  } catch (e) {
    try {
      db.exec("ALTER TABLE sale_items ADD COLUMN returned_qty INTEGER DEFAULT 0;");
    } catch (err) {
      console.error("Migration error adding returned_qty to sale_items table:", err);
    }
  }

  // Detect and migrate old USD dummy products to PKR Pakistani products
  try {
    const hasOldCoke = db.prepare("SELECT * FROM products WHERE barcode = '123456789012' AND price < 10").get();
    if (hasOldCoke) {
      console.log("Old USD dummy products detected. Clearing all transaction history and reseeding with PKR Pakistani products...");
      db.prepare('DELETE FROM sale_items').run();
      db.prepare('DELETE FROM payments').run();
      db.prepare('DELETE FROM sales').run();
      db.prepare('DELETE FROM products').run();
    }
  } catch (err) {
    console.error("Failed to execute USD to PKR migration:", err);
  }

  // Seed dummy products if empty
  const count = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
  if (count.count === 0) {
    const insert = db.prepare('INSERT INTO products (name, barcode, price, stock, category, cost_price) VALUES (?, ?, ?, ?, ?, ?)');
    const insertMany = db.transaction((products: any[]) => {
      for (const product of products) {
        const costPrice = product.cost_price || (product.price * 0.7);
        insert.run(product.name, product.barcode, product.price, product.stock, product.category, costPrice);
      }
    });

    insertMany([
      // Drinks
      { name: 'Pakola Cream Soda 1.5L', barcode: '896101400234', price: 170.00, stock: 100, category: 'Drinks' },
      { name: 'Coca Cola 1.5L', barcode: '123456789012', price: 190.00, stock: 120, category: 'Drinks' },
      { name: 'Nestle Fruita Vitals Orange 1L', barcode: '222333444555', price: 290.00, stock: 60, category: 'Drinks' },
      { name: 'Gourmet Mineral Water 1.5L', barcode: '333444555666', price: 90.00, stock: 200, category: 'Drinks' },
      { name: 'Red Bull Energy Can', barcode: '111222333444', price: 480.00, stock: 80, category: 'Drinks' },
      // Snacks & Biscuits
      { name: 'Lays Masala Chips (Large)', barcode: '098765432109', price: 100.00, stock: 150, category: 'Snacks' },
      { name: 'Kurkure Red Chilli (Medium)', barcode: '444555666777', price: 60.00, stock: 120, category: 'Snacks' },
      { name: 'Oreo Biscuit Family Pack', barcode: '777888999000', price: 120.00, stock: 80, category: 'Snacks' },
      { name: 'Sooper Biscuits Half Roll', barcode: '896100122345', price: 50.00, stock: 250, category: 'Snacks' },
      { name: 'Snickers Bar 50g', barcode: '555666777888', price: 180.00, stock: 100, category: 'Snacks' },
      // Groceries
      { name: "Olper's Milk 1L", barcode: '888999000111', price: 295.00, stock: 90, category: 'Groceries' },
      { name: 'Dawn Bread (Large)', barcode: '999000111222', price: 180.00, stock: 40, category: 'Groceries' },
      { name: 'National Refined Salt 800g', barcode: '896100011223', price: 60.00, stock: 100, category: 'Groceries' },
      { name: 'Shan Biryani Masala', barcode: '896101221122', price: 130.00, stock: 150, category: 'Groceries' },
      { name: 'Tapal Danedar Tea 475g', barcode: '896101111222', price: 950.00, stock: 70, category: 'Groceries' },
      { name: 'Fresh Eggs Dozen', barcode: '000111222333', price: 320.00, stock: 35, category: 'Groceries' },
      // Personal Care & Home
      { name: 'Safeguard Soap Active 135g', barcode: '490243075231', price: 160.00, stock: 120, category: 'Personal Care' },
      { name: 'Surf Excel 1kg', barcode: '896100045231', price: 680.00, stock: 50, category: 'Personal Care' },
      { name: 'Sensodyne Herbal Multi 100g', barcode: '501010101010', price: 420.00, stock: 60, category: 'Personal Care' },
      // Fast Add
      { name: 'Plastic Bag', barcode: '000000000001', price: 10.00, stock: 9999, category: 'General' },
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

export function getNextSaleId() {
  const row = db.prepare('SELECT MAX(id) as maxId FROM sales').get() as { maxId: number | null };
  return (row.maxId || 0) + 1;
}

export function addProduct(product: Omit<any, 'id'>) {
  const insert = db.prepare('INSERT INTO products (name, barcode, price, stock, category, cost_price) VALUES (?, ?, ?, ?, ?, ?)');
  const info = insert.run(product.name, product.barcode, product.price, product.stock, product.category, product.cost_price || 0);
  return info.lastInsertRowid;
}

export function updateProduct(id: number, product: Omit<any, 'id'>) {
  const update = db.prepare('UPDATE products SET name = ?, barcode = ?, price = ?, stock = ?, category = ?, cost_price = ? WHERE id = ?');
  const info = update.run(product.name, product.barcode, product.price, product.stock, product.category, product.cost_price || 0, id);
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

// --- Sales History & Returns Data Access ---
export function getAllSales() {
  const sales = db.prepare(`
    SELECT s.*, u.name as cashier_name 
    FROM sales s
    LEFT JOIN users u ON s.user_id = u.id
    ORDER BY s.timestamp DESC
  `).all() as any[];
  
  return sales.map(sale => {
    const items = db.prepare(`
      SELECT si.*, p.name as product_name, p.barcode as product_barcode, p.category as product_category
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `).all(sale.id);
    const payments = db.prepare('SELECT * FROM payments WHERE sale_id = ?').all(sale.id);
    return { ...sale, items, payments };
  });
}

export function returnSaleItems(saleId: number, returnsList: { productId: number, qtyToReturn: number }[]) {
  const selectSale = db.prepare('SELECT * FROM sales WHERE id = ?');
  const selectSaleItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?');
  const updateSaleItemReturned = db.prepare('UPDATE sale_items SET returned_qty = returned_qty + ? WHERE sale_id = ? AND product_id = ?');
  const updateProductStock = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
  const updateSaleRefund = db.prepare('UPDATE sales SET refund_amount = refund_amount + ?, status = ? WHERE id = ?');

  const transaction = db.transaction(() => {
    const sale = selectSale.get(saleId) as any;
    if (!sale) throw new Error('Sale not found');

    const saleItems = selectSaleItems.all(saleId) as any[];
    let totalRefundForThisReturn = 0;

    for (const ret of returnsList) {
      const item = saleItems.find(i => i.product_id === ret.productId);
      if (!item) throw new Error(`Product ID ${ret.productId} not found in this sale`);

      const maxReturnable = item.qty - item.returned_qty;
      if (ret.qtyToReturn > maxReturnable) {
        throw new Error(`Cannot return ${ret.qtyToReturn} items. Only ${maxReturnable} are remaining.`);
      }

      // Update returned quantity for the item
      updateSaleItemReturned.run(ret.qtyToReturn, saleId, ret.productId);

      // Refund calculation
      const itemRefund = item.price * ret.qtyToReturn;
      totalRefundForThisReturn += itemRefund;

      // Restock the product
      updateProductStock.run(ret.qtyToReturn, ret.productId);
    }

    // Recalculate status
    const updatedSaleItems = selectSaleItems.all(saleId) as any[];
    const allFullyReturned = updatedSaleItems.every(i => i.returned_qty === i.qty);
    const anyReturned = updatedSaleItems.some(i => i.returned_qty > 0);

    let newStatus = 'Completed';
    if (allFullyReturned) {
      newStatus = 'Returned';
    } else if (anyReturned) {
      newStatus = 'Partially Returned';
    }

    // Update sale refund amount and status
    updateSaleRefund.run(totalRefundForThisReturn, newStatus, saleId);
  });

  transaction();
  return true;
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

// --- Expense Tracking Operations ---
export function getAllExpenses() {
  return db.prepare('SELECT * FROM expenses ORDER BY timestamp DESC').all();
}

export function addExpense(expense: { amount: number, description: string, category: string, loggedBy: string }) {
  const insert = db.prepare('INSERT INTO expenses (amount, description, category, logged_by) VALUES (?, ?, ?, ?)');
  const info = insert.run(expense.amount, expense.description, expense.category, expense.loggedBy);
  return info.lastInsertRowid;
}

export function deleteExpense(id: number) {
  const del = db.prepare('DELETE FROM expenses WHERE id = ?');
  const info = del.run(id);
  return info.changes > 0;
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

  // 30 Days Daily Trend
  const dailyTrend = db.prepare(`
    SELECT 
      date,
      SUM(revenue) as revenue,
      SUM(refunds) as refunds,
      SUM(cost) as cost,
      COALESCE((
        SELECT SUM(amount)
        FROM expenses
        WHERE strftime('%Y-%m-%d', timestamp) = date
      ), 0) as expenses
    FROM (
      SELECT 
        strftime('%Y-%m-%d', s.timestamp) as date,
        s.total as revenue,
        COALESCE(s.refund_amount, 0) as refunds,
        COALESCE((
          SELECT SUM((si.qty - si.returned_qty) * p.cost_price) 
          FROM sale_items si 
          JOIN products p ON si.product_id = p.id 
          WHERE si.sale_id = s.id
        ), 0) as cost
      FROM sales s
      WHERE s.timestamp >= date('now', '-30 days')
    )
    GROUP BY date
    ORDER BY date ASC
  `).all();

  // 12 Months Monthly Trend
  const monthlyTrend = db.prepare(`
    SELECT 
      month,
      SUM(revenue) as revenue,
      SUM(refunds) as refunds,
      SUM(cost) as cost,
      COALESCE((
        SELECT SUM(amount)
        FROM expenses
        WHERE strftime('%Y-%m', timestamp) = month
      ), 0) as expenses
    FROM (
      SELECT 
        strftime('%Y-%m', s.timestamp) as month,
        s.total as revenue,
        COALESCE(s.refund_amount, 0) as refunds,
        COALESCE((
          SELECT SUM((si.qty - si.returned_qty) * p.cost_price) 
          FROM sale_items si 
          JOIN products p ON si.product_id = p.id 
          WHERE si.sale_id = s.id
        ), 0) as cost
      FROM sales s
      WHERE s.timestamp >= date('now', '-1 year')
    )
    GROUP BY month
    ORDER BY month ASC
  `).all();

  // 5 Years Yearly Trend
  const yearlyTrend = db.prepare(`
    SELECT 
      year,
      SUM(revenue) as revenue,
      SUM(refunds) as refunds,
      SUM(cost) as cost,
      COALESCE((
        SELECT SUM(amount)
        FROM expenses
        WHERE strftime('%Y', timestamp) = year
      ), 0) as expenses
    FROM (
      SELECT 
        strftime('%Y', s.timestamp) as year,
        s.total as revenue,
        COALESCE(s.refund_amount, 0) as refunds,
        COALESCE((
          SELECT SUM((si.qty - si.returned_qty) * p.cost_price) 
          FROM sale_items si 
          JOIN products p ON si.product_id = p.id 
          WHERE si.sale_id = s.id
        ), 0) as cost
      FROM sales s
      WHERE s.timestamp >= date('now', '-5 years')
    )
    GROUP BY year
    ORDER BY year ASC
  `).all();

  // Today's financials
  const todayRow = db.prepare(`
    SELECT 
      COALESCE(SUM(s.total), 0) as revenue,
      COALESCE(SUM(s.refund_amount), 0) as refunds,
      COUNT(s.id) as orders,
      COALESCE((
        SELECT SUM((si.qty - si.returned_qty) * p.cost_price)
        FROM sale_items si
        JOIN sales s2 ON si.sale_id = s2.id
        JOIN products p ON si.product_id = p.id
        WHERE date(s2.timestamp) = date('now')
      ), 0) as cost
    FROM sales s
    WHERE date(s.timestamp) = date('now')
  `).get() as { revenue: number, refunds: number, orders: number, cost: number };

  const todayExpenses = (db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total 
    FROM expenses 
    WHERE date(timestamp) = date('now')
  `).get() as { total: number }).total;

  const todayFinancials = {
    revenue: todayRow.revenue,
    refunds: todayRow.refunds,
    orders: todayRow.orders,
    cost: todayRow.cost,
    expenses: todayExpenses,
    profit: todayRow.revenue - todayRow.refunds - todayRow.cost - todayExpenses
  };

  // Monthly financials
  const monthRow = db.prepare(`
    SELECT 
      COALESCE(SUM(s.total), 0) as revenue,
      COALESCE(SUM(s.refund_amount), 0) as refunds,
      COUNT(s.id) as orders,
      COALESCE((
        SELECT SUM((si.qty - si.returned_qty) * p.cost_price)
        FROM sale_items si
        JOIN sales s2 ON si.sale_id = s2.id
        JOIN products p ON si.product_id = p.id
        WHERE strftime('%Y-%m', s2.timestamp) = strftime('%Y-%m', 'now')
      ), 0) as cost
    FROM sales s
    WHERE strftime('%Y-%m', s.timestamp) = strftime('%Y-%m', 'now')
  `).get() as { revenue: number, refunds: number, orders: number, cost: number };

  const monthExpenses = (db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total 
    FROM expenses 
    WHERE strftime('%Y-%m', timestamp) = strftime('%Y-%m', 'now')
  `).get() as { total: number }).total;

  const monthFinancials = {
    revenue: monthRow.revenue,
    refunds: monthRow.refunds,
    orders: monthRow.orders,
    cost: monthRow.cost,
    expenses: monthExpenses,
    profit: monthRow.revenue - monthRow.refunds - monthRow.cost - monthExpenses
  };

  // Yearly financials
  const yearRow = db.prepare(`
    SELECT 
      COALESCE(SUM(s.total), 0) as revenue,
      COALESCE(SUM(s.refund_amount), 0) as refunds,
      COUNT(s.id) as orders,
      COALESCE((
        SELECT SUM((si.qty - si.returned_qty) * p.cost_price)
        FROM sale_items si
        JOIN sales s2 ON si.sale_id = s2.id
        JOIN products p ON si.product_id = p.id
        WHERE strftime('%Y', s2.timestamp) = strftime('%Y', 'now')
      ), 0) as cost
    FROM sales s
    WHERE strftime('%Y', s.timestamp) = strftime('%Y', 'now')
  `).get() as { revenue: number, refunds: number, orders: number, cost: number };

  const yearExpenses = (db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total 
    FROM expenses 
    WHERE strftime('%Y', timestamp) = strftime('%Y', 'now')
  `).get() as { total: number }).total;

  const yearFinancials = {
    revenue: yearRow.revenue,
    refunds: yearRow.refunds,
    orders: yearRow.orders,
    cost: yearRow.cost,
    expenses: yearExpenses,
    profit: yearRow.revenue - yearRow.refunds - yearRow.cost - yearExpenses
  };

  return {
    summary: {
      totalRevenue: totalRevenue.revenue || 0,
      totalOrders: totalOrders.count || 0,
      avgTicket: avgTicket.avgTicket || 0
    },
    salesByMethod,
    topProducts,
    dailyTrend,
    monthlyTrend,
    yearlyTrend,
    financials: {
      today: todayFinancials,
      month: monthFinancials,
      year: yearFinancials
    }
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
