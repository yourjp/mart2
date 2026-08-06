const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'mart.db');
const db = new Database(dbPath);

// Enable foreign keys and WAL mode for better concurrency
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// Initialize database schema
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS marts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS budgets (
      mart_id TEXT PRIMARY KEY,
      amount INTEGER NOT NULL DEFAULT 60000,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mart_id TEXT NOT NULL,
      name TEXT NOT NULL,
      last_price INTEGER,
      use_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(mart_id, name)
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      price INTEGER NOT NULL,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      note TEXT,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mart_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(mart_id, name)
    );

    CREATE TABLE IF NOT EXISTS purchase_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mart_id TEXT NOT NULL,
      time_str TEXT NOT NULL,
      total_amount INTEGER NOT NULL,
      items_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Insert default marts
  const insertMart = db.prepare('INSERT OR IGNORE INTO marts (id, name) VALUES (?, ?)');
  insertMart.run('Emart', '이마트');
  insertMart.run('코스트코', '코스트코');

  // Insert default budgets if missing
  const insertBudget = db.prepare('INSERT OR IGNORE INTO budgets (mart_id, amount) VALUES (?, ?)');
  insertBudget.run('Emart', 60000);
  insertBudget.run('코스트코', 300000);
}

initDatabase();

module.exports = {
  db,
  
  // Budget handlers
  getBudget(martId) {
    const row = db.prepare('SELECT amount FROM budgets WHERE mart_id = ?').get(martId);
    return row ? row.amount : (martId === '코스트코' ? 300000 : 60000);
  },
  
  setBudget(martId, amount) {
    db.prepare(`
      INSERT INTO budgets (mart_id, amount, updated_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(mart_id) DO UPDATE SET amount = excluded.amount, updated_at = CURRENT_TIMESTAMP
    `).run(martId, amount);
  },

  // Item handlers
  getItems(martId) {
    const items = db.prepare('SELECT * FROM items WHERE mart_id = ? ORDER BY use_count DESC, name ASC').all(martId);
    return items.map(item => {
      const history = db.prepare('SELECT id, price, recorded_at, note FROM price_history WHERE item_id = ? ORDER BY recorded_at DESC, id DESC').all(item.id);
      return {
        id: item.id,
        name: item.name,
        lastPrice: item.last_price,
        useCount: item.use_count,
        priceHistory: history
      };
    });
  },

  upsertItem(martId, name, price, incrementUse = false) {
    const trimmedName = name.trim();
    if (!trimmedName) return null;

    let item = db.prepare('SELECT * FROM items WHERE mart_id = ? AND name = ?').get(martId, trimmedName);
    
    if (!item) {
      const info = db.prepare(`
        INSERT INTO items (mart_id, name, last_price, use_count, updated_at) 
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(martId, trimmedName, price || null, incrementUse ? 1 : 0);
      
      const itemId = info.lastInsertRowid;
      if (price && price > 0) {
        db.prepare('INSERT INTO price_history (item_id, price, note) VALUES (?, ?, ?)').run(itemId, price, '첫 기록');
      }
    } else {
      const newUseCount = incrementUse ? (item.use_count + 1) : item.use_count;
      let newPrice = item.last_price;
      
      if (price && price > 0 && price !== item.last_price) {
        let note = '가격 변경';
        if (item.last_price && item.last_price > 0) {
          const diff = price - item.last_price;
          note = diff > 0 ? `+${diff.toLocaleString()}원 인상` : `-${Math.abs(diff).toLocaleString()}원 할인`;
        } else {
          note = '첫 기록';
        }
        
        newPrice = price;
        db.prepare('INSERT INTO price_history (item_id, price, note) VALUES (?, ?, ?)').run(item.id, price, note);
      }

      db.prepare(`
        UPDATE items 
        SET last_price = ?, use_count = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(newPrice, newUseCount, item.id);
    }

    return this.getItemWithHistory(martId, trimmedName);
  },

  getItemWithHistory(martId, name) {
    const item = db.prepare('SELECT * FROM items WHERE mart_id = ? AND name = ?').get(martId, name);
    if (!item) return null;
    const history = db.prepare('SELECT id, price, recorded_at, note FROM price_history WHERE item_id = ? ORDER BY recorded_at DESC, id DESC').all(item.id);
    return {
      id: item.id,
      name: item.name,
      lastPrice: item.last_price,
      useCount: item.use_count,
      priceHistory: history
    };
  },

  getItemHistoryById(itemId) {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId);
    if (!item) return null;
    const history = db.prepare('SELECT id, price, recorded_at, note FROM price_history WHERE item_id = ? ORDER BY recorded_at DESC, id DESC').all(itemId);
    return {
      item,
      history
    };
  },

  deleteItem(martId, name) {
    db.prepare('DELETE FROM items WHERE mart_id = ? AND name = ?').run(martId, name);
  },

  // Cart handlers
  getCart(martId) {
    return db.prepare('SELECT name, price, quantity FROM cart_items WHERE mart_id = ? ORDER BY updated_at DESC, id DESC').all(martId);
  },

  saveCart(martId, cartItems) {
    const deleteStmt = db.prepare('DELETE FROM cart_items WHERE mart_id = ?');
    const insertStmt = db.prepare('INSERT OR REPLACE INTO cart_items (mart_id, name, price, quantity) VALUES (?, ?, ?, ?)');

    const transaction = db.transaction(() => {
      deleteStmt.run(martId);
      if (Array.isArray(cartItems)) {
        cartItems.forEach(item => {
          insertStmt.run(martId, item.name, item.price, item.quantity || 1);
        });
      }
    });

    transaction();
  },

  clearCart(martId) {
    db.prepare('DELETE FROM cart_items WHERE mart_id = ?').run(martId);
  },

  savePurchaseRecord(martId, timeStr, totalAmount, items) {
    db.prepare(`
      INSERT INTO purchase_records (mart_id, time_str, total_amount, items_json)
      VALUES (?, ?, ?, ?)
    `).run(martId, timeStr, totalAmount, JSON.stringify(items));
  },

  getPurchaseRecords(martId) {
    const query = martId 
      ? 'SELECT * FROM purchase_records WHERE mart_id = ? ORDER BY created_at DESC, id DESC'
      : 'SELECT * FROM purchase_records ORDER BY created_at DESC, id DESC';
    return db.prepare(query).all(martId ? [martId] : []);
  },

  deletePurchaseRecord(id) {
    return db.prepare('DELETE FROM purchase_records WHERE id = ?').run(id);
  }
};
