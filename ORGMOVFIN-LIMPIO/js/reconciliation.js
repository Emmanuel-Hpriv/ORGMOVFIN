// ========================
// FinFlow — Reconciliation / Arqueo de Caja
// ========================

const getAccountBalance = (accountId) => {
    const balances = { MXN: 0, USD: 0, EUR: 0 };
    appData.movements.forEach(m => {
        if (m.accountId !== accountId) return;
        const amt = parseFloat(m.amount);
        if (m.type === 'income') balances[m.currency] = (balances[m.currency] || 0) + amt;
        else balances[m.currency] = (balances[m.currency] || 0) - amt;
    });
    return balances;
};

window.saveReconciliation = (accountId, currency) => {
    const inp = document.getElementById(`recon-real-${accountId}-${currency}`);
    if (!inp) return;
    const realBalance = parseFloat(inp.value);
    if (isNaN(realBalance)) return alert('Ingresa un saldo válido.');

    const balances = getAccountBalance(accountId);
    const theoretical = balances[currency] || 0;
    const diff = realBalance - theoretical;
    if (Math.abs(diff) < 0.01) return alert('No hay diferencia. El saldo coincide.');

    const acc = appData.accounts.find(a => a.id === accountId);
    const accName = acc ? acc.name : 'Cuenta';

    appData.movements.unshift({
        id: Date.now().toString(),
        type: diff > 0 ? 'income' : 'expense',
        amount: Math.abs(diff),
        currency: currency,
        category: 'Ajuste de Conciliación',
        desc: `Arqueo ${accName} (${currency}): ${diff > 0 ? 'sobrante' : 'faltante'} ${formatMoney(Math.abs(diff), currency)}`,
        date: new Date().toISOString().split('T')[0],
        accountId: accountId
    });

    if (!appData.reconciliations) appData.reconciliations = [];
    appData.reconciliations.push({
        id: Date.now().toString(),
        accountId, currency,
        theoretical: theoretical,
        real: realBalance,
        diff: diff,
        date: new Date().toISOString().split('T')[0]
    });

    saveData();
    alert(`Ajuste de ${formatMoney(Math.abs(diff), currency)} aplicado.`);
};

const renderReconciliation = () => {
    const container = document.getElementById('reconciliation-list');
    if (!container) return;

    if (appData.accounts.length === 0) {
        container.innerHTML = '<p class="text-muted" style="text-align:center;">Registra cuentas en Configuración primero.</p>';
        return;
    }

    let html = '';
    appData.accounts.forEach(acc => {
        const bals = getAccountBalance(acc.id);
        const typeLabel = acc.type === 'physical' ? '💵 Física' : '🏦 Digital';
        html += `<div class="glass" style="padding:16px;margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <h3 style="font-size:16px;">${acc.name}</h3>
                <span class="text-muted" style="font-size:12px;">${typeLabel}</span>
            </div>`;

        ['MXN', 'USD', 'EUR'].forEach(cur => {
            if (Math.abs(bals[cur]) > 0.001 || cur === 'MXN') {
                html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
                    <span class="text-muted" style="min-width:40px;">${cur}:</span>
                    <span style="font-weight:600;min-width:90px;">${formatMoney(bals[cur], cur)}</span>
                    <input type="number" id="recon-real-${acc.id}-${cur}" placeholder="Saldo real" step="0.01" style="flex:1;min-width:100px;padding:8px;">
                    <button class="btn-small" onclick="saveReconciliation('${acc.id}','${cur}')">Conciliar</button>
                </div>`;
            }
        });
        html += `</div>`;
    });

    // Recent reconciliations
    const recent = (appData.reconciliations || []).slice(-5).reverse();
    if (recent.length > 0) {
        html += '<h2 style="margin-top:20px;">Últimos Arqueos</h2>';
        recent.forEach(r => {
            const acc = appData.accounts.find(a => a.id === r.accountId);
            const name = acc ? acc.name : '?';
            const diffColor = r.diff >= 0 ? 'var(--income)' : 'var(--expense)';
            html += `<div class="glass list-item">
                <div class="item-info">
                    <div class="item-title">${name} (${r.currency})</div>
                    <div class="item-date">${r.date} · Teórico: ${formatMoney(r.theoretical, r.currency)}</div>
                </div>
                <div style="font-weight:bold;color:${diffColor};">${r.diff >= 0 ? '+' : ''}${formatMoney(r.diff, r.currency)}</div>
            </div>`;
        });
    }

    container.innerHTML = html;
};
