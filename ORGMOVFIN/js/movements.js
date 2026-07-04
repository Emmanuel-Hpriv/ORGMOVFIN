// ========================
// FinFlow — Movements Module
// ========================

// --- Frankfurter API: Live Exchange Rate ---
let cachedLiveRates = {}; // cache: "USD-MXN" -> { rate, timestamp }
const RATE_CACHE_MS = 5 * 60 * 1000; // 5 min cache

async function getLiveExchangeRate(from, to) {
    if (from === to) return 1;
    const key = `${from}-${to}`;
    const cached = cachedLiveRates[key];
    if (cached && (Date.now() - cached.timestamp < RATE_CACHE_MS)) return cached.rate;
    try {
        const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`);
        if (!res.ok) throw new Error('Network error');
        const data = await res.json();
        const rate = data.rates[to];
        cachedLiveRates[key] = { rate, timestamp: Date.now() };
        cachedLiveRates[`${to}-${from}`] = { rate: 1 / rate, timestamp: Date.now() };
        return rate;
    } catch (e) {
        console.warn('Frankfurter API offline, usando tasa manual.', e);
        return null;
    }
}

let currentType = 'expense';

const selectType = (type) => {
    currentType = type;
    document.querySelectorAll('#view-add .type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });

    const standardFields = document.getElementById('standard-fields');
    const exchangeFields = document.getElementById('exchange-fields');

    if (type === 'exchange') {
        standardFields.style.display = 'none';
        exchangeFields.style.display = 'block';
        updateExchangeRateDisplay();
    } else {
        standardFields.style.display = 'block';
        exchangeFields.style.display = 'none';
        updateCategoryOptions();
    }
};
window.selectType = selectType;

const initMovementView = () => {
    updateCategoryOptions();
    updateDebtSelector();
    updateAccountSelector('inp-account', '-- Sin Cuenta --');
    updateAccountSelector('inp-exch-account', '-- Sin Cuenta --');
    // Show account selector if accounts exist
    const accGroup = document.getElementById('account-selector-group');
    accGroup.style.display = appData.accounts.length > 0 ? 'block' : 'none';
    // Reset to expense
    selectType('expense');
};
window.initMovementView = initMovementView;

const updateCategoryOptions = () => {
    const select = document.getElementById('inp-category');
    select.innerHTML = '';
    const cats = appData.categories[currentType] || [];
    cats.forEach(c => {
        select.innerHTML += `<option value="${c}">${c} ${getCategoryIcon(c)}</option>`;
    });
    handleCategoryChange();
};

const handleCategoryChange = () => {
    const val = document.getElementById('inp-category').value;
    const debtGroup = document.getElementById('debt-selector-group');
    if (val === 'Deuda' && currentType === 'expense') {
        debtGroup.style.display = 'block';
        updateDebtSelector();
    } else {
        debtGroup.style.display = 'none';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const catSelect = document.getElementById('inp-category');
    if (catSelect) catSelect.addEventListener('change', handleCategoryChange);

    // Live exchange rate calculation
    ['inp-exch-from-amount', 'inp-exch-to-amount'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateExchangeRateDisplay);
    });
    ['inp-exch-from-currency', 'inp-exch-to-currency'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => {
            updateExchangeRateDisplay();
            autoFillWithLiveRate();
        });
    });

    // Auto-fill destination when typing source amount
    const fromAmtEl = document.getElementById('inp-exch-from-amount');
    if (fromAmtEl) {
        let debounceTimer;
        fromAmtEl.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(autoFillWithLiveRate, 400);
        });
    }
});

const updateDebtSelector = () => {
    const select = document.getElementById('inp-debt-id');
    select.innerHTML = '<option value="">-- Seleccionar Deuda --</option>';
    appData.debts.forEach(debt => {
        if (debt.paid < debt.total) {
            select.innerHTML += `<option value="${debt.id}">${debt.name} (Resta ${formatMoney(debt.total - debt.paid, debt.currency)})</option>`;
        }
    });
};

const updateAccountSelector = (selectId, defaultText) => {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = `<option value="">${defaultText}</option>`;
    appData.accounts.forEach(acc => {
        select.innerHTML += `<option value="${acc.id}">${acc.name}</option>`;
    });
};
window.updateAccountSelector = updateAccountSelector;

const updateExchangeRateDisplay = () => {
    const fromAmt = parseFloat(document.getElementById('inp-exch-from-amount').value) || 0;
    const toAmt = parseFloat(document.getElementById('inp-exch-to-amount').value) || 0;
    const fromCur = document.getElementById('inp-exch-from-currency').value;
    const toCur = document.getElementById('inp-exch-to-currency').value;
    const display = document.getElementById('exchange-rate-display');

    if (fromAmt > 0 && toAmt > 0 && fromCur !== toCur) {
        const rate = toAmt / fromAmt;
        display.innerHTML = `<div class="exchange-rate-badge">1 ${fromCur} = ${rate.toFixed(4)} ${toCur}</div>`;
    } else if (fromCur === toCur) {
        display.innerHTML = '<div class="exchange-rate-badge" style="border-color:var(--expense);color:var(--expense);">Selecciona divisas diferentes</div>';
    } else {
        display.innerHTML = '';
    }
};

// Auto-fill destination amount with live Frankfurter rate
const autoFillWithLiveRate = async () => {
    const fromAmt = parseFloat(document.getElementById('inp-exch-from-amount').value) || 0;
    const fromCur = document.getElementById('inp-exch-from-currency').value;
    const toCur = document.getElementById('inp-exch-to-currency').value;
    const display = document.getElementById('exchange-rate-display');
    const toAmtEl = document.getElementById('inp-exch-to-amount');

    if (fromAmt <= 0 || fromCur === toCur) return;

    display.innerHTML = '<div class="exchange-rate-badge" style="opacity:0.6;">⏳ Consultando tasa en tiempo real...</div>';

    const liveRate = await getLiveExchangeRate(fromCur, toCur);
    if (liveRate) {
        const result = (fromAmt * liveRate).toFixed(2);
        toAmtEl.value = result;
        display.innerHTML = `<div class="exchange-rate-badge">📡 Tasa BCE: 1 ${fromCur} = ${liveRate.toFixed(4)} ${toCur}<br><span style="font-size:11px;opacity:0.7;">Puedes ajustar el monto destino manualmente</span></div>`;
    } else {
        display.innerHTML = '<div class="exchange-rate-badge" style="border-color:var(--warning);color:var(--warning);">⚠️ Sin conexión — ingresa la tasa manualmente</div>';
    }
};

const saveMovement = () => {
    const date = document.getElementById('inp-date').value;

    if (currentType === 'exchange') {
        saveExchangeMovement(date);
        return;
    }

    const amount = parseFloat(document.getElementById('inp-amount').value);
    const currency = document.getElementById('inp-currency').value;
    const category = document.getElementById('inp-category').value;
    const desc = document.getElementById('inp-desc').value;
    const debtId = document.getElementById('inp-debt-id').value;
    const accountId = document.getElementById('inp-account').value;

    if (!amount || amount <= 0) { alert('Ingresa un monto válido.'); return; }

    const movement = {
        id: Date.now().toString(),
        type: currentType,
        amount, currency, category, desc, date,
        debtId: category === 'Deuda' ? debtId : null,
        accountId: accountId || null
    };

    // Update debt
    if (movement.debtId) {
        const debt = appData.debts.find(d => d.id === movement.debtId);
        if (debt) debt.paid += amount;
    }

    appData.movements.unshift(movement);
    saveData();
    document.getElementById('inp-amount').value = '';
    document.getElementById('inp-desc').value = '';
    switchView('dashboard');
};
window.saveMovement = saveMovement;

const saveExchangeMovement = (date) => {
    const fromAmt = parseFloat(document.getElementById('inp-exch-from-amount').value);
    const fromCur = document.getElementById('inp-exch-from-currency').value;
    const toAmt = parseFloat(document.getElementById('inp-exch-to-amount').value);
    const toCur = document.getElementById('inp-exch-to-currency').value;

    if (!fromAmt || fromAmt <= 0 || !toAmt || toAmt <= 0) {
        alert('Ingresa montos válidos.'); return;
    }
    if (fromCur === toCur) {
        alert('Las divisas deben ser diferentes.'); return;
    }

    const exchangeId = Date.now().toString();
    const rate = toAmt / fromAmt;

    // Record exchange rate
    appData.exchangeRates.push({
        id: exchangeId,
        fromCurrency: fromCur,
        toCurrency: toCur,
        rate: rate,
        date: date
    });

    // Expense in origin currency
    appData.movements.unshift({
        id: exchangeId + '-out',
        type: 'expense',
        amount: fromAmt,
        currency: fromCur,
        category: 'Cambio de Divisas',
        desc: `${fromAmt} ${fromCur} → ${toAmt} ${toCur} (TC: ${rate.toFixed(4)})`,
        date: date,
        exchangeId: exchangeId
    });

    // Income in destination currency
    appData.movements.unshift({
        id: exchangeId + '-in',
        type: 'income',
        amount: toAmt,
        currency: toCur,
        category: 'Cambio de Divisas',
        desc: `${fromAmt} ${fromCur} → ${toAmt} ${toCur} (TC: ${rate.toFixed(4)})`,
        date: date,
        exchangeId: exchangeId
    });

    // --- Spread Control: check if physical account ---
    const exchAccId = document.getElementById('inp-exch-account')?.value;
    if (exchAccId) {
        const exchAcc = appData.accounts.find(a => a.id === exchAccId);
        if (exchAcc && exchAcc.type === 'physical') {
            // Use cached live rate if available, fallback to stored
            const cachedKey = `${fromCur}-${toCur}`;
            const cached = cachedLiveRates[cachedKey];
            const interbankRate = (cached && (Date.now() - cached.timestamp < RATE_CACHE_MS))
                ? cached.rate : getLatestRate(fromCur, toCur);
            const expectedDestAmt = fromAmt * interbankRate;
            const spreadLoss = expectedDestAmt - toAmt;
            if (spreadLoss > 0.01) {
                appData.movements.unshift({
                    id: exchangeId + '-spread',
                    type: 'expense',
                    amount: parseFloat(spreadLoss.toFixed(2)),
                    currency: toCur,
                    category: 'Pérdida por Spread',
                    desc: `Spread: TC real ${rate.toFixed(4)} vs interbancario ${interbankRate.toFixed(4)} (${fromCur}→${toCur})`,
                    date: date,
                    accountId: exchAccId,
                    exchangeId: exchangeId
                });
            }
        }
    }

    saveData();
    // Reset fields
    document.getElementById('inp-exch-from-amount').value = '';
    document.getElementById('inp-exch-to-amount').value = '';
    document.getElementById('exchange-rate-display').innerHTML = '';
    switchView('dashboard');
};
