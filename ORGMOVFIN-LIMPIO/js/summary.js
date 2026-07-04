// ========================
// FinFlow — Summary & Budgets Module
// ========================

const updateBudgetCategorySelector = () => {
    const select = document.getElementById('inp-budget-cat');
    if (!select) return;
    select.innerHTML = '';
    appData.categories.expense.forEach(c => {
        select.innerHTML += `<option value="${c}">${c}</option>`;
    });
};
window.updateBudgetCategorySelector = updateBudgetCategorySelector;

const setBudget = () => {
    const cat = document.getElementById('inp-budget-cat').value;
    const limit = parseFloat(document.getElementById('inp-budget-limit').value);
    if (!cat || !limit || limit <= 0) return alert('Datos inválidos');

    const existing = appData.budgets.find(b => b.category === cat);
    if (existing) existing.limit = limit;
    else appData.budgets.push({ category: cat, limit });

    saveData();
    document.getElementById('inp-budget-limit').value = '';
};
window.setBudget = setBudget;

const deleteBudget = (cat) => {
    appData.budgets = appData.budgets.filter(b => b.category !== cat);
    saveData();
};
window.deleteBudget = deleteBudget;

const renderSummary = () => {
    // Calculate total balance for summary header
    let balMXN = 0, balUSD = 0, balEUR = 0;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthExpensesByCat = {};

    appData.movements.forEach(m => {
        const amt = parseFloat(m.amount);
        if (m.type === 'income') {
            if (m.currency === 'MXN') balMXN += amt;
            else if (m.currency === 'USD') balUSD += amt;
            else if (m.currency === 'EUR') balEUR += amt;
        } else {
            if (m.currency === 'MXN') balMXN -= amt;
            else if (m.currency === 'USD') balUSD -= amt;
            else if (m.currency === 'EUR') balEUR -= amt;
        }
        const d = new Date(m.date);
        if (m.type === 'expense' && m.category !== 'Cambio de Divisas' &&
            d.getUTCMonth() === currentMonth && d.getUTCFullYear() === currentYear) {
            monthExpensesByCat[m.category] = (monthExpensesByCat[m.category] || 0) + convertToMXN(amt, m.currency);
        }
    });

    const totalMXN = balMXN + (balUSD * getLatestRate('USD', 'MXN')) + (balEUR * getLatestRate('EUR', 'MXN'));
    document.getElementById('sum-balance').textContent = formatMoney(totalMXN);
    document.getElementById('sum-balance').className = `amount ${totalMXN >= 0 ? 'income' : 'expense'}`;

    // Budgets
    let budgetHtml = '';
    appData.budgets.forEach(b => {
        const spent = monthExpensesByCat[b.category] || 0;
        const perc = Math.min((spent / b.limit) * 100, 100);
        const over = spent > b.limit;
        budgetHtml += `
            <div class="glass budget-card">
                <div class="budget-header">
                    <div><strong>${getCategoryIcon(b.category)} ${b.category}</strong></div>
                    <div style="color:var(--expense);font-size:14px;cursor:pointer;" onclick="deleteBudget('${b.category}')">✕</div>
                </div>
                <div class="text-muted" style="font-size:12px;margin-bottom:5px;">Gastado: ${formatMoney(spent)} / ${formatMoney(b.limit)}</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${perc}%;background:${over ? 'var(--expense)' : 'var(--income)'};"></div>
                </div>
                ${over ? '<div style="color:var(--expense);font-size:12px;margin-top:5px;">¡Presupuesto excedido!</div>' : ''}
            </div>
        `;
    });
    document.getElementById('budgets-list').innerHTML = budgetHtml || '<p class="text-muted">No hay presupuestos definidos.</p>';

    // Category summary
    let catHtml = '';
    for (let cat in monthExpensesByCat) {
        catHtml += `
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--surface-border);">
                <span>${getCategoryIcon(cat)} ${cat}</span>
                <span style="font-weight:bold;">${formatMoney(monthExpensesByCat[cat])}</span>
            </div>
        `;
    }
    document.getElementById('summary-categories').innerHTML = catHtml || '<div class="text-muted">No hay gastos en este mes.</div>';
};
