const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const dbHelper = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper: Seed default items from Markdown files into SQLite DB if empty
function seedItemsFromMarkdownIfEmpty(martId) {
  const existingItems = dbHelper.getItems(martId);
  if (existingItems && existingItems.length > 0) return;

  const fileName = `품목_${martId}.md`;
  const filePath = path.join(__dirname, fileName);
  const items = parseItemsFromMarkdown(filePath);
  if (items && items.length > 0) {
    items.forEach(item => {
      dbHelper.upsertItem(martId, item.name, item.lastPrice, false);
    });
  }
}

// ----------------------------------------------------
// DB Sync API Endpoints
// ----------------------------------------------------

// GET /api/db/sync - Read complete state for a mart (items, cart, budget)
app.get('/api/db/sync', (req, res) => {
  try {
    const martName = req.query.mart || 'Emart';
    const canonicalMart = (martName === '이마트' || martName === 'Emart') ? 'Emart' : martName;
    
    // Seed initial data if DB table is empty
    seedItemsFromMarkdownIfEmpty(canonicalMart);

    const items = dbHelper.getItems(canonicalMart);
    const cart = dbHelper.getCart(canonicalMart);
    const budget = dbHelper.getBudget(canonicalMart);

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
app.post('/api/db/item', (req, res) => {
  try {
    const { martName, name, price, incrementUse } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: '품목명이 필요합니다.' });
    }

    const canonicalMart = (martName === '이마트' || martName === 'Emart') ? 'Emart' : (martName || 'Emart');
    const updatedItem = dbHelper.upsertItem(canonicalMart, name, price, !!incrementUse);

    // Sync back to markdown file as backup
    const allItems = dbHelper.getItems(canonicalMart);
    writeItemsToMarkdown(path.join(__dirname, `품목_${canonicalMart}.md`), canonicalMart, allItems);

    return res.json({ success: true, item: updatedItem });
  } catch (error) {
    console.error('Error updating DB item:', error);
    return res.status(500).json({ success: false, message: '품목 저장 실패: ' + error.message });
  }
});

// DELETE /api/db/item - Delete a saved item from DB and Markdown backup
app.delete('/api/db/item', (req, res) => {
  try {
    const { mart, martName, name } = req.query;
    const requestedMart = mart || martName || 'Emart';
    const canonicalMart = (requestedMart === '이마트' || requestedMart === 'Emart') ? 'Emart' : requestedMart;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: '삭제할 품목명이 필요합니다.' });
    }

    dbHelper.deleteItem(canonicalMart, String(name).trim());

    const allItems = dbHelper.getItems(canonicalMart);
    writeItemsToMarkdown(path.join(__dirname, `품목_${canonicalMart}.md`), canonicalMart, allItems);

    return res.json({ success: true, message: '품목이 삭제되었습니다.' });
  } catch (error) {
    console.error('Error deleting DB item:', error);
    return res.status(500).json({ success: false, message: '품목 삭제 실패: ' + error.message });
  }
});

// GET /api/db/history - Fetch price history for a specific item
app.get('/api/db/history', (req, res) => {
  try {
    const { itemId } = req.query;
    if (!itemId) {
      return res.status(400).json({ success: false, message: 'itemId가 필요합니다.' });
    }

    const data = dbHelper.getItemHistoryById(itemId);
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
app.post('/api/db/cart', (req, res) => {
  try {
    const { martName, cart } = req.body;
    const canonicalMart = (martName === '이마트' || martName === 'Emart') ? 'Emart' : (martName || 'Emart');

    dbHelper.saveCart(canonicalMart, cart || []);
    return res.json({ success: true, message: '장바구니 동기화 성공' });
  } catch (error) {
    console.error('Error saving cart:', error);
    return res.status(500).json({ success: false, message: '장바구니 저장 실패: ' + error.message });
  }
});

// POST /api/db/budget - Sync budget amount
app.post('/api/db/budget', (req, res) => {
  try {
    const { martName, amount } = req.body;
    const canonicalMart = (martName === '이마트' || martName === 'Emart') ? 'Emart' : (martName || 'Emart');

    dbHelper.setBudget(canonicalMart, parseInt(amount, 10) || 60000);
    return res.json({ success: true, message: '예산 저장 성공' });
  } catch (error) {
    console.error('Error saving budget:', error);
    return res.status(500).json({ success: false, message: '예산 저장 실패: ' + error.message });
  }
});

// GET /api/db/export - Export items and price history in CSV / JSON / MD format
app.get('/api/db/export', (req, res) => {
  try {
    const martName = req.query.mart || 'Emart';
    const format = (req.query.format || 'csv').toLowerCase();
    const canonicalMart = (martName === '이마트' || martName === 'Emart') ? 'Emart' : martName;

    seedItemsFromMarkdownIfEmpty(canonicalMart);
    const items = dbHelper.getItems(canonicalMart);

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=mart_${canonicalMart}_items.json`);
      return res.send(JSON.stringify({ mart: canonicalMart, exportedAt: new Date().toISOString(), items }, null, 2));
    } else if (format === 'md') {
      let md = `# ${canonicalMart} 품목 및 가격 이력 리스트\n\n`;
      md += `> 내보낸 날짜: ${new Date().toLocaleString()}\n\n`;
      md += `| ID | 품목명 | 최근 단가 | 구매 횟수 | 변동 이력 수 |\n`;
      md += `|---|---|---|---|---|\n`;
      items.forEach(item => {
        const priceStr = item.lastPrice ? `${item.lastPrice.toLocaleString()}원` : '-';
        md += `| ${item.id} | ${item.name} | ${priceStr} | ${item.useCount} | ${item.priceHistory ? item.priceHistory.length : 0} |\n`;
      });
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=mart_${canonicalMart}_items.md`);
      return res.send(md);
    } else {
      // CSV Format
      let csv = '\uFEFF'; // UTF-8 BOM for Excel compatibility
      csv += 'ID,품목명,최근단가,구매횟수,이력기록수,최근이력\n';
      items.forEach(item => {
        const priceStr = item.lastPrice || '';
        const historyText = (item.priceHistory && item.priceHistory.length > 0)
          ? item.priceHistory.map(h => `${h.recorded_at.substring(0, 10)}:${h.price}원(${h.note || ''})`).join(' | ')
          : '';
        csv += `"${item.id}","${item.name.replace(/"/g, '""')}","${priceStr}","${item.useCount}","${item.priceHistory ? item.priceHistory.length : 0}","${historyText.replace(/"/g, '""')}"\n`;
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=mart_${canonicalMart}_items.csv`);
      return res.send(csv);
    }
  } catch (error) {
    console.error('Error exporting data:', error);
    return res.status(500).json({ success: false, message: '데이터 내보내기 실패: ' + error.message });
  }
});

// API endpoint to append grocery calculation result to 구매내역.md
app.post('/api/save-record', (req, res) => {
  try {
    const { martName, items, totalAmount } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: '장바구니가 비어 있습니다.' });
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timeStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

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

    const canonicalMart = (martName === '이마트' || martName === 'Emart') ? 'Emart' : (martName || 'Emart');

    // 1. Save to SQLite DB table
    dbHelper.savePurchaseRecord(canonicalMart, timeStr, totalAmount, items);

    // 2. Save to Local File (구매내역.md)
    const filePath = path.join(__dirname, '구매내역.md');
    fs.appendFileSync(filePath, markdownText, 'utf8');

    return res.json({ success: true, message: '계산결과가 DB 및 로컬 구매내역.md 파일에 성공적으로 저장되었습니다.' });
  } catch (error) {
    console.error('Error saving record to 구매내역.md:', error);
    return res.status(500).json({ 
      success: false, 
      message: '서버 파일 저장에 실패했습니다: ' + error.message 
    });
  }
});

// API endpoint to fetch saved purchase records history from DB
app.get('/api/db/records', (req, res) => {
  try {
    const { mart } = req.query;
    const records = dbHelper.getPurchaseRecords(mart);
    return res.json({ success: true, records });
  } catch (err) {
    console.error('Error getting purchase records:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// API endpoint to delete a specific purchase record from DB
app.delete('/api/db/records/:id', (req, res) => {
  try {
    const { id } = req.params;
    dbHelper.deletePurchaseRecord(id);
    return res.json({ success: true, message: '저장 내역이 삭제되었습니다.' });
  } catch (err) {
    console.error('Error deleting purchase record:', err);
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

// GET /api/items
app.get('/api/items', (req, res) => {
  const martName = req.query.mart || 'Emart';
  const canonicalMart = (martName === '이마트' || martName === 'Emart') ? 'Emart' : martName;
  seedItemsFromMarkdownIfEmpty(canonicalMart);
  const items = dbHelper.getItems(canonicalMart);

  if (items && items.length > 0) {
    return res.json({ success: true, martName: canonicalMart, items });
  }

  return res.json({ success: false, message: '품목 마크다운 파일이 없거나 내용이 비어 있습니다.' });
});

// POST /api/items
app.post('/api/items', (req, res) => {
  const { martName, items } = req.body;
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ success: false, message: '유효한 품목 리스트가 없습니다.' });
  }

  const canonicalMart = (martName === '이마트' || martName === 'Emart') ? 'Emart' : (martName || 'Emart');
  items.forEach(item => {
    dbHelper.upsertItem(canonicalMart, item.name, item.lastPrice, false);
  });

  const fileName = `품목_${canonicalMart}.md`;
  const filePath = path.join(__dirname, fileName);
  writeItemsToMarkdown(filePath, canonicalMart, dbHelper.getItems(canonicalMart));

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
