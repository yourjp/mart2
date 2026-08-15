const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

function loadLocalEnv() {
  ['.env.local', '.env'].forEach(fileName => {
    const envPath = path.join(__dirname, fileName);
    if (!fs.existsSync(envPath)) return;

    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) return;

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();
      if (!key || process.env[key] !== undefined) return;

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    });
  });
}

loadLocalEnv();

const dbHelper = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  maxAge: 0,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

function toCanonicalMartId(martName, fallback = 'Emart') {
  if (martName === '이마트' || martName === 'Emart') return 'Emart';
  if (martName === '코스트코' || martName === 'Costco') return 'Costco';
  return fallback;
}

function getMartRecordAliases(martName) {
  const canonicalMart = toCanonicalMartId(martName, martName);
  if (canonicalMart === 'Costco') return ['Costco', '코스트코'];
  if (canonicalMart === 'Emart') return ['Emart', '이마트'];
  return [canonicalMart];
}

function isKoreaSunday(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'Asia/Seoul'
  }).format(date) === 'Sun';
}

function getDefaultBudgetForMart(martId) {
  if (martId === 'Costco' || martId === '코스트코') return 300000;
  if ((martId === 'Emart' || martId === '이마트') && isKoreaSunday()) return 50000;
  return 60000;
}

function normalizeKnownItemPrice(martId, name, price) {
  const normalizedName = String(name || '').trim();
  const numericPrice = Number(price);
  if ((martId === 'Costco' || martId === '코스트코') && normalizedName === '청화 페페론치노') {
    return 15990;
  }
  return Number.isFinite(numericPrice) && numericPrice > 0 ? numericPrice : price;
}

// Helper: Seed default items from Markdown files into Postgres if empty
async function seedItemsFromMarkdownIfEmpty(martId) {
  const existingItems = await dbHelper.getItems(martId);
  if (existingItems && existingItems.length > 0) return;

  const fileName = `품목_${martId}.md`;
  const filePath = path.join(__dirname, fileName);
    const items = parseItemsFromMarkdown(filePath);
  if (items && items.length > 0) {
    for (const item of items) {
      await dbHelper.upsertItem(martId, item.name, normalizeKnownItemPrice(martId, item.name, item.lastPrice), false);
    }
  }
}

// ----------------------------------------------------
// DB Sync API Endpoints
// ----------------------------------------------------

// GET /api/db/sync - Read complete state for a mart (items, cart, budget)
app.get('/api/db/sync', async (req, res) => {
  try {
    const martName = req.query.mart || 'Emart';
    const canonicalMart = toCanonicalMartId(martName);
    
    // Seed initial data if DB table is empty
    await seedItemsFromMarkdownIfEmpty(canonicalMart);

    const items = await dbHelper.getItems(canonicalMart, false);
    const cart = await dbHelper.getCart(canonicalMart);
    const budget = await dbHelper.ensureDefaultBudget(canonicalMart, getDefaultBudgetForMart(canonicalMart));

    return res.json({
      success: true,
      martName: canonicalMart,
      budget,
      items,
      cart
    });
  } catch (error) {
    console.error('Error syncing DB data:', error);
    return res.status(500).json({ success: false, message: 'DB 동기화 실패: ' + error.message });
  }
});

// POST /api/db/item - Add or update an item with price history
app.post('/api/db/item', async (req, res) => {
  try {
    const { martName, name, price, incrementUse } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: '품목명이 필요합니다.' });
    }

    const canonicalMart = (martName === '이마트' || martName === 'Emart')
      ? 'Emart'
      : (martName === '코스트코' || martName === 'Costco') ? 'Costco' : 'Emart';
    const normalizedPrice = normalizeKnownItemPrice(canonicalMart, name, price);
    const updatedItem = await dbHelper.upsertItem(canonicalMart, name, normalizedPrice, !!incrementUse);

    // Sync back to markdown file as backup
    const allItems = await dbHelper.getItems(canonicalMart, true);
    writeItemsToMarkdownBackups(canonicalMart, allItems);

    return res.json({ success: true, item: updatedItem });
  } catch (error) {
    console.error('Error updating DB item:', error);
    return res.status(500).json({ success: false, message: '품목 저장 실패: ' + error.message });
  }
});

// DELETE /api/db/item - Delete a saved item from DB and Markdown backup
app.delete('/api/db/item', async (req, res) => {
  try {
    const { mart, martName, name } = req.query;
    const requestedMart = mart || martName || 'Emart';
    const canonicalMart = (requestedMart === '이마트' || requestedMart === 'Emart') ? 'Emart' : requestedMart;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: '삭제할 품목명이 필요합니다.' });
    }

    await dbHelper.deleteItem(canonicalMart, String(name).trim());

    const allItems = await dbHelper.getItems(canonicalMart, true);
    writeItemsToMarkdownBackups(canonicalMart, allItems);

    return res.json({ success: true, message: '품목이 삭제되었습니다.' });
  } catch (error) {
    console.error('Error deleting DB item:', error);
    return res.status(500).json({ success: false, message: '품목 삭제 실패: ' + error.message });
  }
});

// GET /api/db/history - Fetch price history for a specific item
app.get('/api/db/history', async (req, res) => {
  try {
    const { itemId, mart, martName, name } = req.query;
    let data = null;

    if (itemId && !isNaN(Number(itemId))) {
      data = await dbHelper.getItemHistoryById(itemId);
    } else if (name && String(name).trim()) {
      const requestedMart = mart || martName || 'Emart';
      const canonicalMart = toCanonicalMartId(requestedMart);
      data = await dbHelper.getItemHistoryByName(canonicalMart, String(name).trim());
    } else {
      return res.status(400).json({ success: false, message: 'itemId 또는 name이 필요합니다.' });
    }

    if (!data) {
      return res.status(404).json({ success: false, message: '품목을 찾을 수 없습니다.' });
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching item price history:', error);
    return res.status(500).json({ success: false, message: '이력 조회 실패: ' + error.message });
  }
});

// POST /api/db/cart - Sync cart state
app.post('/api/db/cart', async (req, res) => {
  try {
    const { martName, cart } = req.body;
    const canonicalMart = (martName === '이마트' || martName === 'Emart')
      ? 'Emart'
      : (martName === '코스트코' || martName === 'Costco') ? 'Costco' : 'Emart';

    await dbHelper.saveCart(canonicalMart, cart || []);
    return res.json({ success: true, message: '장바구니 동기화 성공' });
  } catch (error) {
    console.error('Error saving cart:', error);
    return res.status(500).json({ success: false, message: '장바구니 저장 실패: ' + error.message });
  }
});

// POST /api/db/budget - Sync budget amount
app.post('/api/db/budget', async (req, res) => {
  try {
    const { martName, amount } = req.body;
    const canonicalMart = (martName === '이마트' || martName === 'Emart') ? 'Emart' : (martName || 'Emart');

    await dbHelper.setBudget(canonicalMart, parseInt(amount, 10) || getDefaultBudgetForMart(canonicalMart));
    return res.json({ success: true, message: '예산 저장 성공' });
  } catch (error) {
    console.error('Error saving budget:', error);
    return res.status(500).json({ success: false, message: '예산 저장 실패: ' + error.message });
  }
});

// GET /api/db/export - Export items and price history in CSV / JSON / MD format
app.get('/api/db/export', async (req, res) => {
  try {
    const martName = req.query.mart || 'Emart';
    const format = (req.query.format || 'csv').toLowerCase();
    const canonicalMart = (martName === '이마트' || martName === 'Emart') ? 'Emart' : martName;

    await seedItemsFromMarkdownIfEmpty(canonicalMart);
    const items = await dbHelper.getItems(canonicalMart, true);
    const exportedItems = items.map(item => ({
      ...item,
      priceStats: getPriceHistoryStats(item.priceHistory)
    }));

    if (format === 'json') {
      setDownloadHeaders(res, 'application/json; charset=utf-8', canonicalMart, 'json');
      return res.send(JSON.stringify({ mart: canonicalMart, exportedAt: new Date().toISOString(), items: exportedItems }, null, 2));
    } else if (format === 'md') {
      let md = `# ${canonicalMart} 품목 및 가격 이력 리스트\n\n`;
      md += `> 내보낸 날짜: ${new Date().toLocaleString()}\n\n`;
      md += `| ID | 품목명 | 최근 단가 | 구매 횟수 | 변동 이력 수 | 최저 | 최고 | 평균 |\n`;
      md += `|---|---|---|---|---|---|---|---|\n`;
      exportedItems.forEach(item => {
        const priceStr = item.lastPrice ? `${item.lastPrice.toLocaleString()}원` : '-';
        md += `| ${item.id} | ${item.name} | ${priceStr} | ${item.useCount} | ${item.priceStats.count} | ${formatWon(item.priceStats.min)} | ${formatWon(item.priceStats.max)} | ${formatWon(item.priceStats.avg)} |\n`;
      });
      setDownloadHeaders(res, 'text/markdown; charset=utf-8', canonicalMart, 'md');
      return res.send(md);
    } else {
      // CSV Format
      let csv = '\uFEFF'; // UTF-8 BOM for Excel compatibility
      csv += 'ID,품목명,최근단가,구매횟수,이력기록수,최저,최고,평균,최근이력\n';
      exportedItems.forEach(item => {
        const priceStr = item.lastPrice || '';
        const historyText = (item.priceHistory && item.priceHistory.length > 0)
          ? item.priceHistory.map(h => `${h.recorded_at.substring(0, 10)}:${h.price}원(${h.note || ''})`).join(' | ')
          : '';
        csv += `"${item.id}","${item.name.replace(/"/g, '""')}","${priceStr}","${item.useCount}","${item.priceStats.count}","${item.priceStats.min || ''}","${item.priceStats.max || ''}","${item.priceStats.avg || ''}","${historyText.replace(/"/g, '""')}"\n`;
      });
      setDownloadHeaders(res, 'text/csv; charset=utf-8', canonicalMart, 'csv');
      return res.send(csv);
    }
  } catch (error) {
    console.error('Error exporting data:', error);
    return res.status(500).json({ success: false, message: '데이터 내보내기 실패: ' + error.message });
  }
});

// API endpoint to append grocery calculation result to 구매내역.md
app.post('/api/save-record', async (req, res) => {
  try {
    const { martName, items, totalAmount, timeStr: requestedTimeStr } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: '장바구니가 비어 있습니다.' });
    }

    const computedTotal = items.reduce((sum, item) => {
      return sum + (Number(item.price) * Number(item.quantity));
    }, 0);
    if (!Number.isFinite(Number(totalAmount)) || computedTotal !== Number(totalAmount)) {
      return res.status(400).json({ success: false, message: '영수증 품목 합계와 총액이 일치하지 않습니다.' });
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const generatedTimeStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    const timeStr = typeof requestedTimeStr === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(requestedTimeStr)
      ? requestedTimeStr
      : generatedTimeStr;

    let markdownText = `## ${timeStr} (${martName || '이마트'})\n\n`;
    markdownText += `| 품목 | 단가 | 수량 | 소계 |\n`;
    markdownText += `|---|---|---|---|\n`;

    items.forEach(item => {
      const unitPriceStr = `${Number(item.price).toLocaleString()}원`;
      const subtotalStr = `${(Number(item.price) * Number(item.quantity)).toLocaleString()}원`;
      markdownText += `| ${item.name} | ${unitPriceStr} | ${item.quantity} | ${subtotalStr} |\n`;
    });

    const formattedTotal = `${Number(totalAmount).toLocaleString()}원`;
    markdownText += `\n**총합계: ${formattedTotal}**\n\n---\n\n`;

    const canonicalMart = (martName === '이마트' || martName === 'Emart')
      ? 'Emart'
      : (martName === '코스트코' || martName === 'Costco') ? 'Costco' : 'Emart';

    // 1. Save to Postgres DB table
    await dbHelper.savePurchaseRecord(canonicalMart, timeStr, totalAmount, items);

    // 2. Update registered/recommended items from the receipt lines
    const receiptItemMap = new Map();
    items.forEach(item => {
      const representativeName = getRepresentativeItemName(canonicalMart, item.name);
      const duplicateKey = getDuplicateItemKey(canonicalMart, representativeName);
      const normalizedPrice = normalizeKnownItemPrice(canonicalMart, representativeName, item.price);
      if (!representativeName || !Number(normalizedPrice)) return;
      receiptItemMap.set(duplicateKey, {
        name: representativeName,
        price: normalizedPrice
      });
    });

    for (const item of receiptItemMap.values()) {
      await dbHelper.upsertItem(canonicalMart, item.name, item.price, true);
    }

    if (receiptItemMap.size > 0) {
      const allItems = await dbHelper.getItems(canonicalMart, true);
      writeItemsToMarkdownBackups(canonicalMart, allItems);
    }

    // 3. Save to Local File (구매내역.md)
    const filePath = path.join(__dirname, '구매내역.md');
    appendLocalBackup(filePath, markdownText);

    return res.json({
      success: true,
      message: '계산결과가 DB 및 로컬 구매내역.md 파일에 성공적으로 저장되었습니다.',
      updatedItems: receiptItemMap.size
    });
  } catch (error) {
    console.error('Error saving record to 구매내역.md:', error);
    return res.status(500).json({ 
      success: false, 
      message: '서버 파일 저장에 실패했습니다: ' + error.message 
    });
  }
});

// API endpoint to fetch saved purchase records history from DB
app.get('/api/db/records', async (req, res) => {
  try {
    const { mart, month, year } = req.query;
    await dbHelper.normalizePurchaseRecordMarts();
    const martFilter = mart ? getMartRecordAliases(mart) : null;
    const records = await dbHelper.getPurchaseRecords(martFilter, month, year);
    return res.json({ success: true, records });
  } catch (err) {
    console.error('Error getting purchase records:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// API endpoint to list item names that currently exist in purchase records
app.get('/api/db/records/item-names', async (req, res) => {
  try {
    const items = await dbHelper.getPurchaseRecordItemNames();
    return res.json({ success: true, items });
  } catch (err) {
    console.error('Error getting purchase record item names:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

function getPreviousMonthValue(monthValue) {
  const safeMonth = /^\d{4}-\d{2}$/.test(monthValue) ? monthValue : new Date().toISOString().slice(0, 7);
  const [year, month] = safeMonth.split('-').map(Number);
  const shifted = new Date(year, month - 2, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
}

function getYearFromMonthValue(monthValue) {
  const safeMonth = /^\d{4}-\d{2}$/.test(monthValue) ? monthValue : new Date().toISOString().slice(0, 7);
  return safeMonth.slice(0, 4);
}

function summarizeRecords(records) {
  const summary = {
    total: 0,
    emart: 0,
    costco: 0,
    records: { emart: 0, costco: 0 }
  };

  (records || []).forEach(record => {
    const amount = Number(record.total_amount || 0);
    const martId = toCanonicalMartId(record.mart_id, record.mart_id);
    summary.total += amount;
    if (martId === 'Costco') {
      summary.costco += amount;
      summary.records.costco += 1;
    } else if (martId === 'Emart') {
      summary.emart += amount;
      summary.records.emart += 1;
    }
  });

  return summary;
}

function getBudgetStatus(spent, budget) {
  if (budget <= 0) return 'normal';
  const ratio = spent / budget;
  if (ratio >= 1) return 'over';
  if (ratio >= 0.8) return 'warning';
  return 'normal';
}

function getShare(summary) {
  if (!summary.total) return { emart: 0, costco: 0 };
  return {
    emart: Math.round((summary.emart / summary.total) * 100),
    costco: Math.round((summary.costco / summary.total) * 100)
  };
}

async function getNumberSetting(key, fallback) {
  const value = await dbHelper.getSetting(key);
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

app.get('/api/db/household-summary', async (req, res) => {
  try {
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : new Date().toISOString().slice(0, 7);
    const previousMonth = getPreviousMonthValue(month);
    const year = getYearFromMonthValue(month);

    await dbHelper.normalizePurchaseRecordMarts();

    const emartBudget = await getNumberSetting('emart_monthly_household_budget', 290000);
    const costcoBudget = await getNumberSetting('costco_monthly_household_budget', 300000);
    const currentRecords = await dbHelper.getPurchaseRecords(null, month);
    const previousRecords = await dbHelper.getPurchaseRecords(null, previousMonth);
    const yearRecords = await dbHelper.getPurchaseRecords(null, null, year);

    const currentMonth = summarizeRecords(currentRecords);
    const previous = summarizeRecords(previousRecords);
    const yearTotal = summarizeRecords(yearRecords);
    const budget = {
      total: emartBudget + costcoBudget,
      emart: emartBudget,
      costco: costcoBudget
    };

    return res.json({
      success: true,
      month,
      previousMonth,
      year,
      budget,
      currentMonth,
      previousMonthSummary: previous,
      diff: {
        total: currentMonth.total - previous.total,
        emart: currentMonth.emart - previous.emart,
        costco: currentMonth.costco - previous.costco
      },
      yearTotal,
      share: getShare(currentMonth),
      status: {
        total: getBudgetStatus(currentMonth.total, budget.total),
        emart: getBudgetStatus(currentMonth.emart, budget.emart),
        costco: getBudgetStatus(currentMonth.costco, budget.costco)
      }
    });
  } catch (err) {
    console.error('Error getting household summary:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/receipt-rules', (req, res) => {
  try {
    const filePath = path.join(__dirname, 'receipt.md');
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'receipt.md 파일을 찾을 수 없습니다.' });
    }

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="receipt.md"');
    return res.send(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error('Error downloading receipt.md:', error);
    return res.status(500).json({ success: false, message: 'receipt.md 다운로드 실패: ' + error.message });
  }
});

app.post('/api/receipt-rules', (req, res) => {
  try {
    const content = typeof req.body.content === 'string' ? req.body.content : '';
    if (!content.trim()) {
      return res.status(400).json({ success: false, message: '저장할 receipt.md 내용이 없습니다.' });
    }

    fs.writeFileSync(path.join(__dirname, 'receipt.md'), content, 'utf8');
    return res.json({ success: true, message: 'receipt.md 파일을 저장했습니다.' });
  } catch (error) {
    console.error('Error saving receipt.md:', error);
    return res.status(500).json({ success: false, message: 'receipt.md 저장 실패: ' + error.message });
  }
});

// API endpoint to delete a specific purchase record from DB
app.delete('/api/db/records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await dbHelper.deletePurchaseRecord(id);
    return res.json({ success: true, message: '저장 내역이 삭제되었습니다.' });
  } catch (err) {
    console.error('Error deleting purchase record:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// API endpoint to rename an item inside saved purchase record JSON payloads
app.post('/api/db/records/rename-item', async (req, res) => {
  try {
    const oldName = String(req.body.oldName || '').trim();
    const newName = String(req.body.newName || '').trim();
    if (!oldName || !newName) {
      return res.status(400).json({ success: false, message: '기존 품명과 새 품명을 모두 입력해야 합니다.' });
    }
    if (oldName === newName) {
      return res.status(400).json({ success: false, message: '기존 품명과 새 품명이 같습니다.' });
    }

    const result = await dbHelper.renamePurchaseRecordItem(oldName, newName);
    return res.json({
      success: true,
      message: `${result.updatedRecords}건의 구매내역에서 ${result.updatedItems}개 품목명을 수정했습니다.`,
      ...result
    });
  } catch (err) {
    console.error('Error renaming purchase record item:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Helper: Parse items from Markdown file
function parseItemsFromMarkdown(filePath) {
  if (!fs.existsSync(filePath)) return null;

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const items = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.includes(':---')) {
        return;
      }

      let name = '';
      let rawPrice = '';

      if (trimmed.startsWith('|')) {
        const parts = trimmed.split('|').map(p => p.trim()).filter(Boolean);
        if (parts.length >= 1) {
          name = parts[0];
          rawPrice = parts[1] || '';
        }
      } else {
        const commaIdx = trimmed.indexOf(',');
        if (commaIdx !== -1) {
          name = trimmed.substring(0, commaIdx).trim();
          rawPrice = trimmed.substring(commaIdx + 1).trim();
        } else {
          name = trimmed;
        }
      }

      if (name && name !== '-' && name !== '품목명') {
        let price = null;
        if (rawPrice) {
          const cleanPrice = rawPrice.replace(/[^0-9]/g, '');
          if (cleanPrice) {
            const parsed = parseInt(cleanPrice, 10);
            if (!isNaN(parsed) && parsed > 0) {
              price = parsed;
            }
          }
        }
        items.push({ name, lastPrice: price });
      }
    });

    return items;
  } catch (e) {
    console.error('Error reading markdown items:', e);
    return null;
  }
}

// Helper: Write items to Markdown file in comma separated format
function writeItemsToMarkdown(filePath, martName, items) {
  if (process.env.VERCEL) return true;
  try {
    let md = `# ${martName} 품목 및 단가 리스트\n\n`;

    items.forEach(item => {
      const priceStr = (item.lastPrice && item.lastPrice > 0) 
        ? `${Number(item.lastPrice).toLocaleString()}원` 
        : '-';
      md += `${item.name}, ${priceStr}\n`;
    });

    fs.writeFileSync(filePath, md, 'utf8');
    return true;
  } catch (e) {
    console.error('Error writing markdown items:', e);
    return false;
  }
}

function writeItemsToMarkdownBackups(canonicalMart, items) {
  if (process.env.VERCEL) return true;
  const targets = [
    { fileName: `품목_${canonicalMart}.md`, label: canonicalMart }
  ];
  if (canonicalMart === 'Emart') {
    targets.push({ fileName: '품목_Emart.md', label: 'Emart' });
  }
  return targets.every(target =>
    writeItemsToMarkdown(path.join(__dirname, target.fileName), target.label, items)
  );
}

function appendLocalBackup(filePath, content) {
  if (process.env.VERCEL) return true;
  fs.appendFileSync(filePath, content, 'utf8');
  return true;
}

function getDownloadMartSlug(martName) {
  if (martName === '코스트코' || martName === 'Costco') return 'costco';
  if (martName === '이마트' || martName === 'Emart') return 'emart';
  return String(martName || 'mart').replace(/[^A-Za-z0-9_-]/g, '_') || 'mart';
}

function setDownloadHeaders(res, contentType, martName, extension) {
  const safeFileName = `mart_${getDownloadMartSlug(martName)}_items.${extension}`;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
}

function getPriceHistoryStats(priceHistory) {
  const prices = Array.isArray(priceHistory)
    ? priceHistory.map(history => Number(history.price)).filter(price => Number.isFinite(price) && price > 0)
    : [];
  if (prices.length === 0) {
    return { count: 0, min: null, max: null, avg: null };
  }

  const sum = prices.reduce((total, price) => total + price, 0);
  return {
    count: prices.length,
    min: Math.min(...prices),
    max: Math.max(...prices),
    avg: Math.round(sum / prices.length)
  };
}

function formatWon(value) {
  return value ? `${Number(value).toLocaleString()}원` : '-';
}

function getRepresentativeItemName(martName, name) {
  const trimmedName = String(name || '').trim();
  if (martName === '이마트' || martName === 'Emart') {
    const compactEmartName = trimmedName.replace(/\s+/g, '').toLowerCase();
    if (compactEmartName === '밀양청양고추' || compactEmartName === '청양고추') {
      return '청양고추';
    }
    return trimmedName;
  }
  if (martName !== '코스트코' && martName !== 'Costco') return trimmedName;

  const compactName = trimmedName.replace(/\s+/g, '').toLowerCase();
  if (compactName.includes('소노마') && (compactName.includes('샤르도네') || compactName.includes('샤도네이'))) {
    return '소노마 샤르도네';
  }
  if (compactName.includes('기린캔') && (compactName.includes('8개') || compactName.includes('500ml'))) {
    return '기린캔 500ML X 8';
  }
  if (compactName.includes('ks새우') || compactName.includes('새우')) {
    const normalizedShrimpName = compactName.replace(/[–—]/g, '-');
    if (normalizedShrimpName.includes('11-15') && normalizedShrimpName.includes('680g')) {
      return '새우 11-15 680G';
    }
    if (normalizedShrimpName.includes('31-40') && normalizedShrimpName.includes('908g')) {
      return '새우 31-40 908G';
    }
    if (normalizedShrimpName.includes('50-70') && normalizedShrimpName.includes('908g')) {
      return '새우 50-70 908G';
    }
  }

  return trimmedName;
}

function getDuplicateItemKey(martName, name) {
  return getRepresentativeItemName(martName, name)
    .replace(/^와인\s+/, '')
    .replace(/\s+/g, '')
    .replace(/[()_\-–]/g, '')
    .toLowerCase();
}

// GET /api/items
app.get('/api/items', async (req, res) => {
  const martName = req.query.mart || 'Emart';
  const canonicalMart = toCanonicalMartId(martName);
  await seedItemsFromMarkdownIfEmpty(canonicalMart);
  const items = await dbHelper.getItems(canonicalMart);

  if (items && items.length > 0) {
    return res.json({ success: true, martName: canonicalMart, items });
  }

  return res.json({ success: false, message: '품목 마크다운 파일이 없거나 내용이 비어 있습니다.' });
});

// POST /api/items
app.post('/api/items', async (req, res) => {
  const { martName, items } = req.body;
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ success: false, message: '유효한 품목 리스트가 없습니다.' });
  }
  if (items.length === 0) {
    return res.status(400).json({ success: false, message: '저장할 품목이 없습니다.' });
  }

  const canonicalMart = toCanonicalMartId(martName);
  const representativeItems = new Map();
  for (const item of items) {
    const representativeName = getRepresentativeItemName(canonicalMart, item.name);
    const duplicateKey = getDuplicateItemKey(canonicalMart, representativeName);
    representativeItems.set(duplicateKey, {
      ...item,
      name: representativeName
    });
  }

  await dbHelper.pool.query('DELETE FROM items WHERE mart_id = $1', [canonicalMart]);
  for (const item of representativeItems.values()) {
    await dbHelper.upsertItem(canonicalMart, item.name, normalizeKnownItemPrice(canonicalMart, item.name, item.lastPrice), false);
  }

  const fileName = `품목_${canonicalMart}.md`;
  const filePath = path.join(__dirname, fileName);
  writeItemsToMarkdown(filePath, canonicalMart, await dbHelper.getItems(canonicalMart));

  return res.json({ success: true, message: `${fileName} 및 DB에 품목이 저장되었습니다.` });
});

// Fallback route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Mart Shopping Budget App listening on http://localhost:${PORT}`);
  });
}

module.exports = app;


