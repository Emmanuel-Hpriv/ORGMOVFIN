// ========================
// FinFlow — Goals Module (Enhanced with Subgoals & Contributions)
// ========================

// State for contribution forms
const contribState = {};

const createGoal = () => {
    const name = document.getElementById('inp-goal-name').value;
    const amount = parseFloat(document.getElementById('inp-goal-amount').value);
    const deadlineEl = document.getElementById('inp-goal-deadline');
    const deadline = deadlineEl && deadlineEl.value ? deadlineEl.value : null;
    if (!name || !amount || amount <= 0) return alert('Datos inválidos.');

    appData.goals.push({
        id: Date.now().toString(), name, total: amount, current: 0,
        deadline, subgoals: [], contributions: []
    });
    saveData();
    document.getElementById('inp-goal-name').value = '';
    document.getElementById('inp-goal-amount').value = '';
    if (deadlineEl) deadlineEl.value = '';
};
window.createGoal = createGoal;

const deleteGoal = (id) => {
    if (confirm('¿Eliminar esta meta?')) {
        appData.goals = appData.goals.filter(g => g.id !== id);
        saveData();
    }
};
window.deleteGoal = deleteGoal;

// --- Subgoals ---
window.toggleSubgoalForm = (goalId) => {
    const form = document.getElementById(`sg-form-${goalId}`);
    if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
};

window.addSubgoal = (goalId) => {
    const name = document.getElementById(`sg-name-${goalId}`).value;
    const target = parseFloat(document.getElementById(`sg-target-${goalId}`).value);
    if (!name || !target || target <= 0) return alert('Datos inválidos.');

    const goal = appData.goals.find(g => g.id === goalId);
    if (goal) {
        goal.subgoals.push({ id: Date.now().toString(), name, target, current: 0 });
        saveData();
    }
};

window.deleteSubgoal = (goalId, subId) => {
    const goal = appData.goals.find(g => g.id === goalId);
    if (goal) {
        goal.subgoals = goal.subgoals.filter(s => s.id !== subId);
        saveData();
    }
};

// --- Contributions ---
window.toggleContribForm = (goalId, subgoalId) => {
    const key = subgoalId ? `${goalId}-${subgoalId}` : goalId;
    const form = document.getElementById(`contrib-form-${key}`);
    if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
    if (!contribState[key]) contribState[key] = 'cash';
};

window.selectContribType = (key, type) => {
    contribState[key] = type;
    const btns = document.querySelectorAll(`#contrib-form-${key} .contrib-type-btn`);
    btns.forEach(b => b.classList.toggle('active', b.dataset.ctype === type));
    const accSel = document.getElementById(`contrib-acc-${key}`);
    if (accSel) accSel.style.display = type === 'digital' ? 'block' : 'none';
};

window.saveContribution = (goalId, subgoalId) => {
    const key = subgoalId ? `${goalId}-${subgoalId}` : goalId;
    const amt = parseFloat(document.getElementById(`contrib-amt-${key}`).value);
    if (!amt || amt <= 0) return alert('Monto inválido.');

    const goal = appData.goals.find(g => g.id === goalId);
    if (!goal) return;

    const type = contribState[key] || 'cash';
    const accSelect = document.getElementById(`contrib-acc-${key}`);
    const accountId = (type === 'digital' && accSelect) ? accSelect.value : null;
    const accountName = accountId ? (appData.accounts.find(a => a.id === accountId)?.name || '') : '';
    const movId = Date.now().toString();

    // Create movement
    const movDesc = subgoalId
        ? `Abono a ${goal.name} > ${goal.subgoals.find(s => s.id === subgoalId)?.name || ''}`
        : `Abono a ${goal.name}`;

    appData.movements.unshift({
        id: movId,
        type: 'expense',
        amount: amt,
        currency: 'MXN',
        category: 'Abono Meta',
        desc: `${movDesc} (${type === 'cash' ? '💵 Efectivo' : '🏦 ' + accountName})`,
        date: new Date().toISOString().split('T')[0],
        goalContribId: goalId,
        subgoalId: subgoalId || null
    });

    // Update goal
    goal.current += amt;
    goal.contributions.push({
        id: movId,
        movementId: movId,
        amount: amt,
        type,
        accountId,
        date: new Date().toISOString().split('T')[0],
        subgoalId: subgoalId || null
    });

    // Update subgoal if applicable
    if (subgoalId) {
        const sg = goal.subgoals.find(s => s.id === subgoalId);
        if (sg) sg.current += amt;
    }

    saveData();
};

// --- Render ---
const buildContribForm = (goalId, subgoalId) => {
    const key = subgoalId ? `${goalId}-${subgoalId}` : goalId;
    let accOptions = '<option value="">-- Seleccionar --</option>';
    appData.accounts.forEach(a => { accOptions += `<option value="${a.id}">${a.name}</option>`; });

    return `
        <div id="contrib-form-${key}" class="inline-form" style="display:none;">
            <input type="number" id="contrib-amt-${key}" placeholder="Cantidad (MXN)" step="0.01">
            <div class="contrib-type-selector">
                <div class="contrib-type-btn active" data-ctype="cash" onclick="selectContribType('${key}','cash')">💵 Efectivo</div>
                <div class="contrib-type-btn" data-ctype="digital" onclick="selectContribType('${key}','digital')">🏦 Digital</div>
            </div>
            <select id="contrib-acc-${key}" style="display:none;">${accOptions}</select>
            <button class="btn-primary" style="padding:10px;font-size:14px;" onclick="saveContribution('${goalId}','${subgoalId || ''}')">Guardar Aporte</button>
        </div>
    `;
};

const renderGoals = () => {
    let html = '';
    appData.goals.forEach(g => {
        const perc = Math.min((g.current / g.total) * 100, 100);
        const reached = g.current >= g.total;
        const barColor = typeof progressColor === 'function' ? progressColor(perc) : 'var(--income)';

        // Subgoals HTML
        let sgHtml = '';
        if (g.subgoals.length > 0) {
            sgHtml = '<div class="subgoals-section"><h4 style="font-size:14px;margin-bottom:8px;">Submetas</h4>';
            g.subgoals.forEach(sg => {
                const sgPerc = Math.min((sg.current / sg.target) * 100, 100);
                sgHtml += `
                    <div class="subgoal-item">
                        <div class="subgoal-header">
                            <span>${sg.name}</span>
                            <span style="font-size:12px;color:var(--text-muted);">${formatMoney(sg.current)} / ${formatMoney(sg.target)}</span>
                        </div>
                        <div class="progress-bar small"><div class="progress-fill" style="width:${sgPerc}%;background:${typeof progressColor === 'function' ? progressColor(sgPerc) : 'var(--income)'};"></div></div>
                        <div style="display:flex;gap:5px;margin-top:4px;">
                            <button class="btn-small" onclick="toggleContribForm('${g.id}','${sg.id}')">Abonar</button>
                            <button class="btn-small danger" onclick="deleteSubgoal('${g.id}','${sg.id}')">✕</button>
                        </div>
                        ${buildContribForm(g.id, sg.id)}
                    </div>
                `;
            });
            sgHtml += '</div>';
        }

        // Recent contributions
        let contribHtml = '';
        const recentContribs = (g.contributions || []).slice(-5).reverse();
        if (recentContribs.length > 0) {
            contribHtml = '<div class="contributions-section"><h4 style="font-size:14px;margin-bottom:8px;">Últimos Aportes</h4>';
            recentContribs.forEach(c => {
                const typeLabel = c.type === 'commission' ? '💸 ' + (c.source || 'Comisión') : c.type === 'cash' ? '💵 Efectivo' : '🏦 ' + (appData.accounts.find(a => a.id === c.accountId)?.name || 'Digital');
                const sgName = c.subgoalId ? ` → ${g.subgoals.find(s => s.id === c.subgoalId)?.name || ''}` : '';
                contribHtml += `<div class="contribution-item"><span>${formatMoney(c.amount)} ${typeLabel}${sgName}</span><span>${c.date}</span></div>`;
            });
            contribHtml += '</div>';
        }

        // Run-rate calculation
        let runRateHtml = '';
        if (g.deadline && !reached) {
            const today = new Date();
            const deadlineDate = new Date(g.deadline + 'T23:59:59');
            const msLeft = deadlineDate - today;
            const daysLeft = Math.max(Math.ceil(msLeft / 86400000), 1);
            const weeksLeft = Math.max(daysLeft / 7, 0.14);
            const remaining = g.total - g.current;
            const dailyQuota = remaining / daysLeft;
            const weeklyQuota = remaining / weeksLeft;
            const isOverdue = msLeft <= 0;
            runRateHtml = `<div class="runrate-badge ${isOverdue ? 'overdue' : ''}">
                ${isOverdue ? '⚠️ Fecha vencida' : `⏳ ${daysLeft}d restantes`}
                ${!isOverdue ? `· Cuota: <strong>${formatMoney(dailyQuota)}/día</strong> · <strong>${formatMoney(weeklyQuota)}/sem</strong>` : ` · Faltan ${formatMoney(remaining)}`}
            </div>`;
        }

        html += `
            <div class="glass goal-card">
                <div class="budget-header">
                    <h3>🎯 ${g.name} ${reached ? '🏆' : ''}</h3>
                    <div style="color:var(--expense);font-size:14px;cursor:pointer;" onclick="deleteGoal('${g.id}')">Eliminar</div>
                </div>
                <div class="text-muted" style="margin-bottom:6px;">Ahorrado: ${formatMoney(g.current)} / ${formatMoney(g.total)} (${perc.toFixed(0)}%)</div>
                ${g.deadline ? `<div class="text-muted" style="font-size:12px;margin-bottom:6px;">📅 Fecha objetivo: ${g.deadline}</div>` : ''}
                <div class="progress-bar"><div class="progress-fill" style="width:${perc}%;background:${barColor};"></div></div>
                ${runRateHtml}
                ${sgHtml}
                ${contribHtml}
                <div class="goal-actions">
                    <button class="btn-small" onclick="toggleContribForm('${g.id}','')">Abonar</button>
                    <button class="btn-small secondary" onclick="toggleSubgoalForm('${g.id}')">+ Submeta</button>
                </div>
                ${buildContribForm(g.id, '')}
                <div id="sg-form-${g.id}" class="inline-form" style="display:none;">
                    <input type="text" id="sg-name-${g.id}" placeholder="Nombre de submeta">
                    <input type="number" id="sg-target-${g.id}" placeholder="Monto objetivo (MXN)" step="0.01">
                    <button class="btn-primary" style="padding:10px;font-size:14px;" onclick="addSubgoal('${g.id}')">Crear Submeta</button>
                </div>
            </div>
        `;
    });
    document.getElementById('goals-list').innerHTML = html || '<p class="text-muted" style="text-align:center;">No hay metas registradas.</p>';
};
