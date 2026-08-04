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
      message: '서버 파일 저기에 실패했습니다 (Vercel 등 서버리스 환경일 수 있습니다): ' + error.message 
    });
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
