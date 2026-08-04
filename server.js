const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint to append grocery calculation result to 물품.md
app.post('/api/save-record', (req, res) => {
  try {
    const { martName, items, totalAmount } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: '장바구니가 비어 있습니다.' });
    }

    const now = new Date();
    // Format timestamp in YYYY-MM-DD HH:mm:ss in local time
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

    const filePath = path.join(__dirname, '구매내역.md');
    fs.appendFileSync(filePath, markdownText, 'utf8');

    return res.json({ success: true, message: '계산결과가 구매내역.md에 성공적으로 저장되었습니다.' });
  } catch (error) {
    console.error('Error saving record to 구매내역.md:', error);
    return res.status(500).json({ 
      success: false, 
      message: '서버 파일 저장에 실패했습니다: ' + error.message 
    });
  }
});

// Helper: Parse items from Markdown file (supports comma separated format: 품목명, 단가)
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

// Helper: Write items to Markdown file in comma separated format (품목명, 단가)
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

// GET /api/items - Read items for a specific mart from markdown file
app.get('/api/items', (req, res) => {
  const martName = req.query.mart || 'Emart';
  const canonicalMart = (martName === '이마트' || martName === 'Emart') ? 'Emart' : martName;
  const fileName = `품목_${canonicalMart}.md`;
  const filePath = path.join(__dirname, fileName);

  const items = parseItemsFromMarkdown(filePath);
  if (items && items.length > 0) {
    return res.json({ success: true, martName: canonicalMart, items });
  }

  return res.json({ success: false, message: '품목 마크다운 파일이 없거나 내용이 비어 있습니다.' });
});

// POST /api/items - Save/Update items to markdown file
app.post('/api/items', (req, res) => {
  const { martName, items } = req.body;
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ success: false, message: '유효한 품목 리스트가 없습니다.' });
  }

  const canonicalMart = (martName === '이마트' || martName === 'Emart') ? 'Emart' : (martName || 'Emart');
  const fileName = `품목_${canonicalMart}.md`;
  const filePath = path.join(__dirname, fileName);

  const success = writeItemsToMarkdown(filePath, canonicalMart, items);
  if (success) {
    return res.json({ success: true, message: `${fileName} 파일에 품목이 성공적으로 저장되었습니다.` });
  } else {
    return res.status(500).json({ success: false, message: `${fileName} 저장 실패` });
  }
});

// Fallback route to serve index.html for single page app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Mart Shopping Budget App listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
