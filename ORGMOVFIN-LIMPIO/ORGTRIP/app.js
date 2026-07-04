/* ============================================================
   ORGTRIP — app.js  |  Bitácora del Marinero
   ============================================================ */

// ── PWA: Register Service Worker ────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// ── STORAGE ─────────────────────────────────────────────────
const STORE = {
  get entries()  { return JSON.parse(localStorage.getItem('orgtrip_entries') || '[]'); },
  set entries(v) { localStorage.setItem('orgtrip_entries', JSON.stringify(v)); },
  get config()   { return JSON.parse(localStorage.getItem('orgtrip_config')  || '{}'); },
  set config(v)  { localStorage.setItem('orgtrip_config',  JSON.stringify(v)); },
};

const TYPE_META = {
  viaje:    { icon:'🚢', label:'Viaje',     desc:'Día de travesía como marinero activo en el barco.' },
  guardia:  { icon:'🛡️', label:'Guardia',   desc:'Día en tierra con turno de guardia asignado.' },
  puerto:   { icon:'⚓', label:'En Puerto', desc:'Día en puerto sin guardia, disponible o en espera.' },
  descanso: { icon:'🌙', label:'Descanso',  desc:'Día de descanso, sin actividad laboral.' },
};

// ── STATE ────────────────────────────────────────────────────
let selectedType   = 'viaje';
let currentWeekOff = 0;   // weeks offset from current week
let deleteTargetId = null;
let editTargetId   = null;

// ── UTILS ────────────────────────────────────────────────────
function uid()   { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function fmt(n)  { return '$' + Number(n || 0).toFixed(2); }
function fmtDate(iso) {
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function toISO(d) { return d.toISOString().split('T')[0]; }
function today()  { return toISO(new Date()); }

// Monday-based week: returns [mon, tue, wed, thu, fri, sat, sun]
function getWeekDates(offset = 0) {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diffToMon = (day === 0) ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diffToMon + offset * 7);
  return Array.from({length:7}, (_,i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return toISO(d);
  });
}

function weekLabel(dates) {
  const [mon,,,,fri] = dates;
  const [my,mm,md] = mon.split('-');
  const [fy,fm,fd] = fri.split('-');
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${+md} ${months[+mm-1]} — ${+fd} ${months[+fm-1]} ${fy}`;
}

function entriesForDates(dates) {
  const entries = STORE.entries;
  return entries.filter(e => dates.includes(e.date));
}

// ── TOAST ────────────────────────────────────────────────────
function toast(msg, type='') {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ── TABS ─────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${tab}-content`).classList.add('active');
    if (tab === 'semana')   renderWeek();
    if (tab === 'historial') renderHistory();
  });
});

// ── TYPE SELECTOR ─────────────────────────────────────────────
document.querySelectorAll('.type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedType = btn.dataset.type;
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateTypeUI();
  });
});

function updateTypeUI() {
  document.getElementById('typeDescText').textContent = TYPE_META[selectedType].desc;
  const isViaje   = selectedType === 'viaje';
  const isGuardia = selectedType === 'guardia';
  const hasShip   = isViaje || isGuardia;
  document.getElementById('groupDestino').classList.toggle('hidden', !isViaje);
  document.getElementById('groupBarco').classList.toggle('hidden', !hasShip);
  document.getElementById('groupGuardType').classList.toggle('hidden', !isGuardia);

  // Pre-fill income from config
  const cfg = STORE.config;
  const incomeField = document.getElementById('entryIncome');
  if (cfg[selectedType] && !incomeField.dataset.manual) {
    incomeField.value = cfg[selectedType];
  }
}

document.getElementById('entryIncome').addEventListener('input', function() {
  this.dataset.manual = '1';
});

// ── FORM SUBMISSION ───────────────────────────────────────────
document.getElementById('entryDate').value = today();

document.getElementById('btnAddEntry').addEventListener('click', () => {
  const date   = document.getElementById('entryDate').value;
  const income = parseFloat(document.getElementById('entryIncome').value) || 0;
  const notes  = document.getElementById('entryNotes').value.trim();
  const destino = document.getElementById('entryDestino').value.trim();
  const barco   = document.getElementById('entryBarco').value.trim();
  const guardType = document.querySelector('input[name="guardType"]:checked')?.value || 'diurna';

  if (!date) { toast('⚠️ Selecciona una fecha', 'error'); return; }

  const entry = { id: uid(), date, type: selectedType, income, notes };
  if (selectedType === 'viaje')    { entry.destino = destino; entry.barco = barco; }
  if (selectedType === 'guardia')  { entry.barco = barco; entry.guardType = guardType; }

  const entries = STORE.entries;
  entries.unshift(entry);
  STORE.entries = entries;

  // Reset form
  document.getElementById('entryNotes').value  = '';
  document.getElementById('entryDestino').value = '';
  delete document.getElementById('entryIncome').dataset.manual;
  updateTypeUI();

  toast('✅ Jornada registrada', 'success');
  renderEntries();
  renderStats();
});

// ── RENDER ENTRY ROW ──────────────────────────────────────────
function entryHTML(entry, actions=true) {
  const m = TYPE_META[entry.type];
  const sub = entry.destino ? entry.destino
    : entry.barco ? entry.barco
    : entry.guardType ? `Guardia ${entry.guardType}`
    : entry.notes ? entry.notes.slice(0,40)
    : m.label;

  return `
    <div class="entry-row" data-id="${entry.id}">
      <div class="entry-type-dot dot-${entry.type}"></div>
      <div class="entry-icon">${m.icon}</div>
      <div class="entry-info">
        <div class="entry-date">${fmtDate(entry.date)}</div>
        <div class="entry-main">${m.label}${entry.barco ? ' — '+entry.barco : ''}</div>
        <div class="entry-sub">${sub !== m.label ? sub : (entry.notes || '')}</div>
      </div>
      <div class="entry-income">${entry.income > 0 ? fmt(entry.income) : '—'}</div>
      ${actions ? `<div class="entry-actions">
        <button class="entry-btn btn-edit" title="Editar">✏️</button>
        <button class="entry-btn btn-delete" title="Eliminar">🗑️</button>
      </div>` : ''}
    </div>`;
}

function renderEntries() {
  const list = document.getElementById('entriesList');
  const entries = STORE.entries.slice(0, 20);
  if (!entries.length) {
    list.innerHTML = `<div class="empty-state" id="emptyState">
      <div class="empty-icon">🌊</div><p>No hay jornadas registradas aún.</p>
      <p class="empty-sub">¡Registra tu primera salida arriba!</p></div>`;
    return;
  }
  list.innerHTML = entries.map(e => entryHTML(e)).join('');
  attachEntryActions(list);
}

function attachEntryActions(container) {
  container.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteTargetId = btn.closest('.entry-row').dataset.id;
      document.getElementById('deleteModal').classList.remove('hidden');
    });
  });
  container.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      editTargetId = btn.closest('.entry-row').dataset.id;
      openEditModal(editTargetId);
    });
  });
}

// ── STATS ─────────────────────────────────────────────────────
function renderStats() {
  const entries = STORE.entries;
  const dates   = getWeekDates(0);
  const week    = entriesForDates(dates);

  document.getElementById('statTrips').textContent  = entries.filter(e=>e.type==='viaje').length;
  document.getElementById('statGuards').textContent = entries.filter(e=>e.type==='guardia').length;
  document.getElementById('statRest').textContent   = entries.filter(e=>e.type==='descanso').length;

  const weekInc = week.reduce((s,e) => s + (e.income||0), 0);
  document.getElementById('statIncome').textContent = fmt(weekInc);

  // header badge
  const [mon,,,,fri] = dates;
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const [my,mm,md] = mon.split('-');
  const [fy,fm,fd] = fri.split('-');
  document.getElementById('currentWeekBadge').textContent =
    `${+md} ${months[+mm-1]} — ${+fd} ${months[+fm-1]}`;
}

// ── WEEK TAB ──────────────────────────────────────────────────
function renderWeek() {
  const dates  = getWeekDates(currentWeekOff);
  const all    = entriesForDates(dates);

  document.getElementById('weekNavLabel').textContent = weekLabel(dates);
  document.getElementById('weekRangeChip').textContent =
    currentWeekOff === 0 ? 'Semana actual' : (currentWeekOff < 0 ? 'Semana pasada' : 'Semana próxima');

  const sum = { viaje:0, guardia:0, puerto:0, descanso:0 };
  const inc = { viaje:0, guardia:0, puerto:0, descanso:0 };
  all.forEach(e => { sum[e.type]++; inc[e.type] += (e.income||0); });

  document.getElementById('wkTrips').textContent  = sum.viaje;
  document.getElementById('wkGuards').textContent = sum.guardia;
  document.getElementById('wkPuerto').textContent = sum.puerto;
  document.getElementById('wkRest').textContent   = sum.descanso;
  document.getElementById('wkTripsInc').textContent  = fmt(inc.viaje);
  document.getElementById('wkGuardsInc').textContent = fmt(inc.guardia);
  document.getElementById('wkPuertoInc').textContent = fmt(inc.puerto);
  document.getElementById('wkRestInc').textContent   = fmt(inc.descanso);

  const total = Object.values(inc).reduce((a,b)=>a+b,0);
  document.getElementById('wkTotal').textContent = fmt(total);

  // Bar chart
  if (total > 0) {
    ['viaje','guardia','puerto','descanso'].forEach(t => {
      document.getElementById('bar'+t.charAt(0).toUpperCase()+t.slice(1)).style.width =
        ((inc[t]/total)*100).toFixed(1)+'%';
    });
  }

  // Day rows
  const DAY_NAMES = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const todayISO  = today();
  const container = document.getElementById('weekDays');
  container.innerHTML = dates.map((iso, i) => {
    const dayEntries = STORE.entries.filter(e => e.date === iso);
    const dayIncome  = dayEntries.reduce((s,e)=>s+(e.income||0),0);
    const isToday    = iso === todayISO;
    const tags = dayEntries.map(e =>
      `<span class="day-tag day-tag-${e.type}">${TYPE_META[e.type].icon} ${TYPE_META[e.type].label}</span>`
    ).join('') || `<span class="day-empty-dot"></span>`;
    return `<div class="day-row ${isToday?'today':''}">
      <div class="day-name ${isToday?'today-name':''}">${DAY_NAMES[i]}</div>
      <div class="day-date">${fmtDate(iso)}</div>
      <div class="day-entries">${tags}</div>
      ${dayIncome>0 ? `<div class="day-income">${fmt(dayIncome)}</div>` : ''}
    </div>`;
  }).join('');
}

document.getElementById('btnPrevWeek').addEventListener('click', () => { currentWeekOff--; renderWeek(); });
document.getElementById('btnNextWeek').addEventListener('click', () => { currentWeekOff++; renderWeek(); });

// ── HISTORY TAB ───────────────────────────────────────────────
function populateMonthSelect() {
  const entries = STORE.entries;
  const months  = new Set(entries.map(e => e.date.slice(0,7)));
  const now = today().slice(0,7);
  months.add(now);
  const sel = document.getElementById('historyMonth');
  const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                       'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  sel.innerHTML = [...months].sort().reverse().map(m => {
    const [y,mo] = m.split('-');
    return `<option value="${m}" ${m===now?'selected':''}>${MONTH_NAMES[+mo-1]} ${y}</option>`;
  }).join('');
}

function renderHistory() {
  populateMonthSelect();
  const month = document.getElementById('historyMonth').value;
  const type  = document.getElementById('historyType').value;
  let filtered = STORE.entries.filter(e => e.date.startsWith(month));
  if (type !== 'all') filtered = filtered.filter(e => e.type === type);
  filtered.sort((a,b) => b.date.localeCompare(a.date));

  const totalInc = filtered.reduce((s,e)=>s+(e.income||0),0);
  document.getElementById('historyTotalIncome').textContent = fmt(totalInc);

  const list = document.getElementById('historyList');
  list.innerHTML = filtered.length
    ? filtered.map(e => entryHTML(e)).join('')
    : `<div class="empty-state"><div class="empty-icon">📜</div><p>No hay registros.</p></div>`;
  attachEntryActions(list);

  // Weekly bars for the month
  renderMonthlyBars(month);
}

function renderMonthlyBars(month) {
  const entries = STORE.entries.filter(e => e.date.startsWith(month));
  // Group by week (Mon–Fri cutoff)
  const weeks = {};
  entries.forEach(e => {
    const d   = new Date(e.date);
    const day = d.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const mon = new Date(d);
    mon.setDate(d.getDate() + diffToMon);
    const key = toISO(mon);
    if (!weeks[key]) weeks[key] = 0;
    weeks[key] += (e.income||0);
  });

  const keys = Object.keys(weeks).sort();
  const max  = Math.max(...Object.values(weeks), 1);
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  const container = document.getElementById('monthlyBars');
  container.innerHTML = keys.map(k => {
    const [y,m,d] = k.split('-');
    return `<div class="month-bar-row">
      <div class="month-bar-label">${+d}/${months[+m-1]}</div>
      <div class="month-bar-track">
        <div class="month-bar-fill" style="width:${((weeks[k]/max)*100).toFixed(1)}%"></div>
      </div>
      <div class="month-bar-val">${fmt(weeks[k])}</div>
    </div>`;
  }).join('') || '<p style="color:var(--text3);font-size:.8rem;padding:8px">Sin datos</p>';
}

['historyMonth','historyType'].forEach(id =>
  document.getElementById(id).addEventListener('change', renderHistory)
);

// ── DELETE MODAL ──────────────────────────────────────────────
document.getElementById('btnCancelDelete').addEventListener('click', () => {
  document.getElementById('deleteModal').classList.add('hidden');
});
document.getElementById('btnConfirmDelete').addEventListener('click', () => {
  if (!deleteTargetId) return;
  STORE.entries = STORE.entries.filter(e => e.id !== deleteTargetId);
  document.getElementById('deleteModal').classList.add('hidden');
  deleteTargetId = null;
  toast('🗑️ Jornada eliminada');
  renderEntries(); renderStats();
});

// ── EDIT MODAL ────────────────────────────────────────────────
function openEditModal(id) {
  const entry = STORE.entries.find(e => e.id === id);
  if (!entry) return;
  const m = TYPE_META[entry.type];
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group">
      <label class="form-label">Tipo</label>
      <div style="padding:8px;background:var(--bg3);border-radius:8px;font-size:.85rem;">
        ${m.icon} ${m.label}
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Fecha</label>
        <input type="date" id="editDate" class="form-input" value="${entry.date}" />
      </div>
      <div class="form-group">
        <label class="form-label">Ingreso ($)</label>
        <input type="number" id="editIncome" class="form-input" value="${entry.income||''}" step="0.01" />
      </div>
    </div>
    ${entry.destino !== undefined ? `<div class="form-group"><label class="form-label">Destino</label>
      <input type="text" id="editDestino" class="form-input" value="${entry.destino||''}" /></div>` : ''}
    ${entry.barco !== undefined ? `<div class="form-group"><label class="form-label">Barco</label>
      <input type="text" id="editBarco" class="form-input" value="${entry.barco||''}" /></div>` : ''}
    <div class="form-group">
      <label class="form-label">Notas</label>
      <textarea id="editNotes" class="form-input form-textarea">${entry.notes||''}</textarea>
    </div>
    <button class="btn-primary" id="btnSaveEdit">💾 Guardar cambios</button>`;

  document.getElementById('editModal').classList.remove('hidden');

  document.getElementById('btnSaveEdit').addEventListener('click', () => {
    const entries = STORE.entries;
    const idx = entries.findIndex(e => e.id === id);
    if (idx === -1) return;
    entries[idx].date   = document.getElementById('editDate').value;
    entries[idx].income = parseFloat(document.getElementById('editIncome').value)||0;
    entries[idx].notes  = document.getElementById('editNotes').value.trim();
    if (document.getElementById('editDestino')) entries[idx].destino = document.getElementById('editDestino').value.trim();
    if (document.getElementById('editBarco'))   entries[idx].barco   = document.getElementById('editBarco').value.trim();
    STORE.entries = entries;
    document.getElementById('editModal').classList.add('hidden');
    toast('✅ Jornada actualizada', 'success');
    renderEntries(); renderStats();
  });
}

document.getElementById('btnCloseModal').addEventListener('click', () => {
  document.getElementById('editModal').classList.add('hidden');
});

// ── CONFIG ────────────────────────────────────────────────────
function loadConfig() {
  const cfg = STORE.config;
  ['Viaje','Guardia','Puerto','Descanso'].forEach(k => {
    const el = document.getElementById('cfg'+k);
    if (el && cfg[k.toLowerCase()]) el.value = cfg[k.toLowerCase()];
  });
  if (cfg.name) document.getElementById('cfgName').value = cfg.name;
}

document.getElementById('btnSaveConfig').addEventListener('click', () => {
  const cfg = STORE.config;
  ['Viaje','Guardia','Puerto','Descanso'].forEach(k => {
    const val = parseFloat(document.getElementById('cfg'+k).value);
    if (!isNaN(val)) cfg[k.toLowerCase()] = val;
  });
  STORE.config = cfg;
  const msg = document.getElementById('configSaved');
  msg.classList.remove('hidden');
  setTimeout(() => msg.classList.add('hidden'), 2500);
});

document.getElementById('btnSaveName').addEventListener('click', () => {
  const cfg  = STORE.config;
  cfg.name   = document.getElementById('cfgName').value.trim();
  STORE.config = cfg;
  toast('👤 Nombre guardado', 'success');
});

// ── EXPORT / IMPORT / CLEAR ───────────────────────────────────
document.getElementById('btnExport').addEventListener('click', () => {
  const data = { entries: STORE.entries, config: STORE.config, exported: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `orgtrip_${today()}.json`;
  a.click();
  toast('📤 Datos exportados', 'success');
});

document.getElementById('btnImport').addEventListener('click', () => {
  document.getElementById('importFile').click();
});
document.getElementById('importFile').addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (data.entries) STORE.entries = data.entries;
      if (data.config)  STORE.config  = data.config;
      toast('📥 Datos importados', 'success');
      init();
    } catch { toast('❌ Archivo inválido', 'error'); }
  };
  reader.readAsText(file);
  e.target.value = '';
});

document.getElementById('btnClearAll').addEventListener('click', () => {
  if (confirm('¿Borrar TODOS los datos? Esta acción es irreversible.')) {
    localStorage.removeItem('orgtrip_entries');
    localStorage.removeItem('orgtrip_config');
    toast('🗑️ Todos los datos borrados', 'error');
    init();
  }
});

// ── INIT ──────────────────────────────────────────────────────
function init() {
  updateTypeUI();
  renderEntries();
  renderStats();
  loadConfig();
}

document.addEventListener('DOMContentLoaded', init);
