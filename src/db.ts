import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

// Setup database in user data directory
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'mart-pos.db');

export const db = new Database(dbPath);

export function initDb() {
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('temp_store = MEMORY');
  db.pragma('cache_size = -64000');
  db.pragma('mmap_size = 268435456');

  // Create tables & performance indexes
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
      points INTEGER DEFAULT 0,
      balance REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS customer_khata_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      sale_id INTEGER,
      type TEXT NOT NULL, -- 'LOAN' (borrowed goods/sale on credit) or 'PAYMENT' (paid back loan)
      amount REAL NOT NULL,
      notes TEXT DEFAULT '',
      payment_method TEXT DEFAULT 'Cash',
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (sale_id) REFERENCES sales(id)
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

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending',
      total_cost REAL NOT NULL DEFAULT 0,
      paid_amount REAL NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'Unpaid',
      notes TEXT DEFAULT '',
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    );

    CREATE TABLE IF NOT EXISTS vendor_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_id INTEGER,
      vendor_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'Cash',
      notes TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id),
      FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    );

    CREATE TABLE IF NOT EXISTS vendor_order_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_id INTEGER NOT NULL,
      vendor_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      notes TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id),
      FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      qty INTEGER NOT NULL,
      cost_price REAL NOT NULL,
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    -- Performance Indexes
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_sales_timestamp ON sales(timestamp);
    CREATE INDEX IF NOT EXISTS idx_sales_synced ON sales(synced);
    CREATE INDEX IF NOT EXISTS idx_sales_user ON sales(user_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
    CREATE INDEX IF NOT EXISTS idx_payments_sale_id ON payments(sale_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_timestamp ON expenses(timestamp);
    CREATE INDEX IF NOT EXISTS idx_po_vendor_id ON purchase_orders(vendor_id);
    CREATE INDEX IF NOT EXISTS idx_po_items_po_id ON purchase_order_items(po_id);
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

  // Simple migration to add paid_amount and payment_status to purchase_orders table
  try {
    db.prepare("SELECT paid_amount FROM purchase_orders LIMIT 1").get();
  } catch (e) {
    try {
      db.exec("ALTER TABLE purchase_orders ADD COLUMN paid_amount REAL DEFAULT 0;");
      db.exec("ALTER TABLE purchase_orders ADD COLUMN payment_status TEXT DEFAULT 'Unpaid';");
    } catch (err) {
      console.error("Migration error adding paid_amount columns to purchase_orders table:", err);
    }
  }

  // Ensure vendor_payments and vendor_order_entries tables exist
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS vendor_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        po_id INTEGER,
        vendor_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'Cash',
        notes TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (po_id) REFERENCES purchase_orders(id),
        FOREIGN KEY (vendor_id) REFERENCES vendors(id)
      );

      CREATE TABLE IF NOT EXISTS vendor_order_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        po_id INTEGER NOT NULL,
        vendor_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        notes TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (po_id) REFERENCES purchase_orders(id),
        FOREIGN KEY (vendor_id) REFERENCES vendors(id)
      );
    `);

    // Clean up any orphaned vendor payments or order entries from previously deleted POs
    db.exec(`
      DELETE FROM vendor_payments WHERE po_id NOT IN (SELECT id FROM purchase_orders);
      DELETE FROM vendor_order_entries WHERE po_id NOT IN (SELECT id FROM purchase_orders);
    `);
  } catch (err) {
    console.error("Vendor tables creation error:", err);
  }

  // Ensure customer balance and customer_khata_entries exist
  try {
    db.prepare("SELECT balance FROM customers LIMIT 1").get();
  } catch (e) {
    try {
      db.exec("ALTER TABLE customers ADD COLUMN balance REAL DEFAULT 0;");
    } catch (err) {
      console.error("Migration error adding balance to customers table:", err);
    }
  }

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS customer_khata_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        sale_id INTEGER,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        notes TEXT DEFAULT '',
        payment_method TEXT DEFAULT 'Cash',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        sync_id TEXT UNIQUE,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (sale_id) REFERENCES sales(id)
      );
    `);
    try {
      db.exec("ALTER TABLE customer_khata_entries ADD COLUMN sync_id TEXT;");
    } catch {
      // Column already exists
    }
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_cke_sync_id ON customer_khata_entries(sync_id);");
  } catch (err) {
    console.error("Customer khata table creation error:", err);
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

  // Auto-sync products from latest CSV export spreadsheet
  try {
    const fs = require('fs');
    const csvPaths = [
      path.join(process.cwd(), 'Untitled spreadsheet - mart_inventory_bulk_export_2026-08-20 (3).csv'),
      path.join(process.cwd(), 'Untitled spreadsheet - mart_inventory_bulk_export_2026-08-20.csv'),
      path.join(process.cwd(), 'mart_inventory_bulk_export_2026-08-20.csv')
    ];
    const targetCsv = csvPaths.find(p => fs.existsSync(p));
    if (targetCsv) {
      const lines = fs.readFileSync(targetCsv, 'utf-8').split(/\r?\n/).filter((l: string) => l.trim().length > 0);
      if (lines.length > 1) {
        const updateByBarcode = db.prepare(`
          UPDATE products 
          SET name = @name, category = @category, cost_price = @cost_price, price = @price, stock = @stock
          WHERE barcode = @barcode
        `);

        const insertProduct = db.prepare(`
          INSERT INTO products (barcode, name, category, cost_price, price, stock)
          VALUES (@barcode, @name, @category, @cost_price, @price, @stock)
        `);

        const syncTx = db.transaction(() => {
          for (let i = 1; i < lines.length; i++) {
            const rawLine = lines[i];
            const cols: string[] = [];
            let cur = '';
            let inQuotes = false;
            for (let j = 0; j < rawLine.length; j++) {
              const c = rawLine[j];
              if (c === '"') inQuotes = !inQuotes;
              else if (c === ',' && !inQuotes) {
                cols.push(cur.trim());
                cur = '';
              } else {
                cur += c;
              }
            }
            cols.push(cur.trim());

            if (cols.length < 6) continue;
            const barcode = cols[1]?.trim();
            const name = cols[2]?.trim();
            const category = cols[3]?.trim() || 'General';
            const cost_price = parseFloat(cols[4]) || 0;
            const price = parseFloat(cols[5]) || 0;
            const stock = parseInt(cols[6], 10) || 0;

            if (!barcode || !name) continue;

            const existing = db.prepare('SELECT id FROM products WHERE barcode = ?').get(barcode);
            if (existing) {
              updateByBarcode.run({ barcode, name, category, cost_price, price, stock });
            } else {
              insertProduct.run({ barcode, name, category, cost_price, price, stock });
            }
          }
        });
        syncTx();
        console.log(`Successfully synchronized ${lines.length - 1} products from ${path.basename(targetCsv)}.`);
      }
    }
  } catch (err) {
    console.warn("CSV auto-sync warning:", err);
  }
}

// Data Access Methods
export function getProductByBarcode(barcode: string) {
  return db.prepare('SELECT * FROM products WHERE barcode = ?').get(barcode);
}

export function bulkUpdateProducts(updates: Array<{ id: number; cost_price: number; price: number; stock: number; category?: string }>) {
  const stmt = db.prepare('UPDATE products SET cost_price = ?, price = ?, stock = ?, category = COALESCE(?, category) WHERE id = ?');
  const transaction = db.transaction((items) => {
    for (const item of items) {
      stmt.run(item.cost_price, item.price, item.stock, item.category || null, item.id);
    }
  });
  transaction(updates);
  return true;
}

export function getAllProducts() {
  return db.prepare('SELECT * FROM products').all();
}

export function saveSale(items: any[], paymentData: { subtotal: number, tax: number, discount: number, total: number, payments: any[], change: number, userId?: number, customerId?: number }) {
  const insertSale = db.prepare('INSERT INTO sales (subtotal, tax, discount, total, payment_method, amount_tendered, change_given, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const insertSaleItem = db.prepare('INSERT INTO sale_items (sale_id, product_id, qty, price) VALUES (?, ?, ?, ?)');
  const insertPayment = db.prepare('INSERT INTO payments (sale_id, method, amount) VALUES (?, ?, ?)');
  const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
  const insertKhata = db.prepare('INSERT INTO customer_khata_entries (customer_id, sale_id, type, amount, notes, payment_method) VALUES (?, ?, ?, ?, ?, ?)');
  const updateCustomerBalance = db.prepare('UPDATE customers SET balance = balance + ? WHERE id = ?');

  let saleId = 0;

  const transaction = db.transaction(() => {
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

      // If sale has loan / credit (Udhaar) for a selected customer, log to customer's running loan ledger
      if ((p.method === 'Credit / Loan' || p.method === 'Loan' || p.method === 'Udhaar') && paymentData.customerId) {
        const syncId = `khata_sale_${saleId}_${Date.now()}`;
        db.prepare('INSERT INTO customer_khata_entries (customer_id, sale_id, type, amount, notes, payment_method, sync_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(paymentData.customerId, saleId, 'LOAN', p.amount, `Store POS Order #${saleId}`, 'Credit / Loan', syncId);
        updateCustomerBalance.run(p.amount, paymentData.customerId);
      }
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

export function bulkAddProducts(productsList: Array<Omit<any, 'id'>>) {
  const insert = db.prepare(`
    INSERT INTO products (barcode, name, category, cost_price, price, stock)
    VALUES (@barcode, @name, @category, @cost_price, @price, @stock)
    ON CONFLICT(barcode) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      cost_price = excluded.cost_price,
      price = excluded.price,
      stock = stock + excluded.stock
  `);

  const transaction = db.transaction((items) => {
    let addedCount = 0;
    for (const item of items) {
      if (!item.barcode || !item.name) continue;
      insert.run({
        barcode: String(item.barcode).trim(),
        name: String(item.name).trim(),
        category: item.category?.trim() || 'General',
        cost_price: parseFloat(item.cost_price) || 0,
        price: parseFloat(item.price) || 0,
        stock: parseInt(item.stock, 10) || 0
      });
      addedCount++;
    }
    return addedCount;
  });

  return transaction(productsList);
}

export function updateProduct(id: number, product: Omit<any, 'id'>) {
  const update = db.prepare('UPDATE products SET name = ?, barcode = ?, price = ?, stock = ?, category = ?, cost_price = ? WHERE id = ?');
  const info = update.run(product.name, product.barcode, product.price, product.stock, product.category, product.cost_price || 0, id);
  return info.changes > 0;
}

export function deleteProduct(id: number) {
  const deleteSaleItems = db.prepare('DELETE FROM sale_items WHERE product_id = ?');
  const deletePOItems = db.prepare('DELETE FROM purchase_order_items WHERE product_id = ?');
  const deleteProd = db.prepare('DELETE FROM products WHERE id = ?');

  const transaction = db.transaction(() => {
    deleteSaleItems.run(id);
    deletePOItems.run(id);
    const info = deleteProd.run(id);
    return info.changes > 0;
  });

  return transaction();
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

export function addCustomer(customer: { name: string, phone?: string, email?: string, points?: number, balance?: number }) {
  const cleanPhone = customer.phone && customer.phone.trim().length > 0 ? customer.phone.trim() : null;
  const insert = db.prepare('INSERT INTO customers (name, phone, email, points, balance) VALUES (?, ?, ?, ?, ?)');
  const info = insert.run(customer.name, cleanPhone, customer.email || '', customer.points || 0, customer.balance || 0);
  return info.lastInsertRowid;
}

export function updateCustomer(id: number, customer: { name: string, phone?: string, email?: string, points: number }) {
  const cleanPhone = customer.phone && customer.phone.trim().length > 0 ? customer.phone.trim() : null;
  const update = db.prepare('UPDATE customers SET name = ?, phone = ?, email = ?, points = ? WHERE id = ?');
  const info = update.run(customer.name, cleanPhone, customer.email || '', customer.points, id);
  return info.changes > 0;
}

export function upsertCustomer(c: { id?: number, name: string, phone?: string, email?: string, points?: number, balance?: number }) {
  const cleanPhone = c.phone && c.phone.trim().length > 0 ? c.phone.trim() : null;
  const points = Number(c.points) || 0;
  const balance = Number(c.balance) || 0;

  let existing: any = null;
  if (c.id && c.id > 0) {
    existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(c.id);
  }
  if (!existing && cleanPhone) {
    existing = db.prepare('SELECT * FROM customers WHERE phone = ?').get(cleanPhone);
  }

  if (existing) {
    db.prepare(`
      UPDATE customers 
      SET name = ?, phone = COALESCE(?, phone), email = ?, points = ?
      WHERE id = ?
    `).run(c.name || existing.name, cleanPhone, c.email ?? existing.email ?? '', points, existing.id);
    return existing.id;
  } else {
    if (c.id && c.id > 0) {
      try {
        db.prepare(`
          INSERT INTO customers (id, name, phone, email, points, balance)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(c.id, c.name, cleanPhone, c.email || '', points, balance);
        return c.id;
      } catch {
        const res = db.prepare(`
          INSERT INTO customers (name, phone, email, points, balance)
          VALUES (?, ?, ?, ?, ?)
        `).run(c.name, cleanPhone, c.email || '', points, balance);
        return res.lastInsertRowid as number;
      }
    } else {
      const res = db.prepare(`
        INSERT INTO customers (name, phone, email, points, balance)
        VALUES (?, ?, ?, ?, ?)
      `).run(c.name, cleanPhone, c.email || '', points, balance);
      return res.lastInsertRowid as number;
    }
  }
}

export function deleteCustomer(id: number) {
  const deleteKhata = db.prepare('DELETE FROM customer_khata_entries WHERE customer_id = ?');
  const deleteCust = db.prepare('DELETE FROM customers WHERE id = ?');
  const transaction = db.transaction(() => {
    deleteKhata.run(id);
    return deleteCust.run(id).changes > 0;
  });
  return transaction();
}

export function getCustomerKhataEntries(customerId: number) {
  return db.prepare(`
    SELECT cke.*, s.total as sale_total
    FROM customer_khata_entries cke
    LEFT JOIN sales s ON cke.sale_id = s.id
    WHERE cke.customer_id = ?
    ORDER BY cke.timestamp DESC
  `).all(customerId);
}

export function clearAllKhataRecords() {
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM customer_khata_entries').run();
    db.prepare('UPDATE customers SET balance = 0').run();
  });
  transaction();
  return true;
}

export function getAllCustomerKhataEntries() {
  return db.prepare(`
    SELECT cke.*, s.total as sale_total
    FROM customer_khata_entries cke
    LEFT JOIN sales s ON cke.sale_id = s.id
    ORDER BY cke.timestamp DESC
  `).all() as any[];
}

export function recalculateCustomerBalance(customerId: number) {
  const row = db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'LOAN' THEN amount ELSE -amount END), 0) as balance
    FROM customer_khata_entries
    WHERE customer_id = ?
  `).get(customerId) as { balance: number } | undefined;

  const balance = row ? row.balance : 0;
  db.prepare('UPDATE customers SET balance = ? WHERE id = ?').run(balance, customerId);
  return balance;
}

export function recalculateAllCustomerBalances() {
  const customers = db.prepare('SELECT id FROM customers').all() as { id: number }[];
  for (const c of customers) {
    recalculateCustomerBalance(c.id);
  }
}

export function upsertCloudKhataEntry(entry: any) {
  if (!entry || entry.amount === undefined || !entry.customer_id) return false;
  const custId = Number(entry.customer_id) || 0;
  if (custId <= 0) return false;

  // Make sure customer exists in customers table
  const custExists = db.prepare('SELECT id FROM customers WHERE id = ?').get(custId);
  if (!custExists) {
    try {
      db.prepare('INSERT OR IGNORE INTO customers (id, name, phone, email, points, balance) VALUES (?, ?, NULL, ?, 0, 0)')
        .run(custId, entry.customer_name || `Customer #${custId}`, '');
    } catch {
      // ignore
    }
  }

  const amount = Number(entry.amount) || 0;
  const type = (entry.type || 'LOAN').toString().toUpperCase();
  const paymentMethod = entry.payment_method || entry.paymentMethod || (type === 'LOAN' ? 'Credit / Loan' : 'Cash');
  const notes = entry.notes || '';
  const timestamp = entry.timestamp || new Date().toISOString();
  const syncId = entry.sync_id || (entry.id ? String(entry.id) : `khata_${custId}_${type}_${amount}_${timestamp}`);
  
  // Verify saleId exists in local sales table to prevent FOREIGN KEY violation
  let saleId: number | null = null;
  if (entry.sale_id) {
    const sId = Number(entry.sale_id);
    if (!isNaN(sId) && sId > 0) {
      const saleExists = db.prepare('SELECT id FROM sales WHERE id = ?').get(sId);
      if (saleExists) {
        saleId = sId;
      }
    }
  }

  const timePrefix = timestamp.substring(0, 19);

  // Check if entry already exists by sync_id OR by (customer_id, type, amount, timestamp)
  const existing = (syncId ? db.prepare('SELECT id FROM customer_khata_entries WHERE sync_id = ?').get(syncId) : null) ||
                   db.prepare(`
                     SELECT id FROM customer_khata_entries 
                     WHERE customer_id = ? AND type = ? AND ABS(amount - ?) < 0.001 
                       AND (timestamp LIKE ? OR timestamp = ?)
                   `).get(custId, type, amount, `${timePrefix}%`, timestamp);

  if (existing) {
    if (syncId) {
      db.prepare('UPDATE customer_khata_entries SET sync_id = ? WHERE id = ? AND (sync_id IS NULL OR sync_id = ?)').run(syncId, (existing as any).id, syncId);
    }
    return false;
  }

  db.prepare(`
    INSERT INTO customer_khata_entries (customer_id, sale_id, type, amount, notes, payment_method, timestamp, sync_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(custId, saleId, type, amount, notes, paymentMethod, timestamp, syncId);

  recalculateCustomerBalance(custId);
  return true;
}

export function addCustomerLoanPayment(data: { customerId: number, amount: number, paymentMethod?: string, notes?: string }) {
  const syncId = `khata_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const insertKhata = db.prepare('INSERT INTO customer_khata_entries (customer_id, type, amount, notes, payment_method, sync_id) VALUES (?, ?, ?, ?, ?, ?)');
  const updateBalance = db.prepare('UPDATE customers SET balance = balance - ? WHERE id = ?');

  const transaction = db.transaction(() => {
    insertKhata.run(data.customerId, 'PAYMENT', data.amount, data.notes || 'Loan Repayment (Udhaar Wasool)', data.paymentMethod || 'Cash', syncId);
    updateBalance.run(data.amount, data.customerId);
  });

  transaction();
  return true;
}

export function addCustomerLoanEntry(data: { customerId: number, amount: number, notes?: string }) {
  const syncId = `khata_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const insertKhata = db.prepare('INSERT INTO customer_khata_entries (customer_id, type, amount, notes, payment_method, sync_id) VALUES (?, ?, ?, ?, ?, ?)');
  const updateBalance = db.prepare('UPDATE customers SET balance = balance + ? WHERE id = ?');

  const transaction = db.transaction(() => {
    insertKhata.run(data.customerId, 'LOAN', data.amount, data.notes || 'Manual Credit / Loan Entry', 'Credit / Loan', syncId);
    updateBalance.run(data.amount, data.customerId);
  });

  transaction();
  return true;
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

// Ingest / Upsert Sale from Firebase Cloud into SQLite
export function upsertCloudSale(cloudSale: any) {
  if (!cloudSale || cloudSale.id === undefined || cloudSale.id === null) return false;

  const numericId = Number(cloudSale.id);
  if (isNaN(numericId) || numericId <= 0) return false;

  const existing = db.prepare('SELECT id, status, refund_amount FROM sales WHERE id = ?').get(numericId) as any;

  const subtotal = Number(cloudSale.subtotal) || 0;
  const tax = Number(cloudSale.tax) || 0;
  const discount = Number(cloudSale.discount) || 0;
  const total = Number(cloudSale.total) || 0;
  const paymentMethod = cloudSale.payment_method || cloudSale.paymentMethod || 'Cash';
  const amountTendered = Number(cloudSale.amount_tendered || cloudSale.amountTendered) || total;
  const changeGiven = Number(cloudSale.change_given || cloudSale.changeGiven) || 0;
  const timestamp = cloudSale.timestamp || new Date().toISOString();
  const userId = cloudSale.user_id ? Number(cloudSale.user_id) : null;
  const status = cloudSale.status || 'Completed';
  const refundAmount = Number(cloudSale.refund_amount) || 0;

  if (existing) {
    db.prepare(`
      UPDATE sales 
      SET status = ?, refund_amount = ?, synced = 1
      WHERE id = ?
    `).run(status, refundAmount, numericId);
    return true;
  }

  // Insert new sale into SQLite
  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO sales (id, subtotal, tax, discount, total, payment_method, amount_tendered, change_given, timestamp, synced, user_id, status, refund_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(numericId, subtotal, tax, discount, total, paymentMethod, amountTendered, changeGiven, timestamp, userId, status, refundAmount);

    // Items
    let itemsList = cloudSale.items || [];
    if (itemsList && typeof itemsList === 'object' && !Array.isArray(itemsList)) {
      itemsList = Object.values(itemsList);
    }

    const insertSaleItem = db.prepare('INSERT INTO sale_items (sale_id, product_id, qty, price) VALUES (?, ?, ?, ?)');
    for (const item of itemsList) {
      if (!item) continue;
      const rawProdId = Number(item.product_id ?? item.productId) || 0;
      let prodId = rawProdId;

      // Ensure product exists in products table
      if (prodId > 0) {
        const prodExists = db.prepare('SELECT id FROM products WHERE id = ?').get(prodId);
        if (!prodExists) {
          const barcode = item.product_barcode || item.productBarcode || `AUTO-${prodId}`;
          const name = item.product_name || item.productName || `Product #${prodId}`;
          const category = item.product_category || item.productCategory || 'General';
          const price = Number(item.price) || 0;
          try {
            db.prepare('INSERT OR IGNORE INTO products (id, name, barcode, price, stock, category, cost_price) VALUES (?, ?, ?, ?, 0, ?, 0)')
              .run(prodId, name, barcode, price, category);
          } catch (e) {
            const res = db.prepare('INSERT INTO products (name, barcode, price, stock, category, cost_price) VALUES (?, ?, ?, 0, ?, 0)')
              .run(name, barcode, price, category);
            prodId = res.lastInsertRowid as number;
          }
        }
      } else {
        const name = item.product_name || item.productName || 'Custom Item';
        const price = Number(item.price) || 0;
        const res = db.prepare('INSERT INTO products (name, barcode, price, stock, category, cost_price) VALUES (?, ?, ?, 0, ?, 0)')
          .run(name, `GEN-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, price, 'General');
        prodId = res.lastInsertRowid as number;
      }

      const qty = Number(item.qty ?? item.quantity) || 1;
      const price = Number(item.price) || 0;
      insertSaleItem.run(numericId, prodId, qty, price);
    }

    // Payments
    let paymentsList = cloudSale.payments || [];
    if (paymentsList && typeof paymentsList === 'object' && !Array.isArray(paymentsList)) {
      paymentsList = Object.values(paymentsList);
    }

    const insertPayment = db.prepare('INSERT INTO payments (sale_id, method, amount) VALUES (?, ?, ?)');
    if (paymentsList.length > 0) {
      for (const p of paymentsList) {
        if (!p) continue;
        const method = p.method || p.payment_method || paymentMethod;
        const amount = Number(p.amount) || total;
        insertPayment.run(numericId, method, amount);
      }
    } else {
      insertPayment.run(numericId, paymentMethod, total);
    }
  });

  transaction();
  return true;
}

// --- Sales History & Returns Data Access ---
export function getAllSales() {
  const sales = db.prepare(`
    SELECT s.*, u.name as cashier_name 
    FROM sales s
    LEFT JOIN users u ON s.user_id = u.id
    ORDER BY s.timestamp DESC
  `).all() as any[];

  if (sales.length === 0) return [];

  // Batch query all sale items and payments with LEFT JOIN so no items are dropped
  const allItems = db.prepare(`
    SELECT si.*, 
           COALESCE(p.name, 'Product #' || si.product_id) as product_name, 
           COALESCE(p.barcode, '') as product_barcode, 
           COALESCE(p.category, 'General') as product_category
    FROM sale_items si
    LEFT JOIN products p ON si.product_id = p.id
  `).all() as any[];

  const allPayments = db.prepare('SELECT * FROM payments').all() as any[];

  const itemsMap = new Map<number, any[]>();
  for (const item of allItems) {
    let list = itemsMap.get(item.sale_id);
    if (!list) {
      list = [];
      itemsMap.set(item.sale_id, list);
    }
    list.push(item);
  }

  const paymentsMap = new Map<number, any[]>();
  for (const payment of allPayments) {
    let list = paymentsMap.get(payment.sale_id);
    if (!list) {
      list = [];
      paymentsMap.set(payment.sale_id, list);
    }
    list.push(payment);
  }

  return sales.map(sale => ({
    ...sale,
    items: itemsMap.get(sale.id) || [],
    payments: paymentsMap.get(sale.id) || []
  }));
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

export function updateVendor(id: number, vendor: { name: string, contact: string, category: string }) {
  const update = db.prepare('UPDATE vendors SET name = ?, contact = ?, category = ? WHERE id = ?');
  return update.run(vendor.name, vendor.contact, vendor.category, id).changes > 0;
}

export function deleteVendor(id: number) {
  const del = db.prepare('DELETE FROM vendors WHERE id = ?');
  return del.run(id).changes > 0;
}

export function getAllPurchaseOrders() {
  const pos = db.prepare(`
    SELECT po.*, v.name as vendor_name, v.contact as vendor_contact, v.category as vendor_category
    FROM purchase_orders po
    JOIN vendors v ON po.vendor_id = v.id
    ORDER BY po.timestamp DESC
  `).all() as any[];

  return pos.map(po => {
    const items = db.prepare(`
      SELECT poi.*, p.name as product_name, p.barcode as product_barcode
      FROM purchase_order_items poi
      JOIN products p ON poi.product_id = p.id
      WHERE poi.po_id = ?
    `).all(po.id);

    const payments = db.prepare(`
      SELECT * FROM vendor_payments
      WHERE po_id = ?
      ORDER BY timestamp DESC
    `).all(po.id);

    const orderEntries = db.prepare(`
      SELECT * FROM vendor_order_entries
      WHERE po_id = ?
      ORDER BY timestamp DESC
    `).all(po.id);

    return {
      ...po,
      paid_amount: po.paid_amount || 0,
      payment_status: po.payment_status || 'Unpaid',
      items,
      payments,
      order_entries: orderEntries
    };
  });
}

export function addVendorPayment(payment: { poId: number, vendorId: number, amount: number, paymentMethod?: string, notes?: string }) {
  const insertPayment = db.prepare('INSERT INTO vendor_payments (po_id, vendor_id, amount, payment_method, notes) VALUES (?, ?, ?, ?, ?)');
  const selectPO = db.prepare('SELECT * FROM purchase_orders WHERE id = ?');
  const updatePOPayment = db.prepare('UPDATE purchase_orders SET paid_amount = ?, payment_status = ? WHERE id = ?');

  const transaction = db.transaction(() => {
    const po = selectPO.get(payment.poId) as any;
    if (!po) throw new Error('Purchase Order not found');

    insertPayment.run(
      payment.poId,
      payment.vendorId,
      payment.amount,
      payment.paymentMethod || 'Cash',
      payment.notes || ''
    );

    const newPaidAmount = (po.paid_amount || 0) + payment.amount;
    let newStatus = 'Unpaid';
    if (newPaidAmount >= po.total_cost) {
      newStatus = 'Paid';
    } else if (newPaidAmount > 0) {
      newStatus = 'Partially Paid';
    }

    updatePOPayment.run(newPaidAmount, newStatus, payment.poId);
  });

  transaction();
  return true;
}

export function getVendorPayments(vendorId?: number) {
  if (vendorId) {
    return db.prepare(`
      SELECT vp.*, v.name as vendor_name 
      FROM vendor_payments vp 
      JOIN vendors v ON vp.vendor_id = v.id 
      JOIN purchase_orders po ON vp.po_id = po.id
      WHERE vp.vendor_id = ? 
      ORDER BY vp.timestamp DESC
    `).all(vendorId);
  }
  return db.prepare(`
    SELECT vp.*, v.name as vendor_name 
    FROM vendor_payments vp 
    JOIN vendors v ON vp.vendor_id = v.id 
    JOIN purchase_orders po ON vp.po_id = po.id
    ORDER BY vp.timestamp DESC
  `).all();
}

export function getVendorOrderEntries(vendorId?: number) {
  if (vendorId) {
    return db.prepare(`
      SELECT voe.*, v.name as vendor_name 
      FROM vendor_order_entries voe 
      JOIN vendors v ON voe.vendor_id = v.id 
      JOIN purchase_orders po ON voe.po_id = po.id
      WHERE voe.vendor_id = ? 
      ORDER BY voe.timestamp DESC
    `).all(vendorId);
  }
  return db.prepare(`
    SELECT voe.*, v.name as vendor_name 
    FROM vendor_order_entries voe 
    JOIN vendors v ON voe.vendor_id = v.id 
    JOIN purchase_orders po ON voe.po_id = po.id
    ORDER BY voe.timestamp DESC
  `).all();
}

export function createPurchaseOrder(
  vendorId: number,
  items: { productId: number, qty: number, costPrice: number }[],
  customTotalCost?: number,
  notes?: string
) {
  const findExistingPO = db.prepare('SELECT * FROM purchase_orders WHERE vendor_id = ? ORDER BY id DESC LIMIT 1');
  const updatePO = db.prepare('UPDATE purchase_orders SET total_cost = total_cost + ?, notes = CASE WHEN notes = \'\' THEN ? ELSE notes || \' | \' || ? END, timestamp = CURRENT_TIMESTAMP WHERE id = ?');
  const updatePaymentStatus = db.prepare('UPDATE purchase_orders SET payment_status = CASE WHEN paid_amount >= total_cost AND total_cost > 0 THEN \'Paid\' WHEN paid_amount > 0 THEN \'Partially Paid\' ELSE \'Unpaid\' END WHERE id = ?');
  const insertPO = db.prepare('INSERT INTO purchase_orders (vendor_id, total_cost, status, notes) VALUES (?, ?, ?, ?)');
  const insertPOItem = db.prepare('INSERT INTO purchase_order_items (po_id, product_id, qty, cost_price) VALUES (?, ?, ?, ?)');
  const insertOrderEntry = db.prepare('INSERT INTO vendor_order_entries (po_id, vendor_id, amount, notes) VALUES (?, ?, ?, ?)');

  let poId = 0;
  const transaction = db.transaction(() => {
    const calculatedTotal = items.reduce((sum, item) => sum + (item.qty * item.costPrice), 0);
    const finalTotal = typeof customTotalCost === 'number' && customTotalCost > 0 ? customTotalCost : calculatedTotal;

    // Check if vendor already has a purchase order
    const existing = findExistingPO.get(vendorId) as any;

    if (existing) {
      // Sum the new order amount into the vendor's existing PO
      poId = existing.id;
      updatePO.run(finalTotal, notes || '', notes || '', poId);
      updatePaymentStatus.run(poId);
    } else {
      // Create new unified PO for this vendor
      const info = insertPO.run(vendorId, finalTotal, 'Pending', notes || '');
      poId = info.lastInsertRowid as number;
    }

    // Record this specific order invoice entry in the history ledger
    insertOrderEntry.run(poId, vendorId, finalTotal, notes || '');

    for (const item of items) {
      insertPOItem.run(poId, item.productId, item.qty, item.costPrice);
    }
  });

  transaction();
  return poId;
}

export function receivePurchaseOrder(poId: number) {
  const selectPO = db.prepare('SELECT * FROM purchase_orders WHERE id = ?');
  const selectItems = db.prepare('SELECT * FROM purchase_order_items WHERE po_id = ?');
  const updatePOStatus = db.prepare("UPDATE purchase_orders SET status = 'Received' WHERE id = ?");
  const updateProductStock = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');

  const transaction = db.transaction(() => {
    const po = selectPO.get(poId) as any;
    if (!po) throw new Error('Purchase Order not found');
    if (po.status === 'Received') throw new Error('Purchase Order is already received');

    const items = selectItems.all(poId) as any[];
    for (const item of items) {
      updateProductStock.run(item.qty, item.product_id);
    }

    updatePOStatus.run(poId);
  });

  transaction();
  return true;
}

export function deletePurchaseOrder(poId: number) {
  const deleteItems = db.prepare('DELETE FROM purchase_order_items WHERE po_id = ?');
  const deletePayments = db.prepare('DELETE FROM vendor_payments WHERE po_id = ?');
  const deleteEntries = db.prepare('DELETE FROM vendor_order_entries WHERE po_id = ?');
  const deletePO = db.prepare('DELETE FROM purchase_orders WHERE id = ?');

  const transaction = db.transaction(() => {
    deleteItems.run(poId);
    deletePayments.run(poId);
    deleteEntries.run(poId);
    deletePO.run(poId);
  });
  transaction();
  return true;
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

export function updateExpense(id: number, expense: { amount: number, description: string, category: string, loggedBy: string }) {
  const update = db.prepare('UPDATE expenses SET amount = ?, description = ?, category = ?, logged_by = ? WHERE id = ?');
  const info = update.run(expense.amount, expense.description, expense.category, expense.loggedBy, id);
  return info.changes > 0;
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
        SELECT SUM((si.qty - si.returned_qty) * COALESCE(p.cost_price, 0))
        FROM sale_items si
        JOIN sales s2 ON si.sale_id = s2.id
        LEFT JOIN products p ON si.product_id = p.id
        WHERE substr(s2.timestamp, 1, 10) = strftime('%Y-%m-%d', 'now', 'localtime') 
           OR date(s2.timestamp) = date('now') 
           OR date(s2.timestamp, 'localtime') = date('now', 'localtime')
      ), 0) as cost
    FROM sales s
    WHERE substr(s.timestamp, 1, 10) = strftime('%Y-%m-%d', 'now', 'localtime') 
       OR date(s.timestamp) = date('now') 
       OR date(s.timestamp, 'localtime') = date('now', 'localtime')
  `).get() as { revenue: number, refunds: number, orders: number, cost: number };

  const todayExpenses = (db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total 
    FROM expenses 
    WHERE substr(timestamp, 1, 10) = strftime('%Y-%m-%d', 'now', 'localtime') 
       OR date(timestamp) = date('now') 
       OR date(timestamp, 'localtime') = date('now', 'localtime')
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
