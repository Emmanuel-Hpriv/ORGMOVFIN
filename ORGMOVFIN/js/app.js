// --- MOTOR DE RESPALDO GOOGLE DRIVE ---
const CLIENT_ID = '855803934299-dc5onqpjplr5k5f5oroaeerb2kd4ag87.apps.googleusercontent.com'; // Pega tu ID aquí, manteniendo las comillas
let tokenClient;
let accessToken = null;

function initGoogleDrive() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (response) => {
            if (response.error !== undefined) throw (response);
            accessToken = response.access_token;
            backupToDrive();
        },
    });
}

function conectarDrive() {
    if (!accessToken) {
        tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
        backupToDrive();
    }
}

async function backupToDrive() {
    if (!accessToken) return;
    const appData = localStorage.getItem('finflow_data');
    if (!appData) return;

    const fileContent = new Blob([appData], { type: 'application/json' });
    const metadata = { name: 'FinFlow_Backup_Automático.json', mimeType: 'application/json' };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', fileContent);

    try {
        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
            body: form,
        });
        if(res.ok) console.log("¡Respaldo exitoso en Google Drive!");
    } catch (error) {
        console.error("Error al subir a Drive", error);
    }
}
// --------------------------------------
// ========================
// FinFlow — Core Application
// ========================

let appData = {
    movements: [],
    debts: [],
    accounts: [],
    goals: [],
    commissions: [],
    reconciliations: [],
    budgets: [],
    categories: {
        expense: ['Comida', 'Transporte', 'Servicios', 'Deuda', 'Ocio', 'Abono Meta', 'Pérdida por Spread', 'Ajuste de Conciliación', 'Otro'],
        income: ['Salario', 'Ventas', 'Ajuste de Conciliación', 'Otro']
    },
    exchangeRates: [],
    gdriveFileId: null
};

// --- Persistence ---
const loadData = () => {
    const saved = localStorage.getItem('finflow_data');
    if (saved) {
        const parsed = JSON.parse(saved);
        appData = { ...appData, ...parsed };
        // Migrations
        if (!appData.accounts) appData.accounts = [];
        if (!appData.goals) appData.goals = [];
        if (!appData.commissions) appData.commissions = [];
        if (!appData.reconciliations) appData.reconciliations = [];
        if (!appData.budgets) appData.budgets = [];
        if (!appData.categories) appData.categories = {
            expense: ['Comida', 'Transporte', 'Servicios', 'Deuda', 'Ocio', 'Abono Meta', 'Pérdida por Spread', 'Ajuste de Conciliación', 'Otro'],
            income: ['Salario', 'Ventas', 'Ajuste de Conciliación', 'Otro']
        };
        // Add new categories if missing
        if (!appData.categories.expense.includes('Pérdida por Spread')) appData.categories.expense.splice(-1, 0, 'Pérdida por Spread');
        if (!appData.categories.expense.includes('Ajuste de Conciliación')) appData.categories.expense.splice(-1, 0, 'Ajuste de Conciliación');
        if (!appData.categories.income.includes('Ajuste de Conciliación')) appData.categories.income.splice(-1, 0, 'Ajuste de Conciliación');
        if (!appData.exchangeRates) {
            appData.exchangeRates = [];
            if (appData.settings && appData.settings.rateUSD) {
                appData.exchangeRates.push({
                    id: 'migration-usd',
                    fromCurrency: 'USD', toCurrency: 'MXN',
                    rate: appData.settings.rateUSD,
                    date: new Date().toISOString().split('T')[0]
                });
            }
            if (appData.settings && appData.settings.rateEUR) {
                appData.exchangeRates.push({
                    id: 'migration-eur',
                    fromCurrency: 'EUR', toCurrency: 'MXN',
                    rate: appData.settings.rateEUR,
                    date: new Date().toISOString().split('T')[0]
                });
            }
        }
        // Migrate goals
        appData.goals.forEach(g => {
            if (!g.subgoals) g.subgoals = [];
            if (!g.contributions) g.contributions = [];
            if (g.deadline === undefined) g.deadline = null;
        });
        // Migrate accounts to have type
        appData.accounts.forEach(a => {
            if (!a.type) a.type = 'digital';
        });
    }
};

const saveData = () => {
    localStorage.setItem('finflow_data', JSON.stringify(appData));
    if (typeof gdriveAutoBackup === 'function') gdriveAutoBackup();
    render();
};

// --- Navigation ---
const switchView = (viewId) => {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${viewId}`).classList.add('active');

    const viewToNavMap = {
        'dashboard': 0, 'commissions': 1, 'add': 2, 'goals': 3,
        'debts': 4, 'summary': 4, 'history': 4, 'config': 4, 'reconciliation': 4
    };
    const navItems = document.querySelectorAll('.nav-item');
    if (viewToNavMap[viewId] !== undefined) {
        navItems[viewToNavMap[viewId]].classList.add('active');
    }

    if (viewId === 'add') {
        document.getElementById('inp-date').valueAsDate = new Date();
        if (typeof initMovementView === 'function') initMovementView();
    }
    if (viewId === 'summary' && typeof updateBudgetCategorySelector === 'function') {
        updateBudgetCategorySelector();
    }

    if (viewId === 'commissions' && typeof initCommissionView === 'function') {
        initCommissionView();
    }

    render();
    window.scrollTo(0, 0);
};
window.switchView = switchView;

const toggleMoreDrawer = () => {
    const d = document.getElementById('more-drawer');
    d.classList.toggle('open');
};
window.toggleMoreDrawer = toggleMoreDrawer;

// --- Helpers ---
const formatMoney = (amount, currency = 'MXN') => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(amount);
};

const getCategoryIcon = (cat) => {
    const icons = {
        'Comida': '🍔', 'Transporte': '🚗', 'Servicios': '💡', 'Deuda': '💳',
        'Ocio': '🎉', 'Salario': '💰', 'Ventas': '📈', 'Abono Meta': '🎯',
        'Otro': '📦', 'Cambio de Divisas': '💱',
        'Pérdida por Spread': '📉', 'Ajuste de Conciliación': '🔄'
    };
    return icons[cat] || '📌';
};

const getLatestRate = (fromCurrency, toCurrency) => {
    if (fromCurrency === toCurrency) return 1;
    const rates = appData.exchangeRates || [];
    // Direct match
    const direct = rates
        .filter(r => r.fromCurrency === fromCurrency && r.toCurrency === toCurrency)
        .sort((a, b) => b.date.localeCompare(a.date));
    if (direct.length > 0) return direct[0].rate;
    // Inverse match
    const inverse = rates
        .filter(r => r.fromCurrency === toCurrency && r.toCurrency === fromCurrency)
        .sort((a, b) => b.date.localeCompare(a.date));
    if (inverse.length > 0) return 1 / inverse[0].rate;
    // Defaults
    const defaults = { 'USD-MXN': 17.0, 'EUR-MXN': 18.5 };
    const key = `${fromCurrency}-${toCurrency}`;
    if (defaults[key]) return defaults[key];
    const reverseKey = `${toCurrency}-${fromCurrency}`;
    if (defaults[reverseKey]) return 1 / defaults[reverseKey];
    return 1;
};

const convertToMXN = (amount, currency) => {
    if (currency === 'MXN') return amount;
    return amount * getLatestRate(currency, 'MXN');
};

// --- Render Movement Item (shared) ---
const renderMovementItem = (mov) => {
    const isInc = mov.type === 'income';
    const isExchange = mov.category === 'Cambio de Divisas';
    let accName = '';
    if (mov.accountId) {
        const acc = appData.accounts.find(a => a.id === mov.accountId);
        if (acc) accName = ` • ${acc.name}`;
    }
    const iconClass = isExchange ? 'exchange' : (isInc ? 'income' : 'expense');
    const amountClass = isInc ? 'income' : 'expense';
    const sign = isInc ? '+' : '-';

    return `
        <div class="glass list-item">
            <div class="item-icon ${iconClass}">${getCategoryIcon(mov.category)}</div>
            <div class="item-info">
                <div class="item-title">${mov.category}</div>
                <div class="item-date">${mov.desc || ''}${accName}</div>
            </div>
            <div class="item-amount ${amountClass}">
                ${sign}${formatMoney(mov.amount, mov.currency)}
            </div>
            <div style="margin-left:10px;color:var(--expense);font-size:18px;cursor:pointer;" onclick="deleteMovement('${mov.id}')">🗑️</div>
        </div>
    `;
};

// --- Delete Movement (global) ---
window.deleteMovement = (id) => {
    if (!confirm('¿Eliminar este movimiento?')) return;
    const mov = appData.movements.find(m => m.id === id);
    if (mov) {
        // Reverse debt payment
        if (mov.debtId) {
            const debt = appData.debts.find(d => d.id === mov.debtId);
            if (debt) { debt.paid -= mov.amount; if (debt.paid < 0) debt.paid = 0; }
        }
        // Reverse goal contribution
        if (mov.goalContribId) {
            const goal = appData.goals.find(g => g.id === mov.goalContribId);
            if (goal) {
                goal.current -= mov.amount;
                if (goal.current < 0) goal.current = 0;
                // Remove contribution record
                goal.contributions = goal.contributions.filter(c => c.movementId !== id);
                // If subgoal contribution
                if (mov.subgoalId) {
                    const sg = goal.subgoals.find(s => s.id === mov.subgoalId);
                    if (sg) { sg.current -= mov.amount; if (sg.current < 0) sg.current = 0; }
                }
            }
        }
        // If exchange, delete paired movement
        if (mov.exchangeId) {
            appData.movements = appData.movements.filter(m => m.exchangeId !== mov.exchangeId);
            appData.exchangeRates = appData.exchangeRates.filter(r => r.id !== mov.exchangeId);
        } else {
            appData.movements = appData.movements.filter(m => m.id !== id);
        }
    }
    saveData();
};

// --- Master Render ---
const render = () => {
    if (typeof renderDashboard === 'function') renderDashboard();
    if (typeof renderHistory === 'function') renderHistory();
    if (typeof renderDebts === 'function') renderDebts();
    if (typeof renderSummary === 'function') renderSummary();
    if (typeof renderCommissions === 'function') renderCommissions();
    if (typeof renderGoals === 'function') renderGoals();
    if (typeof renderReconciliation === 'function') renderReconciliation();
    if (typeof renderConfig === 'function') renderConfig();
};

// --- Init ---
window.onload = () => {
    loadData();
    const now = new Date();
    document.getElementById('inp-date').valueAsDate = now;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    document.getElementById('hist-date-start').valueAsDate = startOfMonth;
    document.getElementById('hist-date-end').valueAsDate = now;
    render();
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW setup failed', err));
    }
};
