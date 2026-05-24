/* CvSU Kiosk - Frontend Application
   Slideshow-driven main screen. Help drawer. Multi-doc requests with
   scheduled claim slots. Inquiry via email. QR generation for new students.
*/

const STATE = {
  user: null,
  request: {
    office: null,
    documents: [],
    refNumber: null,
    queueNumber: null,
    paymentMethod: null,
    paid: false,
    scheduledAt: null,
    totalFee: 0,
  },
  cache: { offices: null, documents: null, announcements: null, faqs: null, buildings: null, mission: null }
};

let SLIDESHOW_TIMER = null;
let SLIDESHOW_INDEX = 0;
let THANKYOU_TIMER = null;

// ============ API ============
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ============ CLOCK ============
function tickClock() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  const tStr = `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
  const dStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  setText('welcomeTime', tStr);
  setText('welcomeDate', dStr);
  ['topbarClock','topbarClockMap','topbarClockAnn','topbarClockFaq','topbarClockAsk','topbarClockIdGate','topbarClockQrGen','topbarClockQrResult','topbarClockDocSel','topbarClockSched','topbarClockPay','topbarClockQr','topbarClockRcp','topbarClockQ','topbarClockMV'].forEach(id => setText(id, tStr));
}
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ============ ROUTING ============
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.querySelector(`[data-screen="${name}"]`);
  if (target) target.classList.add('active');

  if (THANKYOU_TIMER) { clearInterval(THANKYOU_TIMER); THANKYOU_TIMER = null; }
  stopSlideshow();

  if (name === 'home') { renderHome(); startSlideshow(); }
  if (name === 'faq') renderFaqs();
  if (name === 'askstaff') renderAskStaff();
  if (name === 'queue') renderQueue();
  if (name === 'map') renderMap();
  if (name === 'mission') renderMission();
  if (name === 'docselect') renderDocSelect();
  if (name === 'schedule') renderSchedule();
  if (name === 'payment') renderPayment();
  if (name === 'thankyou') runThankYou();
}

function goHome() { showScreen('home'); }

// ============ HOME / SLIDESHOW ============
async function renderHome() {
  try {
    const { announcements } = await api('/api/public/announcements');
    STATE.cache.announcements = announcements;
    const stage = document.getElementById('slideshow');
    const dots = document.getElementById('slideshowDots');
    if (!announcements.length) {
      stage.innerHTML = '<div class="slide-empty">No announcements yet. Tap "How Can I Help You?" to start.</div>';
      dots.innerHTML = '';
      return;
    }
    stage.innerHTML = announcements.map((a, i) => `
      <div class="slide ${i === 0 ? 'is-active' : ''}" data-idx="${i}" onclick="openAnnouncementDetail(${a.id})">
        <div class="slide-bg slide-bg--${a.type}"></div>
        <div class="slide-content">
          <span class="slide-tag tag--${a.type}">${escapeHtml(a.type)}</span>
          <h2 class="slide-title">${escapeHtml(a.title)}</h2>
          <p class="slide-body">${escapeHtml(a.body).substring(0, 240)}${a.body.length > 240 ? '...' : ''}</p>
          <div class="slide-foot">
            <span>${escapeHtml(a.date_text || '')}</span>
            <span class="slide-tap-hint">Tap to read more &rarr;</span>
          </div>
        </div>
      </div>
    `).join('');
    dots.innerHTML = announcements.map((a, i) => `<button class="slideshow-dot ${i === 0 ? 'is-active' : ''}" data-idx="${i}" onclick="goToSlide(${i})"></button>`).join('');
    SLIDESHOW_INDEX = 0;
  } catch (e) { console.error(e); }

  // Footer stats
  try {
    const { queues } = await api('/api/public/queues');
    const totalWaiting = Object.values(queues).reduce((s, q) => s + (q.waiting || 0), 0);
    setText('statQueue', totalWaiting);
    const docs = await getDocuments();
    setText('statDocs', docs.length);
  } catch {}
}

function startSlideshow() {
  stopSlideshow();
  SLIDESHOW_TIMER = setInterval(nextSlide, 6000);
}
function stopSlideshow() {
  if (SLIDESHOW_TIMER) { clearInterval(SLIDESHOW_TIMER); SLIDESHOW_TIMER = null; }
}
function nextSlide() {
  const slides = document.querySelectorAll('#slideshow .slide');
  if (!slides.length) return;
  const next = (SLIDESHOW_INDEX + 1) % slides.length;
  goToSlide(next);
}
function goToSlide(idx) {
  document.querySelectorAll('#slideshow .slide').forEach((s, i) => s.classList.toggle('is-active', i === idx));
  document.querySelectorAll('.slideshow-dot').forEach((d, i) => d.classList.toggle('is-active', i === idx));
  SLIDESHOW_INDEX = idx;
}

function openAnnouncementDetail(id) {
  const a = (STATE.cache.announcements || []).find(x => x.id === id);
  if (!a) return;
  document.getElementById('annDetailBody').innerHTML = `
    <div class="modal-head">
      <h3>${escapeHtml(a.title)}</h3>
      <button class="modal-close" onclick="closeAnnouncementDetail()">x</button>
    </div>
    <div class="modal-body">
      <span class="announce-tag tag--${a.type}">${escapeHtml(a.type)}</span>
      <p class="ann-detail-body">${escapeHtml(a.body)}</p>
      <div class="ann-detail-foot">
        <span>${escapeHtml(a.date_text || '')}</span>
        <span>${escapeHtml(a.author || '')}</span>
      </div>
    </div>
  `;
  document.getElementById('annDetailModal').classList.add('is-open');
}
function closeAnnouncementDetail() {
  document.getElementById('annDetailModal').classList.remove('is-open');
}

// ============ HELP DRAWER ============
function openHelp() { document.getElementById('helpDrawer').classList.add('is-open'); }
function closeHelp() { document.getElementById('helpDrawer').classList.remove('is-open'); }

// ============ DATA CACHE ============
async function getOffices() {
  if (!STATE.cache.offices) {
    const { offices } = await api('/api/public/offices');
    STATE.cache.offices = offices;
  }
  return STATE.cache.offices;
}
async function getDocuments() {
  if (!STATE.cache.documents) {
    const { documents } = await api('/api/public/documents');
    STATE.cache.documents = documents;
  }
  return STATE.cache.documents;
}

// ============ MAP (floor plan) ============
const DEFAULT_FLOORS = window.DEFAULT_FLOORS_DATA || null;
let FLOORS = null;
let CURRENT_FLOOR = 'ground';

async function renderMap() {
  if (!FLOORS) {
    try {
      const { floors } = await api('/api/public/floor-plan');
      if (floors && floors.ground && floors.second) {
        FLOORS = floors;
      } else if (window.FLOORS_FALLBACK) {
        FLOORS = window.FLOORS_FALLBACK;
      }
    } catch {
      if (window.FLOORS_FALLBACK) FLOORS = window.FLOORS_FALLBACK;
    }
  }
  if (!FLOORS) return;
  renderFloorPlan(CURRENT_FLOOR);
}

function switchFloor(floor) {
  CURRENT_FLOOR = floor;
  document.querySelectorAll('.floor-btn').forEach(b => b.classList.toggle('is-active', b.dataset.floor === floor));
  renderFloorPlan(floor);
}

const TYPE_COLORS = {
  admin:    { fill: '#1A4F2F', stroke: '#FFD24D', text: '#FFFFFF' },
  academic: { fill: '#143B26', stroke: '#3D7A5A', text: '#E4F0E8' },
  lab:      { fill: '#1B3A5C', stroke: '#4A82C9', text: '#E5EFF9' },
  library:  { fill: '#3A2A5C', stroke: '#8C6BD0', text: '#EDE5F9' },
  support:  { fill: '#3F3024', stroke: '#7C6048', text: '#EFE5DC' },
  service:  { fill: '#262626', stroke: '#5A5A5A', text: '#B0B0B0' },
  public:   { fill: '#1A2D40', stroke: '#3D6080', text: '#D8E5F0' },
  gate:     { fill: '#FFD24D', stroke: '#E0A91E', text: '#0E2A1A' },
};

function renderFloorPlan(floorId) {
  const floor = FLOORS && FLOORS[floorId];
  if (!floor) return;
  const svg = document.getElementById('floorPlan');
  if (!svg) return;
  const parts = [];
  parts.push(`<defs>
    <pattern id="fpGrid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.025)" stroke-width="1"/></pattern>
    <pattern id="fpFloor" x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="#0F2418"/><path d="M 14 0 L 0 0 0 14" fill="none" stroke="rgba(255,255,255,0.025)" stroke-width="1"/></pattern>
  </defs>`);
  parts.push(`<rect width="1210" height="620" fill="#0A1A12"/>`);
  parts.push(`<rect width="1210" height="620" fill="url(#fpGrid)"/>`);
  if (floor.outline) parts.push(`<path d="${floor.outline}" fill="url(#fpFloor)" stroke="rgba(255,210,77,0.4)" stroke-width="2.5"/>`);
  if (Array.isArray(floor.hallways)) {
    for (const h of floor.hallways) parts.push(`<rect x="${h.x}" y="${h.y}" width="${h.w}" height="${h.h}" fill="rgba(255,255,255,0.04)"/>`);
  }
  parts.push(`<text x="900" y="430" fill="rgba(255,210,77,0.25)" font-size="11" font-weight="700" letter-spacing="3">H A L L W A Y</text>`);
  parts.push(`<text x="270" y="430" fill="rgba(255,210,77,0.25)" font-size="11" font-weight="700" letter-spacing="3">H A L L W A Y</text>`);
  for (const r of floor.rooms || []) {
    const c = TYPE_COLORS[r.type] || TYPE_COLORS.support;
    const stroke = r.isKiosk ? '#FFD24D' : c.stroke;
    const sw = r.isKiosk ? 3 : 1.5;
    const highlightClass = r.isKiosk ? 'is-kiosk' : (r.isHighlight ? 'is-highlight' : '');
    parts.push(`<g class="room ${highlightClass}" data-room="${r.id}" onclick="selectRoom('${r.id}')">`);
    parts.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="3" fill="${c.fill}" stroke="${stroke}" stroke-width="${sw}"/>`);
    const label = r.label || r.shortName || r.name || r.id;
    if (label) {
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const fs = r.w >= 150 ? 12 : (r.w >= 80 ? 10 : 8);
      parts.push(`<text x="${cx}" y="${cy + fs/3}" text-anchor="middle" fill="${c.text}" font-size="${fs}" font-weight="600" pointer-events="none">${escapeHtml(label)}</text>`);
    }
    if (r.isKiosk) parts.push(`<circle cx="${r.x + r.w - 10}" cy="${r.y + 10}" r="5" fill="#FFD24D" pointer-events="none"/>`);
    parts.push('</g>');
  }
  parts.push(`<text x="1200" y="610" text-anchor="end" fill="rgba(255,210,77,0.4)" font-size="13" font-weight="700" letter-spacing="2">${escapeHtml(floor.label || '')}</text>`);
  svg.innerHTML = parts.join('');
}

function selectRoom(id) {
  const floor = FLOORS[CURRENT_FLOOR];
  const room = floor.rooms.find(r => r.id === id);
  if (!room) return;
  document.querySelectorAll('.room').forEach(r => r.classList.remove('is-selected'));
  document.querySelector(`[data-room="${id}"]`)?.classList.add('is-selected');
  const typeLabel = ({ admin: 'Administrative', academic: 'Academic', lab: 'Laboratory', library: 'Library', support: 'Support Office', service: 'Service Area', public: 'Common Area', gate: 'Entrance / Exit' })[room.type] || 'Room';
  document.getElementById('mapSide').innerHTML = `
    <div class="map-side-content">
      <span class="bldg-cat">${typeLabel} . ${floor.name}</span>
      <h2>${escapeHtml(room.name)}</h2>
      <p class="bldg-desc">${escapeHtml(getRoomDesc(room))}</p>
      ${room.offices ? `<h4>What is inside</h4><div class="bldg-offices">${room.offices.map(o => `<div class="bldg-office"><div class="bldg-office-name">${escapeHtml(o.name)}</div><div class="bldg-office-room">${escapeHtml(o.room)}</div></div>`).join('')}</div>` : ''}
    </div>
  `;
}
function getRoomDesc(room) {
  if (room.type === 'admin') return 'Administrative office where transactions and student services are handled.';
  if (room.type === 'academic') return 'Classroom or academic department area.';
  if (room.type === 'lab') return 'Laboratory used for specialized classes.';
  if (room.type === 'library') return 'Quiet study area, references, and computers.';
  if (room.type === 'gate') return 'Building entrance or exit point.';
  return `${room.name}. Part of the CvSU Cavite City Main Building.`;
}
function focusRoom(id) {
  for (const fid of ['ground', 'second']) {
    if (FLOORS[fid].rooms.find(r => r.id === id)) {
      if (CURRENT_FLOOR !== fid) switchFloor(fid);
      setTimeout(() => selectRoom(id), 100);
      return;
    }
  }
}

// ============ FAQ ============
let activeFaqCat = 'All';
let faqData = [];
async function renderFaqs() {
  if (!faqData.length) {
    try {
      const { faqs } = await api('/api/public/faqs');
      faqData = faqs.map(f => ({ cat: f.category, q: f.question, a: f.answer }));
    } catch { faqData = []; }
  }
  const cats = ['All', ...new Set(faqData.map(f => f.cat))];
  document.getElementById('faqFilters').innerHTML = cats.map(c => `<button class="faq-chip ${c === activeFaqCat ? 'is-active' : ''}" onclick="filterFaq('${c}')">${escapeHtml(c)}</button>`).join('');
  const filtered = activeFaqCat === 'All' ? faqData : faqData.filter(f => f.cat === activeFaqCat);
  document.getElementById('faqList').innerHTML = filtered.map((f, idx) => `
    <div class="faq-item" data-idx="${idx}">
      <div class="faq-q" onclick="toggleFaq(${idx})">
        <div class="faq-q-text">${escapeHtml(f.q)}</div>
        <div class="faq-q-toggle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg></div>
      </div>
      <div class="faq-a">${escapeHtml(f.a)}</div>
    </div>
  `).join('');
}
function filterFaq(cat) { activeFaqCat = cat; renderFaqs(); }
function toggleFaq(idx) { document.querySelector(`.faq-item[data-idx="${idx}"]`)?.classList.toggle('is-open'); }

// ============ ASK STAFF ============
async function renderAskStaff() {
  const offices = await getOffices();
  document.getElementById('askOfficeGrid').innerHTML = offices.map(o => `
    <button type="button" class="ask-office-btn" data-office-id="${o.id}" onclick="selectAskOffice('${o.id}')">
      <div class="ask-office-icon" style="background:${o.color}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${o.icon_svg}</svg>
      </div>
      <div class="ask-office-name">${escapeHtml(o.name)}</div>
    </button>
  `).join('') + `
    <button type="button" class="ask-office-btn" data-office-id="" onclick="selectAskOffice('')">
      <div class="ask-office-icon" style="background:#888"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg></div>
      <div class="ask-office-name">General / Other</div>
    </button>
  `;
  // Pre-fill student info if available
  if (STATE.user) {
    document.getElementById('askName').value = STATE.user.name || '';
    document.getElementById('askEmail').value = STATE.user.email || '';
  }
  selectAskOffice(''); // default to general
}
function selectAskOffice(id) {
  document.querySelectorAll('.ask-office-btn').forEach(b => b.classList.toggle('is-active', b.dataset.officeId === id));
  STATE.askOfficeId = id;
}

async function submitInquiry() {
  const q = document.getElementById('askQuestion').value.trim();
  const name = document.getElementById('askName').value.trim();
  const email = document.getElementById('askEmail').value.trim();
  if (!q) return toast('Please type your question.', 'error');
  if (!email || !email.includes('@')) return toast('Please enter a valid Gmail address.', 'error');
  try {
    await api('/api/public/inquiries', {
      method: 'POST',
      body: { question: q, student_email: email, student_name: name || null, student_id: STATE.user?.id || null, office_id: STATE.askOfficeId || null },
    });
    STATE.thankYouMsg = 'Your question has been sent to the office staff.';
    STATE.thankYouRef = `Reply will be sent to ${email}`;
    showScreen('thankyou');
  } catch (e) {
    toast('Failed to send inquiry: ' + e.message, 'error');
  }
}

// ============ DOCUMENT REQUEST FLOW ============
async function startDocFlow() {
  STATE.request = { office: null, documents: [], refNumber: null, queueNumber: null, paymentMethod: null, paid: false, scheduledAt: null, totalFee: 0 };
  if (STATE.user && STATE.user.id) {
    showScreen('docselect');
  } else {
    showScreen('idgate');
  }
}

async function submitIdGate() {
  const id = document.getElementById('idgateInput').value.trim();
  if (!id) return toast('Please enter your Student Number.', 'error');
  try {
    const { student } = await api(`/api/public/student/${encodeURIComponent(id)}`);
    STATE.user = student;
    toast(`Welcome, ${student.name.split(' ')[0]}.`);
    showScreen('docselect');
  } catch {
    // Student not found - offer to generate
    if (confirm(`Student Number ${id} was not found. Would you like to generate a new QR for this number?`)) {
      document.getElementById('qrgenStudentId').value = id;
      showScreen('qrgen');
    }
  }
}

// QR Generation
async function generateQr() {
  const id = document.getElementById('qrgenStudentId').value.trim();
  const name = document.getElementById('qrgenStudentName').value.trim();
  if (!id || !name) return toast('Please enter both Student Number and Full Name.', 'error');
  try {
    const { qr_code } = await api('/api/public/qr-generate', { method: 'POST', body: { student_id: id, student_name: name } });
    STATE.user = { id, name, course: null, year: null, email: null };
    document.getElementById('qrResultCard').innerHTML = `
      <div class="qrresult-head">
        <h3>Your Student QR Code is Ready</h3>
        <p>Take a picture of this QR code or print it for your next transaction.</p>
      </div>
      <div class="qrresult-qr">${buildQrSvg(qr_code, 280)}</div>
      <div class="qrresult-meta">
        <div class="qrresult-row"><span>Student Number</span><span class="qrresult-val">${escapeHtml(id)}</span></div>
        <div class="qrresult-row"><span>Name</span><span class="qrresult-val">${escapeHtml(name)}</span></div>
        <div class="qrresult-row"><span>QR Code</span><span class="qrresult-val mono">${escapeHtml(qr_code)}</span></div>
        <div class="qrresult-row"><span>Generated</span><span class="qrresult-val">${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span></div>
      </div>
      <p class="qrresult-hint">Take a picture of this QR code for your next transaction or print it.</p>
    `;
    showScreen('qrresult');
  } catch (e) {
    toast('Failed to generate QR: ' + e.message, 'error');
  }
}

function printQrCard() { window.print(); }
function continueAfterQr() { showScreen('docselect'); }

// Multi-document selection
async function renderDocSelect() {
  const docs = await getDocuments();
  // Group by office
  const offices = await getOffices();
  const html = offices.map(o => {
    const officeDocs = docs.filter(d => d.office_id === o.id);
    if (!officeDocs.length) return '';
    return `
      <div class="docselect-office">
        <div class="docselect-office-head" style="--c:${o.color}">
          <div class="docselect-office-name">${escapeHtml(o.name)}</div>
          <div class="docselect-office-sub">${escapeHtml(o.full_name)}</div>
        </div>
        <div class="docselect-list">
          ${officeDocs.map(d => `
            <label class="docselect-card" data-doc-id="${d.id}" data-office-id="${o.id}" data-fee="${d.fee}" data-days="${d.processing_days}">
              <input type="checkbox" onchange="toggleDocSelect(this)" data-doc-id="${d.id}">
              <div class="docselect-card-body">
                <div class="docselect-card-name">${escapeHtml(d.name)}</div>
                <div class="docselect-card-meta">${escapeHtml(d.description)} . ${d.processing_days} ${d.processing_days === 1 ? 'day' : 'days'} processing</div>
              </div>
              <div class="docselect-card-fee">PHP ${d.fee}</div>
            </label>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
  document.getElementById('docselectGrid').innerHTML = html;
  STATE.request.documents = [];
  updateDocSelectFoot();
}

async function toggleDocSelect(checkbox) {
  const docId = checkbox.dataset.docId;
  const docs = await getDocuments();
  const doc = docs.find(d => d.id === docId);
  if (!doc) return;
  const card = checkbox.closest('.docselect-card');
  if (checkbox.checked) {
    // Enforce single-office (otherwise scheduling logic gets confusing)
    const existingOffice = STATE.request.documents[0]?.office_id;
    if (existingOffice && existingOffice !== doc.office_id) {
      checkbox.checked = false;
      toast('You can only pick documents from one office in one request. Submit another request afterwards for other offices.', 'error');
      return;
    }
    STATE.request.documents.push(doc);
    card.classList.add('is-selected');
  } else {
    STATE.request.documents = STATE.request.documents.filter(d => d.id !== docId);
    card.classList.remove('is-selected');
  }
  updateDocSelectFoot();
}

function updateDocSelectFoot() {
  const foot = document.getElementById('docselectFoot');
  const n = STATE.request.documents.length;
  if (!n) { foot.hidden = true; return; }
  foot.hidden = false;
  const total = STATE.request.documents.reduce((s, d) => s + Number(d.fee), 0);
  STATE.request.totalFee = total;
  STATE.request.office = STATE.request.documents[0].office_id;
  setText('docselectCount', `${n} document${n > 1 ? 's' : ''} selected`);
  setText('docselectTotal', `PHP ${total.toFixed(2)}`);
}

function goToSchedule() {
  if (!STATE.request.documents.length) return toast('Pick at least one document.', 'error');
  showScreen('schedule');
}

// ============ SCHEDULE ============
let SCHED_DATE = null;
let SCHED_SLOT = null;

function renderSchedule() {
  SCHED_DATE = null;
  SCHED_SLOT = null;
  document.getElementById('schedNextBtn').disabled = true;
  setText('schedSlotsTitle', 'Pick a date on the left, then a time slot.');
  document.getElementById('scheduleSlots').innerHTML = '<div class="sched-empty">Available slots will appear here once you choose a date.</div>';

  // Build a 14-day calendar starting from today (skip weekends)
  const days = [];
  const today = new Date();
  for (let i = 0; i < 21 && days.length < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;
    days.push(d);
  }
  document.getElementById('scheduleCalendar').innerHTML = `
    <div class="sched-cal-head">Pick a date</div>
    <div class="sched-cal-grid">
      ${days.map(d => `
        <button class="sched-day" data-date="${d.toISOString().slice(0,10)}" onclick="pickSchedDate('${d.toISOString().slice(0,10)}', this)">
          <div class="sched-day-dow">${d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
          <div class="sched-day-num">${d.getDate()}</div>
          <div class="sched-day-mo">${d.toLocaleDateString('en-US', { month: 'short' })}</div>
        </button>
      `).join('')}
    </div>
  `;
}

async function pickSchedDate(date, btn) {
  document.querySelectorAll('.sched-day').forEach(d => d.classList.remove('is-active'));
  btn.classList.add('is-active');
  SCHED_DATE = date;
  SCHED_SLOT = null;
  document.getElementById('schedNextBtn').disabled = true;
  setText('schedSlotsTitle', `Available time slots on ${new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`);
  document.getElementById('scheduleSlots').innerHTML = '<div class="sched-empty">Loading...</div>';
  try {
    const { slots } = await api(`/api/public/schedule-availability?office_id=${STATE.request.office}&date=${date}`);
    if (!slots.length) {
      document.getElementById('scheduleSlots').innerHTML = '<div class="sched-empty">No slots available on this date.</div>';
      return;
    }
    document.getElementById('scheduleSlots').innerHTML = slots.map(s => {
      const isFull = s.available <= 0;
      const time = `${formatHour(s.hour)} - ${formatHour(s.hour + 1)}`;
      return `
        <button class="sched-slot ${isFull ? 'is-full' : ''}" data-start="${s.start}" ${isFull ? 'disabled' : `onclick="pickSchedSlot('${s.start}', this)"`}>
          <div class="sched-slot-time">${time}</div>
          <div class="sched-slot-cap">
            ${isFull ? 'Full' : `${s.available} of ${s.capacity} slots open`}
          </div>
        </button>
      `;
    }).join('');
  } catch (e) {
    document.getElementById('scheduleSlots').innerHTML = '<div class="sched-empty">Could not load slots: ' + escapeHtml(e.message) + '</div>';
  }
}
function pickSchedSlot(startIso, btn) {
  document.querySelectorAll('.sched-slot').forEach(s => s.classList.remove('is-active'));
  btn.classList.add('is-active');
  SCHED_SLOT = startIso;
  STATE.request.scheduledAt = startIso;
  document.getElementById('schedNextBtn').disabled = false;
}
function formatHour(h) {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:00 ${ampm}`;
}

function goToPayment() {
  if (!SCHED_SLOT) return toast('Pick a time slot.', 'error');
  showScreen('payment');
}

// ============ PAYMENT ============
function renderPayment() {
  const r = STATE.request;
  const u = STATE.user || { name: 'Guest', id: '---' };
  const sched = new Date(r.scheduledAt);
  document.getElementById('paymentReviewCard').innerHTML = `
    <div class="review-row"><div class="review-label">Student</div><div class="review-value">${escapeHtml(u.name)}${u.id ? ` <span style="color:var(--c-mute);font-weight:500"> . ${u.id}</span>` : ''}</div></div>
    <div class="review-row"><div class="review-label">Office</div><div class="review-value">${escapeHtml(r.office.toUpperCase())}</div></div>
    <div class="review-row"><div class="review-label">Documents (${r.documents.length})</div><div class="review-value" style="text-align:right">${r.documents.map(d => `${escapeHtml(d.name)} <span style="color:var(--c-mute);font-weight:500">. PHP ${d.fee}</span>`).join('<br>')}</div></div>
    <div class="review-row"><div class="review-label">Claim Schedule</div><div class="review-value">${sched.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} . ${formatHour(sched.getHours())} - ${formatHour(sched.getHours() + 1)}</div></div>
    <div class="review-row"><div class="review-label">Total Fee</div><div class="review-value review-value--big">PHP ${r.totalFee.toFixed(2)}</div></div>
  `;
}

async function selectPay(method) {
  const r = STATE.request;
  r.paymentMethod = method;
  const u = STATE.user || { name: 'Guest User', id: null };
  try {
    const { request } = await api('/api/public/requests', {
      method: 'POST',
      body: {
        student_id: u.id,
        student_name: u.name,
        office_id: r.office,
        document_ids: r.documents.map(d => d.id),
        payment_method: method,
        scheduled_at: r.scheduledAt,
      },
    });
    r.refNumber = request.ref_number;
    r.queueNumber = request.queue_number;
    r.paid = !!request.paid;
    if (method === 'ewallet') showQrPay();
    else showReceipt();
  } catch (e) {
    toast('Failed to submit request: ' + e.message, 'error');
  }
}

function showQrPay() {
  showScreen('qrpay');
  setText('qrAmount', `PHP ${STATE.request.totalFee.toFixed(2)}`);
  setText('qrRef', `REF: ${STATE.request.refNumber}`);
  document.getElementById('qrCode').innerHTML = buildQrSvg(STATE.request.refNumber, 280);
}

async function finishPayment() {
  try {
    await api(`/api/public/requests/${STATE.request.refNumber}/pay`, { method: 'POST' });
    STATE.request.paid = true;
    toast('Payment confirmed. Your receipt is ready.');
    showReceipt();
  } catch (e) { toast('Could not confirm payment: ' + e.message, 'error'); }
}

// ============ RECEIPT ============
function showReceipt() {
  showScreen('receipt');
  const r = STATE.request;
  const u = STATE.user || { name: 'Guest', id: '---' };
  const sched = new Date(r.scheduledAt);
  const paid = r.paid ? 'PAID' : 'UNPAID. Pay at Cashier.';
  const paidColor = r.paid ? 'var(--c-green)' : '#E53935';
  document.getElementById('receiptCard').innerHTML = `
    <div class="receipt-head">
      <div class="receipt-check">
        ${r.paid
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 8v4M12 16h.01"/><circle cx="12" cy="12" r="9"/></svg>'}
      </div>
      <div class="receipt-title">CAVITE STATE UNIVERSITY</div>
      <div class="receipt-sub">Cavite City Campus . Document Request</div>
    </div>
    <div class="receipt-ref">
      <div class="receipt-ref-label">Reference Number</div>
      <div class="receipt-ref-num">${r.refNumber}</div>
    </div>
    <div class="receipt-rows">
      <div class="receipt-row"><span class="receipt-row-label">Student</span><span class="receipt-row-value">${escapeHtml(u.name)}</span></div>
      ${u.id ? `<div class="receipt-row"><span class="receipt-row-label">Student ID</span><span class="receipt-row-value">${u.id}</span></div>` : ''}
      <div class="receipt-row"><span class="receipt-row-label">Office</span><span class="receipt-row-value">${escapeHtml(r.office.toUpperCase())}</span></div>
      <div class="receipt-row"><span class="receipt-row-label">Documents</span><span class="receipt-row-value" style="text-align:right">${r.documents.map(d => escapeHtml(d.name)).join('<br>')}</span></div>
      <div class="receipt-row"><span class="receipt-row-label">Queue Number</span><span class="receipt-row-value">#${r.queueNumber}</span></div>
      <div class="receipt-row"><span class="receipt-row-label">Claim Schedule</span><span class="receipt-row-value">${sched.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}<br>${formatHour(sched.getHours())} - ${formatHour(sched.getHours()+1)}</span></div>
      <div class="receipt-row"><span class="receipt-row-label">Payment Method</span><span class="receipt-row-value">${r.paymentMethod === 'ewallet' ? 'E-Wallet (QR Ph)' : 'Cash at Cashier'}</span></div>
      <div class="receipt-row"><span class="receipt-row-label">Status</span><span class="receipt-row-value" style="color:${paidColor};font-weight:700">${paid}</span></div>
      <div class="receipt-row receipt-row--big"><span class="receipt-row-label">Total Fee</span><span class="receipt-row-value">PHP ${r.totalFee.toFixed(2)}</span></div>
    </div>
    <div class="receipt-foot">Bring this receipt and a valid ID when claiming your documents.<br>Generated on ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</div>
  `;
}
function printReceipt() { window.print(); }

// ============ THANK YOU ============
function runThankYou() {
  const r = STATE.request;
  if (r && r.refNumber) {
    setText('thankYouSub', `Your reference number is ready. Please claim your documents on the scheduled time.`);
    document.getElementById('thankYouRef').innerHTML = `<span class="ty-ref-label">Reference</span><span class="ty-ref-num">${r.refNumber}</span>`;
  } else if (STATE.thankYouMsg) {
    setText('thankYouSub', STATE.thankYouMsg);
    document.getElementById('thankYouRef').innerHTML = STATE.thankYouRef ? `<span class="ty-ref-label">Note</span><span class="ty-ref-note">${escapeHtml(STATE.thankYouRef)}</span>` : '';
  } else {
    setText('thankYouSub', 'Action completed successfully.');
    document.getElementById('thankYouRef').innerHTML = '';
  }
  // Reset transient data
  STATE.thankYouMsg = null;
  STATE.thankYouRef = null;
  // Auto-redirect countdown
  let n = 10;
  setText('thankYouCount', n);
  THANKYOU_TIMER = setInterval(() => {
    n -= 1;
    setText('thankYouCount', n);
    if (n <= 0) { clearInterval(THANKYOU_TIMER); goHome(); }
  }, 1000);
}

// ============ QUEUE ============
async function renderQueue() {
  const grid = document.getElementById('queueGrid');
  grid.innerHTML = '<div style="color:var(--c-mute);padding:40px;text-align:center;grid-column:1/-1">Loading...</div>';
  try {
    const offices = await getOffices();
    const { queues } = await api('/api/public/queues');
    grid.innerHTML = offices.map(o => {
      const q = queues[o.id] || { current: 0, waiting: 0, avg_min: 3 };
      return `
        <div class="queue-card" style="--accent:${o.color}">
          <div class="queue-card-head">
            <div class="queue-icon" style="background:${o.color}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${o.icon_svg}</svg></div>
            <div>
              <div class="queue-office-name">${escapeHtml(o.name)}</div>
              <div class="queue-office-status">Online . Now serving</div>
            </div>
          </div>
          <div class="queue-now"><div class="queue-now-label">Now Serving</div><div class="queue-now-num">${String(q.current).padStart(3, '0')}</div></div>
          <div class="queue-stats">
            <div class="queue-stat"><div class="queue-stat-num">${q.waiting}</div><div class="queue-stat-label">In Queue</div></div>
            <div class="queue-stat"><div class="queue-stat-num">~${q.avg_min * q.waiting}m</div><div class="queue-stat-label">Est. Wait</div></div>
          </div>
        </div>
      `;
    }).join('');
  } catch {
    grid.innerHTML = '<div style="color:var(--c-red);padding:40px;text-align:center;grid-column:1/-1">Failed to load queue data.</div>';
  }
}

// ============ MISSION ============
async function renderMission() {
  try {
    const { mission } = await api('/api/public/mission');
    if (!mission) return;
    document.querySelector('[data-screen="mission"] .mv-grid').innerHTML = `
      <div class="mv-card"><div class="mv-card-tag">Vision</div><p>${escapeHtml(mission.vision)}</p></div>
      <div class="mv-card"><div class="mv-card-tag">Mission</div><p>${escapeHtml(mission.mission)}</p></div>
      <div class="mv-card"><div class="mv-card-tag">Core Values</div><p>${escapeHtml(mission.core_values)}</p></div>
    `;
  } catch {}
}

// ============ FAKE QR SVG GENERATOR ============
function buildQrSvg(seedStr, sizePx) {
  const seed = seedStr.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const cells = 25;
  let svg = `<svg viewBox="0 0 ${cells} ${cells}" xmlns="http://www.w3.org/2000/svg" style="width:${sizePx}px;height:${sizePx}px">`;
  svg += `<rect width="${cells}" height="${cells}" fill="white"/>`;
  const m = (x, y) => {
    svg += `<rect x="${x}" y="${y}" width="7" height="7" fill="black"/>`;
    svg += `<rect x="${x+1}" y="${y+1}" width="5" height="5" fill="white"/>`;
    svg += `<rect x="${x+2}" y="${y+2}" width="3" height="3" fill="black"/>`;
  };
  m(0, 0); m(cells-7, 0); m(0, cells-7);
  let s = seed;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      if ((x < 8 && y < 8) || (x > cells-9 && y < 8) || (x < 8 && y > cells-9)) continue;
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      if (s % 2 === 0) svg += `<rect x="${x}" y="${y}" width="1" height="1" fill="black"/>`;
    }
  }
  svg += '</svg>';
  return svg;
}

// ============ HELPERS ============
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let toastTimer = null;
function toast(msg, kind = 'ok') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (kind === 'error' ? ' toast--error' : '');
  requestAnimationFrame(() => t.classList.add('is-show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-show'), 2800);
}

// ============ INIT ============
window.addEventListener('DOMContentLoaded', () => {
  tickClock();
  setInterval(tickClock, 30000);
  renderHome();
  startSlideshow();

  setInterval(() => {
    const active = document.querySelector('.screen.active')?.dataset.screen;
    if (active === 'queue') renderQueue();
    if (active === 'home') renderHome();
  }, 30000);

  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('is-open'); });
  });
  document.getElementById('helpDrawer')?.addEventListener('click', e => {
    if (e.target.id === 'helpDrawer') closeHelp();
  });

  document.getElementById('idgateInput')?.addEventListener('keypress', e => { if (e.key === 'Enter') submitIdGate(); });
});
