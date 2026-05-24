/* CvSU Kiosk - Frontend Application
   Talks to the backend API for all data. Renders the kiosk UI.
*/

const STATE = {
  user: null,
  request: {
    office: null, document: null, refNumber: null,
    queueNumber: null, paymentMethod: null, paid: false, releaseDate: null
  },
  currentStep: 1,
  cache: { offices: null, documents: null, announcements: null, faqs: null, buildings: null, mission: null }
};

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
  ['topbarClock','topbarClockMap','topbarClockAnn','topbarClockFaq','topbarClockDoc','topbarClockQr','topbarClockRcp','topbarClockQ','topbarClockMV'].forEach(id => setText(id, tStr));
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.querySelector(`[data-screen="${name}"]`);
  if (target) target.classList.add('active');

  if (name === 'menu') renderMenu();
  if (name === 'announce') renderAnnouncements();
  if (name === 'faq') renderFaqs();
  if (name === 'docrequest') startDocRequest();
  if (name === 'queue') renderQueue();
  if (name === 'map') renderMap();
  if (name === 'mission') renderMission();
}

function goWelcome() {
  STATE.user = null;
  showScreen('welcome');
}

function enterAsGuest() {
  STATE.user = { name: 'Guest User', id: null, course: null };
  showScreen('menu');
}

function openLogin() {
  document.getElementById('loginModal').classList.add('is-open');
  setTimeout(() => document.getElementById('loginIdInput').focus(), 100);
}
function closeLogin() {
  document.getElementById('loginModal').classList.remove('is-open');
}

async function manualLogin() {
  const input = document.getElementById('loginIdInput').value.trim();
  if (!input) return toast('Please enter a Student ID', 'error');
  try {
    const { student } = await api(`/api/public/student/${encodeURIComponent(input)}`);
    STATE.user = student;
    closeLogin();
    toast(`Welcome, ${student.name.split(' ')[0]}.`);
    showScreen('menu');
  } catch (e) {
    toast('Student ID not found. Try 202301234 for demo.', 'error');
  }
}

async function demoLogin() {
  try {
    const { student } = await api('/api/public/student/202301234');
    STATE.user = student;
    closeLogin();
    toast(`Welcome, ${student.name.split(' ')[0]}.`);
    showScreen('menu');
  } catch (e) {
    toast('Demo student not available.', 'error');
  }
}

async function renderMenu() {
  const u = STATE.user || { name: 'Guest User', course: null };
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  setText('menuGreet', `${greet}.`);
  setText('menuUser', u.id ? `${u.name} . ${u.course} ${u.year}` : 'Guest User');

  try {
    const { queues } = await api('/api/public/queues');
    const offices = await getOffices();
    const items = offices.map(o => {
      const q = queues[o.id] || { current: 0, waiting: 0 };
      return `${o.name}: now serving #${q.current} . ${q.waiting} waiting`;
    });
    setText('liveTicker', items.join('   .   ') + '   .   ' + items.join('   .   '));
    const totalWaiting = Object.values(queues).reduce((s, q) => s + (q.waiting || 0), 0);
    setText('statQueue', totalWaiting);
    const docs = await getDocuments();
    setText('statDocs', docs.length);
  } catch (e) { console.error(e); }
}

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

async function renderMap() {
  if (!STATE.cache.buildings) {
    const { buildings } = await api('/api/public/buildings');
    STATE.cache.buildings = buildings;
  }
}

async function selectBuilding(id) {
  await renderMap();
  document.querySelectorAll('.map-building').forEach(b => b.classList.remove('is-selected'));
  document.querySelector(`[data-bldg="${id}"]`)?.classList.add('is-selected');

  const b = STATE.cache.buildings[id];
  if (!b) return;
  const side = document.getElementById('mapSide');
  side.innerHTML = `
    <div class="map-side-content">
      <span class="bldg-cat">${b.category}</span>
      <h2>${b.name}</h2>
      <p class="bldg-desc">${b.desc}</p>
      <h4>Offices and Rooms</h4>
      <div class="bldg-offices">
        ${b.offices.map(o => `
          <div class="bldg-office">
            <div class="bldg-office-name">${o.name}</div>
            <div class="bldg-office-room">${o.room}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

async function renderAnnouncements() {
  const grid = document.getElementById('announceGrid');
  grid.innerHTML = '<div style="color:var(--c-mute);padding:40px;text-align:center;grid-column:1/-1">Loading...</div>';
  try {
    const { announcements } = await api('/api/public/announcements');
    if (!announcements.length) {
      grid.innerHTML = '<div style="color:var(--c-mute);padding:40px;text-align:center;grid-column:1/-1">No announcements yet.</div>';
      return;
    }
    grid.innerHTML = announcements.map(a => `
      <article class="announce-card ${a.featured ? 'announce-card--featured' : ''}">
        <span class="announce-tag tag--${a.type}">${a.type}</span>
        <h3 class="announce-title">${escapeHtml(a.title)}</h3>
        <p class="announce-body">${escapeHtml(a.body)}</p>
        <div class="announce-foot">
          <span>${escapeHtml(a.date_text || '')}</span>
          <span>${escapeHtml(a.author || '')}</span>
        </div>
      </article>
    `).join('');
  } catch (e) {
    grid.innerHTML = '<div style="color:var(--c-red);padding:40px;text-align:center;grid-column:1/-1">Failed to load announcements.</div>';
  }
}

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
  const filters = document.getElementById('faqFilters');
  filters.innerHTML = cats.map(c => `
    <button class="faq-chip ${c === activeFaqCat ? 'is-active' : ''}" onclick="filterFaq('${c}')">${escapeHtml(c)}</button>
  `).join('');

  const list = document.getElementById('faqList');
  const filtered = activeFaqCat === 'All' ? faqData : faqData.filter(f => f.cat === activeFaqCat);
  list.innerHTML = filtered.map((f, idx) => `
    <div class="faq-item" data-idx="${idx}">
      <div class="faq-q" onclick="toggleFaq(${idx})">
        <div class="faq-q-text">${escapeHtml(f.q)}</div>
        <div class="faq-q-toggle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
        </div>
      </div>
      <div class="faq-a">${escapeHtml(f.a)}</div>
    </div>
  `).join('');
}
function filterFaq(cat) { activeFaqCat = cat; renderFaqs(); }
function toggleFaq(idx) {
  document.querySelector(`.faq-item[data-idx="${idx}"]`)?.classList.toggle('is-open');
}

async function startDocRequest() {
  STATE.request = { office: null, document: null, refNumber: null, queueNumber: null, paymentMethod: null, paid: false, releaseDate: null };
  STATE.currentStep = 1;
  goDocStep(1);
  await renderOfficeGrid();
}
function docRequestBack() {
  if (STATE.currentStep > 1) goDocStep(STATE.currentStep - 1);
  else showScreen('menu');
}
function goDocStep(step) {
  STATE.currentStep = step;
  document.querySelectorAll('.doc-step').forEach(d => {
    d.style.display = parseInt(d.dataset.step) === step ? 'block' : 'none';
  });
  document.querySelectorAll('.step-item').forEach((item, i) => {
    item.classList.remove('is-active', 'is-done');
    if (i + 1 === step) item.classList.add('is-active');
    if (i + 1 < step) item.classList.add('is-done');
  });
  const names = ['Select Office', 'Pick Document', 'Review Request', 'Choose Payment'];
  setText('docStepLabel', `Step ${step} of 4 . ${names[step-1]}`);
  if (step === 2) renderDocsGrid();
  if (step === 3) renderReview();
}

async function renderOfficeGrid() {
  const grid = document.getElementById('officeGrid');
  const offices = await getOffices();
  grid.innerHTML = offices.map(o => `
    <button class="office-card" onclick="selectOffice('${o.id}')">
      <div class="office-card-icon" style="background:${o.color}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${o.icon_svg}</svg>
      </div>
      <div class="office-card-name">${escapeHtml(o.name)}</div>
      <div class="office-card-desc">${escapeHtml(o.description)}</div>
    </button>
  `).join('');
}

async function selectOffice(id) {
  const offices = await getOffices();
  STATE.request.office = offices.find(o => o.id === id);
  goDocStep(2);
}

async function renderDocsGrid() {
  const grid = document.getElementById('docsGrid');
  const docs = await getDocuments();
  const filtered = docs.filter(d => d.office_id === STATE.request.office.id);
  grid.innerHTML = filtered.map(d => `
    <button class="doc-card" onclick="selectDoc('${d.id}')">
      <div class="doc-card-body">
        <div class="doc-card-name">${escapeHtml(d.name)}</div>
        <div class="doc-card-meta">${escapeHtml(d.description)} . ${d.processing_days} ${d.processing_days === 1 ? 'day' : 'days'} processing</div>
      </div>
      <div class="doc-card-fee">PHP ${d.fee}</div>
    </button>
  `).join('');
}

async function selectDoc(id) {
  const docs = await getDocuments();
  STATE.request.document = docs.find(d => d.id === id);
  goDocStep(3);
}

function renderReview() {
  const r = STATE.request;
  const u = STATE.user || { name: 'Guest', id: '---' };
  const release = addBusinessDays(new Date(), r.document.processing_days);
  STATE.request.releaseDate = release;

  document.getElementById('reviewCard').innerHTML = `
    <div class="review-row">
      <div class="review-label">Student</div>
      <div class="review-value">${escapeHtml(u.name)}${u.id ? ` <span style="color:var(--c-mute);font-weight:500"> . ${u.id}</span>` : ''}</div>
    </div>
    <div class="review-row">
      <div class="review-label">Office</div>
      <div class="review-value">${escapeHtml(r.office.full_name)}</div>
    </div>
    <div class="review-row">
      <div class="review-label">Document</div>
      <div class="review-value">${escapeHtml(r.document.name)}</div>
    </div>
    <div class="review-row">
      <div class="review-label">Processing Days</div>
      <div class="review-value">${r.document.processing_days} ${r.document.processing_days === 1 ? 'working day' : 'working days'}</div>
    </div>
    <div class="review-row">
      <div class="review-label">Estimated Pickup</div>
      <div class="review-value">${release.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
    </div>
    <div class="review-row">
      <div class="review-label">Total Fee</div>
      <div class="review-value review-value--big">PHP ${r.document.fee}.00</div>
    </div>
  `;
}

function addBusinessDays(date, days) {
  const r = new Date(date);
  let added = 0;
  while (added < days) {
    r.setDate(r.getDate() + 1);
    const d = r.getDay();
    if (d !== 0 && d !== 6) added++;
  }
  return r;
}

async function selectPay(method) {
  STATE.request.paymentMethod = method;
  const u = STATE.user || { name: 'Guest User', id: null };
  try {
    const { request } = await api('/api/public/requests', {
      method: 'POST',
      body: {
        student_id: u.id,
        student_name: u.name,
        office_id: STATE.request.office.id,
        document_id: STATE.request.document.id,
        payment_method: method,
      },
    });
    STATE.request.refNumber = request.ref_number;
    STATE.request.queueNumber = request.queue_number;
    STATE.request.paid = !!request.paid;
    STATE.request.releaseDate = new Date(request.release_date);

    if (method === 'ewallet') showQrPay();
    else showReceipt();
  } catch (e) {
    toast('Failed to submit request. Please try again.', 'error');
  }
}

function showQrPay() {
  showScreen('qrpay');
  setText('qrAmount', `PHP ${STATE.request.document.fee}.00`);
  setText('qrRef', `REF: ${STATE.request.refNumber}`);
  renderQrCode();
}

function renderQrCode() {
  const ref = STATE.request.refNumber;
  const seed = ref.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const cells = 25;
  let svg = `<svg viewBox="0 0 ${cells} ${cells}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">`;
  svg += `<rect width="${cells}" height="${cells}" fill="white"/>`;
  const marker = (x, y) => {
    svg += `<rect x="${x}" y="${y}" width="7" height="7" fill="black"/>`;
    svg += `<rect x="${x+1}" y="${y+1}" width="5" height="5" fill="white"/>`;
    svg += `<rect x="${x+2}" y="${y+2}" width="3" height="3" fill="black"/>`;
  };
  marker(0, 0); marker(cells-7, 0); marker(0, cells-7);
  let s = seed;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      if ((x < 8 && y < 8) || (x > cells-9 && y < 8) || (x < 8 && y > cells-9)) continue;
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      if (s % 2 === 0) svg += `<rect x="${x}" y="${y}" width="1" height="1" fill="black"/>`;
    }
  }
  svg += '</svg>';
  document.getElementById('qrCode').innerHTML = svg;
}

async function finishPayment() {
  try {
    await api(`/api/public/requests/${STATE.request.refNumber}/pay`, { method: 'POST' });
    STATE.request.paid = true;
    toast('Payment confirmed. Your receipt is ready.');
    showReceipt();
  } catch (e) {
    toast('Could not confirm payment.', 'error');
  }
}

function showReceipt() {
  showScreen('receipt');
  const r = STATE.request;
  const u = STATE.user || { name: 'Guest', id: '---' };
  const card = document.getElementById('receiptCard');
  const paid = r.paid ? 'PAID' : 'UNPAID. Pay at Cashier.';
  const paidColor = r.paid ? 'var(--c-green)' : '#E53935';
  card.innerHTML = `
    <div class="receipt-head">
      <div class="receipt-check">
        ${r.paid
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 8v4M12 16h.01"/><circle cx="12" cy="12" r="9"/></svg>'
        }
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
      <div class="receipt-row"><span class="receipt-row-label">Office</span><span class="receipt-row-value">${escapeHtml(r.office.name)}</span></div>
      <div class="receipt-row"><span class="receipt-row-label">Document</span><span class="receipt-row-value">${escapeHtml(r.document.name)}</span></div>
      <div class="receipt-row"><span class="receipt-row-label">Queue Number</span><span class="receipt-row-value">#${r.queueNumber}</span></div>
      <div class="receipt-row"><span class="receipt-row-label">Pickup On or After</span><span class="receipt-row-value">${r.releaseDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
      <div class="receipt-row"><span class="receipt-row-label">Payment Method</span><span class="receipt-row-value">${r.paymentMethod === 'ewallet' ? 'E-Wallet (QR Ph)' : 'Cash at Cashier'}</span></div>
      <div class="receipt-row"><span class="receipt-row-label">Status</span><span class="receipt-row-value" style="color:${paidColor};font-weight:700">${paid}</span></div>
      <div class="receipt-row receipt-row--big"><span class="receipt-row-label">Total Fee</span><span class="receipt-row-value">PHP ${r.document.fee}.00</span></div>
    </div>
    <div class="receipt-foot">
      Bring this receipt and a valid ID when claiming your document.<br>
      Generated on ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
    </div>
  `;
}
function printReceipt() { window.print(); }

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
            <div class="queue-icon" style="background:${o.color}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${o.icon_svg}</svg>
            </div>
            <div>
              <div class="queue-office-name">${escapeHtml(o.name)}</div>
              <div class="queue-office-status">Online . Now serving</div>
            </div>
          </div>
          <div class="queue-now">
            <div class="queue-now-label">Now Serving</div>
            <div class="queue-now-num">${String(q.current).padStart(3, '0')}</div>
          </div>
          <div class="queue-stats">
            <div class="queue-stat">
              <div class="queue-stat-num">${q.waiting}</div>
              <div class="queue-stat-label">In Queue</div>
            </div>
            <div class="queue-stat">
              <div class="queue-stat-num">~${q.avg_min * q.waiting}m</div>
              <div class="queue-stat-label">Est. Wait</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    grid.innerHTML = '<div style="color:var(--c-red);padding:40px;text-align:center;grid-column:1/-1">Failed to load queue data.</div>';
  }
}

async function renderMission() {
  try {
    const { mission } = await api('/api/public/mission');
    if (!mission) return;
    document.querySelector('[data-screen="mission"] .mv-grid').innerHTML = `
      <div class="mv-card">
        <div class="mv-card-tag">Vision</div>
        <p>${escapeHtml(mission.vision)}</p>
      </div>
      <div class="mv-card">
        <div class="mv-card-tag">Mission</div>
        <p>${escapeHtml(mission.mission)}</p>
      </div>
      <div class="mv-card">
        <div class="mv-card-tag">Core Values</div>
        <p>${escapeHtml(mission.core_values)}</p>
      </div>
    `;
  } catch (e) { console.error(e); }
}

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

window.addEventListener('DOMContentLoaded', () => {
  tickClock();
  setInterval(tickClock, 1000 * 30);

  setInterval(() => {
    const active = document.querySelector('.screen.active')?.dataset.screen;
    if (active === 'queue') renderQueue();
    if (active === 'menu') renderMenu();
  }, 30000);

  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('is-open'); });
  });

  document.getElementById('loginIdInput')?.addEventListener('keypress', e => {
    if (e.key === 'Enter') manualLogin();
  });
});
