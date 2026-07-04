// ========================
// FinFlow — Comisiones Semanales Module
// ========================

const createCommission = () => {
    const amount = parseFloat(document.getElementById('inp-comm-amount').value);
    const currency = document.getElementById('inp-comm-currency').value;
    const desc = document.getElementById('inp-comm-desc').value;
    const date = document.getElementById('inp-comm-date').value;
    if (!amount || amount <= 0 || !date) return alert('Datos inválidos.');

    appData.commissions.push({
        id: Date.now().toString(), amount, currency, desc, date, assigned: false,
        assignedTo: null, assignedType: null, assignedAccountId: null, assignedGoalId: null
    });
    saveData();
    document.getElementById('inp-comm-amount').value = '';
    document.getElementById('inp-comm-desc').value = '';
};
window.createCommission = createCommission;

window.deleteCommission = (id) => {
    if (!confirm('¿Eliminar comisión?')) return;
    const comm = appData.commissions.find(c => c.id === id);
    if (comm && comm.assignedGoalId) {
        const goal = appData.goals.find(g => g.id === comm.assignedGoalId);
        if (goal) {
            const amtMXN = convertToMXN(comm.amount, comm.currency);
            goal.current -= amtMXN;
            if (goal.current < 0) goal.current = 0;
            goal.contributions = goal.contributions.filter(c => c.movementId !== 'comm-' + id);
        }
    }
    appData.commissions = appData.commissions.filter(c => c.id !== id);
    saveData();
};

// --- Assignment ---
window.toggleAssignForm = (id) => {
    const f = document.getElementById(`assign-form-${id}`);
    if (f) f.style.display = f.style.display === 'none' ? 'block' : 'none';
};

window.onAssignTypeChange = (id) => {
    const type = document.getElementById(`assign-type-${id}`).value;
    document.getElementById(`assign-acc-wrap-${id}`).style.display = (type === 'account') ? 'block' : 'none';
    document.getElementById(`assign-goal-wrap-${id}`).style.display = (type === 'goal') ? 'block' : 'none';
};

window.saveAssignment = (id) => {
    const comm = appData.commissions.find(c => c.id === id);
    if (!comm) return;
    const type = document.getElementById(`assign-type-${id}`).value;
    comm.assignedType = type;
    comm.assigned = true;

    if (type === 'capital') {
        comm.assignedTo = 'Capital';
        appData.movements.unshift({
            id: 'comm-' + id, type: 'income', amount: comm.amount,
            currency: comm.currency, category: 'Ventas',
            desc: `Comisión: ${comm.desc || 'Sin desc.'} → Capital`,
            date: comm.date
        });
    } else if (type === 'account') {
        const accId = document.getElementById(`assign-acc-${id}`).value;
        const acc = appData.accounts.find(a => a.id === accId);
        if (!acc) return alert('Selecciona una cuenta.');
        comm.assignedAccountId = accId;
        comm.assignedTo = acc.name;
        appData.movements.unshift({
            id: 'comm-' + id, type: 'income', amount: comm.amount,
            currency: comm.currency, category: 'Ventas',
            desc: `Comisión: ${comm.desc || 'Sin desc.'} → 🏦 ${acc.name}`,
            date: comm.date, accountId: accId
        });
    } else if (type === 'goal') {
        const goalId = document.getElementById(`assign-goal-${id}`).value;
        const goal = appData.goals.find(g => g.id === goalId);
        if (!goal) return alert('Selecciona una meta.');
        comm.assignedGoalId = goalId;
        comm.assignedTo = goal.name;
        const amtMXN = convertToMXN(comm.amount, comm.currency);
        goal.current += amtMXN;
        goal.contributions.push({
            id: 'comm-' + id, movementId: 'comm-' + id,
            amount: amtMXN, type: 'commission',
            source: `Comisión ${comm.currency} (${comm.desc || 'venta'})`,
            date: comm.date, subgoalId: null
        });
    }
    saveData();
};

// --- Week Helpers ---
const getWeekKey = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((day + 6) % 7));
    return monday.toISOString().split('T')[0];
};

const getWeekLabel = (weekKey) => {
    const start = new Date(weekKey + 'T12:00:00');
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const fmt = d => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    return `${fmt(start)} – ${fmt(end)}`;
};

// --- Progress bar color by percentage ---
const progressColor = (pct) => {
    if (pct >= 100) return '#00D4AA';
    if (pct >= 75) return '#4CAF50';
    if (pct >= 50) return '#FFC107';
    if (pct >= 25) return '#FF9800';
    return '#FF5252';
};

// --- Render ---
const renderCommissions = () => {
    const container = document.getElementById('commissions-list');
    if (!container) return;
    const comms = appData.commissions || [];

    // Group by week
    const weeks = {};
    comms.forEach(c => {
        const wk = getWeekKey(c.date);
        if (!weeks[wk]) weeks[wk] = [];
        weeks[wk].push(c);
    });

    const sortedWeeks = Object.keys(weeks).sort((a, b) => b.localeCompare(a));
    if (sortedWeeks.length === 0) {
        container.innerHTML = '<p class="text-muted" style="text-align:center;">No hay comisiones registradas.</p>';
        return;
    }

    let html = '';
    sortedWeeks.forEach(wk => {
        const items = weeks[wk].sort((a, b) => b.date.localeCompare(a.date));
        let weekTotal = 0;
        items.forEach(c => { weekTotal += convertToMXN(c.amount, c.currency); });

        html += `<div class="comm-week-card glass">
            <div class="comm-week-header">
                <span>📅 ${getWeekLabel(wk)}</span>
                <span class="income">${formatMoney(weekTotal)}</span>
            </div>`;
        items.forEach(c => {
            let accOptions = '<option value="">--</option>';
            appData.accounts.forEach(a => { accOptions += `<option value="${a.id}">${a.name}</option>`; });
            let goalOptions = '<option value="">--</option>';
            appData.goals.forEach(g => { goalOptions += `<option value="${g.id}">${g.name}</option>`; });

            const badge = c.assigned
                ? `<span class="comm-badge assigned">✓ ${c.assignedType === 'goal' ? '🎯' : c.assignedType === 'account' ? '🏦' : '💰'} ${c.assignedTo}</span>`
                : `<span class="comm-badge pending">Pendiente</span>`;

            html += `<div class="comm-item">
                <div class="comm-item-row">
                    <div>
                        <div style="font-weight:600;">${formatMoney(c.amount, c.currency)}</div>
                        <div class="text-muted" style="font-size:12px;">${c.date} · ${c.desc || 'Sin descripción'}</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:6px;">
                        ${badge}
                        ${!c.assigned ? `<button class="btn-small" onclick="toggleAssignForm('${c.id}')">Asignar</button>` : ''}
                        <span style="color:var(--expense);cursor:pointer;font-size:16px;" onclick="deleteCommission('${c.id}')">🗑️</span>
                    </div>
                </div>
                ${!c.assigned ? `<div id="assign-form-${c.id}" class="inline-form" style="display:none;">
                    <select id="assign-type-${c.id}" onchange="onAssignTypeChange('${c.id}')">
                        <option value="capital">💰 Capital</option>
                        <option value="account">🏦 Cuenta de Banco</option>
                        <option value="goal">🎯 Meta</option>
                    </select>
                    <div id="assign-acc-wrap-${c.id}" style="display:none;">
                        <select id="assign-acc-${c.id}">${accOptions}</select>
                    </div>
                    <div id="assign-goal-wrap-${c.id}" style="display:none;">
                        <select id="assign-goal-${c.id}">${goalOptions}</select>
                    </div>
                    <button class="btn-primary" style="padding:10px;font-size:14px;" onclick="saveAssignment('${c.id}')">Confirmar</button>
                </div>` : ''}
            </div>`;
        });
        html += `</div>`;
    });

    // Summary + Trend
    let totalMXN = 0, totalUSD = 0, totalEUR = 0, assignedCount = 0;
    comms.forEach(c => {
        if (c.currency === 'MXN') totalMXN += c.amount;
        else if (c.currency === 'USD') totalUSD += c.amount;
        else if (c.currency === 'EUR') totalEUR += c.amount;
        if (c.assigned) assignedCount++;
    });

    // Trend: current week vs previous week
    const today = new Date();
    const currentWeekKey = getWeekKey(today.toISOString().split('T')[0]);
    const prevWeekDate = new Date(today);
    prevWeekDate.setDate(today.getDate() - 7);
    const prevWeekKey = getWeekKey(prevWeekDate.toISOString().split('T')[0]);

    let currentWeekTotal = 0, prevWeekTotal = 0;
    comms.forEach(c => {
        const wk = getWeekKey(c.date);
        const mxnAmt = convertToMXN(c.amount, c.currency);
        if (wk === currentWeekKey) currentWeekTotal += mxnAmt;
        if (wk === prevWeekKey) prevWeekTotal += mxnAmt;
    });

    let trendHtml = '';
    if (prevWeekTotal > 0) {
        const pctChange = ((currentWeekTotal - prevWeekTotal) / prevWeekTotal) * 100;
        const isUp = pctChange >= 0;
        trendHtml = `<div class="trend-badge ${isUp ? 'up' : 'down'}">
            ${isUp ? '🔺' : '🔻'} ${isUp ? '+' : ''}${pctChange.toFixed(1)}% vs semana anterior
        </div>`;
    } else if (currentWeekTotal > 0) {
        trendHtml = `<div class="trend-badge up">🔺 Primera semana con actividad</div>`;
    }

    html = `<div class="glass balance-card" style="margin-bottom:20px;">
        <div class="text-muted">Comisiones Totales (MXN equiv.)</div>
        <div class="amount income">${formatMoney(comms.reduce((s, c) => s + convertToMXN(c.amount, c.currency), 0))}</div>
        ${trendHtml}
        <div class="currency-columns">
            <div class="currency-col"><div class="currency-label">MXN</div><div class="currency-value">${formatMoney(totalMXN, 'MXN')}</div></div>
            <div class="currency-col"><div class="currency-label">USD</div><div class="currency-value">${formatMoney(totalUSD, 'USD')}</div></div>
            <div class="currency-col"><div class="currency-label">EUR</div><div class="currency-value">${formatMoney(totalEUR, 'EUR')}</div></div>
        </div>
        <div class="text-muted" style="margin-top:10px;">${assignedCount}/${comms.length} asignadas</div>
    </div>` + html;

    container.innerHTML = html;

    // Update goal progress bars with commission source tracking
    renderGoalProgressFromCommissions();
};

const renderGoalProgressFromCommissions = () => {
    const goalCards = document.getElementById('goals-list');
    if (!goalCards) return;
    // Re-render goals to pick up updated contributions with source info
    if (typeof renderGoals === 'function') renderGoals();
};

// Set default date on commission form
const initCommissionView = () => {
    const dateInput = document.getElementById('inp-comm-date');
    if (dateInput && !dateInput.value) dateInput.valueAsDate = new Date();
};
window.initCommissionView = initCommissionView;
