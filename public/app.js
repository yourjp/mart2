/**
 * Node.js Mart Shopping Budget Calculator
 * Main Frontend Application Script
 */

(function () {
  'use strict';

  // --- Constants & Default Data ---
  const APP_VERSION = 'v2.2 (2026-08-05)';
  const DEFAULT_BUDGET_EMART = 60000;
  const DEFAULT_BUDGET_COSTCO = 300000;

  function getDefaultBudgetForMart(mart) {
    if (mart === '코스트코') {
      return DEFAULT_BUDGET_COSTCO;
    }
    return DEFAULT_BUDGET_EMART;
  }
  
  const DEFAULT_ITEMS_EMART = [
    { name: '맥주(5개묶음)', lastPrice: 14000 },
    { name: '맥주', lastPrice: 14000 },
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
    { name: '밀양 청양고추', lastPrice: 2980 },
    { name: '캠벨 1.5kg', lastPrice: 13100 },
    { name: '알배기', lastPrice: 2489 },
    { name: '대파', lastPrice: 1930 },
    { name: '더 클래스 우유(2개묶음)', lastPrice: 4280 },
    { name: '락토프리', lastPrice: 2680 }
  ];

  const DEFAULT_ITEMS_COSTCO = [
    { name: '커클랜드 생수', lastPrice: null },
    { name: '맥주(5개묶음)', lastPrice: null },
    { name: '계란 30구', lastPrice: null },
    { name: '돼지고기(대용량)', lastPrice: null },
    { name: '소고기(대용량)', lastPrice: null },
    { name: '크로와상', lastPrice: null },
    { name: '베이글', lastPrice: null },
    { name: '우유 2입', lastPrice: null },
    { name: '토마토 4KG', lastPrice: 11890 },
    { name: '미니 대추토마토', lastPrice: 10890 },
    { name: '그린키위 2.4KG', lastPrice: 17090 },
    { name: '설빙 미숫가루', lastPrice: 13990 },
    { name: '기린캔 500ML', lastPrice: 1874 },
    { name: '산토리 카쿠빈', lastPrice: 27690 },
    { name: '와인 베라짜노 클라시코', lastPrice: 29990 },
    { name: '와인 소비뇽블랑', lastPrice: 10990 },
    { name: '와인 소노마 샤르도네', lastPrice: 14790 },
    { name: '파프리카', lastPrice: 7890 },
    { name: '조미 아구포 350G', lastPrice: 16290 },
    { name: '델리마 코파슬리', lastPrice: 5990 },
    { name: '깐대파 1KG', lastPrice: 5990 },
    { name: '궁 쇠고기육포 280G', lastPrice: 19990 },
    { name: '불고기 브리또', lastPrice: 11490 },
    { name: '새우 31–40 908G', lastPrice: 23490 },
    { name: '새우 50–70 908G', lastPrice: 22490 }
  ];

  function getDefaultItemsForMart(mart) {
    if (mart === '코스트코') {
      return DEFAULT_ITEMS_COSTCO;
    }
    return DEFAULT_ITEMS_EMART;
  }

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
  let budget = DEFAULT_BUDGET_EMART;
  let cart = [];
  let savedItems = [];
  let autoNameIndex = 1;

  // --- DOM Elements ---
  const tabEmart = document.getElementById('tab-emart');
  const tabCostco = document.getElementById('tab-costco');
  const dashboardBoard = document.getElementById('dashboard-board');
  const dashboardMartLabel = document.getElementById('dashboard-mart-label');
  const appVersionBadge = document.getElementById('app-version-badge');
  const totalAmountEl = document.getElementById('total-amount');
  const statusBadgeEl = document.getElementById('status-badge');
  const statusValueEl = document.getElementById('status-value');

  const btnBudgetSetting = document.getElementById('btn-budget-setting');
  const budgetModal = document.getElementById('budget-modal');
  const btnBudgetModalClose = document.getElementById('btn-budget-modal-close');
  const btnBudgetModalSave = document.getElementById('btn-budget-modal-save');
  const modalMartName = document.getElementById('modal-mart-name');

  const recommendationBanner = document.getElementById('recommendation-banner');
  const recommendationText = document.getElementById('recommendation-text');
  const btnRemoveRecommended = document.getElementById('btn-remove-recommended');
  const btnToggleOverBanner = document.getElementById('btn-toggle-over-banner');
  const btnCloseOverBanner = document.getElementById('btn-close-over-banner');

  const withinBudgetBanner = document.getElementById('within-budget-banner');
  const withinBudgetText = document.getElementById('within-budget-text');
  const btnAddRecommended = document.getElementById('btn-add-recommended');
  const btnToggleWithinBanner = document.getElementById('btn-toggle-within-banner');
  const btnCloseWithinBanner = document.getElementById('btn-close-within-banner');
  const btnSmartRecommendation = document.getElementById('btn-smart-recommendation');

  const budgetInput = document.getElementById('budget-input');
  const itemForm = document.getElementById('item-form');
  const itemNameInput = document.getElementById('item-name-input');
  const itemPriceInput = document.getElementById('item-price-input');
  const priceHelper = document.getElementById('price-helper');
  const priceHelperText = document.getElementById('price-helper-text');
  const autocompleteList = document.getElementById('autocomplete-list');
  const quickChipsList = document.getElementById('quick-chips-list');

  const cartItemCount = document.getElementById('cart-item-count');
  const cartEmptyMsg = document.getElementById('cart-empty-msg');
  const cartList = document.getElementById('cart-list');
  const btnClearCart = document.getElementById('btn-clear-cart');
  const btnSaveRecord = document.getElementById('btn-save-record');
  const btnResetSaved = document.getElementById('btn-reset-saved');
  const btnUploadItems = document.getElementById('btn-upload-items');
  const fileInputItems = document.getElementById('file-input-items');

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
  function createDefaultSavedItems(mart) {
    const list = getDefaultItemsForMart(mart);
    return list.map(def => {
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
    const defaultBudget = getDefaultBudgetForMart(mart);
    if (mart === '코스트코' && (savedBudget === null || savedBudget === '60000')) {
      budget = DEFAULT_BUDGET_COSTCO;
    } else {
      budget = savedBudget !== null ? parseInt(savedBudget, 10) : defaultBudget;
    }

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
      let parsed = rawSaved ? JSON.parse(rawSaved) : null;
      if (!Array.isArray(parsed) || parsed.length === 0) {
        parsed = createDefaultSavedItems(mart);
      } else {
        // Validate & fill default fields
        parsed = parsed.filter(item => item && typeof item.name === 'string' && item.name.trim().length > 0);
        parsed = parsed.map(item => ({
          name: item.name.trim(),
          lastPrice: typeof item.lastPrice === 'number' ? item.lastPrice : null,
          useCount: typeof item.useCount === 'number' ? item.useCount : 0,
          lastUsedAt: item.lastUsedAt || null,
          isDefault: Boolean(item.isDefault),
          priceHistory: Array.isArray(item.priceHistory) ? item.priceHistory : []
        }));

        if (mart === 'Emart') {
          parsed = parsed.filter(i => i.name !== '행사 우유' && i.name !== '소화 우유');
        }
      }

      // Merge & sync missing default items for THIS mart only
      const defaultList = getDefaultItemsForMart(mart);
      const itemMap = new Map(parsed.map(i => [i.name.trim(), i]));

      defaultList.forEach(def => {
        const defName = (typeof def === 'string' ? def : def.name).trim();
        const defPrice = typeof def === 'object' ? def.lastPrice : null;

        if (itemMap.has(defName)) {
          const existing = itemMap.get(defName);
          if ((existing.lastPrice === null || existing.lastPrice === undefined) && defPrice !== null) {
            existing.lastPrice = defPrice;
            if (!Array.isArray(existing.priceHistory) || existing.priceHistory.length === 0) {
              existing.priceHistory = [{ price: defPrice, usedAt: new Date().toISOString() }];
            }
          }
        } else {
          const newItem = {
            name: defName,
            lastPrice: defPrice,
            useCount: defPrice ? 1 : 0,
            lastUsedAt: null,
            isDefault: true,
            priceHistory: defPrice ? [{ price: defPrice, usedAt: new Date().toISOString() }] : []
          };
          parsed.push(newItem);
          itemMap.set(defName, newItem);
        }
      });

      savedItems = parsed;
    } catch (e) {
      console.warn('loadState error, resetting saved items for', mart, e);
      savedItems = createDefaultSavedItems(mart);
    }

    calculateAutoNameIndex();
    saveState();

    // Asynchronously sync from markdown file (품목_Emart.md / 품목_코스트코.md)
    syncFromMarkdownFile(mart);
  }

  // --- Sync items from Markdown file API ---
  async function syncFromMarkdownFile(mart) {
    try {
      const canonicalMart = (mart === '이마트' || mart === 'Emart') ? 'Emart' : mart;
      const res = await fetch(`/api/items?mart=${canonicalMart}`);
      if (!res.ok) return;

      const data = await res.json();
      if (data.success && Array.isArray(data.items) && data.items.length > 0) {
        const itemMap = new Map(savedItems.map(i => [i.name.trim(), i]));

        data.items.forEach(mdItem => {
          const name = mdItem.name.trim();
          const price = mdItem.lastPrice;

          if (itemMap.has(name)) {
            const existing = itemMap.get(name);
            if (price !== null && price !== undefined) {
              existing.lastPrice = price;
            }
          } else {
            const newItem = {
              name: name,
              lastPrice: price,
              useCount: price ? 1 : 0,
              lastUsedAt: null,
              isDefault: true,
              priceHistory: price ? [{ price: price, usedAt: new Date().toISOString() }] : []
            };
            savedItems.push(newItem);
            itemMap.set(name, newItem);
          }
        });

        saveState();
        render();
      }
    } catch (e) {
      // Ignore in pure static mode
    }
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

    if (appVersionBadge) appVersionBadge.textContent = APP_VERSION;
    dashboardMartLabel.textContent = `${currentMart} 장보기`;
    btnResetSaved.textContent = `🔄 ${currentMart} 품목 초기화`;
    budgetInput.value = budget.toLocaleString();

    // Render Quick Selection Chips for active mart
    renderQuickChips();

    // Compute total amount
    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    totalAmountEl.textContent = `${totalAmount.toLocaleString()}원`;

    // Budget Status
    if (totalAmount > budget) {
      const over = totalAmount - budget;
      dashboardBoard.classList.add('over-budget');
      statusBadgeEl.textContent = '예산 초과';
      statusValueEl.textContent = `${over.toLocaleString()}원 초과`;
      
      withinBudgetBanner.classList.add('hidden');
      renderRecommendationBanner(over);
    } else {
      const remaining = budget - totalAmount;
      dashboardBoard.classList.remove('over-budget');
      statusBadgeEl.textContent = '예산 내';
      statusValueEl.textContent = `${remaining.toLocaleString()}원 남음`;

      recommendationBanner.classList.add('hidden');
      renderWithinBudgetRecommendation(remaining, totalAmount, budget);
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
    withinBudgetBanner.classList.add('hidden');

    if (recommendationDismissed || cart.length === 0) {
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
          recommendationDismissed = false;
          saveState();
          render();
          showToast(`'${closestItem.name}' 항목을 장바구니에서 제거했습니다.`);
        }
      };
    } else {
      recommendationBanner.classList.add('hidden');
    }
  }

  // Render Recommendation Banner when within budget (activates when totalAmount >= 70% of budget or forceShow)
  function renderWithinBudgetRecommendation(remainingAmount, totalAmount, budgetAmount, forceShow = false) {
    recommendationBanner.classList.add('hidden');

    if (recommendationDismissed || remainingAmount < 0 || budgetAmount <= 0) {
      withinBudgetBanner.classList.add('hidden');
      return;
    }

    if (!forceShow && (totalAmount / budgetAmount) < 0.70) {
      withinBudgetBanner.classList.add('hidden');
      return;
    }

    const cartNames = new Set(cart.map(i => i.name.trim()));

    // Filter savedItems: lastPrice <= remainingAmount, not in cart, lastPrice > 0
    let candidates = savedItems.filter(item => 
      item.lastPrice && 
      item.lastPrice > 0 && 
      item.lastPrice <= remainingAmount && 
      !cartNames.has(item.name.trim())
    );

    // Fallback if forceShow is true and no candidate fits price: pick any saved item not in cart
    if (candidates.length === 0 && forceShow) {
      candidates = savedItems.filter(item => !cartNames.has(item.name.trim()));
    }

    if (candidates.length === 0) {
      if (forceShow && cart.length > 0) {
        withinBudgetText.innerHTML = `등록된 모든 품목이 담겨 있습니다! <strong>수량을 조절하거나 새로운 품목</strong>을 담아보세요.`;
        withinBudgetBanner.classList.remove('hidden');
        btnAddRecommended.onclick = () => {
          if (itemNameInput) itemNameInput.focus();
          showToast('새 품목 이름을 입력해주세요.');
        };
        return;
      }
      withinBudgetBanner.classList.add('hidden');
      return;
    }

    // Sort candidates:
    // 1. Frequently used (useCount)
    // 2. Recently used (lastUsedAt)
    // 3. Highest price <= remaining (to maximize budget utilization)
    candidates.sort((a, b) => {
      const aUse = a.useCount || 0;
      const bUse = b.useCount || 0;
      if (bUse !== aUse) return bUse - aUse;

      const aTime = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
      const bTime = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
      if (bTime !== aTime) return bTime - aTime;

      return (b.lastPrice || 0) - (a.lastPrice || 0);
    });

    const bestCandidate = candidates[0];
    const priceDisplay = bestCandidate.lastPrice ? `${bestCandidate.lastPrice.toLocaleString()}원` : '가격 입력';
    withinBudgetText.innerHTML = `남은 예산으로 <strong>'${escapeHtml(bestCandidate.name)}'</strong> (${priceDisplay})을 담아보세요!`;
    withinBudgetBanner.classList.remove('hidden');

    btnAddRecommended.onclick = () => {
      const recPrice = bestCandidate.lastPrice || 0;
      cart.push({
        id: 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        name: bestCandidate.name,
        price: recPrice,
        quantity: 1,
        isAutoName: false,
        priceChange: { type: 'same' }
      });

      bestCandidate.useCount = (bestCandidate.useCount || 0) + 1;
      bestCandidate.lastUsedAt = new Date().toISOString();

      recommendationDismissed = false;
      saveState();
      render();
      showToast(`'${bestCandidate.name}' 항목을 장바구니에 담았습니다.`);
    };
  }

  // --- Quick Selection Chips Rendering ---
  function renderQuickChips() {
    if (!quickChipsList) return;
    quickChipsList.innerHTML = '';

    if (!savedItems || savedItems.length === 0) {
      quickChipsList.innerHTML = '<span class="chips-label" style="font-weight:normal;">등록된 품목이 없습니다.</span>';
      return;
    }

    savedItems.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip-btn';
      btn.title = '터치: 선택 / 길게 누르기: 삭제';
      
      const priceText = item.lastPrice ? `<span class="chip-price">${item.lastPrice.toLocaleString()}원</span>` : '';
      btn.innerHTML = `${escapeHtml(item.name)} ${priceText}`;

      let pressTimer = null;
      let isLongPress = false;

      const startPress = () => {
        isLongPress = false;
        pressTimer = setTimeout(() => {
          isLongPress = true;
          if (confirm(`[${currentMart}] '${item.name}' 품목을 저장 품목 목록에서 삭제하시겠습니까?`)) {
            savedItems = savedItems.filter(i => i.name.trim() !== item.name.trim());
            saveState();
            render();
            showToast(`'${item.name}' 품목이 저장 목록에서 삭제되었습니다.`);
          }
        }, 550);
      };

      const cancelPress = () => {
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
      };

      btn.addEventListener('mousedown', startPress);
      btn.addEventListener('touchstart', startPress, { passive: true });

      btn.addEventListener('mouseup', cancelPress);
      btn.addEventListener('mouseleave', cancelPress);
      btn.addEventListener('touchend', cancelPress);
      btn.addEventListener('touchmove', cancelPress);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (isLongPress) {
          isLongPress = false;
          return;
        }
        selectAutocompleteItem(item);
      });

      quickChipsList.appendChild(btn);
    });
  }

  // --- Autocomplete Logic ---
  function updateAutocomplete() {
    const query = itemNameInput.value.trim();
    let matches = [];

    if (!query) {
      matches = [...savedItems];
    } else {
      const queryLower = query.toLowerCase();
      const queryChosung = getChosung(queryLower);

      matches = savedItems.filter(item => {
        const nameLower = item.name.toLowerCase();
        const nameChosung = getChosung(nameLower);

        return (
          nameLower.startsWith(queryLower) ||
          nameLower.includes(queryLower) ||
          nameChosung.includes(queryChosung)
        );
      });
    }

    // Sort matching items:
    matches.sort((a, b) => {
      if (query) {
        const queryLower = query.toLowerCase();
        const aLower = a.name.toLowerCase();
        const bLower = b.name.toLowerCase();

        const aStart = aLower.startsWith(queryLower);
        const bStart = bLower.startsWith(queryLower);
        if (aStart && !bStart) return -1;
        if (!aStart && bStart) return 1;
      }

      const aUse = a.useCount || 0;
      const bUse = b.useCount || 0;
      if (bUse !== aUse) return bUse - aUse;

      const aTime = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
      const bTime = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
      return bTime - aTime;
    });

    const displayList = matches.slice(0, 10);

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

    let rawName = itemNameInput.value.trim();
    let rawPrice = itemPriceInput.value.trim();
    let itemQuantity = 1;

    // Smart price auto-fill if user types a known item name without price
    if (!rawPrice && rawName) {
      const matchItem = savedItems.find(i => i.name.trim().toLowerCase() === rawName.toLowerCase());
      if (matchItem && matchItem.lastPrice) {
        rawPrice = matchItem.lastPrice.toString();
      } else {
        // Smart combined input parser (e.g. "맥주 5 14000원", "맥주 14000원")
        const parts = rawName.split(/\s+/);
        if (parts.length >= 2) {
          const lastPartPrice = parseQuickPrice(parts[parts.length - 1]);
          if (lastPartPrice && lastPartPrice > 0) {
            rawPrice = parts[parts.length - 1];
            parts.pop();

            if (parts.length >= 1 && /^\d+$/.test(parts[parts.length - 1])) {
              const parsedQty = parseInt(parts[parts.length - 1], 10);
              if (parsedQty > 0) {
                itemQuantity = parsedQty;
                parts.pop();
              }
            }
            rawName = parts.join(' ');
          }
        }
      }
    }

    const parsedPrice = parseQuickPrice(rawPrice);
    if (!parsedPrice || parsedPrice <= 0) {
      showToast('유효한 가격을 입력해 주세요.');
      itemPriceInput.focus();
      return;
    }

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
      quantity: itemQuantity,
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
    const handleTabClick = (targetMart) => {
      const canonicalTarget = (targetMart === '이마트' || targetMart === 'Emart') ? 'Emart' : targetMart;
      saveState();
      loadState(canonicalTarget);
      render();
      if (itemNameInput) itemNameInput.value = '';
      if (itemPriceInput) itemPriceInput.value = '';
      if (priceHelper) priceHelper.classList.add('hidden');
      if (autocompleteList) autocompleteList.classList.add('hidden');
    };

    const martTabsNav = document.querySelector('.mart-tabs');
    if (martTabsNav) {
      martTabsNav.addEventListener('click', (e) => {
        const btn = e.target.closest('.tab-btn');
        if (btn && btn.dataset.tab) {
          e.preventDefault();
          handleTabClick(btn.dataset.tab);
        }
      });
    }

    if (tabEmart) {
      tabEmart.addEventListener('click', (e) => {
        e.preventDefault();
        handleTabClick('Emart');
      });
    }

    if (tabCostco) {
      tabCostco.addEventListener('click', (e) => {
        e.preventDefault();
        handleTabClick('코스트코');
      });
    }

    // Top-Left Budget Setting Button & Modal Handlers
    if (btnBudgetSetting && budgetModal) {
      btnBudgetSetting.addEventListener('click', () => {
        if (modalMartName) modalMartName.textContent = currentMart;
        if (budgetInput) budgetInput.value = budget ? budget.toLocaleString() : '';
        budgetModal.classList.remove('hidden');
        setTimeout(() => budgetInput && budgetInput.focus(), 100);
      });
    }

    if (btnBudgetModalClose && budgetModal) {
      btnBudgetModalClose.addEventListener('click', () => {
        budgetModal.classList.add('hidden');
      });
      budgetModal.addEventListener('click', (e) => {
        if (e.target === budgetModal) {
          budgetModal.classList.add('hidden');
        }
      });
    }

    if (btnBudgetModalSave && budgetModal) {
      btnBudgetModalSave.addEventListener('click', () => {
        const val = budgetInput ? budgetInput.value.replace(/[^0-9]/g, '') : '';
        const parsed = parseInt(val, 10);
        budget = isNaN(parsed) ? 0 : parsed;
        saveState();
        render();
        budgetModal.classList.add('hidden');
        showToast(`[${currentMart}] 목표 예산이 ${budget.toLocaleString()}원으로 변경되었습니다.`);
      });
    }

    // Quick budget chips in modal
    const quickBudgetChips = document.querySelectorAll('.btn-budget-chip');
    quickBudgetChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const amt = parseInt(chip.getAttribute('data-amount'), 10);
        if (!isNaN(amt)) {
          budget = amt;
          if (budgetInput) budgetInput.value = amt.toLocaleString();
          saveState();
          render();
          budgetModal.classList.add('hidden');
          showToast(`[${currentMart}] 목표 예산이 ${budget.toLocaleString()}원으로 변경되었습니다.`);
        }
      });
    });

    // Budget input live sync
    if (budgetInput) {
      budgetInput.addEventListener('input', () => {
        const clean = budgetInput.value.replace(/[^0-9]/g, '');
        const parsed = parseInt(clean, 10);
        budget = isNaN(parsed) ? 0 : parsed;
        saveState();
        render();
      });
    }

    // Recommendation Banner Controls (Toggle & Delete/Close)
    if (btnToggleOverBanner && recommendationBanner) {
      btnToggleOverBanner.addEventListener('click', () => {
        recommendationBanner.classList.toggle('collapsed');
        btnToggleOverBanner.textContent = recommendationBanner.classList.contains('collapsed') ? '▼' : '▲';
      });
    }

    if (btnCloseOverBanner && recommendationBanner) {
      btnCloseOverBanner.addEventListener('click', () => {
        recommendationDismissed = true;
        recommendationBanner.classList.add('hidden');
        showToast('추천 카드를 닫았습니다.');
      });
    }

    if (btnToggleWithinBanner && withinBudgetBanner) {
      btnToggleWithinBanner.addEventListener('click', () => {
        withinBudgetBanner.classList.toggle('collapsed');
        btnToggleWithinBanner.textContent = withinBudgetBanner.classList.contains('collapsed') ? '▼' : '▲';
      });
    }

    if (btnCloseWithinBanner && withinBudgetBanner) {
      btnCloseWithinBanner.addEventListener('click', () => {
        recommendationDismissed = true;
        withinBudgetBanner.classList.add('hidden');
        showToast('추천 카드를 닫았습니다.');
      });
    }

    // Smart Recommendation Button on Bottom-Left of Display Board
    if (btnSmartRecommendation) {
      btnSmartRecommendation.addEventListener('click', () => {
        recommendationDismissed = false;

        if (recommendationBanner) recommendationBanner.classList.remove('collapsed');
        if (withinBudgetBanner) withinBudgetBanner.classList.remove('collapsed');

        const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const remaining = budget - totalAmount;

        if (totalAmount > budget) {
          renderRecommendationBanner(totalAmount - budget);
          if (recommendationBanner && !recommendationBanner.classList.contains('hidden')) {
            recommendationBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            showToast('💡 예산 초과 조정 추천 카드가 활성화되었습니다.');
          }
        } else {
          renderWithinBudgetRecommendation(remaining, totalAmount, budget, true);
          if (withinBudgetBanner && !withinBudgetBanner.classList.contains('hidden')) {
            withinBudgetBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            showToast('🎁 스마트 품목 추천 카드가 활성화되었습니다.');
          } else {
            showToast('💡 추천할 품목 정보가 충분하지 않습니다.');
          }
        }
      });
    }

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
        savedItems = createDefaultSavedItems(currentMart);
        saveState();
        render();
        showToast('저장 품목을 기본 상태로 복원했습니다.');
      }
    });

    // Upload Items Markdown/CSV/Text File
    if (btnUploadItems && fileInputItems) {
      btnUploadItems.addEventListener('click', () => {
        fileInputItems.click();
      });

      fileInputItems.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
          const content = evt.target.result;
          if (!content) return;

          const lines = content.split('\n');

          const itemMap = new Map(savedItems.map(i => [i.name.trim(), i]));

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

              if (itemMap.has(name)) {
                const existing = itemMap.get(name);
                if (price !== null) {
                  existing.lastPrice = price;
                }
              } else {
                const newItem = {
                  name: name,
                  lastPrice: price,
                  useCount: price ? 1 : 0,
                  lastUsedAt: null,
                  isDefault: true,
                  priceHistory: price ? [{ price: price, usedAt: new Date().toISOString() }] : []
                };
                savedItems.push(newItem);
                itemMap.set(name, newItem);
              }
            }
          });

          saveState();
          render();
          fileInputItems.value = '';

          // Sync to backend file if API is available
          try {
            fetch('/api/items', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ martName: currentMart, items: savedItems })
            });
          } catch (err) {}

          showToast(`'${file.name}' 파일에서 품목이 성공적으로 업로드되었습니다!`);
        };

        reader.readAsText(file);
      });
    }

    // Helper: Client-side Markdown File Download
    function downloadMarkdownFile(martName, cartItems, totalAmount) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const timeStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

      let mdText = `## ${timeStr} (${martName || '이마트'})\n\n`;
      mdText += `| 품목 | 단가 | 수량 | 소계 |\n`;
      mdText += `|---|---|---|---|\n`;

      cartItems.forEach(item => {
        const unitPriceStr = `${Number(item.price).toLocaleString()}원`;
        const subtotalStr = `${(Number(item.price) * Number(item.quantity)).toLocaleString()}원`;
        mdText += `| ${item.name} | ${unitPriceStr} | ${item.quantity} | ${subtotalStr} |\n`;
      });

      const formattedTotal = `${Number(totalAmount).toLocaleString()}원`;
      mdText += `\n**총합계: ${formattedTotal}**\n\n---\n\n`;

      const blob = new Blob([mdText], { type: 'text/markdown;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `구매내역_${year}${month}${day}_${hours}${minutes}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

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
        if (data && data.success) {
          showToast(`✅ ${data.message}`);
          if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            downloadMarkdownFile(currentMart, cart, totalAmount);
          }
        } else {
          // If serverless read-only filesystem or server error occurred
          console.warn('Server file save failed, falling back to browser download:', data);
          downloadMarkdownFile(currentMart, cart, totalAmount);
          showToast('📥 서버리스/모바일 환경으로 인해 구매내역.md 파일이 기기로 즉시 다운로드되었습니다!');
        }
      } catch (err) {
        console.error('Save record network error, downloading client-side:', err);
        downloadMarkdownFile(currentMart, cart, totalAmount);
        showToast('📥 구매내역.md 파일이 기기로 다운로드되었습니다!');
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

    // Default initial mart is 'Emart' unless explicitly saved as '코스트코'
    let savedMart = localStorage.getItem('martApp_currentMart');
    if (savedMart !== '코스트코') {
      savedMart = 'Emart';
    }
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
