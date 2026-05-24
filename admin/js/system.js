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
