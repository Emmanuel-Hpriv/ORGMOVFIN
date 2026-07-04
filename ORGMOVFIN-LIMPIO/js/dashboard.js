// ========================
// FinFlow — Dashboard Module
// ========================

const renderDashboard = () => {
    let balMXN = 0, balUSD = 0, balEUR = 0;
    let incMXN = 0, expMXN = 0;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    appData.movements.forEach(m => {
        const amt = parseFloat(m.amount);
        const isExchange = m.category === 'Cambio de Divisas';
        if (m.type === 'income') {
            if (m.currency === 'MXN') balMXN += amt;
            else if (m.currency === 'USD') balUSD += amt;
            else if (m.currency === 'EUR') balEUR += amt;
        } else {
            if (m.currency === 'MXN') balMXN -= amt;
            else if (m.currency === 'USD') balUSD -= amt;
            else if (m.currency === 'EUR') balEUR -= amt;
        }
        // Monthly stats (exclude currency exchanges)
        const d = new Date(m.date);
        if (!isExchange && d.getUTCMonth() === currentMonth && d.getUTCFullYear() === currentYear) {
            const mxnEq = convertToMXN(amt, m.currency);
            if (m.type === 'income') incMXN += mxnEq;
            else expMXN += mxnEq;
        }
    });

    const totalMXN = balMXN + (balUSD * getLatestRate('USD', 'MXN')) + (balEUR * getLatestRate('EUR', 'MXN'));

    document.getElementById('dash-balance').textContent = formatMoney(totalMXN);
    document.getElementById('dash-balance').className = `amount ${totalMXN >= 0 ? 'income' : 'expense'}`;

    document.getElementById('currency-columns').innerHTML = `
        <div class="currency-col">
            <div class="currency-label">MXN</div>
            <div class="currency-value">${formatMoney(balMXN, 'MXN')}</div>
        </div>
        <div class="currency-col">
            <div class="currency-label">USD</div>
            <div class="currency-value">${formatMoney(balUSD, 'USD')}</div>
        </div>
        <div class="currency-col">
            <div class="currency-label">EUR</div>
            <div class="currency-value">${formatMoney(balEUR, 'EUR')}</div>
        </div>
    `;

    document.getElementById('dash-income').textContent = '+' + formatMoney(incMXN);
    document.getElementById('dash-expense').textContent = '-' + formatMoney(expMXN);

    // Recent movements (last 5)
    document.getElementById('recent-movements').innerHTML =
        appData.movements.slice(0, 5).map(renderMovementItem).join('') ||
        '<p class="text-muted" style="text-align:center;">No hay movimientos recientes.</p>';
};
