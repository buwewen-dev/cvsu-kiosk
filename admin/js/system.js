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
  if (name === 'inquiries') loadInquiries();
  if (name === 'capacity') loadCapacity();
  if (name === 'announcements') loadAnnouncements();
  if (name === 'mission') loadMission();
  if (name === 'floor-plan') loadFloorPlan();
}

// ============ INQUIRIES (system admin: sees all) ============
let INQ_FILTER = 'all';
let INQ_DATA = [];

async function loadInquiries() {
  try {
    const { inquiries } = await api('/api/admin/inquiries');
    INQ_DATA = inquiries;
    renderInquiryList();
  } catch (e) { toast(e.message, 'error'); }
}

function filterInquiries(f) {
  INQ_FILTER = f;
  document.querySelectorAll('.filter-chip[data-inqf]').forEach(c => c.classList.toggle('is-active', c.dataset.inqf === f));
  renderInquiryList();
}

function renderInquiryList() {
  const filtered = INQ_FILTER === 'all' ? INQ_DATA : INQ_DATA.filter(i => i.status === INQ_FILTER);
  const list = document.getElementById('inquiryList');
  const empty = document.getElementById('inquiriesEmpty');
  if (!filtered.length) { list.innerHTML = ''; empty.hidden = false; return; }
  empty.hidden = true;
  list.innerHTML = filtered.map(i => `
    <div class="inquiry-item" onclick="openInquiry(${i.id})">
      <div class="inquiry-head">
        <div class="inquiry-from">
          <span class="inquiry-name">${escapeHtml(i.student_name || 'Anonymous')}</span>
          ${i.student_id ? `<span class="inquiry-id">${escapeHtml(i.student_id)}</span>` : ''}
          ${i.office_id ? `<span class="pill pill--office">${escapeHtml(i.office_id)}</span>` : '<span class="pill pill--inactive">General</span>'}
        </div>
        <span class="pill pill--${i.status === 'replied' ? 'released' : 'pending'}">${i.status}</span>
      </div>
      <div class="inquiry-q">${escapeHtml(i.question)}</div>
      <div class="inquiry-meta">
        <span>${i.student_email ? '<b>Reply to:</b> ' + escapeHtml(i.student_email) : 'No email provided'}</span>
        <span>${formatDate(i.created_at)}</span>
      </div>
    </div>
  `).join('');
}

function openInquiry(id) {
  const inq = INQ_DATA.find(x => x.id === id);
  if (!inq) return;
  document.getElementById('inquiryModalBody').innerHTML = `
    <div class="modal-head">
      <h3>Inquiry from ${escapeHtml(inq.student_name || 'student')}</h3>
      <button class="modal-close" onclick="closeInquiry()">&times;</button>
    </div>
    <div class="modal-body">
      <div class="inquiry-grid">
        <div><span class="req-detail-label">Student</span><span class="req-detail-value">${escapeHtml(inq.student_name || 'Anonymous')}</span></div>
        <div><span class="req-detail-label">Student ID</span><span class="req-detail-value">${escapeHtml(inq.student_id || '-')}</span></div>
        <div><span class="req-detail-label">Email</span><span class="req-detail-value"><a href="mailto:${escapeHtml(inq.student_email || '')}">${escapeHtml(inq.student_email || '-')}</a></span></div>
        <div><span class="req-detail-label">Office</span><span class="req-detail-value">${escapeHtml(inq.office_id || 'General')}</span></div>
        <div><span class="req-detail-label">Submitted</span><span class="req-detail-value">${formatDate(inq.created_at)}</span></div>
        <div><span class="req-detail-label">Status</span><span class="req-detail-value"><span class="pill pill--${inq.status === 'replied' ? 'released' : 'pending'}">${inq.status}</span></span></div>
      </div>
      <div class="inquiry-q-detail"><h4>Question</h4><p>${escapeHtml(inq.question)}</p></div>
      <label class="field"><span>Reply (saved as a note. Send the actual email through Gmail)</span>
        <textarea id="inqReply" rows="5">${escapeHtml(inq.reply || '')}</textarea>
      </label>
      ${inq.replied_at ? `<p style="font-size:12px;color:var(--c-mute)">Last replied by ${escapeHtml(inq.replied_by || 'staff')} on ${formatDate(inq.replied_at)}</p>` : ''}
      <div class="req-actions-row" style="margin-top: 18px">
        ${inq.student_email ? `<a class="btn-secondary" href="mailto:${escapeHtml(inq.student_email)}?subject=Re: Your CvSU Kiosk Inquiry&body=${encodeURIComponent('Hi ' + (inq.student_name || 'student') + ',%0A%0AThank you for reaching out. Here is your answer:%0A%0A')}" target="_blank">Open in Gmail</a>` : ''}
        <button class="btn-primary" onclick="saveInquiryReply(${inq.id})">Save Reply / Mark Replied</button>
        <button class="btn-danger" onclick="deleteInquiry(${inq.id})">Delete</button>
      </div>
    </div>
  `;
  document.getElementById('inquiryModal').classList.add('is-open');
}
function closeInquiry() { document.getElementById('inquiryModal').classList.remove('is-open'); }

async function saveInquiryReply(id) {
  const reply = document.getElementById('inqReply').value.trim();
  if (!reply) return toast('Please type a reply note first.', 'error');
  try {
    await api(`/api/admin/inquiries/${id}`, { method: 'PATCH', body: { reply } });
    toast('Reply saved. Inquiry marked as replied.', 'success');
    closeInquiry();
    loadInquiries();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteInquiry(id) {
  if (!confirm('Delete this inquiry?')) return;
  try {
    await api(`/api/admin/inquiries/${id}`, { method: 'DELETE' });
    toast('Deleted.', 'success');
    closeInquiry();
    loadInquiries();
  } catch (e) { toast(e.message, 'error'); }
}

// ============ CAPACITY ============
async function loadCapacity() {
  try {
    const { capacity } = await api('/api/admin/capacity');
    const offices = [
      { id: 'registrar', label: 'Registrar' },
      { id: 'cashier', label: 'Cashier' },
      { id: 'osas', label: 'OSAS' },
    ];
    document.getElementById('capacityList').innerHTML = offices.map(o => {
      const c = capacity.find(x => x.office_id === o.id) || { per_hour: 20, hours_start: '08:00', hours_end: '17:00' };
      return `
        <div class="capacity-row">
          <div class="capacity-row-name">${escapeHtml(o.label)}</div>
          <label class="field" style="flex:1"><span>Releases per hour</span>
            <input type="number" min="1" max="200" id="cap_${o.id}_per_hour" value="${c.per_hour}">
          </label>
          <label class="field" style="flex:1"><span>Office Hours Start</span>
            <input type="time" id="cap_${o.id}_start" value="${c.hours_start}">
          </label>
          <label class="field" style="flex:1"><span>Office Hours End</span>
            <input type="time" id="cap_${o.id}_end" value="${c.hours_end}">
          </label>
          <button class="btn-primary" onclick="saveCapacity('${o.id}')">Save</button>
        </div>
      `;
    }).join('');
  } catch (e) { toast(e.message, 'error'); }
}

async function saveCapacity(officeId) {
  const per_hour = parseInt(document.getElementById(`cap_${officeId}_per_hour`).value);
  const hours_start = document.getElementById(`cap_${officeId}_start`).value;
  const hours_end = document.getElementById(`cap_${officeId}_end`).value;
  if (!per_hour || per_hour < 1) return toast('Per hour must be at least 1.', 'error');
  try {
    await api(`/api/admin/capacity/${officeId}`, { method: 'PATCH', body: { per_hour, hours_start, hours_end } });
    toast(`Capacity saved for ${officeId}.`, 'success');
  } catch (e) { toast(e.message, 'error'); }
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

// ============ FLOOR PLAN (Visual Drag-and-Drop Editor) ============
let FP_DATA = null;
let FP_EDITOR_FLOOR = 'ground';
let FP_SELECTED_ID = null;
let FP_DRAG = null; // { type, roomId, startSvg, origX, origY, origW, origH }
let FP_DIRTY = false;

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
    FP_DATA = floors || await loadDefaultFloorPlan();
    FP_DIRTY = false;
    setFpStatus('Ready. Drag rooms to move, drag the corner to resize.', 'ok');
    renderEditorCanvas();
  } catch (e) {
    toast('Failed to load floor plan: ' + e.message, 'error');
  }
}

async function loadDefaultFloorPlan() {
  const res = await fetch('/js/app.js');
  const src = await res.text();
  const m = src.match(/const DEFAULT_FLOORS = (\{[\s\S]+?\n\});/);
  if (!m) return { ground: { name: 'Ground Floor', label: 'GROUND FLOOR PLAN', rooms: [] }, second: { name: 'Second Floor', label: 'SECOND FLOOR PLAN', rooms: [] } };
  try {
    return Function('"use strict"; return (' + m[1] + ')')();
  } catch {
    return { ground: { name: 'Ground Floor', label: 'GROUND FLOOR PLAN', rooms: [] }, second: { name: 'Second Floor', label: 'SECOND FLOOR PLAN', rooms: [] } };
  }
}

function setFpStatus(msg, kind) {
  const el = document.getElementById('fpStatus');
  if (!el) return;
  el.textContent = msg;
  el.className = 'fp-status' + (kind === 'ok' ? ' is-ok' : kind === 'error' ? ' is-error' : '');
}

function markDirty() {
  FP_DIRTY = true;
  setFpStatus('You have unsaved changes. Click Save Changes.', '');
}

function switchEditorFloor(floor) {
  FP_EDITOR_FLOOR = floor;
  FP_SELECTED_ID = null;
  document.querySelectorAll('.fp-toolbar .floor-btn').forEach(b => b.classList.toggle('is-active', b.dataset.floor === floor));
  renderEditorCanvas();
  renderSidePanel();
}

function renderEditorCanvas() {
  if (!FP_DATA) return;
  const floor = FP_DATA[FP_EDITOR_FLOOR];
  if (!floor) return;
  const svg = document.getElementById('fpEditCanvas');
  if (!svg) return;

  const parts = [];
  parts.push(`<defs>
    <pattern id="fpEdGrid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1"/></pattern>
    <pattern id="fpEdFloor" x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="#0F2418"/><path d="M 14 0 L 0 0 0 14" fill="none" stroke="rgba(255,255,255,0.025)" stroke-width="1"/></pattern>
  </defs>`);
  parts.push(`<rect width="1210" height="620" fill="#0A1A12"/>`);
  parts.push(`<rect width="1210" height="620" fill="url(#fpEdGrid)"/>`);

  if (floor.outline) parts.push(`<path d="${floor.outline}" fill="url(#fpEdFloor)" stroke="rgba(255,210,77,0.4)" stroke-width="2.5"/>`);
  if (Array.isArray(floor.hallways)) {
    for (const h of floor.hallways) {
      parts.push(`<rect x="${h.x}" y="${h.y}" width="${h.w}" height="${h.h}" fill="rgba(255,255,255,0.04)" pointer-events="none"/>`);
    }
  }

  for (const r of floor.rooms || []) {
    const c = FP_TYPE_COLORS[r.type] || FP_TYPE_COLORS.support;
    const stroke = r.isKiosk ? '#FFD24D' : c.stroke;
    const sw = r.isKiosk ? 3 : 1.5;
    const isSel = FP_SELECTED_ID === r.id;
    parts.push(`<g class="room ${isSel ? 'is-selected' : ''}" data-room-id="${escapeHtml(r.id)}">`);
    parts.push(`<rect class="room-rect room-body" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="3" fill="${c.fill}" stroke="${stroke}" stroke-width="${sw}" data-room-id="${escapeHtml(r.id)}"/>`);
    const label = r.label || r.shortName || r.name || r.id;
    if (label) {
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const fs = r.w >= 150 ? 12 : (r.w >= 80 ? 10 : 8);
      parts.push(`<text x="${cx}" y="${cy + fs/3}" text-anchor="middle" fill="${c.text}" font-size="${fs}" font-weight="600" pointer-events="none">${escapeHtml(label)}</text>`);
    }
    if (r.isKiosk) parts.push(`<circle cx="${r.x + r.w - 10}" cy="${r.y + 10}" r="5" fill="#FFD24D" pointer-events="none"/>`);
    if (isSel) {
      // Resize handle in bottom-right
      const hx = r.x + r.w - 8;
      const hy = r.y + r.h - 8;
      parts.push(`<rect class="room-resize" x="${hx}" y="${hy}" width="14" height="14" rx="3" fill="#FFD24D" stroke="white" stroke-width="2" data-room-id="${escapeHtml(r.id)}"/>`);
    }
    parts.push(`</g>`);
  }

  svg.innerHTML = parts.join('');
  attachCanvasEvents();
}

function attachCanvasEvents() {
  const svg = document.getElementById('fpEditCanvas');
  if (!svg) return;
  svg.onmousedown = onCanvasDown;
  svg.ontouchstart = onCanvasTouch;
}

function clientToSvg(svg, clientX, clientY) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const transformed = pt.matrixTransform(ctm.inverse());
  return { x: transformed.x, y: transformed.y };
}

function onCanvasDown(ev) {
  const svg = ev.currentTarget;
  const target = ev.target;
  const roomId = target.getAttribute && target.getAttribute('data-room-id');
  if (!roomId) {
    // Clicked empty area: deselect
    FP_SELECTED_ID = null;
    renderEditorCanvas();
    renderSidePanel();
    return;
  }

  const isHandle = target.classList.contains('room-resize');
  const room = (FP_DATA[FP_EDITOR_FLOOR].rooms || []).find(r => r.id === roomId);
  if (!room) return;

  // Select this room
  FP_SELECTED_ID = roomId;
  renderEditorCanvas();
  renderSidePanel();

  const start = clientToSvg(svg, ev.clientX, ev.clientY);
  FP_DRAG = {
    type: isHandle ? 'resize' : 'move',
    roomId,
    startSvg: start,
    origX: room.x, origY: room.y, origW: room.w, origH: room.h,
    shift: ev.shiftKey,
  };
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
  ev.preventDefault();
}

function onCanvasTouch(ev) {
  if (!ev.touches || ev.touches.length === 0) return;
  const t = ev.touches[0];
  onCanvasDown({ ...ev, clientX: t.clientX, clientY: t.clientY, currentTarget: ev.currentTarget, target: ev.target, preventDefault: () => ev.preventDefault(), shiftKey: false });
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd);
}

function onTouchMove(ev) {
  if (!ev.touches || ev.touches.length === 0) return;
  const t = ev.touches[0];
  onDragMove({ clientX: t.clientX, clientY: t.clientY, shiftKey: false });
  ev.preventDefault();
}
function onTouchEnd() {
  document.removeEventListener('touchmove', onTouchMove);
  document.removeEventListener('touchend', onTouchEnd);
  onDragEnd();
}

function onDragMove(ev) {
  if (!FP_DRAG) return;
  const svg = document.getElementById('fpEditCanvas');
  const cur = clientToSvg(svg, ev.clientX, ev.clientY);
  const dx = cur.x - FP_DRAG.startSvg.x;
  const dy = cur.y - FP_DRAG.startSvg.y;
  const room = FP_DATA[FP_EDITOR_FLOOR].rooms.find(r => r.id === FP_DRAG.roomId);
  if (!room) return;
  const snap = ev.shiftKey ? 10 : 1;
  const snapVal = (v) => Math.round(v / snap) * snap;

  if (FP_DRAG.type === 'move') {
    room.x = Math.max(0, Math.min(1210 - room.w, snapVal(FP_DRAG.origX + dx)));
    room.y = Math.max(0, Math.min(620 - room.h, snapVal(FP_DRAG.origY + dy)));
  } else {
    room.w = Math.max(20, Math.min(1210 - room.x, snapVal(FP_DRAG.origW + dx)));
    room.h = Math.max(20, Math.min(620 - room.y, snapVal(FP_DRAG.origH + dy)));
  }
  markDirty();
  renderEditorCanvas();
  syncPositionInputs(room);
}

function onDragEnd() {
  if (!FP_DRAG) return;
  FP_DRAG = null;
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
}

function renderSidePanel() {
  const side = document.getElementById('fpSidePanel');
  if (!side) return;
  if (!FP_SELECTED_ID) {
    side.innerHTML = `
      <div class="fp-side-empty">
        <div class="fp-side-empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h18M12 3v18"/></svg>
        </div>
        <h3>Pick a room to edit</h3>
        <p>Click any room on the floor plan to change its name, type, or position. Or click <b>+ Add Room</b> to create a new one.</p>
        <div class="fp-quick-tips">
          <div class="fp-tip"><b>Drag</b> the room body to move it</div>
          <div class="fp-tip"><b>Drag</b> the gold corner handle to resize</div>
          <div class="fp-tip"><b>Hold Shift</b> while dragging to snap to grid (10 px = 0.5 m)</div>
        </div>
      </div>
    `;
    return;
  }
  const room = FP_DATA[FP_EDITOR_FLOOR].rooms.find(r => r.id === FP_SELECTED_ID);
  if (!room) { FP_SELECTED_ID = null; renderSidePanel(); return; }

  side.innerHTML = `
    <div class="fp-prop">
      <div class="fp-prop-head">
        <div>
          <div class="fp-prop-title">Editing Room</div>
          <div class="fp-prop-name">${escapeHtml(room.name || room.id)}</div>
        </div>
      </div>

      <label class="field"><span>Name</span><input type="text" id="fpRoomName" value="${escapeAttr(room.name || '')}"></label>
      <label class="field"><span>Short Name (optional, for compact labels)</span><input type="text" id="fpRoomShort" value="${escapeAttr(room.shortName || '')}"></label>
      <label class="field"><span>Label Override (optional, replaces displayed text)</span><input type="text" id="fpRoomLabel" value="${escapeAttr(room.label || '')}"></label>

      <label class="field"><span>Type</span>
        <select id="fpRoomType">
          ${['admin','academic','lab','library','support','service','public','gate'].map(t =>
            `<option value="${t}" ${room.type === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </label>

      <div class="fp-prop-row">
        <label class="field"><span>X (px)</span><input class="fp-num-input" type="number" id="fpRoomX" value="${room.x}" min="0" max="1210"></label>
        <label class="field"><span>Y (px)</span><input class="fp-num-input" type="number" id="fpRoomY" value="${room.y}" min="0" max="620"></label>
      </div>
      <div class="fp-prop-row">
        <label class="field"><span>Width (px)</span><input class="fp-num-input" type="number" id="fpRoomW" value="${room.w}" min="20" max="1210"></label>
        <label class="field"><span>Height (px)</span><input class="fp-num-input" type="number" id="fpRoomH" value="${room.h}" min="20" max="620"></label>
      </div>

      <label class="field-check"><input type="checkbox" id="fpRoomKiosk" ${room.isKiosk ? 'checked' : ''}> Kiosk office (highlighted in gold)</label>
      <label class="field-check"><input type="checkbox" id="fpRoomHighlight" ${room.isHighlight ? 'checked' : ''}> Highlighted (slightly brighter)</label>

      <div class="fp-prop-actions">
        <button class="btn-danger" onclick="deleteRoom()">Delete Room</button>
        <button class="btn-secondary" onclick="duplicateRoom()">Duplicate</button>
      </div>
    </div>
  `;

  // Wire up live inputs
  const onPropChange = () => {
    room.name = document.getElementById('fpRoomName').value;
    room.shortName = document.getElementById('fpRoomShort').value || undefined;
    room.label = document.getElementById('fpRoomLabel').value || undefined;
    room.type = document.getElementById('fpRoomType').value;
    room.x = parseInt(document.getElementById('fpRoomX').value) || 0;
    room.y = parseInt(document.getElementById('fpRoomY').value) || 0;
    room.w = parseInt(document.getElementById('fpRoomW').value) || 20;
    room.h = parseInt(document.getElementById('fpRoomH').value) || 20;
    room.isKiosk = document.getElementById('fpRoomKiosk').checked;
    room.isHighlight = document.getElementById('fpRoomHighlight').checked;
    // Strip undefined for cleanliness
    if (!room.shortName) delete room.shortName;
    if (!room.label) delete room.label;
    if (!room.isKiosk) delete room.isKiosk;
    if (!room.isHighlight) delete room.isHighlight;
    markDirty();
    renderEditorCanvas();
  };

  ['fpRoomName','fpRoomShort','fpRoomLabel','fpRoomType','fpRoomX','fpRoomY','fpRoomW','fpRoomH','fpRoomKiosk','fpRoomHighlight']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', onPropChange);
    });
}

function syncPositionInputs(room) {
  const x = document.getElementById('fpRoomX');
  const y = document.getElementById('fpRoomY');
  const w = document.getElementById('fpRoomW');
  const h = document.getElementById('fpRoomH');
  if (x) x.value = room.x;
  if (y) y.value = room.y;
  if (w) w.value = room.w;
  if (h) h.value = room.h;
}

function addRoom() {
  if (!FP_DATA) return;
  const floor = FP_DATA[FP_EDITOR_FLOOR];
  const newId = 'room-' + Date.now().toString(36);
  const newRoom = {
    id: newId,
    name: 'New Room',
    type: 'academic',
    x: 540, y: 280, w: 130, h: 80,
  };
  floor.rooms.push(newRoom);
  FP_SELECTED_ID = newId;
  markDirty();
  renderEditorCanvas();
  renderSidePanel();
  toast('New room added. Drag to position it.', 'success');
}

function deleteRoom() {
  if (!FP_SELECTED_ID) return;
  const floor = FP_DATA[FP_EDITOR_FLOOR];
  const idx = floor.rooms.findIndex(r => r.id === FP_SELECTED_ID);
  if (idx < 0) return;
  if (!confirm('Delete this room? This cannot be undone until you reload without saving.')) return;
  floor.rooms.splice(idx, 1);
  FP_SELECTED_ID = null;
  markDirty();
  renderEditorCanvas();
  renderSidePanel();
  toast('Room deleted.', 'success');
}

function duplicateRoom() {
  if (!FP_SELECTED_ID) return;
  const floor = FP_DATA[FP_EDITOR_FLOOR];
  const orig = floor.rooms.find(r => r.id === FP_SELECTED_ID);
  if (!orig) return;
  const copy = { ...orig, id: 'room-' + Date.now().toString(36), x: orig.x + 20, y: orig.y + 20, name: orig.name + ' (copy)' };
  floor.rooms.push(copy);
  FP_SELECTED_ID = copy.id;
  markDirty();
  renderEditorCanvas();
  renderSidePanel();
  toast('Room duplicated.', 'success');
}

async function saveFloorPlan() {
  if (!FP_DATA || !FP_DATA.ground || !FP_DATA.second) {
    toast('Floor plan data is incomplete.', 'error');
    return;
  }
  try {
    await api('/api/admin/floor-plan', { method: 'PUT', body: { floors: FP_DATA } });
    FP_DIRTY = false;
    toast('Floor plan saved. The kiosk picks this up on the next map view.', 'success');
    setFpStatus('Saved. ' + FP_DATA.ground.rooms.length + ' ground rooms, ' + FP_DATA.second.rooms.length + ' second rooms.', 'ok');
  } catch (e) {
    toast('Save failed: ' + e.message, 'error');
  }
}

async function resetFloorPlan() {
  if (!confirm('Reset to the default floor plan? All your customizations will be lost.')) return;
  try {
    await api('/api/admin/floor-plan', { method: 'DELETE' });
    FP_DATA = await loadDefaultFloorPlan();
    FP_DIRTY = false;
    FP_SELECTED_ID = null;
    renderEditorCanvas();
    renderSidePanel();
    setFpStatus('Reset to default.', 'ok');
    toast('Reset to default floor plan.', 'success');
  } catch (e) {
    toast('Reset failed: ' + e.message, 'error');
  }
}

function toggleJsonView() {
  document.getElementById('fpJsonEditor').value = JSON.stringify(FP_DATA, null, 2);
  document.getElementById('jsonViewModal').classList.add('is-open');
}
function closeJsonView() {
  document.getElementById('jsonViewModal').classList.remove('is-open');
}
function applyJsonView() {
  try {
    const parsed = JSON.parse(document.getElementById('fpJsonEditor').value);
    if (!parsed.ground || !parsed.second) throw new Error('Missing ground or second floor.');
    FP_DATA = parsed;
    FP_SELECTED_ID = null;
    markDirty();
    renderEditorCanvas();
    renderSidePanel();
    closeJsonView();
    toast('JSON applied. Remember to save.', 'success');
  } catch (e) {
    toast('Invalid JSON: ' + e.message, 'error');
  }
}

function escapeAttr(s) {
  return String(s == null ? '' : s).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
