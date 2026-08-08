/**
 * Node.js Mart Shopping Budget Calculator
 * Main Frontend Application Script
 */

(function () {
  'use strict';

  // --- Constants & Default Data ---
  const APP_VERSION = 'v1.3.25 (26-08-08)';
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
    { name: '토마토 4KG', lastPrice: 11890 },
    { name: '미니 대추토마토', lastPrice: 10890 },
    { name: '그린키위 2.4KG', lastPrice: 17090 },
    { name: '설빙 미숫가루', lastPrice: 13990 },
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
    { name: '새우 50–70 908G', lastPrice: 22490 },
    { name: '기린캔 8개', lastPrice: 14990 },
    { name: '유기농 딸기쨈(2)', lastPrice: 14990 },
    { name: '리코타치즈', lastPrice: 12990 },
    { name: '미니 까망베르', lastPrice: 12990 },
    { name: '캠벨포도2kg', lastPrice: 22590 },
    { name: '새우 11-15 680G', lastPrice: 25490 },
    { name: '욕실클리너', lastPrice: 13790 },
    { name: '크림치즈플레인', lastPrice: 12790 }
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

  // --- Helper: Normalize Tense Consonants (ㄲ->ㄱ, ㄸ->ㄷ, ㅃ->ㅂ, ㅆ->ㅅ, ㅉ->ㅈ) ---
  function normalizeTenseConsonants(str) {
    if (!str) return '';
    return str
      .replace(/ㄲ/g, 'ㄱ')
      .replace(/ㄸ/g, 'ㄷ')
      .replace(/ㅃ/g, 'ㅂ')
      .replace(/ㅆ/g, 'ㅅ')
      .replace(/ㅉ/g, 'ㅈ');
  }

  // --- Helper: Check if string is Chosung/Consonant only ---
  function isConsonantOnly(str) {
    if (!str) return false;
    return /^[ㄱ-ㅎ0-9\s]+$/.test(str);
  }

  function getWordChosungTokens(str) {
    return str
      .split(/[\s()_-]+/)
      .map(w => w.trim())
      .filter(Boolean)
      .map(w => getChosung(w));
  }

  // --- State Variables ---
  let currentMart = 'Emart';
  let budget = DEFAULT_BUDGET_EMART;
  let cart = [];
  let savedItems = [];
  let autoNameIndex = 1;
  let recommendationDismissed = false;
  let currentMatches = [];

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
        } else if (mart === '코스트코') {
          const costcoDefaultNames = new Set(DEFAULT_ITEMS_COSTCO.map(i => i.name.trim()));
          parsed = parsed.filter(i => costcoDefaultNames.has(i.name.trim()));
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

    // Trigger asynchronous DB sync for multi-device data consistency
    calculateAutoNameIndex();
    saveState();
    syncWithBackend(mart);
  }

  // --- Sync State with Backend Postgres DB ---
  async function syncWithBackend(mart) {
    try {
      const res = await fetch(`/api/db/sync?mart=${encodeURIComponent(mart)}`);
      const data = await res.json();
      if (data && data.success) {
        budget = data.budget;
        const defaultList = getDefaultItemsForMart(mart);
        const defaultMap = new Map(defaultList.map(def => {
          const name = (typeof def === 'string' ? def : def.name).trim();
          const lastPrice = typeof def === 'object' ? def.lastPrice : null;
          return [name, { name, lastPrice, useCount: lastPrice ? 1 : 0, isDefault: true, priceHistory: lastPrice ? [{ price: lastPrice, usedAt: new Date().toISOString() }] : [] }];
        }));

        if (Array.isArray(data.items)) {
          data.items.forEach(item => {
            const name = item.name.trim();
            const existing = defaultMap.get(name);
            defaultMap.set(name, {
              id: item.id,
              name,
              lastPrice: item.lastPrice !== undefined ? item.lastPrice : (existing ? existing.lastPrice : null),
              useCount: item.useCount !== undefined ? item.useCount : (existing ? existing.useCount : 0),
              isDefault: true,
              priceHistory: Array.isArray(item.priceHistory) ? item.priceHistory : (existing ? existing.priceHistory : [])
            });
          });
        }
        savedItems = Array.from(defaultMap.values());
        if (Array.isArray(data.cart)) cart = data.cart;

        saveState(false);
        render();
      }
    } catch (err) {
      console.warn('Backend DB sync unavailable:', err);
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
    if (btnResetSaved) btnResetSaved.textContent = `🔄 ${currentMart} 품목 초기화`;
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
              <span>${escapeHtml(getDisplayItemName(item.name, item.price))}</span>
              ${badgeHtml}
              <button type="button" class="btn-history-trigger" data-name="${escapeHtml(item.name)}" title="가격 변동 이력 보기">📜 이력</button>
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

    // Candidates: strictly not in cart, lastPrice > 0, lastPrice <= remainingAmount
    let candidates = savedItems.filter(item => 
      item.lastPrice && 
      item.lastPrice > 0 && 
      item.lastPrice <= remainingAmount && 
      !cartNames.has(item.name.trim())
    );

    if (candidates.length === 0) {
      if (forceShow && cart.length > 0) {
        withinBudgetText.innerHTML = `등록된 모든 품목이 담겨 있거나 남은 예산 이하인 추천 품목이 없습니다.`;
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

    // Option B Sorting (Strictly for un-carted items <= remainingAmount):
    // 1st Priority: Purchase Frequency (useCount desc - 자주 구매한 순)
    // 2nd Priority: Korean Alphabetical Order (가나다순)
    // 3rd Priority: Lowest Price (lastPrice asc - 낮은 가격순)
    candidates.sort((a, b) => {
      const aUse = a.useCount || 0;
      const bUse = b.useCount || 0;
      if (bUse !== aUse) return bUse - aUse;

      const compName = a.name.localeCompare(b.name, 'ko');
      if (compName !== 0) return compName;

      const aPrice = a.lastPrice || 0;
      const bPrice = b.lastPrice || 0;
      return aPrice - bPrice;
    });

    const bestCandidate = candidates[0];
    const priceDisplay = bestCandidate.lastPrice ? `${bestCandidate.lastPrice.toLocaleString()}원` : '가격 입력';

    withinBudgetText.innerHTML = `남은 예산으로 자주 찾는 <strong>'${escapeHtml(getDisplayItemName(bestCandidate.name, bestCandidate.lastPrice))}'</strong> (${priceDisplay})을 담아보세요!`;
    withinBudgetBanner.classList.remove('hidden');

    btnAddRecommended.onclick = () => {
      if (!bestCandidate.lastPrice || bestCandidate.lastPrice <= 0) {
        itemNameInput.value = bestCandidate.name;
        itemPriceInput.value = '';
        priceHelper.classList.add('hidden');
        itemPriceInput.focus();
        showToast(`'${bestCandidate.name}' 가격을 입력해 주세요.`);
        return;
      }

      const recPrice = bestCandidate.lastPrice;
      cart.unshift({
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

    // Sort items by Low Price Ascending (낮은 가격순), then Frequency (useCount desc), then Korean Order (가나다순)
    const sortedItems = [...savedItems].sort((a, b) => {
      const aPrice = (typeof a.lastPrice === 'number' && a.lastPrice > 0) ? a.lastPrice : Infinity;
      const bPrice = (typeof b.lastPrice === 'number' && b.lastPrice > 0) ? b.lastPrice : Infinity;
      if (aPrice !== bPrice) return aPrice - bPrice;

      const aUse = a.useCount || 0;
      const bUse = b.useCount || 0;
      if (bUse !== aUse) return bUse - aUse;

      return a.name.localeCompare(b.name, 'ko');
    });

    sortedItems.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip-btn';
      btn.title = '터치: 선택 / 길게 누르기: 삭제';
      
      const priceText = item.lastPrice ? `<span class="chip-price">${item.lastPrice.toLocaleString()}원</span>` : '';
      btn.innerHTML = `${escapeHtml(getDisplayItemName(item.name, item.lastPrice))} ${priceText} <span class="chip-history-btn" title="가격 이력 보기">📜</span>`;

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
        if (e.target.closest('.chip-history-btn')) {
          e.stopPropagation();
          openPriceHistoryModal(item.id, item.name);
          return;
        }
        if (isLongPress) {
          isLongPress = false;
          return;
        }
        selectAutocompleteItem(item);
      });

      quickChipsList.appendChild(btn);
    });
  }

  // --- Autocomplete Logic (Strict Chosung Boundary Matching) ---
  function updateAutocomplete() {
    const query = itemNameInput.value.trim();
    let matches = [];

    if (!query) {
      matches = [...savedItems];
    } else {
      const queryLower = query.toLowerCase();
      const queryChosung = getChosung(queryLower);
      const normQueryLower = normalizeTenseConsonants(queryLower);
      const normQueryChosung = normalizeTenseConsonants(queryChosung);
      const isConsonantSearch = isConsonantOnly(queryLower);

      matches = savedItems.filter(item => {
        const nameLower = item.name.toLowerCase();
        const nameChosung = getChosung(nameLower);

        const normNameLower = normalizeTenseConsonants(nameLower);
        const normNameChosung = normalizeTenseConsonants(nameChosung);

        if (isConsonantSearch) {
          // Strict Chosung Search: Must match from start of full name or start of any word!
          const chosungMatch = normNameChosung.startsWith(normQueryChosung) || nameChosung.startsWith(queryChosung);
          const consecutiveChosungMatch =
            queryChosung.length >= 2 &&
            (nameChosung.includes(queryChosung) || normNameChosung.includes(normQueryChosung));
          
          const words = nameLower.split(/[\s()_-]+/);
          const wordChosungMatch = words.some(w => {
            if (!w) return false;
            const wChosung = getChosung(w);
            const normWChosung = normalizeTenseConsonants(wChosung);
            return wChosung.startsWith(queryChosung) || normWChosung.startsWith(normQueryChosung);
          });

          const wordChosungTokens = getWordChosungTokens(nameLower);
          const joinedWordChosungMatch = wordChosungTokens.some((_, index) => {
            const joinedFromWord = wordChosungTokens.slice(index).join('');
            const normJoinedFromWord = normalizeTenseConsonants(joinedFromWord);
            return joinedFromWord.startsWith(queryChosung) || normJoinedFromWord.startsWith(normQueryChosung);
          });

          return chosungMatch || consecutiveChosungMatch || wordChosungMatch || joinedWordChosungMatch;
        } else {
          // Full Text Search
          return (
            nameLower.startsWith(queryLower) ||
            nameLower.includes(queryLower) ||
            normNameLower.startsWith(normQueryLower) ||
            normNameLower.includes(normQueryLower) ||
            nameChosung.startsWith(queryChosung) ||
            normNameChosung.startsWith(normQueryChosung)
          );
        }
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

      return a.name.localeCompare(b.name, 'ko');
    });

    currentMatches = matches;

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
        <span class="item-name-bold">${escapeHtml(getDisplayItemName(item.name, item.lastPrice))}</span>
        <div style="display:flex; align-items:center; gap:6px;">
          ${priceTag}
          <button type="button" class="btn-history-trigger" data-id="${item.id || ''}" data-name="${escapeHtml(item.name)}" title="가격 이력 보기">📜 이력</button>
        </div>
      `;

      li.addEventListener('mousedown', (e) => {
        if (e.target.closest('.btn-history-trigger')) {
          e.preventDefault();
          e.stopPropagation();
          openPriceHistoryModal(item.id, item.name);
          return;
        }
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

    let parsedPrice = parseQuickPrice(rawPrice);
    if (!parsedPrice && /^\d+$/.test(rawPrice)) {
      parsedPrice = parseInt(rawPrice, 10);
    }

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

    cart.unshift(cartItem);
    saveState();
    render();

    // Push item update to server DB
    if (!isAutoName) {
      try {
        fetch('/api/db/item', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ martName: currentMart, name: itemName, price: parsedPrice, incrementUse: true })
        });
      } catch (e) {}
    }

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

    // Autocomplete listeners & Enter Key Selection for Single Match (Focuses Price Field for Review)
    itemNameInput.addEventListener('input', updateAutocomplete);
    itemNameInput.addEventListener('focus', updateAutocomplete);
    itemNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const query = itemNameInput.value.trim();
        if (query && currentMatches && currentMatches.length === 1) {
          const match = currentMatches[0];
          e.preventDefault();
          selectAutocompleteItem(match);
        }
      }
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.autocomplete-container')) {
        autocompleteList.classList.add('hidden');
      }
    });

    // Form Submit
    if (itemForm) {
      itemForm.addEventListener('submit', handleAddItem);
    }

    // Cart item quantity / delete controls (Event Delegation)
    cartList.addEventListener('click', (e) => {
      const btnMinus = e.target.closest('.btn-minus');
      const btnPlus = e.target.closest('.btn-plus');
      const btnDelete = e.target.closest('.btn-item-delete');

      const btnHistory = e.target.closest('.btn-history-trigger');

      if (btnHistory) {
        const name = btnHistory.dataset.name;
        openPriceHistoryModal(null, name);
      } else if (btnMinus) {
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

    // Reset Saved Items (Disabled/Hidden)
    if (btnResetSaved) {
      btnResetSaved.addEventListener('click', () => {
        if (confirm(`[${currentMart}] 저장된 품목 및 가격 이력을 초기화하고 기본 품목으로 복원하시겠습니까?`)) {
          savedItems = createDefaultSavedItems(currentMart);
          saveState();
          render();
          showToast('저장 품목을 기본 상태로 복원했습니다.');
        }
      });
    }

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

    // Sync State with Backend Postgres DB
    async function syncWithBackend(mart) {
      try {
        const res = await fetch(`/api/db/sync?mart=${encodeURIComponent(mart)}`);
        const data = await res.json();
        if (data && data.success) {
          budget = data.budget;
          savedItems = data.items || [];
          cart = data.cart || [];
          saveState(false); // save locally without trigger loop
          render();
        }
      } catch (err) {
        console.warn('Backend DB sync unavailable, using localStorage fallback:', err);
      }
    }

    // Save State & Push to DB
    function saveState(pushToDb = true) {
      const keys = getStorageKeys(currentMart);
      localStorage.setItem('martApp_currentMart', currentMart);
      localStorage.setItem(keys.budgetKey, budget.toString());
      localStorage.setItem(keys.cartKey, JSON.stringify(cart));
      localStorage.setItem(keys.savedItemsKey, JSON.stringify(savedItems));

      if (pushToDb) {
        try {
          fetch('/api/db/cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ martName: currentMart, cart })
          });
        } catch (err) {}
      }
    }

    // History Modal Elements
    const historyModal = document.getElementById('price-history-modal');
    const btnHistoryModalClose = document.getElementById('btn-history-modal-close');
    const historyModalTitle = document.getElementById('history-modal-title');
    const historySummaryBox = document.getElementById('history-summary-box');
    const historyTimelineList = document.getElementById('history-timeline-list');

    // Open Price History Modal
    async function openPriceHistoryModal(itemId, itemName) {
      document.body.appendChild(historyModal);
      historyModalTitle.textContent = `📜 ${itemName || '품목'} 가격 변동 이력`;
      historySummaryBox.innerHTML = '<div style="padding:10px; text-align:center; color:var(--text-muted);">이력을 불러오는 중...</div>';
      historyTimelineList.innerHTML = '';
      historyModal.classList.add('modal-topmost');
      historyModal.classList.remove('hidden');
      historyModal.style.display = 'flex';
      historyModal.style.visibility = 'visible';
      historyModal.style.opacity = '1';
      historyModal.style.pointerEvents = 'auto';

      try {
        let historyData = null;
        let itemInfo = savedItems.find(i => (itemId && (i.id === itemId || String(i.id) === String(itemId))) || (itemName && i.name.trim() === itemName.trim()));

        if (itemId && !isNaN(Number(itemId))) {
          try {
            const res = await fetch(`/api/db/history?itemId=${itemId}`);
            const resData = await res.json();
            if (resData && resData.success && resData.data) {
              historyData = resData.data.history;
              if (resData.data.item) itemInfo = resData.data.item;
            }
          } catch (e) {}
        }

        if (!historyData && itemInfo && Array.isArray(itemInfo.priceHistory)) {
          historyData = itemInfo.priceHistory;
        }

        if (!historyData || historyData.length === 0) {
          if (itemInfo && itemInfo.lastPrice) {
            historyData = [{ price: itemInfo.lastPrice, usedAt: itemInfo.lastUsedAt || new Date().toISOString(), note: '등록 단가' }];
          }
        }

        if (!historyData || historyData.length === 0) {
          historySummaryBox.innerHTML = '<div style="color:var(--text-muted); padding:10px; text-align:center;">가격 변동 이력이 아직 없습니다.</div>';
          historyTimelineList.innerHTML = '<li class="history-timeline-item">단가 기록이 1건 이하이거나 첫 기록 상태입니다.</li>';
          return;
        }

        // Compute Statistics
        const prices = historyData.map(h => h.price).filter(p => typeof p === 'number' && p > 0);
        const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
        const latestPrice = prices.length > 0 ? prices[0] : 0;

        historySummaryBox.innerHTML = `
          <div class="summary-stat-item">
            <span class="summary-stat-label">최근 단가</span>
            <span class="summary-stat-value" style="color:var(--theme-primary);">${latestPrice.toLocaleString()}원</span>
          </div>
          <div class="summary-stat-item">
            <span class="summary-stat-label">최저가</span>
            <span class="summary-stat-value" style="color:#0284c7;">${minPrice.toLocaleString()}원</span>
          </div>
          <div class="summary-stat-item">
            <span class="summary-stat-label">최고가</span>
            <span class="summary-stat-value" style="color:#dc2626;">${maxPrice.toLocaleString()}원</span>
          </div>
        `;

        historyTimelineList.innerHTML = historyData.map(h => {
          const dateStr = h.recorded_at ? h.recorded_at.substring(0, 16) : (h.usedAt ? h.usedAt.substring(0, 10) : '이전 기록');
          const noteText = h.note ? h.note : (h.price === minPrice ? '최저가' : '가격 변경');
          return `
            <li class="history-timeline-item">
              <div class="history-time-group">
                <span class="history-date">📅 ${dateStr}</span>
                <span class="history-note-badge">${escapeHtml(noteText)}</span>
              </div>
              <div class="history-price-group">
                <span class="history-price-val">${Number(h.price).toLocaleString()}원</span>
              </div>
            </li>
          `;
        }).join('');

      } catch (err) {
        console.error('Error rendering history modal:', err);
        historySummaryBox.innerHTML = '이력을 불러오는 중 오류가 발생했습니다.';
      }
    }

    if (btnHistoryModalClose) {
      btnHistoryModalClose.addEventListener('click', () => {
        historyModal.classList.remove('modal-topmost');
        historyModal.removeAttribute('style');
        historyModal.classList.add('hidden');
      });
    }

    // Export Dropdown Controls
    const btnExportData = document.getElementById('btn-export-data');
    const exportMenu = document.getElementById('export-menu');

    if (btnExportData && exportMenu) {
      btnExportData.addEventListener('click', (e) => {
        e.stopPropagation();
        exportMenu.classList.toggle('hidden');
      });

      document.addEventListener('click', () => {
        exportMenu.classList.add('hidden');
      });

      exportMenu.addEventListener('click', (e) => {
        const optionBtn = e.target.closest('.export-option');
        if (!optionBtn) return;
        const format = optionBtn.dataset.format || 'csv';
        window.location.href = `/api/db/export?mart=${encodeURIComponent(currentMart)}&format=${format}`;
        exportMenu.classList.add('hidden');
        showToast(`📥 ${format.toUpperCase()} 포맷으로 품목/가격 정보 다운로드가 시작되었습니다.`);
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

    const btnDownloadMdRecord = document.getElementById('btn-download-md-record');

    // Save Record to DB ("계산결과 저장 (DB 저장)")
    if (btnSaveRecord) {
      btnSaveRecord.addEventListener('click', async () => {
      if (cart.length === 0) {
        alert('장바구니가 비어 있어 계산결과를 저장할 수 없습니다.');
        return;
      }

      const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      btnSaveRecord.disabled = true;

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
        if (res.ok && data && data.success) {
          showToast(`💾 계산결과가 서버 DB에 성공적으로 저장되었습니다!`);
          const recordsModal = document.getElementById('purchase-records-modal');
          if (recordsModal && !recordsModal.classList.contains('hidden')) {
            openPurchaseRecordsModal();
          }
        } else {
          showToast(data && data.message ? data.message : `⚠️ 서버 DB 저장 중 오류가 발생했습니다.`);
        }
      } catch (err) {
        console.error('Save record network error:', err);
        showToast('⚠️ 네트워크 오류로 DB 저장 실패');
      } finally {
        btnSaveRecord.disabled = false;
      }
      });
    }

    // Save/Download Local MD File ("로컬 MD 파일로 저장")
    if (btnDownloadMdRecord) {
      btnDownloadMdRecord.addEventListener('click', () => {
        if (cart.length === 0) {
          alert('장바구니가 비어 있어 마크다운 파일로 저장할 수 없습니다.');
          return;
        }
        const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        downloadMarkdownFile(currentMart, cart, totalAmount);
        showToast('📝 로컬 구매내역.md 파일이 다운로드되었습니다!');
      });
    }

    // View Purchase Records Modal
    const btnViewRecords = document.getElementById('btn-view-records');
    const recordsModal = document.getElementById('purchase-records-modal');
    const btnRecordsModalClose = document.getElementById('btn-records-modal-close');

    if (btnViewRecords) {
      btnViewRecords.addEventListener('click', () => {
        openPurchaseRecordsModal();
      });
    }

    if (btnRecordsModalClose && recordsModal) {
      btnRecordsModalClose.addEventListener('click', () => {
        recordsModal.classList.add('hidden');
      });

      recordsModal.addEventListener('click', (e) => {
        if (e.target === recordsModal) {
          recordsModal.classList.add('hidden');
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !recordsModal.classList.contains('hidden')) {
          recordsModal.classList.add('hidden');
        }
      });
    }

    // Registered Items Lookup Modal
    const btnViewAllItems = document.getElementById('btn-view-all-items');
    const allItemsModal = document.getElementById('all-items-modal');
    const btnAllItemsModalClose = document.getElementById('btn-all-items-modal-close');
    const allItemsSearchInput = document.getElementById('all-items-search-input');

    if (btnViewAllItems) {
      btnViewAllItems.addEventListener('click', () => {
        openAllItemsModal();
      });
    }

    if (btnAllItemsModalClose && allItemsModal) {
      btnAllItemsModalClose.addEventListener('click', () => {
        allItemsModal.classList.add('hidden');
      });
    }

    if (allItemsSearchInput) {
      allItemsSearchInput.addEventListener('input', () => {
        renderAllItemsList(allItemsSearchInput.value.trim());
      });
    }
  }

  function openAllItemsModal() {
    const allItemsModal = document.getElementById('all-items-modal');
    const allItemsSearchInput = document.getElementById('all-items-search-input');
    if (!allItemsModal) return;

    if (allItemsSearchInput) allItemsSearchInput.value = '';
    renderAllItemsList('');
    allItemsModal.classList.remove('hidden');
  }

  function renderAllItemsList(filterQuery) {
    const listContainer = document.getElementById('all-items-list-container');
    if (!listContainer) return;

    if (!savedItems || savedItems.length === 0) {
      listContainer.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted);">등록된 품목 정보가 없습니다.</div>';
      return;
    }

    let itemsToDisplay = [...savedItems];
    if (filterQuery) {
      const qLower = filterQuery.toLowerCase();
      itemsToDisplay = itemsToDisplay.filter(item => item.name.toLowerCase().includes(qLower));
    }

    // Sort by Low Price Ascending (낮은 가격순)
    itemsToDisplay.sort((a, b) => {
      const pA = (a.lastPrice && a.lastPrice > 0) ? a.lastPrice : Infinity;
      const pB = (b.lastPrice && b.lastPrice > 0) ? b.lastPrice : Infinity;
      if (pA !== pB) return pA - pB;
      return a.name.localeCompare(b.name, 'ko');
    });

    if (itemsToDisplay.length === 0) {
      listContainer.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted);">검색 결과가 없습니다.</div>';
      return;
    }

    let html = '<div style="display:flex; flex-direction:column; gap:8px;">';
    itemsToDisplay.forEach(item => {
      const priceValue = (item.lastPrice && item.lastPrice > 0) ? String(item.lastPrice) : '';
      html += `
        <div class="all-item-row" style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; border:1px solid var(--border-color); border-radius:6px; padding:10px 12px;">
          <span style="font-weight:700; color:var(--text-main); font-size:0.95rem;">${escapeHtml(getDisplayItemName(item.name, item.lastPrice))}</span>
          <div style="display:flex; align-items:center; gap:6px;">
            <input type="text" class="all-item-price-input" data-name="${escapeHtml(item.name)}" value="${priceValue ? Number(priceValue).toLocaleString() : ''}" placeholder="가격 입력" inputmode="numeric" aria-label="${escapeHtml(item.name)} 단가 입력" title="단가를 바로 입력하고 Enter 또는 포커스 이동으로 저장">
            <button type="button" class="btn-item-history-modal" data-id="${item.id || ''}" data-name="${escapeHtml(item.name)}" style="background:none; border:none; cursor:pointer; font-size:1.1rem; padding:2px;" title="가격 변동 이력 보기">📜</button>
            <button type="button" class="btn-item-delete-modal" data-name="${escapeHtml(item.name)}" style="background:none; border:none; cursor:pointer; font-size:1.1rem; padding:2px; color:#94a3b8;" title="품목 삭제">🗑️</button>
          </div>
        </div>
      `;
    });
    html += '</div>';

    listContainer.innerHTML = html;

    listContainer.onclick = async (e) => {
      // 1. History Modal
      const historyBtn = e.target.closest('.btn-item-history-modal');
      if (historyBtn) {
        e.preventDefault();
        e.stopPropagation();
        const id = historyBtn.dataset.id;
        const name = historyBtn.dataset.name;
        openPriceHistoryModal(id, name);
        return;
      }

      // 2. Delete Item
      const deleteBtn = e.target.closest('.btn-item-delete-modal');
      if (deleteBtn) {
        const name = deleteBtn.dataset.name;
        if (confirm(`[${currentMart}] '${name}' 품목을 등록 목록에서 완전히 삭제하시겠습니까?`)) {
          savedItems = savedItems.filter(i => i.name.trim() !== name.trim());
          saveState();
          render();
          try {
            fetch(`/api/db/item?mart=${encodeURIComponent(currentMart)}&name=${encodeURIComponent(name)}`, {
              method: 'DELETE'
            });
          } catch (dbErr) {
            console.warn('DB item delete error:', dbErr);
          }
          showToast(`'${name}' 품목이 삭제되었습니다.`);
          const searchInput = document.getElementById('all-items-search-input');
          renderAllItemsList(searchInput ? searchInput.value.trim() : '');
        }
      }
    };

    listContainer.onpointerdown = (e) => {
      const historyBtn = e.target.closest('.btn-item-history-modal');
      if (!historyBtn) return;
      e.preventDefault();
      e.stopPropagation();
      const id = historyBtn.dataset.id;
      const name = historyBtn.dataset.name;
      openPriceHistoryModal(id, name);
    };

    async function saveInlinePrice(input) {
      const name = input.dataset.name;
      const rawValue = input.value.trim();
      if (!name || !rawValue) return;

      const parsed = parseQuickPrice(rawValue) || parseInt(rawValue.replace(/[^0-9]/g, ''), 10);
      if (!parsed || parsed <= 0) {
        alert('유효한 가격 숫자를 입력해 주세요.');
        return;
      }

      const targetItem = savedItems.find(i => i.name.trim() === name.trim());
      const previousPrice = targetItem ? targetItem.lastPrice : null;
      if (previousPrice === parsed) {
        input.value = parsed.toLocaleString();
        return;
      }

      if (input.dataset.saving === 'true') return;
      input.dataset.saving = 'true';
      input.disabled = true;
      input.classList.add('saving');
      const nowIso = new Date().toISOString();
      if (targetItem) {
        targetItem.lastPrice = parsed;
        if (!Array.isArray(targetItem.priceHistory)) targetItem.priceHistory = [];
        targetItem.priceHistory.unshift({ price: parsed, usedAt: nowIso });
      }

      saveState(false);
      input.value = parsed.toLocaleString();

      try {
        const res = await fetch('/api/db/item', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ martName: currentMart, name, price: parsed, incrementUse: false })
        });
        const data = await res.json();
        if (!res.ok || !data || !data.success) {
          if (targetItem) {
            targetItem.lastPrice = previousPrice;
            targetItem.priceHistory.shift();
          }
          input.value = previousPrice ? previousPrice.toLocaleString() : '';
          showToast(data && data.message ? data.message : '단가 저장 중 오류가 발생했습니다.');
          return;
        }
      } catch (dbErr) {
        console.warn('DB item update error:', dbErr);
        if (targetItem) {
          targetItem.lastPrice = previousPrice;
          targetItem.priceHistory.shift();
        }
        input.value = previousPrice ? previousPrice.toLocaleString() : '';
        showToast('네트워크 오류로 단가 저장에 실패했습니다.');
        return;
      } finally {
        input.disabled = false;
        input.dataset.saving = 'false';
        input.classList.remove('saving');
      }

      showToast(`'${name}' 단가가 ${parsed.toLocaleString()}원으로 저장되었습니다.`);
      const searchInput = document.getElementById('all-items-search-input');
      renderQuickChips();
      if (itemNameInput && itemNameInput.value.trim()) {
        updateAutocomplete();
      }
      renderAllItemsList(searchInput ? searchInput.value.trim() : '');
    }

    listContainer.onkeydown = (e) => {
      const priceInput = e.target.closest('.all-item-price-input');
      if (!priceInput || e.key !== 'Enter') return;
      e.preventDefault();
      priceInput.blur();
    };

    listContainer.onfocusout = (e) => {
      const priceInput = e.target.closest('.all-item-price-input');
      if (!priceInput) return;
      saveInlinePrice(priceInput);
    };

    listContainer.onchange = (e) => {
      const priceInput = e.target.closest('.all-item-price-input');
      if (!priceInput) return;
      saveInlinePrice(priceInput);
    };
  }

  async function openPurchaseRecordsModal() {
    const recordsModal = document.getElementById('purchase-records-modal');
    const recordsContent = document.getElementById('records-modal-content');
    if (!recordsModal || !recordsContent) return;

    recordsContent.innerHTML = '<div style="padding:16px; text-align:center; color:var(--text-muted);">저장 내역을 불러오는 중...</div>';
    recordsModal.classList.remove('hidden');

    try {
      const res = await fetch(`/api/db/records?mart=${encodeURIComponent(currentMart)}`);
      const data = await res.json();
      if (!data || !data.success || !Array.isArray(data.records) || data.records.length === 0) {
        recordsContent.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted);">저장된 구매 계산 내역이 없습니다.</div>';
        return;
      }

      // Compute Monthly Total Summaries (Group by YYYY-MM)
      const monthlyTotals = {};
      data.records.forEach(rec => {
        const timeStr = rec.time_str || '';
        const monthKey = timeStr.length >= 7 ? timeStr.substring(0, 7) : '기타';
        monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + Number(rec.total_amount);
      });

      let html = '<div class="monthly-summary-container" style="display:flex; flex-direction:column; gap:6px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:12px; margin-bottom:14px;">';
      Object.keys(monthlyTotals).sort().reverse().forEach(mKey => {
        const [y, m] = mKey.split('-');
        const monthLabel = m ? `${y}년 ${parseInt(m, 10)}월` : mKey;
        html += `
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:700; color:#1e40af; font-size:1.05rem;">📅 ${monthLabel} 총 지출:</span>
            <span style="font-weight:800; color:#dc2626; font-size:1.15rem;">${monthlyTotals[mKey].toLocaleString()}원</span>
          </div>
        `;
      });
      html += '</div>';

      data.records.forEach(rec => {
        let itemsArr = [];
        try {
          itemsArr = typeof rec.items_json === 'string' ? JSON.parse(rec.items_json) : rec.items_json;
        } catch (e) {
          itemsArr = [];
        }

        let formattedTime = rec.time_str || '';
        if (formattedTime.length >= 16) {
          const parts = formattedTime.split(' ');
          if (parts.length >= 2) {
            const datePart = parts[0];
            const timePart = parts[1].substring(0, 5); // YYYY-MM-DD & HH:mm
            formattedTime = `${datePart} &nbsp;&nbsp;${timePart}`;
          }
        }

        html += `
          <div class="record-card" style="background:#f8fafc; border:1px solid var(--border-color); border-radius:8px; padding:12px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:6px; margin-bottom:8px;">
              <span style="font-weight:700; color:var(--text-main); font-size:0.95rem;">${formattedTime}</span>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-weight:800; color:#dc2626; font-size:1.05rem;">${Number(rec.total_amount).toLocaleString()}원</span>
                <button type="button" class="btn-delete-record" data-id="${rec.id}" style="background:none; border:none; color:#94a3b8; font-size:1rem; cursor:pointer; padding:2px 4px;" title="이 내역 삭제" aria-label="삭제">🗑️</button>
              </div>
            </div>
            <ul style="list-style:none; padding:0; margin:0; font-size:0.9rem;">
              ${itemsArr.map(item => `
                <li style="display:flex; justify-content:space-between; padding:3px 0;">
                  <span>${escapeHtml(getDisplayItemName(item.name, item.price))} x ${item.quantity}</span>
                  <span style="color:#dc2626; font-weight:600;">${(Number(item.price) * Number(item.quantity)).toLocaleString()}원</span>
                </li>
              `).join('')}
            </ul>
          </div>
        `;
      });

      recordsContent.innerHTML = html;

      // Event delegation for deleting a record
      recordsContent.onclick = async (e) => {
        const btnDelete = e.target.closest('.btn-delete-record');
        if (btnDelete) {
          const recId = btnDelete.dataset.id;
          if (confirm('이 저장 내역을 삭제하시겠습니까?')) {
            try {
              const delRes = await fetch(`/api/db/records/${recId}`, { method: 'DELETE' });
              const delData = await delRes.json();
              if (delData && delData.success) {
                showToast('🗑️ 저장 내역이 삭제되었습니다.');
                openPurchaseRecordsModal();
              } else {
                showToast('⚠️ 삭제 중 오류가 발생했습니다.');
              }
            } catch (err) {
              console.error('Delete record error:', err);
              showToast('⚠️ 네트워크 오류로 삭제 실패');
            }
          }
        }
      };
    } catch (err) {
      console.error('Failed to load purchase records:', err);
      recordsContent.innerHTML = '<div style="padding:16px; text-align:center; color:red;">내역을 불러오는데 실패했습니다.</div>';
    }
  }

  // Toast Notification Helper
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

  // Utility: HTML Escape
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function isCostcoStarPrice(price) {
    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) return false;
    const lastTwoDigits = numericPrice % 100;
    return lastTwoDigits === 70 || lastTwoDigits === 0;
  }

  function getDisplayItemName(name, price) {
    const trimmedName = String(name || '').trim();
    if (currentMart === '코스트코' && isCostcoStarPrice(price) && !trimmedName.startsWith('🔥')) {
      return `🔥 ${trimmedName}`;
    }
    return trimmedName;
  }

  // App Initialization
  function init() {
    migrateLegacyData();

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
