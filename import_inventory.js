const fs = require('fs');
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const possiblePaths = [
  path.join(os.homedir(), 'AppData', 'Roaming', 'offline-mart-pos', 'mart-pos.db'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'ssmart-pos', 'mart-pos.db'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'Electron', 'mart-pos.db')
];

let targetDbPath = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];
console.log('Target SQLite Database Path:', targetDbPath);

const dbDir = path.dirname(targetDbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(targetDbPath);

// Ensure products table exists
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
`);

const csvFile = path.join(__dirname, 'Untitled spreadsheet - mart_inventory_bulk_export_2026-08-20.csv');
const lines = fs.readFileSync(csvFile, 'utf-8').split(/\r?\n/).filter(l => l.trim().length > 0);
console.log('Total rows in CSV:', lines.length);

const upsertStmt = db.prepare(`
  INSERT INTO products (id, barcode, name, category, cost_price, price, stock)
  VALUES (@id, @barcode, @name, @category, @cost_price, @price, @stock)
  ON CONFLICT(id) DO UPDATE SET
    barcode = excluded.barcode,
    name = excluded.name,
    category = excluded.category,
    cost_price = excluded.cost_price,
    price = excluded.price,
    stock = excluded.stock
`);

let importedCount = 0;
const runTransaction = db.transaction(() => {
  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    // CSV parse taking quotes into account
    const cols = [];
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

    const id = parseInt(cols[0], 10);
    const barcode = cols[1]?.trim();
    const name = cols[2]?.trim();
    const category = cols[3]?.trim() || 'General';
    const cost_price = parseFloat(cols[4]) || 0;
    const price = parseFloat(cols[5]) || 0;
    const stock = parseInt(cols[6], 10) || 0;

    if (!barcode || !name) continue;

    upsertStmt.run({
      id: isNaN(id) ? null : id,
      barcode,
      name,
      category,
      cost_price,
      price,
      stock
    });
    importedCount++;
  }
});

runTransaction();
console.log(`Successfully synced ${importedCount} products into local database!`);
