// ========================
// FinFlow — Config Module (No Exchange Rate Section)
// ========================

const createAccount = () => {
    const name = document.getElementById('inp-account-name').value;
    const type = document.getElementById('inp-account-type')?.value || 'digital';
    if (!name) return;
    appData.accounts.push({ id: Date.now().toString(), name, type });
    saveData();
    document.getElementById('inp-account-name').value = '';
};
window.createAccount = createAccount;

const deleteAccount = (id) => {
    if (confirm('¿Eliminar cuenta?')) {
        appData.accounts = appData.accounts.filter(a => a.id !== id);
        saveData();
    }
};
window.deleteAccount = deleteAccount;

const addCategory = () => {
    const name = document.getElementById('inp-new-category').value.trim();
    const type = document.getElementById('inp-new-cat-type').value;
    if (!name) return;
    if (!appData.categories[type].includes(name)) {
        appData.categories[type].push(name);
        saveData();
    }
    document.getElementById('inp-new-category').value = '';
};
window.addCategory = addCategory;

const deleteCategory = (type, name) => {
    if (confirm(`¿Eliminar categoría ${name}?`)) {
        appData.categories[type] = appData.categories[type].filter(c => c !== name);
        saveData();
    }
};
window.deleteCategory = deleteCategory;

// --- JSON Import/Export ---
const exportData = () => {
    const dataStr = JSON.stringify(appData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finflow_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
};
window.exportData = exportData;

const importData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const parsed = JSON.parse(event.target.result);
            appData = { ...appData, ...parsed };
            // Re-run migrations
            if (!appData.exchangeRates) appData.exchangeRates = [];
            if (!appData.commissions) appData.commissions = [];
            if (!appData.reconciliations) appData.reconciliations = [];
            appData.goals.forEach(g => {
                if (!g.subgoals) g.subgoals = [];
                if (!g.contributions) g.contributions = [];
                if (g.deadline === undefined) g.deadline = null;
            });
            appData.accounts.forEach(a => { if (!a.type) a.type = 'digital'; });
            saveData();
            alert('Datos importados con éxito.');
        } catch (err) {
            alert('Error leyendo el archivo JSON.');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
};
window.importData = importData;

const clearAllData = () => {
    if (confirm('¡ADVERTENCIA! Vas a borrar TODOS los datos permanentemente. ¿Estás seguro?')) {
        if (confirm('¿Completamente seguro?')) {
            localStorage.removeItem('finflow_data');
            location.reload();
        }
    }
};
window.clearAllData = clearAllData;

// --- Render Config ---
const renderConfig = () => {
    // Accounts list
    let accHtml = '';
    appData.accounts.forEach(a => {
        const typeIcon = a.type === 'physical' ? '💵' : '🏦';
        accHtml += `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--surface-border);"><span>${typeIcon} ${a.name} <span class="text-muted" style="font-size:11px;">(${a.type === 'physical' ? 'Física' : 'Digital'})</span></span><span style="color:var(--expense);cursor:pointer;" onclick="deleteAccount('${a.id}')">✕</span></div>`;
    });
    document.getElementById('accounts-list').innerHTML = accHtml || '<p class="text-muted">Sin cuentas.</p>';

    // Categories list
    let cfgCatHtml = '<h3 style="font-size:14px;margin-top:10px;">Gastos</h3>';
    appData.categories.expense.forEach(c => {
        cfgCatHtml += `<div style="display:flex;justify-content:space-between;padding:5px 0;"><span>${c}</span><span style="color:var(--expense);cursor:pointer;" onclick="deleteCategory('expense','${c}')">✕</span></div>`;
    });
    cfgCatHtml += '<h3 style="font-size:14px;margin-top:10px;">Ingresos</h3>';
    appData.categories.income.forEach(c => {
        cfgCatHtml += `<div style="display:flex;justify-content:space-between;padding:5px 0;"><span>${c}</span><span style="color:var(--expense);cursor:pointer;" onclick="deleteCategory('income','${c}')">✕</span></div>`;
    });
    document.getElementById('categories-list').innerHTML = cfgCatHtml;

    // GDrive status
    const statusEl = document.getElementById('gdrive-status');
    if (statusEl) {
        if (gdriveToken) {
            statusEl.innerHTML = '<div class="trend-badge up">✅ Conectado a Google Drive</div>';
            document.getElementById('btn-gdrive-connect').style.display = 'none';
            document.getElementById('btn-gdrive-backup').style.display = 'block';
            document.getElementById('btn-gdrive-restore').style.display = 'block';
        } else {
            statusEl.innerHTML = '<div class="text-muted">❌ No conectado</div>';
            document.getElementById('btn-gdrive-connect').style.display = 'block';
            document.getElementById('btn-gdrive-backup').style.display = 'none';
            document.getElementById('btn-gdrive-restore').style.display = 'none';
        }
    }
};

// ========================
// Google Drive Backup
// ========================
const GDRIVE_CLIENT_ID = ''; // USER MUST SET THIS
const GDRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
let gdriveToken = null;
let gdriveBackupTimer = null;

const gdriveSignIn = () => {
    if (!GDRIVE_CLIENT_ID) {
        alert('Configura tu CLIENT_ID de Google Cloud en js/config.js (línea GDRIVE_CLIENT_ID).');
        return;
    }
    if (typeof google === 'undefined' || !google.accounts) {
        alert('La librería de Google Identity no se cargó. Verifica tu conexión a internet.');
        return;
    }
    const client = google.accounts.oauth2.initTokenClient({
        client_id: GDRIVE_CLIENT_ID,
        scope: GDRIVE_SCOPES,
        callback: (resp) => {
            if (resp.access_token) {
                gdriveToken = resp.access_token;
                renderConfig();
                alert('¡Conectado a Google Drive!');
            }
        }
    });
    client.requestAccessToken();
};
window.gdriveSignIn = gdriveSignIn;

const gdriveBackupNow = async () => {
    if (!gdriveToken) return alert('Conecta Google Drive primero.');
    const data = JSON.stringify(appData, null, 2);
    const metadata = { name: 'finflow_backup.json', parents: ['appDataFolder'] };

    try {
        // Check if file exists
        const listRes = await fetch('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D%27finflow_backup.json%27', {
            headers: { Authorization: `Bearer ${gdriveToken}` }
        });
        const listData = await listRes.json();
        const existingId = listData.files && listData.files.length > 0 ? listData.files[0].id : null;

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(existingId ? { name: 'finflow_backup.json' } : metadata)], { type: 'application/json' }));
        form.append('file', new Blob([data], { type: 'application/json' }));

        const url = existingId
            ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`
            : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

        const res = await fetch(url, {
            method: existingId ? 'PATCH' : 'POST',
            headers: { Authorization: `Bearer ${gdriveToken}` },
            body: form
        });
        if (res.ok) {
            const result = await res.json();
            appData.gdriveFileId = result.id;
            localStorage.setItem('finflow_data', JSON.stringify(appData));
            console.log('GDrive backup OK:', result.id);
        }
    } catch (e) { console.error('GDrive backup error:', e); }
};
window.gdriveBackupNow = gdriveBackupNow;

const gdriveRestore = async () => {
    if (!gdriveToken) return alert('Conecta Google Drive primero.');
    try {
        const listRes = await fetch('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D%27finflow_backup.json%27', {
            headers: { Authorization: `Bearer ${gdriveToken}` }
        });
        const listData = await listRes.json();
        if (!listData.files || listData.files.length === 0) return alert('No se encontró respaldo en Drive.');

        const fileId = listData.files[0].id;
        const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { Authorization: `Bearer ${gdriveToken}` }
        });
        const parsed = await fileRes.json();
        appData = { ...appData, ...parsed };
        saveData();
        alert('¡Datos restaurados desde Google Drive!');
    } catch (e) { alert('Error al restaurar: ' + e.message); }
};
window.gdriveRestore = gdriveRestore;

// Auto-backup (debounced, every 30s after last save)
const gdriveAutoBackup = () => {
    if (!gdriveToken || !navigator.onLine) return;
    clearTimeout(gdriveBackupTimer);
    gdriveBackupTimer = setTimeout(() => gdriveBackupNow(), 30000);
};
window.gdriveAutoBackup = gdriveAutoBackup;
