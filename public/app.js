/**
 * Node.js Mart Shopping Budget Calculator
 * Main Frontend Application Script
 */

(function () {
  'use strict';

  // --- Constants & Default Data ---
  const DEFAULT_BUDGET = 60000;
  const DEFAULT_ITEMS_LIST = [
    { name: '맥주', lastPrice: null },
    { name: '행사 우유', lastPrice: null },
    { name: '소화 우유', lastPrice: null },
    { name: '계란', lastPrice: null },
    { name: '돼지고기', lastPrice: null },
    { name: '파', lastPrice: null },
    { name: '상추', lastPrice: null },
    { name: '깻잎', lastPrice: null },
    { name: '콩국물', lastPrice: null },
    { name: '적상추', lastPrice: 2780 },
    { name: '백오이 5입', lastPrice: 3480 },
    { name: '청양 고추', lastPrice: 2980 },
    { name: '서울 우유 2입', lastPrice: 8960 },
    { name: '양지 1++', lastPrice: 15010 },
    { name: '시금치', lastPrice: 2980 },
    { name: '국산콩물', lastPrice: 6000 },
    { name: '복숭아', lastPrice: 8970 },
    { name: '자두 1kg', lastPrice: 7980 },
    { name: '참타리버섯', lastPrice: 1480 },
    { name: '성주 참외', lastPrice: 11980 },
    { name: '밀양 청양고추', lastPrice: 2980 }
  ];

  // Korean Chosung Disassembly Constants
  const KOREAN_START = 0xac00;
  const KOREAN_END = 0xd7a3;
  const CHOSUNG = [
    'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
  ];

  // --- Helper: Korean Chosung Extractor ---
  function getChosung(str) {
    let result = '';
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code >= KOREAN_START && code <= KOREAN_END) {
        const chosungIndex = Math.floor((code - KOREAN_START) / 588);
        result += CHOSUNG[chosungIndex];
      } else {
        result += str[i];
      }
    }
    return result;
  }

  // --- State Variables ---
  let currentMart = 'Emart';
  let budget = DEFAULT_BUDGET;
  let cart = [];
  let savedItems = [];
  let autoNameIndex = 1;

  // --- DOM Elements ---
  const tabEmart = document.getElementById('tab-emart');
  const tabCostco = document.getElementById('tab-costco');
  const dashboardBoard = document.getElementById('dashboard-board');
  const dashboardMartLabel = document.getElementById('dashboard-mart-label');
  const totalAmountEl = document.getElementById('total-amount');
  const statusBadgeEl = document.getElementById('status-badge');
  const statusValueEl = document.getElementById('status-value');

  const recommendationBanner = document.getElementById('recommendation-banner');
  const recommendationText = document.getElementById('recommendation-text');
  const btnRemoveRecommended = document.getElementById('btn-remove-recommended');

  const budgetInput = document.getElementById('budget-input');
  const itemForm = document.getElementById('item-form');
  const itemNameInput = document.getElementById('item-name-input');
  const itemPriceInput = document.getElementById('item-price-input');
  const priceHelper = document.getElementById('price-helper');
  const priceHelperText = document.getElementById('price-helper-text');
  const autocompleteList = document.getElementById('autocomplete-list');

  const cartItemCount = document.getElementById('cart-item-count');
  const cartEmptyMsg = document.getElementById('cart-empty-msg');
  const cartList = document.getElementById('cart-list');
  const btnClearCart = document.getElementById('btn-clear-cart');
  const btnSaveRecord = document.getElementById('btn-save-record');
  const btnResetSaved = document.getElementById('btn-reset-saved');

  // --- Data Migration & Storage Keys ---
  function getStorageKeys(mart) {
    const canonicalMart = (mart === '이마트' || mart === 'Emart') ? 'Emart' : mart;
    return {
      budgetKey: `martApp_budget_${canonicalMart}`,
      cartKey: `martApp_cart_${canonicalMart}`,
      savedItemsKey: `martApp_savedItems_${canonicalMart}`
    };
  }

  function migrateLegacyData() {
    try {
      // Check legacy single-mart keys
      const legacyBudget = localStorage.getItem('martApp_budget');
      const legacyCart = localStorage.getItem('martApp_cart');
      const legacySaved = localStorage.getItem('martApp_savedItems');

      const emartKeys = getStorageKeys('Emart');
      
      if ((legacyBudget || legacyCart || legacySaved) && !localStorage.getItem(emartKeys.budgetKey)) {
        if (legacyBudget) localStorage.setItem(emartKeys.budgetKey, legacyBudget);
        if (legacyCart) localStorage.setItem(emartKeys.cartKey, legacyCart);
        if (legacySaved) localStorage.setItem(emartKeys.savedItemsKey, legacySaved);

        localStorage.removeItem('martApp_budget');
        localStorage.removeItem('martApp_cart');
        localStorage.removeItem('martApp_savedItems');
      }

      // Also migrate from '이마트' key if present to 'Emart'
      const oldBudget = localStorage.getItem('martApp_budget_이마트');
      const oldCart = localStorage.getItem('martApp_cart_이마트');
      const oldSaved = localStorage.getItem('martApp_savedItems_이마트');

      if (oldBudget && !localStorage.getItem(emartKeys.budgetKey)) localStorage.setItem(emartKeys.budgetKey, oldBudget);
      if (oldCart && !localStorage.getItem(emartKeys.cartKey)) localStorage.setItem(emartKeys.cartKey, oldCart);
      if (oldSaved && !localStorage.getItem(emartKeys.savedItemsKey)) localStorage.setItem(emartKeys.savedItemsKey, oldSaved);

    } catch (e) {
      console.warn('Migration error:', e);
    }
  }

  // --- Default Items Seeding ---
  function createDefaultSavedItems() {
    return DEFAULT_ITEMS_LIST.map(def => {
      const name = typeof def === 'string' ? def : def.name;
      const lastPrice = typeof def === 'object' ? def.lastPrice : null;
      return {
        name: name,
        lastPrice: lastPrice,
        useCount: lastPrice ? 1 : 0,
        lastUsedAt: null,
        isDefault: true,
        priceHistory: lastPrice ? [{ price: lastPrice, usedAt: new Date().toISOString() }] : []
      };
    });
  }

  // --- Load & Save State per Mart ---
  function loadState(mart) {
    currentMart = mart;
    document.body.dataset.mart = mart;

    const keys = getStorageKeys(mart);

    // 1. Budget
    const savedBudget = localStorage.getItem(keys.budgetKey);
    budget = savedBudget !== null ? parseInt(savedBudget, 10) : DEFAULT_BUDGET;

    // 2. Cart
    try {
      const savedCart = localStorage.getItem(keys.cartKey);
      cart = savedCart ? JSON.parse(savedCart) : [];
      if (!Array.isArray(cart)) cart = [];
    } catch (e) {
      cart = [];
    }

    // 3. Saved Items
    try {
      const rawSaved = localStorage.getItem(keys.savedItemsKey);
      let parsed = rawSaved ? JSON.parse(rawSaved) : [];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        parsed = createDefaultSavedItems();
      } else {
        // Validate & fill default fields
        parsed = parsed.map(item => ({
          name: item.name,
          lastPrice: item.lastPrice ?? null,
          useCount: item.useCount ?? 0,
          lastUsedAt: item.lastUsedAt ?? null,
          isDefault: item.isDefault ?? false,
          priceHistory: Array.isArray(item.priceHistory) ? item.priceHistory : []
        }));
      }

      // Merge missing default items into savedItems
      const existingNames = new Set(parsed.map(i => i.name.trim()));
      DEFAULT_ITEMS_LIST.forEach(def => {
        const defName = typeof def === 'string' ? def : def.name;
        const defPrice = typeof def === 'object' ? def.lastPrice : null;
        if (!existingNames.has(defName)) {
          parsed.push({
            name: defName,
            lastPrice: defPrice,
            useCount: defPrice ? 1 : 0,
            lastUsedAt: null,
            isDefault: true,
            priceHistory: defPrice ? [{ price: defPrice, usedAt: new Date().toISOString() }] : []
          });
        }
      });

      savedItems = parsed;
    } catch (e) {
      savedItems = createDefaultSavedItems();
    }

    // Calculate autoNameIndex for generated item names
    calculateAutoNameIndex();

    // Save initial seeded data if newly generated
    saveState();
  }

  function saveState() {
    const keys = getStorageKeys(currentMart);
    localStorage.setItem('martApp_currentMart', currentMart);
    localStorage.setItem(keys.budgetKey, budget.toString());
    localStorage.setItem(keys.cartKey, JSON.stringify(cart));
    localStorage.setItem(keys.savedItemsKey, JSON.stringify(savedItems));
  }

  function calculateAutoNameIndex() {
    let maxIdx = 0;
    cart.forEach(item => {
      if (item.isAutoName && item.name.startsWith('품목 ')) {
        const idx = parseInt(item.name.replace('품목 ', ''), 10);
        if (!isNaN(idx) && idx > maxIdx) {
          maxIdx = idx;
        }
      }
    });
    autoNameIndex = maxIdx + 1;
  }

  // --- Quick Price Input Parser ---
  function parseQuickPrice(inputStr) {
    if (!inputStr) return null;

    // Strip non-digit and non-period characters
    const clean = inputStr.replace(/[^0-9.]/g, '');
    if (!clean) return null;

    // Check if input contains decimal point
    if (clean.includes('.')) {
      const val = parseFloat(clean);
      if (isNaN(val) || val <= 0) return null;
      // Decimal represents thousand won (천원 단위 소수)
      return Math.round(val * 1000);
    }

    const len = clean.length;
    const num = parseInt(clean, 10);
    if (isNaN(num) || num <= 0) return null;

    if (len === 1) {
      // 1 digit -> 1,000 won
      return num * 1000;
    } else if (len === 2) {
      // 2 digits -> 10,000 won
      return num * 1000;
    } else {
      // 3+ digits -> exact amount in won
      return num;
    }
  }

  // --- UI Update & Rendering ---
  function render() {
    // Tab active states
    if (currentMart === 'Emart' || currentMart === '이마트') {
      tabEmart.classList.add('active');
      tabCostco.classList.remove('active');
    } else {
      tabCostco.classList.add('active');
      tabEmart.classList.remove('active');
    }

    dashboardMartLabel.textContent = `${currentMart} 장보기`;
    budgetInput.value = budget.toLocaleString();

    // Compute total amount
    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    totalAmountEl.textContent = `${totalAmount.toLocaleString()}원`;

    // Budget Status
    if (totalAmount > budget) {
      const over = totalAmount - budget;
      dashboardBoard.classList.add('over-budget');
      statusBadgeEl.textContent = '예산 초과';
      statusValueEl.textContent = `${over.toLocaleString()}원 초과`;
      
      renderRecommendationBanner(over);
    } else {
      const remaining = budget - totalAmount;
      dashboardBoard.classList.remove('over-budget');
      statusBadgeEl.textContent = '예산 내';
      statusValueEl.textContent = `${remaining.toLocaleString()}원 남음`;

      recommendationBanner.classList.add('hidden');
    }

    // Render Cart
    cartItemCount.textContent = cart.length;
    cartList.innerHTML = '';

    if (cart.length === 0) {
      cartEmptyMsg.style.display = 'block';
    } else {
      cartEmptyMsg.style.display = 'none';

      cart.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'cart-item';

        const subtotal = item.price * item.quantity;

        // Price change badge HTML
        let badgeHtml = '';
        if (item.priceChange) {
          const pc = item.priceChange;
          if (pc.type === 'discount') {
            badgeHtml = `<span class="badge-price-change badge-discount">할인 ${pc.amount.toLocaleString()}원</span>`;
          } else if (pc.type === 'increase') {
            badgeHtml = `<span class="badge-price-change badge-increase">인상 ${pc.amount.toLocaleString()}원</span>`;
          } else if (pc.type === 'same') {
            badgeHtml = `<span class="badge-price-change badge-same">동일</span>`;
          } else if (pc.type === 'first') {
            badgeHtml = `<span class="badge-price-change badge-first">첫 기록</span>`;
          }
        }

        li.innerHTML = `
          <div class="cart-item-top">
            <div class="cart-item-title">
              <span>${escapeHtml(item.name)}</span>
              ${badgeHtml}
            </div>
            <div class="cart-item-subtotal">${subtotal.toLocaleString()}원</div>
          </div>
          <div class="cart-item-meta">
            <div class="cart-item-unit">단가: ${item.price.toLocaleString()}원</div>
            <div class="cart-item-controls">
              <div class="qty-control">
                <button type="button" class="btn-qty btn-minus" data-index="${index}" aria-label="수량 감소">-</button>
                <span class="qty-value">${item.quantity}</span>
                <button type="button" class="btn-qty btn-plus" data-index="${index}" aria-label="수량 증가">+</button>
              </div>
              <button type="button" class="btn-item-delete" data-index="${index}" aria-label="항목 삭제">🗑️</button>
            </div>
          </div>
        `;

        cartList.appendChild(li);
      });
    }
  }

  // Render Recommendation Banner when budget exceeded
  function renderRecommendationBanner(overAmount) {
    if (cart.length === 0) {
      recommendationBanner.classList.add('hidden');
      return;
    }

    let closestItem = null;
    let minDiff = Infinity;

    cart.forEach(item => {
      const itemSubtotal = item.price * item.quantity;
      const diff = Math.abs(itemSubtotal - overAmount);
      if (diff < minDiff) {
        minDiff = diff;
        closestItem = item;
      }
    });

    if (closestItem) {
      const subtotal = closestItem.price * closestItem.quantity;
      recommendationText.innerHTML = `<strong>'${escapeHtml(closestItem.name)}'</strong> 소계 ${subtotal.toLocaleString()}원을 빼면 예산 초과액과 가장 가까워집니다 (차이 ${minDiff.toLocaleString()}원)`;
      recommendationBanner.classList.remove('hidden');

      btnRemoveRecommended.onclick = () => {
        const itemIdx = cart.findIndex(i => i.id === closestItem.id);
        if (itemIdx !== -1) {
          cart.splice(itemIdx, 1);
          saveState();
          render();
          showToast(`'${closestItem.name}' 항목을 장바구니에서 제거했습니다.`);
        }
      };
    } else {
      recommendationBanner.classList.add('hidden');
    }
  }

  // --- Autocomplete Logic ---
  function updateAutocomplete() {
    const query = itemNameInput.value.trim();
    if (!query) {
      autocompleteList.classList.add('hidden');
      return;
    }

    const queryLower = query.toLowerCase();
    const queryChosung = getChosung(queryLower);

    // Score items for matching
    const matches = savedItems.filter(item => {
      const nameLower = item.name.toLowerCase();
      const nameChosung = getChosung(nameLower);

      return (
        nameLower.startsWith(queryLower) ||
        nameLower.includes(queryLower) ||
        nameChosung.includes(queryChosung)
      );
    });

    // Sort matching items:
    // 1. Starts with query
    // 2. Contains query
    // 3. Recently used
    // 4. Frequently used
    matches.sort((a, b) => {
      const aLower = a.name.toLowerCase();
      const bLower = b.name.toLowerCase();

      const aStart = aLower.startsWith(queryLower);
      const bStart = bLower.startsWith(queryLower);
      if (aStart && !bStart) return -1;
      if (!aStart && bStart) return 1;

      const aUse = a.useCount || 0;
      const bUse = b.useCount || 0;
      if (bUse !== aUse) return bUse - aUse;

      const aTime = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
      const bTime = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
      return bTime - aTime;
    });

    const displayList = matches.slice(0, 7);

    if (displayList.length === 0) {
      autocompleteList.classList.add('hidden');
      return;
    }

    autocompleteList.innerHTML = '';
    displayList.forEach(item => {
      const li = document.createElement('li');
      li.className = 'autocomplete-item';
      li.role = 'option';

      const priceTag = item.lastPrice 
        ? `<span class="item-price-tag">최근 ${item.lastPrice.toLocaleString()}원</span>` 
        : '';

      li.innerHTML = `
        <span class="item-name-bold">${escapeHtml(item.name)}</span>
        ${priceTag}
      `;

      li.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Prevent input blur
        selectAutocompleteItem(item);
      });

      autocompleteList.appendChild(li);
    });

    autocompleteList.classList.remove('hidden');
  }

  function selectAutocompleteItem(item) {
    itemNameInput.value = item.name;
    autocompleteList.classList.add('hidden');

    if (item.lastPrice) {
      itemPriceInput.value = item.lastPrice.toString();
      updatePriceHelper();
    } else {
      itemPriceInput.value = '';
      priceHelper.classList.add('hidden');
    }

    itemPriceInput.focus();
  }

  // --- Real-time Price Helper Update ---
  function updatePriceHelper() {
    const raw = itemPriceInput.value;
    const parsed = parseQuickPrice(raw);

    if (parsed && parsed > 0) {
      priceHelperText.textContent = `${parsed.toLocaleString()}원으로 입력됩니다`;
      priceHelper.classList.remove('hidden');
    } else {
      priceHelper.classList.add('hidden');
    }
  }

  // --- Add Item Handler ---
  function handleAddItem(e) {
    if (e) e.preventDefault();

    const parsedPrice = parseQuickPrice(itemPriceInput.value);
    if (!parsedPrice || parsedPrice <= 0) {
      showToast('유효한 가격을 입력해 주세요.');
      itemPriceInput.focus();
      return;
    }

    const rawName = itemNameInput.value.trim();
    let itemName = rawName;
    let isAutoName = false;
    let priceChange = null;

    if (!itemName) {
      // Auto name generation
      itemName = `품목 ${autoNameIndex++}`;
      isAutoName = true;
    } else {
      // Non-auto name: track & update in savedItems
      const existingIdx = savedItems.findIndex(i => i.name.trim() === itemName);
      const nowIso = new Date().toISOString();

      if (existingIdx !== -1) {
        const existing = savedItems[existingIdx];
        const lastPrice = existing.lastPrice;

        // Price change detection BEFORE updating lastPrice
        if (lastPrice === null || lastPrice === undefined) {
          priceChange = { type: 'first' };
        } else if (parsedPrice < lastPrice) {
          priceChange = { type: 'discount', amount: lastPrice - parsedPrice };
        } else if (parsedPrice > lastPrice) {
          priceChange = { type: 'increase', amount: parsedPrice - lastPrice };
        } else {
          priceChange = { type: 'same' };
        }

        // Update existing saved item
        existing.lastPrice = parsedPrice;
        existing.useCount = (existing.useCount || 0) + 1;
        existing.lastUsedAt = nowIso;
        
        if (!Array.isArray(existing.priceHistory)) existing.priceHistory = [];
        existing.priceHistory.unshift({ price: parsedPrice, usedAt: nowIso });
        if (existing.priceHistory.length > 20) {
          existing.priceHistory = existing.priceHistory.slice(0, 20);
        }
      } else {
        // New saved item
        priceChange = { type: 'first' };
        savedItems.push({
          name: itemName,
          lastPrice: parsedPrice,
          useCount: 1,
          lastUsedAt: nowIso,
          isDefault: false,
          priceHistory: [{ price: parsedPrice, usedAt: nowIso }]
        });
      }
    }

    // Create Cart Item
    const cartItem = {
      id: 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      name: itemName,
      price: parsedPrice,
      quantity: 1,
      isAutoName: isAutoName,
      priceChange: priceChange
    };

    cart.push(cartItem);
    saveState();
    render();

    // Reset Form and focus price input
    itemNameInput.value = '';
    itemPriceInput.value = '';
    priceHelper.classList.add('hidden');
    autocompleteList.classList.add('hidden');
    itemPriceInput.focus();
  }

  // --- Event Listeners Initialization ---
  function initEvents() {
    // Store Tab switching
    tabEmart.addEventListener('click', () => {
      if (currentMart !== 'Emart' && currentMart !== '이마트') {
        saveState();
        loadState('Emart');
        render();
      }
    });

    tabCostco.addEventListener('click', () => {
      if (currentMart !== '코스트코') {
        saveState();
        loadState('코스트코');
        render();
      }
    });

    // Budget input change
    budgetInput.addEventListener('input', () => {
      const clean = budgetInput.value.replace(/[^0-9]/g, '');
      const parsed = parseInt(clean, 10);
      budget = isNaN(parsed) ? 0 : parsed;
      saveState();
      render();
    });

    // Quick price input helper listener
    itemPriceInput.addEventListener('input', updatePriceHelper);

    // Autocomplete listeners
    itemNameInput.addEventListener('input', updateAutocomplete);
    itemNameInput.addEventListener('focus', updateAutocomplete);
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.autocomplete-container')) {
        autocompleteList.classList.add('hidden');
      }
    });

    // Form Submit
    itemForm.addEventListener('submit', handleAddItem);

    // Cart item quantity / delete controls (Event Delegation)
    cartList.addEventListener('click', (e) => {
      const btnMinus = e.target.closest('.btn-minus');
      const btnPlus = e.target.closest('.btn-plus');
      const btnDelete = e.target.closest('.btn-item-delete');

      if (btnMinus) {
        const idx = parseInt(btnMinus.dataset.index, 10);
        if (cart[idx]) {
          cart[idx].quantity -= 1;
          if (cart[idx].quantity <= 0) {
            cart.splice(idx, 1);
          }
          saveState();
          render();
        }
      } else if (btnPlus) {
        const idx = parseInt(btnPlus.dataset.index, 10);
        if (cart[idx]) {
          cart[idx].quantity += 1;
          saveState();
          render();
        }
      } else if (btnDelete) {
        const idx = parseInt(btnDelete.dataset.index, 10);
        if (cart[idx]) {
          cart.splice(idx, 1);
          saveState();
          render();
        }
      }
    });

    // Clear Cart
    btnClearCart.addEventListener('click', () => {
      if (cart.length === 0) return;
      if (confirm(`[${currentMart}] 장바구니의 모든 항목을 비우시겠습니까?`)) {
        cart = [];
        saveState();
        render();
        showToast('장바구니를 비웠습니다.');
      }
    });

    // Reset Saved Items
    btnResetSaved.addEventListener('click', () => {
      if (confirm(`[${currentMart}] 저장된 품목 및 가격 이력을 초기화하고 기본 품목으로 복원하시겠습니까?`)) {
        savedItems = createDefaultSavedItems();
        saveState();
        render();
        showToast('저장 품목을 기본 상태로 복원했습니다.');
      }
    });

    // Save Record API ("계산결과 저장")
    btnSaveRecord.addEventListener('click', async () => {
      if (cart.length === 0) {
        alert('장바구니가 비어 있어 계산결과를 저장할 수 없습니다.');
        return;
      }

      const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      try {
        const res = await fetch('/api/save-record', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            martName: currentMart,
            items: cart,
            totalAmount: totalAmount
          })
        });

        const data = await res.json();
        if (data.success) {
          alert(`✅ ${data.message}`);
        } else {
          alert(`⚠️ ${data.message}`);
        }
      } catch (err) {
        console.error('Save record failed:', err);
        alert('⚠️ 서버 통신 중 오류가 발생했습니다. (로컬 실행 환경이 아닐 경우 파일 저장이 지원되지 않습니다.)');
      }
    });
  }

  // --- Toast Notification Helper ---
  function showToast(msg) {
    let toast = document.getElementById('toast-msg');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast-msg';
      toast.className = 'toast-msg';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  // --- Utility: HTML Escape ---
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- App Initialization ---
  function init() {
    migrateLegacyData();

    // Determine initial mart from localStorage or default to 'Emart'
    let savedMart = localStorage.getItem('martApp_currentMart') || 'Emart';
    if (savedMart === '이마트') savedMart = 'Emart';
    loadState(savedMart);
    initEvents();
    render();
  }

  // Run on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
