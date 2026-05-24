/* Office Admin Console - JS */

let CURRENT_USER = null;
let STATE = { filter: 'all', requests: [] };

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
    CURRENT_USER = user;
    document.getElementById('userName').textContent = user.name;
    document.getElementById('userRole').textContent = officeLabel(user.office_id);
    document.getElementById('userAvatar').textContent = (user.name || 'U')[0].toUpperCase();
    document.getElementById('dashSub').textContent = `${officeLabel(user.office_id)} . Today at a glance`;
    // Show the Payments tab only for Cashier
    if (user.office_id === 'cashier') {
      const sbPay = document.getElementById('sbPayments');
      if (sbPay) sbPay.hidden = false;
    }
  } catch {
    window.location.href = '/admin';
  }
}

function officeLabel(id) {
  return ({ registrar: 'Registrar', cashier: 'Cashier', osas: 'OSAS' })[id] || id || 'Office';
}

async function doLogout() {
  await api('/api/auth/logout', { method: 'POST' });
  window.location.href = '/admin';
}

function showTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('is-active', t.dataset.tab === name));
  document.querySelectorAll('.sb-link').forEach(l => l.classList.toggle('is-active', l.dataset.tab === name));
  if (name === 'dashboard') loadDashboard();
  if (name === 'requests') loadRequests();
  if (name === 'payments') loadPayments();
  if (name === 'inquiries') loadInquiries();
  if (name === 'announcements') loadAnnouncements();
  if (name === 'faqs') loadFaqs();
}

// ============ INQUIRIES ============
let INQ_FILTER = 'all';
let INQ_DATA = [];

async function loadInquiries() {
  try {
    const { inquiries } = await api('/api/admin/inquiries');
    INQ_DATA = inquiries;
    renderInquiryList();
    const pendingCount = inquiries.filter(i => i.status === 'pending').length;
    const badge = document.getElementById('badgeInquiries');
    if (badge) {
      badge.textContent = pendingCount;
      badge.style.display = pendingCount ? '' : 'none';
    }
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
        <div><span class="req-detail-label">Email (reply via Gmail)</span><span class="req-detail-value"><a href="mailto:${escapeHtml(inq.student_email || '')}">${escapeHtml(inq.student_email || '-')}</a></span></div>
        <div><span class="req-detail-label">Office</span><span class="req-detail-value">${escapeHtml(inq.office_id || 'General')}</span></div>
        <div><span class="req-detail-label">Submitted</span><span class="req-detail-value">${formatDate(inq.created_at)}</span></div>
        <div><span class="req-detail-label">Status</span><span class="req-detail-value"><span class="pill pill--${inq.status === 'replied' ? 'released' : 'pending'}">${inq.status}</span></span></div>
      </div>
      <div class="inquiry-q-detail">
        <h4>Question</h4>
        <p>${escapeHtml(inq.question)}</p>
      </div>
      <label class="field"><span>Your reply (will be saved as a note. Then reply through Gmail to ${escapeHtml(inq.student_email || 'the student')})</span>
        <textarea id="inqReply" rows="5" placeholder="Type your reply...">${escapeHtml(inq.reply || '')}</textarea>
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
  if (!reply) return toast('Please type your reply first.', 'error');
  try {
    await api(`/api/admin/inquiries/${id}`, { method: 'PATCH', body: { reply } });
    toast('Reply saved. The inquiry is now marked as replied.', 'success');
    closeInquiry();
    loadInquiries();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteInquiry(id) {
  if (!confirm('Delete this inquiry?')) return;
  try {
    await api(`/api/admin/inquiries/${id}`, { method: 'DELETE' });
    toast('Inquiry deleted.', 'success');
    closeInquiry();
    loadInquiries();
  } catch (e) { toast(e.message, 'error'); }
}

// ============ DASHBOARD ============
async function loadDashboard() {
  try {
    const { stats } = await api('/api/admin/stats');
    document.getElementById('statsGrid').innerHTML = `
      <div class="stat-card" style="--accent:#FB8C00">
        <div class="stat-card-label">Pending</div>
        <div class="stat-card-num">${stats.pending}</div>
        <div class="stat-card-foot">Awaiting payment</div>
      </div>
      <div class="stat-card" style="--accent:#1E88E5">
        <div class="stat-card-label">Processing</div>
        <div class="stat-card-num">${stats.processing}</div>
        <div class="stat-card-foot">In progress</div>
      </div>
      <div class="stat-card" style="--accent:#FFC107">
        <div class="stat-card-label">Ready to Claim</div>
        <div class="stat-card-num">${stats.ready}</div>
        <div class="stat-card-foot">Awaiting pickup</div>
      </div>
      <div class="stat-card" style="--accent:#2EA043">
        <div class="stat-card-label">Released Today</div>
        <div class="stat-card-num">${stats.released_today}</div>
        <div class="stat-card-foot">${stats.total_today} total requests today</div>
      </div>
      <div class="stat-card" style="--accent:#0E5732">
        <div class="stat-card-label">Revenue Today</div>
        <div class="stat-card-num">PHP ${stats.revenue_today.toFixed(2)}</div>
        <div class="stat-card-foot">From paid requests</div>
      </div>
    `;
    document.getElementById('badgePending').textContent = stats.pending + stats.processing;

    // Refresh inquiries badge count
    try {
      const { inquiries } = await api('/api/admin/inquiries?status=pending');
      const badge = document.getElementById('badgeInquiries');
      if (badge) {
        badge.textContent = inquiries.length;
        badge.style.display = inquiries.length ? '' : 'none';
      }
    } catch {}

    // Refresh payments badge for Cashier
    if (CURRENT_USER && CURRENT_USER.office_id === 'cashier') {
      try {
        const { payments } = await api('/api/admin/payments');
        const badge = document.getElementById('badgePayments');
        if (badge) {
          badge.textContent = payments.length;
          badge.style.display = payments.length ? '' : 'none';
        }
      } catch {}
    }

    const { requests } = await api('/api/admin/requests');
    document.getElementById('recentRequests').innerHTML = requests.slice(0, 5).map(r => `
      <div class="request-row">
        <div class="request-row-ref">${r.ref_number}</div>
        <div class="request-row-info">
          <div class="request-row-name">${escapeHtml(r.student_name)}</div>
          <div class="request-row-doc">${escapeHtml(r.document_name)} . PHP ${r.fee}</div>
        </div>
        ${statusPill(r.status)}
      </div>
    `).join('') || '<div class="empty">No requests yet.</div>';
  } catch (e) { toast(e.message, 'error'); }
}

// ============ REQUESTS ============
async function loadRequests() {
  try {
    const q = new URLSearchParams();
    const search = document.getElementById('reqSearch')?.value.trim();
    const payment = document.getElementById('reqPaymentFilter')?.value;
    const archived = document.getElementById('reqArchivedFilter')?.value;
    if (search) q.set('search', search);
    if (payment && payment !== 'all') q.set('payment', payment);
    if (archived) q.set('archived', archived);
    const url = '/api/admin/requests' + (q.toString() ? '?' + q.toString() : '');
    const { requests } = await api(url);
    STATE.requests = requests;
    renderRequestsTable();
  } catch (e) { toast(e.message, 'error'); }
}

// ============ PAYMENTS (Cashier only) ============
async function loadPayments() {
  try {
    const { payments } = await api('/api/admin/payments');
    const tbody = document.getElementById('paymentsTable');
    const empty = document.getElementById('paymentsEmpty');
    if (!payments.length) { tbody.innerHTML = ''; empty.hidden = false; }
    else {
      empty.hidden = true;
      tbody.innerHTML = payments.map(r => `
        <tr>
          <td><span class="ref-mono">${r.ref_number}</span></td>
          <td><span class="pill pill--office">${escapeHtml(officeLabel(r.office_id))}</span></td>
          <td>
            <div class="student-name">${escapeHtml(r.student_name)}</div>
            ${r.student_id ? `<div class="student-id">${r.student_id}</div>` : ''}
          </td>
          <td>${escapeHtml(r.document_name)}</td>
          <td><span class="fee">PHP ${r.total_fee || r.fee}</span></td>
          <td>${formatDate(r.created_at)}</td>
          <td><button class="btn-primary" onclick="markPaidFromPayments(${r.id})">Mark as Paid</button></td>
        </tr>
      `).join('');
    }
    // Update payments badge
    const badge = document.getElementById('badgePayments');
    if (badge) {
      badge.textContent = payments.length;
      badge.style.display = payments.length ? '' : 'none';
    }
  } catch (e) { toast(e.message, 'error'); }
}

async function markPaidFromPayments(id) {
  try {
    await api(`/api/admin/requests/${id}`, { method: 'PATCH', body: { paid: true } });
    toast('Marked as paid. The owning office can now process this request.', 'success');
    loadPayments();
  } catch (e) { toast(e.message, 'error'); }
}

function filterRequests(filter) {
  STATE.filter = filter;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.toggle('is-active', c.dataset.filter === filter));
  renderRequestsTable();
}

function renderRequestsTable() {
  const filtered = STATE.filter === 'all' ? STATE.requests : STATE.requests.filter(r => r.status === STATE.filter);
  const tbody = document.getElementById('requestsTable');
  const empty = document.getElementById('requestsEmpty');
  if (!filtered.length) {
    tbody.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  tbody.innerHTML = filtered.map(r => `
    <tr>
      <td><span class="ref-mono">${r.ref_number}</span></td>
      <td>#${r.queue_number}</td>
      <td>
        <div class="student-name">${escapeHtml(r.student_name)}</div>
        ${r.student_id ? `<div class="student-id">${r.student_id}</div>` : ''}
      </td>
      <td>${escapeHtml(r.document_name)}</td>
      <td><span class="fee">PHP ${r.fee}</span></td>
      <td>${r.paid ? '<span class="pill pill--paid">Paid</span>' : '<span class="pill pill--unpaid">Unpaid</span>'}</td>
      <td>${statusPill(r.status)}</td>
      <td>${r.release_date || '-'}</td>
      <td><button class="btn-text" onclick="openRequest(${r.id})">View</button></td>
    </tr>
  `).join('');
}

function statusPill(status) {
  return `<span class="pill pill--${status}">${status}</span>`;
}

async function openRequest(id) {
  const r = STATE.requests.find(x => x.id === id);
  if (!r) return;
  document.getElementById('requestModalBody').innerHTML = `
    <div class="modal-head">
      <h3>Request Details</h3>
      <button class="modal-close" onclick="closeRequestModal()">&times;</button>
    </div>
    <div class="modal-body">
      <div class="req-detail-head">
        <div>
          <div class="req-detail-label">Reference</div>
          <div class="req-detail-ref">${r.ref_number}</div>
        </div>
        ${statusPill(r.status)}
      </div>
      <div class="req-detail-grid">
        <div><span class="req-detail-label">Student</span><span class="req-detail-value">${escapeHtml(r.student_name)}</span></div>
        <div><span class="req-detail-label">Student ID</span><span class="req-detail-value">${r.student_id || '-'}</span></div>
        <div><span class="req-detail-label">Document</span><span class="req-detail-value">${escapeHtml(r.document_name)}</span></div>
        <div><span class="req-detail-label">Queue Number</span><span class="req-detail-value">#${r.queue_number}</span></div>
        <div><span class="req-detail-label">Fee</span><span class="req-detail-value">PHP ${r.fee}.00</span></div>
        <div><span class="req-detail-label">Payment</span><span class="req-detail-value">${r.payment_method || '-'} . ${r.paid ? 'Paid' : 'Unpaid'}</span></div>
        <div><span class="req-detail-label">Pickup Date</span><span class="req-detail-value">${r.release_date || '-'}</span></div>
        <div><span class="req-detail-label">Created</span><span class="req-detail-value">${formatDate(r.created_at)}</span></div>
      </div>
      <div class="req-actions-row">
        ${!r.paid ? `<button class="btn-primary" onclick="updateRequest(${r.id}, {paid: true})">Mark as Paid</button>` : ''}
        ${r.paid && r.status === 'pending' ? `<button class="btn-secondary" onclick="updateRequest(${r.id}, {status: 'processing'})">Start Processing</button>` : ''}
        ${(r.status === 'pending' || r.status === 'processing') ? `<button class="btn-secondary" onclick="releaseGuard(${r.id}, ${r.paid ? 'true' : 'false'}, 'ready')">Mark Ready</button>` : ''}
        ${r.status === 'ready' ? `<button class="btn-primary" onclick="releaseGuard(${r.id}, ${r.paid ? 'true' : 'false'}, 'released')">Release Document</button>` : ''}
        ${(r.status === 'released' || r.status === 'cancelled') && !r.archived ? `<button class="btn-secondary" onclick="updateRequest(${r.id}, {archived: true})">Archive</button>` : ''}
        ${r.archived ? `<button class="btn-secondary" onclick="updateRequest(${r.id}, {archived: false})">Unarchive</button>` : ''}
        ${r.status !== 'released' && r.status !== 'cancelled' ? `<button class="btn-danger" onclick="updateRequest(${r.id}, {status: 'cancelled'})">Cancel Request</button>` : ''}
      </div>
    </div>
  `;
  document.getElementById('requestModal').classList.add('is-open');
}
function closeRequestModal() { document.getElementById('requestModal').classList.remove('is-open'); }

async function updateRequest(id, body) {
  try {
    await api(`/api/admin/requests/${id}`, { method: 'PATCH', body });
    toast('Request updated.', 'success');
    closeRequestModal();
    loadRequests();
    loadDashboard();
  } catch (e) { toast(e.message, 'error'); }
}

function releaseGuard(id, paid, targetStatus) {
  if (!paid) {
    if (!confirm('This request is still UNPAID. Release without payment? If the student paid in cash, mark as paid first before releasing.')) return;
  }
  updateRequest(id, { status: targetStatus });
}

// ============ ANNOUNCEMENTS ============
let editingAnnId = null;
async function loadAnnouncements() {
  try {
    const { announcements } = await api('/api/admin/announcements');
    const grid = document.getElementById('annGrid');
    if (!announcements.length) {
      grid.innerHTML = '<div class="empty">No announcements yet. Click "+ New Announcement" to add one.</div>';
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
            <button class="icon-btn" onclick='editAnnouncement(${a.id})' title="Edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="icon-btn icon-btn--danger" onclick="deleteAnnouncement(${a.id})" title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      </div>
    `).join('');
    // Stash announcements globally for edit
    window._allAnns = announcements;
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
    if (editingAnnId) {
      await api(`/api/admin/announcements/${editingAnnId}`, { method: 'PATCH', body });
    } else {
      await api('/api/admin/announcements', { method: 'POST', body });
    }
    toast('Announcement saved.', 'success');
    closeAnnModal();
    loadAnnouncements();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteAnnouncement(id) {
  if (!confirm('Delete this announcement?')) return;
  try {
    await api(`/api/admin/announcements/${id}`, { method: 'DELETE' });
    toast('Announcement deleted.', 'success');
    loadAnnouncements();
  } catch (e) { toast(e.message, 'error'); }
}

// ============ FAQs ============
let editingFaqId = null;
async function loadFaqs() {
  try {
    const { faqs } = await api('/api/admin/faqs');
    window._allFaqs = faqs;
    const list = document.getElementById('faqAdminList');
    if (!faqs.length) {
      list.innerHTML = '<div class="empty">No FAQs yet. Click "+ New FAQ" to add one.</div>';
      return;
    }
    list.innerHTML = faqs.map(f => `
      <div class="faq-admin-item">
        <span class="faq-admin-cat">${escapeHtml(f.category)}</span>
        <div class="faq-admin-q">${escapeHtml(f.question)}</div>
        <div class="faq-admin-actions">
          <button class="icon-btn" onclick="editFaq(${f.id})" title="Edit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="icon-btn icon-btn--danger" onclick="deleteFaq(${f.id})" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    `).join('');
  } catch (e) { toast(e.message, 'error'); }
}

function openFaqModal() {
  editingFaqId = null;
  document.getElementById('faqModalTitle').textContent = 'New FAQ';
  document.getElementById('faqCat').value = officeLabel(CURRENT_USER?.office_id);
  document.getElementById('faqQ').value = '';
  document.getElementById('faqA').value = '';
  document.getElementById('faqModal').classList.add('is-open');
}
function editFaq(id) {
  const f = (window._allFaqs || []).find(x => x.id === id);
  if (!f) return;
  editingFaqId = id;
  document.getElementById('faqModalTitle').textContent = 'Edit FAQ';
  document.getElementById('faqCat').value = f.category;
  document.getElementById('faqQ').value = f.question;
  document.getElementById('faqA').value = f.answer;
  document.getElementById('faqModal').classList.add('is-open');
}
function closeFaqModal() { document.getElementById('faqModal').classList.remove('is-open'); }

async function saveFaq() {
  const body = {
    category: document.getElementById('faqCat').value.trim(),
    question: document.getElementById('faqQ').value.trim(),
    answer: document.getElementById('faqA').value.trim(),
  };
  if (!body.category || !body.question || !body.answer) return toast('All fields required.', 'error');
  try {
    if (editingFaqId) await api(`/api/admin/faqs/${editingFaqId}`, { method: 'PATCH', body });
    else await api('/api/admin/faqs', { method: 'POST', body });
    toast('FAQ saved.', 'success');
    closeFaqModal();
    loadFaqs();
  } catch (e) { toast(e.message, 'error'); }
}
async function deleteFaq(id) {
  if (!confirm('Delete this FAQ?')) return;
  try {
    await api(`/api/admin/faqs/${id}`, { method: 'DELETE' });
    toast('FAQ deleted.', 'success');
    loadFaqs();
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
  loadDashboard();

  // Poll for new requests every 20 seconds
  setInterval(() => {
    const active = document.querySelector('.tab.is-active')?.dataset.tab;
    if (active === 'dashboard') loadDashboard();
    if (active === 'requests') loadRequests();
  }, 20000);

  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('is-open'); });
  });
});
