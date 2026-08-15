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

function isKoreaSunday(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'Asia/Seoul'
  }).format(date) === 'Sun';
}

function defaultBudgetForMart(martId) {
  if (martId === 'Costco') return 300000;
  return isKoreaSunday() ? 50000 : 60000;
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

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
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
    ['Emart', defaultBudgetForMart('Emart'), 'Costco', defaultBudgetForMart('Costco')]
  );

  await pool.query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES
       ($1, $2::jsonb, NOW()),
       ($3, $4::jsonb, NOW()),
       ($5, $6::jsonb, NOW()),
       ($7, $8::jsonb, NOW()),
       ($9, $10::jsonb, NOW())
     ON CONFLICT (key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [
      'emart_regular_default_budget', JSON.stringify(60000),
      'emart_sunday_default_budget', JSON.stringify(50000),
      'costco_default_budget', JSON.stringify(300000),
      'emart_monthly_household_budget', JSON.stringify(290000),
      'costco_monthly_household_budget', JSON.stringify(300000)
    ]
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

  async ensureDefaultBudget(martId, defaultAmount = defaultBudgetForMart(martId)) {
    await ensureDatabase();
    const result = await pool.query('SELECT amount FROM budgets WHERE mart_id = $1', [martId]);
    const currentAmount = result.rows[0] ? Number(result.rows[0].amount) : null;
    const shouldApplySundayDefault = martId === 'Emart' && defaultAmount === 50000 && (currentAmount === null || currentAmount === 60000);

    if (currentAmount === null || shouldApplySundayDefault) {
      await pool.query(
        `INSERT INTO budgets (mart_id, amount, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (mart_id)
         DO UPDATE SET amount = EXCLUDED.amount, updated_at = NOW()`,
        [martId, defaultAmount]
      );
      return defaultAmount;
    }

    return currentAmount;
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

  async getSetting(key) {
    await ensureDatabase();
    const result = await pool.query('SELECT value FROM app_settings WHERE key = $1', [key]);
    return result.rows[0] ? result.rows[0].value : null;
  },

  async setSetting(key, value) {
    await ensureDatabase();
    await pool.query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, JSON.stringify(value)]
    );
  },

  async getItems(martId, includeHistory = false) {
    await ensureDatabase();
    const itemsResult = await pool.query(
      'SELECT * FROM items WHERE mart_id = $1 ORDER BY use_count DESC, name ASC',
      [martId]
    );
    const items = itemsResult.rows;
    if (items.length === 0) return [];

    if (!includeHistory) {
      return items.map(item => mapItem(item, []));
    }

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
    return { item: mapItem(item, []), history: historyResult.rows.map(normalizeHistoryRow) };
  },

  async getItemHistoryByName(martId, name) {
    await ensureDatabase();
    const itemResult = await pool.query('SELECT * FROM items WHERE mart_id = $1 AND name = $2', [martId, name]);
    const item = itemResult.rows[0];
    if (!item) return null;

    const historyResult = await pool.query(
      'SELECT id, price, recorded_at, note FROM price_history WHERE item_id = $1 ORDER BY recorded_at DESC, id DESC',
      [item.id]
    );
    return { item: mapItem(item, []), history: historyResult.rows.map(normalizeHistoryRow) };
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

  async getPurchaseRecords(martId, month, year) {
    await ensureDatabase();
    const params = [];
    const where = [];

    const martIds = Array.isArray(martId) ? martId.filter(Boolean) : (martId ? [martId] : []);
    if (martIds.length > 0) {
      params.push(martIds);
      where.push(`mart_id = ANY($${params.length}::text[])`);
    }

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      params.push(`${month}-%`);
      where.push(`time_str LIKE $${params.length}`);
    } else if (year && /^\d{4}$/.test(year)) {
      params.push(`${year}-%`);
      where.push(`time_str LIKE $${params.length}`);
    }

    const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM purchase_records${whereSql} ORDER BY time_str DESC, created_at DESC, id DESC`,
      params
    );
    return result.rows.map(normalizeRecordRow);
  },

  async getPurchaseRecordItemNames() {
    await ensureDatabase();
    const result = await pool.query('SELECT id, items_json FROM purchase_records ORDER BY time_str DESC, created_at DESC, id DESC');
    const itemMap = new Map();

    for (const row of result.rows) {
      const recordId = String(row.id);
      const items = Array.isArray(row.items_json) ? row.items_json : JSON.parse(row.items_json);
      const namesInRecord = new Set();
      for (const item of items) {
        const name = String((item && item.name) || '').trim();
        if (!name) continue;
        if (!itemMap.has(name)) {
          itemMap.set(name, { name, recordCount: 0, itemCount: 0 });
        }
        const entry = itemMap.get(name);
        entry.itemCount += 1;
        if (!namesInRecord.has(name)) {
          entry.recordCount += 1;
          namesInRecord.add(name);
        }
      }
    }

    return Array.from(itemMap.values())
      .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR', { numeric: true, sensitivity: 'base' }));
  },

  async syncItemsFromPurchaseRecords(martId, normalizeItemName = name => name) {
    await ensureDatabase();
    const records = await this.getPurchaseRecords([martId]);
    const itemMap = new Map();

    for (const row of records) {
      const items = Array.isArray(row.items_json) ? row.items_json : JSON.parse(row.items_json);
      for (const item of items) {
        const name = String(normalizeItemName(String((item && item.name) || '').trim()) || '').trim();
        const price = Number(item && item.price);
        if (!name || !Number.isFinite(price) || price <= 0) continue;
        itemMap.set(name, price);
      }
    }

    let checkedItems = 0;
    let createdItems = 0;
    for (const [name, price] of itemMap.entries()) {
      checkedItems += 1;
      const existing = await getItemWithHistory(martId, name);
      if (existing) continue;
      try {
        await this.upsertItem(martId, name, price, true);
        createdItems += 1;
      } catch (error) {
        if (error && error.code === '23505') continue;
        throw error;
      }
    }

    return { checkedItems, createdItems };
  },

  async deletePurchaseRecord(id) {
    await ensureDatabase();
    return pool.query('DELETE FROM purchase_records WHERE id = $1', [id]);
  },

  async renamePurchaseRecordItem(oldName, newName) {
    await ensureDatabase();
    const fromName = String(oldName || '').trim();
    const toName = String(newName || '').trim();
    if (!fromName || !toName || fromName === toName) {
      return { scannedRecords: 0, updatedRecords: 0, updatedItems: 0 };
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'SELECT id, items_json FROM purchase_records WHERE items_json::text LIKE $1 FOR UPDATE',
        [`%${fromName}%`]
      );

      let updatedRecords = 0;
      let updatedItems = 0;
      for (const row of result.rows) {
        const items = Array.isArray(row.items_json) ? row.items_json : JSON.parse(row.items_json);
        let rowUpdates = 0;
        const nextItems = items.map(item => {
          if (item && String(item.name || '').trim() === fromName) {
            rowUpdates += 1;
            return { ...item, name: toName };
          }
          return item;
        });

        if (rowUpdates > 0) {
          await client.query(
            'UPDATE purchase_records SET items_json = $1::jsonb WHERE id = $2',
            [JSON.stringify(nextItems), row.id]
          );
          updatedRecords += 1;
          updatedItems += rowUpdates;
        }
      }

      await client.query('COMMIT');
      return { scannedRecords: result.rowCount, updatedRecords, updatedItems };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async normalizePurchaseRecordMarts() {
    await ensureDatabase();
    await pool.query(
      `UPDATE purchase_records
       SET mart_id = CASE
         WHEN mart_id = '코스트코' THEN 'Costco'
         WHEN mart_id = '이마트' THEN 'Emart'
         ELSE mart_id
       END
       WHERE mart_id IN ('코스트코', '이마트')`
    );
  }
};
