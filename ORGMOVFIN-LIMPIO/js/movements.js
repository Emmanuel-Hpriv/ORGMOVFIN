// ========================
// FinFlow — Movements Module
// ========================

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
        if (el) el.addEventListener('change', updateExchangeRateDisplay);
    });
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
            // Compare against interbank rate (stored rates or defaults)
            const interbankRate = getLatestRate(fromCur, toCur);
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
