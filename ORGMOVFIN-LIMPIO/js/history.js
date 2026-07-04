// ========================
// FinFlow — History Module
// ========================

const renderHistory = () => {
    const start = document.getElementById('hist-date-start').value;
    const end = document.getElementById('hist-date-end').value;

    let filtered = [...appData.movements];
    if (start) filtered = filtered.filter(m => m.date >= start);
    if (end) filtered = filtered.filter(m => m.date <= end);

    // Sort newest first
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Group by date
    const grouped = {};
    filtered.forEach(m => {
        if (!grouped[m.date]) grouped[m.date] = [];
        grouped[m.date].push(m);
    });

    let html = '';
    for (let date in grouped) {
        const dateObj = new Date(date + 'T12:00:00');
        html += `<div class="date-header">${dateObj.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>`;
        html += grouped[date].map(renderMovementItem).join('');
    }

    document.getElementById('history-list').innerHTML = html || '<p class="text-muted" style="text-align:center;">No hay movimientos.</p>';
};
window.renderHistory = renderHistory;
