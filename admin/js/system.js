/* System Admin Console - JS */

let CURRENT_USER = null;
let STATE = { officeFilter: 'all', requests: [] };

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    credentials: 'include',
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function loadMe() {
  try {
    const { user } = await api('/api/auth/me');
    if (user.role !== 'system_admin') {
      window.location.href = '/admin/office';
      return;
    }
    CURRENT_USER = user;
    document.getElementById('userName').textContent = user.name;
    document.getElementById('userAvatar').textContent = (user.name || 'A')[0].toUpperCase();
  } catch {
    window.location.href = '/admin';
  }
}

async function doLogout() {
  await api('/api/auth/logout', { method: 'POST' });
  window.location.href = '/admin';
}

function showTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('is-active', t.dataset.tab === name));
  document.querySelectorAll('.sb-link').forEach(l => l.classList.toggle('is-active', l.dataset.tab === name));
  if (name === 'overview') loadOverview();
  if (name === 'users') loadUsers();
  if (name === 'all-requests') loadAllRequests();
  if (name === 'announcements') loadAnnouncements();
  if (name === 'mission') loadMission();
  if (name === 'floor-plan') loadFloorPlan();
}

// ============ OVERVIEW ============
async function loadOverview() {
  try {
    const { stats } = await api('/api/admin/stats');
    document.getElementById('overviewStats').innerHTML = `
      <div class="stat-card" style="--accent:#FB8C00">
        <div class="stat-card-label">Pending</div>
        <div class="stat-card-num">${stats.pending}</div>
        <div class="stat-card-foot">Across all offices</div>
      </div>
      <div class="stat-card" style="--accent:#1E88E5">
        <div class="stat-card-label">Processing</div>
        <div class="stat-card-num">${stats.processing}</div>
        <div class="stat-card-foot">In progress</div>
      </div>
      <div class="stat-card" style="--accent:#FFC107">
        <div class="stat-card-label">Ready</div>
        <div class="stat-card-num">${stats.ready}</div>
        <div class="stat-card-foot">Awaiting pickup</div>
      </div>
      <div class="stat-card" style="--accent:#2EA043">
        <div class="stat-card-label">Released Today</div>
        <div class="stat-card-num">${stats.released_today}</div>
        <div class="stat-card-foot">Across all offices</div>
      </div>
      <div class="stat-card" style="--accent:#0E5732">
        <div class="stat-card-label">Revenue Today</div>
        <div class="stat-card-num">PHP ${stats.revenue_today.toFixed(2)}</div>
        <div class="stat-card-foot">From paid requests</div>
      </div>
    `;

    // Per-office breakdown
    const offices = [
      { id: 'registrar', name: 'Registrar', color: '#0E5732' },
      { id: 'cashier', name: 'Cashier', color: '#E53935' },
      { id: 'osas', name: 'OSAS', color: '#1E88E5' },
    ];
    const breakdown = await Promise.all(offices.map(async (o) => {
      const { requests } = await api(`/api/admin/requests?office_id=${o.id}`);
      return {
        ...o,
        total: requests.length,
        pending: requests.filter(r => r.status === 'pending').length,
        processing: requests.filter(r => r.status === 'processing').length,
        ready: requests.filter(r => r.status === 'ready').length,
        released: requests.filter(r => r.status === 'released').length,
      };
    }));
    document.getElementById('officeStats').innerHTML = breakdown.map(o => `
      <div class="office-stat" style="--accent:${o.color}">
        <div class="office-stat-name">${o.name}</div>
        <div class="office-stat-row"><span>Total Requests</span><span>${o.total}</span></div>
        <div class="office-stat-row"><span>Pending</span><span>${o.pending}</span></div>
        <div class="office-stat-row"><span>Processing</span><span>${o.processing}</span></div>
        <div class="office-stat-row"><span>Ready</span><span>${o.ready}</span></div>
        <div class="office-stat-row"><span>Released</span><span>${o.released}</span></div>
      </div>
    `).join('');
  } catch (e) { toast(e.message, 'error'); }
}

// ============ USERS ============
async function loadUsers() {
  try {
    const { users } = await api('/api/admin/users');
    document.getElementById('usersTable').innerHTML = users.map(u => `
      <tr>
        <td><span class="ref-mono">${escapeHtml(u.username)}</span></td>
        <td><div class="student-name">${escapeHtml(u.name)}</div></td>
        <td>${u.role === 'system_admin' ? '<span class="pill pill--system">System</span>' : '<span class="pill pill--office">Office</span>'}</td>
        <td>${u.office_id ? escapeHtml(u.office_id) : '-'}</td>
        <td>${u.active ? '<span class="pill pill--active">Active</span>' : '<span class="pill pill--inactive">Inactive</span>'}</td>
        <td>
          <button class="btn-text" onclick="toggleUserActive(${u.id}, ${u.active ? 0 : 1})">
            ${u.active ? 'Deactivate' : 'Activate'}
          </button>
        </td>
      </tr>
    `).join('');
  } catch (e) { toast(e.message, 'error'); }
}

async function toggleUserActive(id, newActive) {
  try {
    await api(`/api/admin/users/${id}`, { method: 'PATCH', body: { active: newActive } });
    toast('User updated.', 'success');
    loadUsers();
  } catch (e) { toast(e.message, 'error'); }
}

function openUserModal() {
  document.getElementById('userFullName').value = '';
  document.getElementById('userUsername').value = '';
  document.getElementById('userPassword').value = '';
  document.getElementById('userRoleSelect').value = 'office_admin';
  document.getElementById('userOffice').value = 'registrar';
  toggleOfficeField();
  document.getElementById('userModal').classList.add('is-open');
}
function closeUserModal() { document.getElementById('userModal').classList.remove('is-open'); }

function toggleOfficeField() {
  const role = document.getElementById('userRoleSelect').value;
  document.getElementById('officeFieldWrap').style.display = role === 'office_admin' ? 'block' : 'none';
}

async function saveUser() {
  const body = {
    name: document.getElementById('userFullName').value.trim(),
    username: document.getElementById('userUsername').value.trim(),
    password: document.getElementById('userPassword').value,
    role: document.getElementById('userRoleSelect').value,
    office_id: document.getElementById('userOffice').value,
  };
  if (!body.name || !body.username || !body.password) return toast('All fields are required.', 'error');
  try {
    await api('/api/admin/users', { method: 'POST', body });
    toast('User created.', 'success');
    closeUserModal();
    loadUsers();
  } catch (e) { toast(e.message, 'error'); }
}

// ============ ALL REQUESTS ============
async function loadAllRequests() {
  try {
    const office = STATE.officeFilter;
    const qs = office === 'all' ? '' : `?office_id=${office}`;
    const { requests } = await api('/api/admin/requests' + qs);
    STATE.requests = requests;
    renderAllRequests();
  } catch (e) { toast(e.message, 'error'); }
}

function filterByOffice(office) {
  STATE.officeFilter = office;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.toggle('is-active', c.dataset.officef === office));
  loadAllRequests();
}

function renderAllRequests() {
  document.getElementById('allRequestsTable').innerHTML = STATE.requests.map(r => `
    <tr>
      <td><span class="ref-mono">${r.ref_number}</span></td>
      <td>${escapeHtml(officeLabel(r.office_id))}</td>
      <td>
        <div class="student-name">${escapeHtml(r.student_name)}</div>
        ${r.student_id ? `<div class="student-id">${r.student_id}</div>` : ''}
      </td>
      <td>${escapeHtml(r.document_name)}</td>
      <td><span class="fee">PHP ${r.fee}</span></td>
      <td><span class="pill pill--${r.status}">${r.status}</span></td>
      <td>${formatDate(r.created_at)}</td>
    </tr>
  `).join('') || '<tr><td colspan="7" class="empty">No requests found.</td></tr>';
}

function officeLabel(id) {
  return ({ registrar: 'Registrar', cashier: 'Cashier', osas: 'OSAS' })[id] || id || '-';
}

// ============ ANNOUNCEMENTS ============
let editingAnnId = null;
async function loadAnnouncements() {
  try {
    const { announcements } = await api('/api/admin/announcements');
    window._allAnns = announcements;
    const grid = document.getElementById('annGrid');
    if (!announcements.length) {
      grid.innerHTML = '<div class="empty">No announcements yet.</div>';
      return;
    }
    grid.innerHTML = announcements.map(a => `
      <div class="ann-card ${a.featured ? 'is-featured' : ''}">
        <span class="ann-card-tag tag--${a.type}">${a.type}</span>
        <h3>${escapeHtml(a.title)}</h3>
        <p>${escapeHtml(a.body)}</p>
        <div class="ann-card-foot">
          <div class="ann-card-foot-meta">${escapeHtml(a.date_text || '')} . ${escapeHtml(a.author || '')}</div>
          <div class="ann-card-foot-actions">
            <button class="icon-btn" onclick="editAnnouncement(${a.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="icon-btn icon-btn--danger" onclick="deleteAnnouncement(${a.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      </div>
    `).join('');
  } catch (e) { toast(e.message, 'error'); }
}

function openAnnouncementModal() {
  editingAnnId = null;
  document.getElementById('annModalTitle').textContent = 'New Announcement';
  document.getElementById('annType').value = 'news';
  document.getElementById('annTitle').value = '';
  document.getElementById('annBody').value = '';
  document.getElementById('annDate').value = '';
  document.getElementById('annFeatured').checked = false;
  document.getElementById('annModal').classList.add('is-open');
}
function editAnnouncement(id) {
  const a = (window._allAnns || []).find(x => x.id === id);
  if (!a) return;
  editingAnnId = id;
  document.getElementById('annModalTitle').textContent = 'Edit Announcement';
  document.getElementById('annType').value = a.type;
  document.getElementById('annTitle').value = a.title;
  document.getElementById('annBody').value = a.body;
  document.getElementById('annDate').value = a.date_text || '';
  document.getElementById('annFeatured').checked = !!a.featured;
  document.getElementById('annModal').classList.add('is-open');
}
function closeAnnModal() { document.getElementById('annModal').classList.remove('is-open'); }

async function saveAnnouncement() {
  const body = {
    type: document.getElementById('annType').value,
    title: document.getElementById('annTitle').value.trim(),
    body: document.getElementById('annBody').value.trim(),
    date_text: document.getElementById('annDate').value.trim(),
    featured: document.getElementById('annFeatured').checked,
  };
  if (!body.title || !body.body) return toast('Title and body are required.', 'error');
  try {
    if (editingAnnId) await api(`/api/admin/announcements/${editingAnnId}`, { method: 'PATCH', body });
    else await api('/api/admin/announcements', { method: 'POST', body });
    toast('Announcement saved.', 'success');
    closeAnnModal();
    loadAnnouncements();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteAnnouncement(id) {
  if (!confirm('Delete this announcement?')) return;
  try {
    await api(`/api/admin/announcements/${id}`, { method: 'DELETE' });
    toast('Deleted.', 'success');
    loadAnnouncements();
  } catch (e) { toast(e.message, 'error'); }
}

// ============ FLOOR PLAN ============
let FP_DATA = null;
let FP_PREVIEW_FLOOR = 'ground';

const FP_TYPE_COLORS = {
  admin:    { fill: '#1A4F2F', stroke: '#FFD24D', text: '#FFFFFF' },
  academic: { fill: '#143B26', stroke: '#3D7A5A', text: '#E4F0E8' },
  lab:      { fill: '#1B3A5C', stroke: '#4A82C9', text: '#E5EFF9' },
  library:  { fill: '#3A2A5C', stroke: '#8C6BD0', text: '#EDE5F9' },
  support:  { fill: '#3F3024', stroke: '#7C6048', text: '#EFE5DC' },
  service:  { fill: '#262626', stroke: '#5A5A5A', text: '#B0B0B0' },
  public:   { fill: '#1A2D40', stroke: '#3D6080', text: '#D8E5F0' },
  gate:     { fill: '#FFD24D', stroke: '#E0A91E', text: '#0E2A1A' },
};

async function loadFloorPlan() {
  try {
    const { floors } = await api('/api/public/floor-plan');
    if (floors) {
      FP_DATA = floors;
    } else {
      // Fall back: fetch defaults from kiosk source. For simplicity, use a minimal shell.
      FP_DATA = await loadDefaultFloorPlan();
    }
    document.getElementById('fpEditor').value = JSON.stringify(FP_DATA, null, 2);
    setFpStatus('Loaded current floor plan.', 'ok');
    renderFpPreview();
  } catch (e) {
    toast('Failed to load floor plan: ' + e.message, 'error');
  }
}

async function loadDefaultFloorPlan() {
  // The kiosk holds the defaults. We load app.js text and extract DEFAULT_FLOORS via a clever parse.
  // Simpler: fetch the default by re-fetching after delete (server returns null then we use a stub).
  // For convenience, we ship a built-in copy of the same defaults here.
  const res = await fetch('/js/app.js');
  const src = await res.text();
  const m = src.match(/const DEFAULT_FLOORS = (\{[\s\S]+?\n\});/);
  if (!m) return { ground: { name: 'Ground', rooms: [] }, second: { name: 'Second', rooms: [] } };
  try {
    return Function('"use strict"; return (' + m[1] + ')')();
  } catch {
    return { ground: { name: 'Ground', rooms: [] }, second: { name: 'Second', rooms: [] } };
  }
}

function setFpStatus(msg, kind) {
  const el = document.getElementById('fpStatus');
  el.textContent = msg;
  el.className = 'fp-status' + (kind === 'ok' ? ' is-ok' : kind === 'error' ? ' is-error' : '');
}

function switchPreviewFloor(floor) {
  FP_PREVIEW_FLOOR = floor;
  document.querySelectorAll('.fp-preview-wrap .floor-btn').forEach(b => b.classList.toggle('is-active', b.dataset.floor === floor));
  renderFpPreview();
}

function validateFloorPlan() {
  const text = document.getElementById('fpEditor').value;
  try {
    const parsed = JSON.parse(text);
    if (!parsed.ground || !parsed.second) throw new Error('Missing ground or second floor.');
    if (!Array.isArray(parsed.ground.rooms) || !Array.isArray(parsed.second.rooms)) throw new Error('Each floor needs a rooms array.');
    FP_DATA = parsed;
    setFpStatus('Valid JSON. ' + parsed.ground.rooms.length + ' ground rooms, ' + parsed.second.rooms.length + ' second rooms.', 'ok');
    renderFpPreview();
    return true;
  } catch (e) {
    setFpStatus('Invalid: ' + e.message, 'error');
    return false;
  }
}

async function saveFloorPlan() {
  if (!validateFloorPlan()) {
    toast('Fix validation errors before saving.', 'error');
    return;
  }
  try {
    await api('/api/admin/floor-plan', { method: 'PUT', body: { floors: FP_DATA } });
    toast('Floor plan saved. Kiosk will use the new layout on next refresh.', 'success');
    setFpStatus('Saved. The kiosk picks this up automatically on next map view.', 'ok');
  } catch (e) {
    toast('Save failed: ' + e.message, 'error');
  }
}

async function resetFloorPlan() {
  if (!confirm('Reset to the default floor plan? Any custom changes you saved will be lost.')) return;
  try {
    await api('/api/admin/floor-plan', { method: 'DELETE' });
    FP_DATA = await loadDefaultFloorPlan();
    document.getElementById('fpEditor').value = JSON.stringify(FP_DATA, null, 2);
    setFpStatus('Reset to default.', 'ok');
    renderFpPreview();
    toast('Reset to default floor plan.', 'success');
  } catch (e) {
    toast('Reset failed: ' + e.message, 'error');
  }
}

function renderFpPreview() {
  if (!FP_DATA) return;
  const floor = FP_DATA[FP_PREVIEW_FLOOR];
  if (!floor) return;
  const svg = document.getElementById('fpPreview');
  const parts = [`<rect width="1210" height="620" fill="#0A1A12"/>`];
  parts.push(`<defs><pattern id="fpEdGrid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1"/></pattern>
  <pattern id="fpEdFloor" x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="#0F2418"/><path d="M 14 0 L 0 0 0 14" fill="none" stroke="rgba(255,255,255,0.025)" stroke-width="1"/></pattern></defs>`);
  parts.push(`<rect width="1210" height="620" fill="url(#fpEdGrid)"/>`);
  if (floor.outline) parts.push(`<path d="${floor.outline}" fill="url(#fpEdFloor)" stroke="rgba(255,210,77,0.4)" stroke-width="2.5"/>`);
  if (Array.isArray(floor.hallways)) {
    for (const h of floor.hallways) {
      parts.push(`<rect x="${h.x}" y="${h.y}" width="${h.w}" height="${h.h}" fill="rgba(255,255,255,0.04)"/>`);
    }
  }
  for (const r of floor.rooms || []) {
    const c = FP_TYPE_COLORS[r.type] || FP_TYPE_COLORS.support;
    const stroke = r.isKiosk ? '#FFD24D' : c.stroke;
    const sw = r.isKiosk ? 3 : 1.5;
    parts.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="3" fill="${c.fill}" stroke="${stroke}" stroke-width="${sw}"/>`);
    const label = r.label || r.shortName || r.name || '';
    if (label) {
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const fs = r.w >= 150 ? 12 : (r.w >= 80 ? 10 : 8);
      parts.push(`<text x="${cx}" y="${cy + fs/3}" text-anchor="middle" fill="${c.text}" font-size="${fs}" font-weight="600">${escapeHtml(label)}</text>`);
    }
    if (r.isKiosk) parts.push(`<circle cx="${r.x + r.w - 10}" cy="${r.y + 10}" r="5" fill="#FFD24D"/>`);
  }
  svg.innerHTML = parts.join('');
}

// Auto-validate on textarea change
document.addEventListener('input', e => {
  if (e.target && e.target.id === 'fpEditor') {
    try {
      FP_DATA = JSON.parse(e.target.value);
      setFpStatus('Live preview updated. Click Save to apply on the kiosk.', 'ok');
      renderFpPreview();
    } catch (err) {
      setFpStatus('Invalid JSON: ' + err.message, 'error');
    }
  }
});

// ============ MISSION ============
async function loadMission() {
  try {
    const { mission } = await api('/api/public/mission');
    if (mission) {
      document.getElementById('mvVision').value = mission.vision || '';
      document.getElementById('mvMission').value = mission.mission || '';
      document.getElementById('mvValues').value = mission.core_values || '';
    }
  } catch (e) { toast(e.message, 'error'); }
}

async function saveMission() {
  const body = {
    vision: document.getElementById('mvVision').value,
    mission: document.getElementById('mvMission').value,
    core_values: document.getElementById('mvValues').value,
  };
  try {
    await api('/api/admin/mission', { method: 'PATCH', body });
    toast('Mission and Vision updated.', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

// ============ HELPERS ============
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function formatDate(dateStr) {
  if (!dateStr) return '-';
  try { return new Date(dateStr).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return dateStr; }
}

let toastTimer = null;
function toast(msg, kind = 'ok') {
  const t = document.getElementById('adminToast');
  t.textContent = msg;
  t.className = 'toast' + (kind === 'error' ? ' toast--error' : kind === 'success' ? ' toast--success' : '');
  requestAnimationFrame(() => t.classList.add('is-show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-show'), 2800);
}

function tickClock() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  document.getElementById('liveClock').textContent = `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`;
}

window.addEventListener('DOMContentLoaded', async () => {
  await loadMe();
  tickClock();
  setInterval(tickClock, 30000);
  loadOverview();

  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('is-open'); });
  });
});
