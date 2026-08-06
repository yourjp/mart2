const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required for Neon Postgres.');
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
});

let initPromise;

function defaultBudgetForMart(martId) {
  return martId === 'Emart' ? 60000 : 300000;
}

function mapItem(row, history = []) {
  return {
    id: row.id,
    name: row.name,
    lastPrice: row.last_price,
    useCount: row.use_count,
    priceHistory: history.map(normalizeHistoryRow)
  };
}

function toIso(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function normalizeHistoryRow(row) {
  return {
    id: row.id,
    price: row.price,
    recorded_at: toIso(row.recorded_at),
    note: row.note
  };
}

function normalizeRecordRow(row) {
  return {
    ...row,
    created_at: toIso(row.created_at)
  };
}

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS marts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS budgets (
      mart_id TEXT PRIMARY KEY,
      amount INTEGER NOT NULL DEFAULT 60000,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS items (
      id BIGSERIAL PRIMARY KEY,
      mart_id TEXT NOT NULL,
      name TEXT NOT NULL,
      last_price INTEGER,
      use_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(mart_id, name)
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id BIGSERIAL PRIMARY KEY,
      item_id BIGINT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      price INTEGER NOT NULL,
      recorded_at TIMESTAMPTZ DEFAULT NOW(),
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id BIGSERIAL PRIMARY KEY,
      mart_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(mart_id, name)
    );

    CREATE TABLE IF NOT EXISTS purchase_records (
      id BIGSERIAL PRIMARY KEY,
      mart_id TEXT NOT NULL,
      time_str TEXT NOT NULL,
      total_amount INTEGER NOT NULL,
      items_json JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(
    `INSERT INTO marts (id, name)
     VALUES ($1, $2), ($3, $4)
     ON CONFLICT (id) DO NOTHING`,
    ['Emart', 'Emart', 'Costco', 'Costco']
  );

  await pool.query(
    `INSERT INTO budgets (mart_id, amount)
     VALUES ($1, $2), ($3, $4)
     ON CONFLICT (mart_id) DO NOTHING`,
    ['Emart', 60000, 'Costco', 300000]
  );
}

function ensureDatabase() {
  if (!initPromise) {
    initPromise = initDatabase();
  }
  return initPromise;
}

async function getItemWithHistory(martId, name) {
  await ensureDatabase();
  const itemResult = await pool.query(
    'SELECT * FROM items WHERE mart_id = $1 AND name = $2',
    [martId, name]
  );
  const item = itemResult.rows[0];
  if (!item) return null;

  const historyResult = await pool.query(
    'SELECT id, price, recorded_at, note FROM price_history WHERE item_id = $1 ORDER BY recorded_at DESC, id DESC',
    [item.id]
  );
  return mapItem(item, historyResult.rows);
}

module.exports = {
  pool,
  ensureDatabase,

  async getBudget(martId) {
    await ensureDatabase();
    const result = await pool.query('SELECT amount FROM budgets WHERE mart_id = $1', [martId]);
    return result.rows[0] ? result.rows[0].amount : defaultBudgetForMart(martId);
  },

  async setBudget(martId, amount) {
    await ensureDatabase();
    await pool.query(
      `INSERT INTO budgets (mart_id, amount, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (mart_id)
       DO UPDATE SET amount = EXCLUDED.amount, updated_at = NOW()`,
      [martId, amount]
    );
  },

  async getItems(martId) {
    await ensureDatabase();
    const itemsResult = await pool.query(
      'SELECT * FROM items WHERE mart_id = $1 ORDER BY use_count DESC, name ASC',
      [martId]
    );
    const items = itemsResult.rows;
    if (items.length === 0) return [];

    const ids = items.map(item => item.id);
    const historyResult = await pool.query(
      'SELECT id, item_id, price, recorded_at, note FROM price_history WHERE item_id = ANY($1::bigint[]) ORDER BY recorded_at DESC, id DESC',
      [ids]
    );

    const historyByItem = new Map();
    historyResult.rows.forEach(row => {
      const key = String(row.item_id);
      if (!historyByItem.has(key)) historyByItem.set(key, []);
      historyByItem.get(key).push(row);
    });

    return items.map(item => mapItem(item, historyByItem.get(String(item.id)) || []));
  },

  async upsertItem(martId, name, price, incrementUse = false) {
    await ensureDatabase();
    const trimmedName = String(name || '').trim();
    if (!trimmedName) return null;

    const normalizedPrice = Number(price) > 0 ? Number(price) : null;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existingResult = await client.query(
        'SELECT * FROM items WHERE mart_id = $1 AND name = $2 FOR UPDATE',
        [martId, trimmedName]
      );
      const existing = existingResult.rows[0];

      if (!existing) {
        const insertResult = await client.query(
          `INSERT INTO items (mart_id, name, last_price, use_count, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           RETURNING id`,
          [martId, trimmedName, normalizedPrice, incrementUse ? 1 : 0]
        );

        if (normalizedPrice) {
          await client.query(
            'INSERT INTO price_history (item_id, price, note) VALUES ($1, $2, $3)',
            [insertResult.rows[0].id, normalizedPrice, 'Initial price']
          );
        }
      } else {
        const newUseCount = incrementUse ? existing.use_count + 1 : existing.use_count;
        let newPrice = existing.last_price;

        if (normalizedPrice && normalizedPrice !== existing.last_price) {
          let note = 'Price changed';
          if (existing.last_price && existing.last_price > 0) {
            const diff = normalizedPrice - existing.last_price;
            note = diff > 0 ? `+${diff.toLocaleString()} increase` : `-${Math.abs(diff).toLocaleString()} discount`;
          } else {
            note = 'Initial price';
          }

          newPrice = normalizedPrice;
          await client.query(
            'INSERT INTO price_history (item_id, price, note) VALUES ($1, $2, $3)',
            [existing.id, normalizedPrice, note]
          );
        }

        await client.query(
          'UPDATE items SET last_price = $1, use_count = $2, updated_at = NOW() WHERE id = $3',
          [newPrice, newUseCount, existing.id]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return getItemWithHistory(martId, trimmedName);
  },

  getItemWithHistory,

  async getItemHistoryById(itemId) {
    await ensureDatabase();
    const itemResult = await pool.query('SELECT * FROM items WHERE id = $1', [itemId]);
    const item = itemResult.rows[0];
    if (!item) return null;

    const historyResult = await pool.query(
      'SELECT id, price, recorded_at, note FROM price_history WHERE item_id = $1 ORDER BY recorded_at DESC, id DESC',
      [itemId]
    );
    return { item, history: historyResult.rows.map(normalizeHistoryRow) };
  },

  async deleteItem(martId, name) {
    await ensureDatabase();
    await pool.query('DELETE FROM items WHERE mart_id = $1 AND name = $2', [martId, name]);
  },

  async getCart(martId) {
    await ensureDatabase();
    const result = await pool.query(
      'SELECT name, price, quantity FROM cart_items WHERE mart_id = $1 ORDER BY updated_at DESC, id DESC',
      [martId]
    );
    return result.rows.map(normalizeRecordRow);
  },

  async saveCart(martId, cartItems) {
    await ensureDatabase();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM cart_items WHERE mart_id = $1', [martId]);
      if (Array.isArray(cartItems)) {
        for (const item of cartItems) {
          await client.query(
            `INSERT INTO cart_items (mart_id, name, price, quantity, updated_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (mart_id, name)
             DO UPDATE SET price = EXCLUDED.price, quantity = EXCLUDED.quantity, updated_at = NOW()`,
            [martId, item.name, Number(item.price) || 0, Number(item.quantity) || 1]
          );
        }
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async clearCart(martId) {
    await ensureDatabase();
    await pool.query('DELETE FROM cart_items WHERE mart_id = $1', [martId]);
  },

  async savePurchaseRecord(martId, timeStr, totalAmount, items) {
    await ensureDatabase();
    await pool.query(
      `INSERT INTO purchase_records (mart_id, time_str, total_amount, items_json)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [martId, timeStr, Number(totalAmount) || 0, JSON.stringify(items || [])]
    );
  },

  async getPurchaseRecords(martId) {
    await ensureDatabase();
    const result = martId
      ? await pool.query('SELECT * FROM purchase_records WHERE mart_id = $1 ORDER BY created_at DESC, id DESC', [martId])
      : await pool.query('SELECT * FROM purchase_records ORDER BY created_at DESC, id DESC');
    return result.rows.map(normalizeRecordRow);
  },

  async deletePurchaseRecord(id) {
    await ensureDatabase();
    return pool.query('DELETE FROM purchase_records WHERE id = $1', [id]);
  }
};
