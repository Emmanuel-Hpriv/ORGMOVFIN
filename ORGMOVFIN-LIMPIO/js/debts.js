// ========================
// FinFlow — Debts Module
// ========================

const createDebt = () => {
    const name = document.getElementById('inp-new-debt-name').value;
    const amount = parseFloat(document.getElementById('inp-new-debt-amount').value);
    const currency = document.getElementById('inp-new-debt-currency') ?
        document.getElementById('inp-new-debt-currency').value : 'MXN';
    if (!name || !amount || amount <= 0) return alert('Datos inválidos.');

    appData.debts.push({ id: Date.now().toString(), name, total: amount, paid: 0, currency });
    saveData();
    document.getElementById('inp-new-debt-name').value = '';
    document.getElementById('inp-new-debt-amount').value = '';
};
window.createDebt = createDebt;

window.deleteDebt = (id) => {
    if (confirm('¿Eliminar esta deuda? Los pagos asociados se mantendrán como gastos normales.')) {
        appData.debts = appData.debts.filter(d => d.id !== id);
        saveData();
    }
};

window.addIncrementToDebt = (id) => {
    const amt = parseFloat(prompt('Monto del incremento a la deuda:'));
    if (amt && amt > 0) {
        const debt = appData.debts.find(d => d.id === id);
        if (debt) {
            debt.total += amt;
            saveData();
        }
    }
};

const renderDebts = () => {
    let html = '';
    appData.debts.forEach(debt => {
        const perc = Math.min((debt.paid / debt.total) * 100, 100);
        const isPaid = debt.paid >= debt.total;
        html += `
            <div class="glass debt-card" style="${isPaid ? 'opacity:0.6;' : ''}">
                <div class="debt-header">
                    <div>
                        <h3>${debt.name} ${isPaid ? '✅' : ''}</h3>
                        <div class="text-muted">Pagado: ${formatMoney(debt.paid, debt.currency)} / ${formatMoney(debt.total, debt.currency)}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-weight:bold;color:${isPaid ? 'var(--income)' : 'var(--expense)'}">
                            ${isPaid ? 'Liquidada' : 'Resta ' + formatMoney(debt.total - debt.paid, debt.currency)}
                        </div>
                        <div style="margin-top:5px;display:flex;gap:8px;justify-content:flex-end;">
                            ${!isPaid ? `<span style="color:var(--warning);cursor:pointer;font-size:12px;" onclick="addIncrementToDebt('${debt.id}')">+ Incremento</span>` : ''}
                            <span style="color:var(--expense);cursor:pointer;font-size:12px;" onclick="deleteDebt('${debt.id}')">Eliminar</span>
                        </div>
                    </div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${perc}%;${isPaid ? 'background:var(--income);' : ''}"></div>
                </div>
            </div>
        `;
    });
    document.getElementById('debts-list').innerHTML = html || '<p class="text-muted" style="text-align:center;">No hay deudas registradas.</p>';
};
