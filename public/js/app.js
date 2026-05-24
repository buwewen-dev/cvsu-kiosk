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

// ============ FLOOR PLAN DATA ============
// Coordinates are within a 1210x620 viewBox matching the actual main building proportions.
const FLOORS = {
  ground: {
    name: 'Ground Floor',
    label: 'GROUND FLOOR PLAN',
    rooms: [
      // Left wing (HRM and Chem)
      { id: 'cold-kitchen',   name: 'HRM Lab Cold Kitchen', type: 'lab',    x: 10,  y: 30,  w: 140, h: 150 },
      { id: 'hot-kitchen',    name: 'HRM Lab Hot Kitchen',  type: 'lab',    x: 10,  y: 180, w: 140, h: 175 },
      { id: 'chem-lab',       name: 'Chem Laboratory',      type: 'lab',    x: 10,  y: 395, w: 140, h: 200 },

      // Center top
      { id: 'housekeeping',   name: 'Housekeeping Laboratory', type: 'lab',     x: 190, y: 30,  w: 230, h: 120 },
      { id: 'hotel-chabacano',name: 'Hotel El Chabacano',      type: 'academic',x: 190, y: 150, w: 130, h: 150 },
      { id: 'chabacano-ext',  name: 'Chabacano Extension',     type: 'academic',x: 320, y: 150, w: 100, h: 80 },
      { id: 'cr1',            name: 'Comfort Room',            type: 'service', label: 'CR', x: 420, y: 200, w: 50, h: 50 },
      { id: 'stockroom',      name: 'HRM Stockroom',           type: 'support',x: 320, y: 230, w: 100, h: 70 },
      { id: 'it-dept',        name: 'Information Technology Department', type: 'academic', x: 190, y: 300, w: 230, h: 100, isHighlight: true, shortName: 'IT Department' },
      { id: 'mis',            name: 'MIS',                     type: 'support',x: 420, y: 300, w: 100, h: 100 },

      // Bottom row
      { id: 'guidance',       name: 'Guidance Office',         type: 'support',x: 190, y: 440, w: 130, h: 60 },
      { id: 'counseling',     name: 'Counseling Area',         type: 'support',x: 190, y: 500, w: 80, h: 100 },
      { id: 'osas',           name: 'OSAS',                    type: 'admin',  x: 270, y: 500, w: 75, h: 100, isKiosk: true, shortName: 'OSAS',
        offices: [{ name: 'Office of Student Affairs and Services', room: 'Rm 105' }] },
      { id: 'css-office',     name: 'CSS Office',              type: 'support',x: 345, y: 440, w: 135, h: 50 },
      { id: 'classroom-114a', name: 'Classroom 114-A',         type: 'academic',x: 345, y: 490, w: 135, h: 110 },
      { id: 'support-staff',  name: 'Support Staff',           type: 'support',x: 480, y: 440, w: 85, h: 45 },
      { id: 'pps-office',     name: 'PPS / Supply Office',     type: 'support',x: 480, y: 485, w: 85, h: 90 },
      { id: 'oja-office',     name: 'OjA Office',              type: 'support',x: 480, y: 575, w: 85, h: 25 },
      { id: 'lobby1',         name: 'Main Lobby',              type: 'public', x: 565, y: 405, w: 130, h: 50 },
      { id: 'admin-office',   name: 'Admin Office',            type: 'admin',  x: 565, y: 455, w: 130, h: 145, isHighlight: true, shortName: 'Admin Office' },

      // Top right wing
      { id: 'cr2',            name: 'Comfort Room',            type: 'service', label: 'CR', x: 695, y: 250, w: 50, h: 50 },
      { id: 'registrar',      name: "Registrar's Office",      type: 'admin',  x: 565, y: 300, w: 130, h: 105, isKiosk: true, shortName: 'Registrar',
        offices: [{ name: 'Office of the University Registrar', room: 'Rm 101' }] },
      { id: 'accounting',     name: 'Accounting Office',       type: 'admin',  x: 695, y: 300, w: 110, h: 105, isKiosk: true, shortName: 'Cashier',
        offices: [{ name: 'University Cashier / Accounting', room: 'Window 1-3' }] },
      { id: 'rm103',          name: 'Rm 103',                  type: 'academic',x: 805, y: 300, w: 130, h: 105 },
      { id: 'rce-office',     name: 'RCE Office',              type: 'support',x: 935, y: 300, w: 90, h: 105 },
      { id: 'records-room',   name: 'Records Room',            type: 'admin',  x: 1025,y: 300, w: 110, h: 105 },
      { id: 'shel',           name: 'Shel',                    type: 'support',label: 'SHE', x: 1135,y: 300, w: 30, h: 75 },
      { id: 'elec-room',      name: 'Electrical Room',         type: 'service',label: 'ELEC',x: 1165,y: 300, w: 35, h: 75 },

      // Stairs
      { id: 'stairs-g1',      name: 'Stairs (UP)',             type: 'service',label: 'UP', x: 745, y: 405, w: 60, h: 35 },
      { id: 'stairs-g2',      name: 'Stairs (DN)',             type: 'service',label: 'DN', x: 1135,y: 375, w: 50, h: 30 },

      // Bottom right labs
      { id: 'lobby2',         name: 'Lobby',                   type: 'public', x: 565, y: 600, w: 80, h: 0 },
      { id: 'computer-lab',   name: 'Computer Lab 104-B',      type: 'lab',    x: 645, y: 470, w: 135, h: 130, isHighlight: true, shortName: 'Computer Lab' },
      { id: 'new-lab-2',      name: 'New Lab 2',               type: 'lab',    x: 780, y: 470, w: 180, h: 130 },
      { id: 'new-lab-1',      name: 'New Lab 1',               type: 'lab',    x: 960, y: 470, w: 175, h: 130 },
      { id: 'lp-stair',       name: 'Stairs', type: 'service', label: 'UP', x: 1135,y: 470, w: 50, h: 50 },

      // Exits
      { id: 'main-gate',      name: 'MAIN ENTRANCE',           type: 'gate',   x: 320, y: 600, w: 220, h: 20 },
      { id: 'east-exit',      name: 'East Exit',               type: 'gate', label: 'EXIT', x: 1150,y: 220, w: 50, h: 30 },
    ],
  },

  second: {
    name: 'Second Floor',
    label: 'SECOND FLOOR PLAN',
    rooms: [
      // Left wing
      { id: 'fire-exit',      name: 'Fire Exit (DN)',          type: 'service',label: 'FIRE EXIT', x: 10, y: 10, w: 140, h: 40 },
      { id: 'room-218',       name: 'Room 218',                type: 'academic',x: 10, y: 60, w: 140, h: 140 },
      { id: 'room-217',       name: 'Room 217',                type: 'academic',x: 10, y: 200, w: 140, h: 110 },
      { id: 'room-216',       name: 'Room 216',                type: 'academic',x: 10, y: 310, w: 140, h: 140 },
      { id: 'room-215',       name: 'Room 215 (Science Lab)',  type: 'lab',     x: 10, y: 450, w: 140, h: 150, isHighlight: true, shortName: 'Science Lab' },

      // Center library
      { id: 'lib-ext',        name: 'Library Extension',       type: 'library', x: 190, y: 30, w: 330, h: 200, isHighlight: true, shortName: 'Library Ext.' },
      { id: 'library',        name: 'Library',                 type: 'library', x: 190, y: 230, w: 330, h: 200, isHighlight: true, shortName: 'Library' },

      // Bottom center
      { id: 'arts-sciences',  name: 'Dept. of Arts and Sciences', type: 'admin',x: 190, y: 445, w: 160, h: 75 },
      { id: 'teacher-ed',     name: 'Dept. of Teacher Education and Languages', type: 'admin', x: 190, y: 520, w: 160, h: 80 },
      { id: 'room-214',       name: 'Room 214',                type: 'academic',x: 350, y: 445, w: 110, h: 155 },
      { id: 'room-213',       name: 'Room 213',                type: 'academic',x: 460, y: 445, w: 110, h: 155 },

      // Right wing top hallway rooms
      { id: 'room-212',       name: 'Room 212',                type: 'academic',x: 580, y: 230, w: 110, h: 200 },
      { id: 'room-209',       name: 'Room 209',                type: 'academic',x: 690, y: 230, w: 110, h: 200 },
      { id: 'room-207',       name: 'Room 207',                type: 'academic',x: 800, y: 230, w: 100, h: 200 },
      { id: 'stairs-2',       name: 'Stairs (DN)',             type: 'service', label: 'STAIRS DN', x: 900, y: 270, w: 70, h: 160 },
      { id: 'room-205',       name: 'Room 205',                type: 'academic',x: 970, y: 230, w: 100, h: 200 },
      { id: 'room-203',       name: 'Room 203',                type: 'academic',x: 1070,y: 230, w: 90, h: 200 },
      { id: 'room-202',       name: 'Room 202',                type: 'academic',x: 1160,y: 230, w: 50, h: 200 },

      // Right wing bottom hallway rooms
      { id: 'room-211',       name: 'Room 211',                type: 'academic',x: 580, y: 470, w: 100, h: 130 },
      { id: 'room-210',       name: 'Room 210',                type: 'academic',x: 680, y: 470, w: 100, h: 130 },
      { id: 'room-208',       name: 'Room 208',                type: 'academic',x: 780, y: 470, w: 100, h: 130 },
      { id: 'room-206',       name: 'Room 206',                type: 'academic',x: 880, y: 470, w: 100, h: 130 },
      { id: 'room-204',       name: 'Room 204',                type: 'academic',x: 980, y: 470, w: 100, h: 130 },
      { id: 'room-201',       name: 'Room 201',                type: 'academic',x: 1080,y: 470, w: 110, h: 130 },

      // Emergency exits
      { id: 'emerg-exit-r',   name: 'Emergency Exit',          type: 'gate', label: 'EMERGENCY EXIT', x: 580, y: 200, w: 110, h: 20 },
      { id: 'emerg-exit-b',   name: 'Emergency Exit',          type: 'gate', label: 'EMERGENCY EXIT', x: 1130, y: 600, w: 80, h: 20 },
    ],
  },
};

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

let CURRENT_FLOOR = 'ground';

async function renderMap() {
  renderFloorPlan(CURRENT_FLOOR);
}

function switchFloor(floor) {
  CURRENT_FLOOR = floor;
  document.querySelectorAll('.floor-btn').forEach(b => b.classList.toggle('is-active', b.dataset.floor === floor));
  renderFloorPlan(floor);
}

function renderFloorPlan(floorId) {
  const floor = FLOORS[floorId];
  if (!floor) return;
  const svg = document.getElementById('floorPlan');

  const parts = [];

  // Background
  parts.push(`<rect width="1210" height="620" fill="#0A1A12"/>`);

  // Subtle grid
  parts.push(`<defs>
    <pattern id="fpGrid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.025)" stroke-width="1"/>
    </pattern>
  </defs>`);
  parts.push(`<rect width="1210" height="620" fill="url(#fpGrid)"/>`);

  // Outer building outline (approximate L-shape)
  // Main rectangle
  parts.push(`<rect x="5" y="5" width="1200" height="610" rx="4" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>`);

  // Hallway base (lighter floor)
  parts.push(`<rect x="155" y="400" width="1050" height="35" fill="rgba(255,255,255,0.04)"/>`);
  parts.push(`<rect x="150" y="20" width="40" height="590" fill="rgba(255,255,255,0.04)"/>`);
  if (floorId === 'second') {
    parts.push(`<rect x="155" y="430" width="1050" height="40" fill="rgba(255,255,255,0.04)"/>`);
  }

  // Rooms
  for (const r of floor.rooms) {
    const c = TYPE_COLORS[r.type] || TYPE_COLORS.support;
    const highlightClass = r.isKiosk ? 'is-kiosk' : (r.isHighlight ? 'is-highlight' : '');
    const strokeWidth = r.isKiosk ? 3 : 1.5;
    const stroke = r.isKiosk ? '#FFD24D' : c.stroke;
    parts.push(`
      <g class="room ${highlightClass}" data-room="${r.id}" onclick="selectRoom('${r.id}')">
        <rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="3"
              fill="${c.fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>
        ${roomLabel(r, c.text)}
        ${r.isKiosk ? `<circle cx="${r.x + r.w - 12}" cy="${r.y + 12}" r="6" fill="#FFD24D"/>` : ''}
      </g>
    `);
  }

  // Floor label
  parts.push(`<text x="1200" y="600" text-anchor="end" fill="rgba(255,210,77,0.4)" font-size="12" font-weight="700" letter-spacing="2">${floor.label}</text>`);

  // North compass
  parts.push(`
    <g transform="translate(1150, 50)">
      <circle r="22" fill="rgba(0,0,0,0.5)" stroke="#FFD24D" stroke-width="1.5"/>
      <path d="M 0 -15 L 5 0 L 0 3 L -5 0 Z" fill="#E53935"/>
      <path d="M 0 15 L 5 0 L 0 -3 L -5 0 Z" fill="white"/>
      <text x="0" y="-26" text-anchor="middle" fill="#FFD24D" font-size="11" font-weight="700">N</text>
    </g>
  `);

  svg.innerHTML = parts.join('');
}

function roomLabel(r, textColor) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const label = r.label || r.shortName || r.name;

  // Adapt label size based on room size
  let fontSize = 10;
  if (r.w >= 130 && r.h >= 80) fontSize = 13;
  if (r.w >= 200 && r.h >= 100) fontSize = 15;
  if (r.type === 'gate') fontSize = Math.min(13, fontSize + 2);

  // Wrap long labels into 2 lines
  const words = label.split(' ');
  let lines = [label];
  if (words.length > 2 && r.w < 160) {
    const mid = Math.ceil(words.length / 2);
    lines = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
  }

  const lineHeight = fontSize + 2;
  const totalH = lines.length * lineHeight;
  const startY = cy - totalH / 2 + fontSize;

  return lines.map((line, i) => `
    <text x="${cx}" y="${startY + i * lineHeight}" text-anchor="middle"
          fill="${textColor}" font-size="${fontSize}" font-weight="${r.type === 'gate' ? 700 : 600}"
          pointer-events="none">${escapeHtml(line)}</text>
  `).join('');
}

function selectRoom(id) {
  const floor = FLOORS[CURRENT_FLOOR];
  const room = floor.rooms.find(r => r.id === id);
  if (!room) return;

  document.querySelectorAll('.room').forEach(r => r.classList.remove('is-selected'));
  document.querySelector(`[data-room="${id}"]`)?.classList.add('is-selected');

  const typeLabel = ({
    admin: 'Administrative', academic: 'Academic', lab: 'Laboratory',
    library: 'Library', support: 'Support Office', service: 'Service Area',
    public: 'Common Area', gate: 'Entrance / Exit',
  })[room.type] || 'Room';

  const side = document.getElementById('mapSide');
  side.innerHTML = `
    <div class="map-side-content">
      <span class="bldg-cat">${typeLabel} . ${floor.name}</span>
      <h2>${escapeHtml(room.name)}</h2>
      <p class="bldg-desc">${escapeHtml(getRoomDesc(room))}</p>
      ${room.offices ? `
        <h4>What is inside</h4>
        <div class="bldg-offices">
          ${room.offices.map(o => `
            <div class="bldg-office">
              <div class="bldg-office-name">${escapeHtml(o.name)}</div>
              <div class="bldg-office-room">${escapeHtml(o.room)}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
      <h4>Directions from Main Entrance</h4>
      <p class="bldg-desc">${escapeHtml(getDirections(room))}</p>
    </div>
  `;
}

function getRoomDesc(room) {
  const descs = {
    'registrar': 'Office of the University Registrar. Request academic documents like Transcript of Records, Certificate of Enrollment, and Certificate of Grades here.',
    'osas': 'Office of Student Affairs and Services. Issues Good Moral Certificates, processes student clearance, and handles scholarships and student concerns.',
    'accounting': 'University Cashier and Accounting Office. Pay tuition, miscellaneous fees, and document request fees here.',
    'admin-office': 'Main administrative office of the campus. Houses the Campus Director and other key administrative functions.',
    'it-dept': 'Department of Information Technology. Faculty offices and operations for the Computer Science and IT programs.',
    'library': 'Main University Library. Quiet study, references, and computer stations.',
    'lib-ext': 'Library Extension area. Additional study space and reference materials.',
    'computer-lab': 'Computer Laboratory 104-B for CS and IT classes.',
    'new-lab-1': 'New Computer Laboratory 1. Used for major IT subjects.',
    'new-lab-2': 'New Computer Laboratory 2. Used for major IT subjects.',
    'chem-lab': 'Chemistry Laboratory for science classes.',
    'cold-kitchen': 'HRM Cold Kitchen Laboratory for Hospitality Management classes.',
    'hot-kitchen': 'HRM Hot Kitchen Laboratory for Hospitality Management classes.',
    'housekeeping': 'Housekeeping Laboratory for Hospitality Management classes.',
    'hotel-chabacano': 'Mock hotel space used for HRM laboratory classes.',
    'room-215': 'Science Laboratory on the second floor.',
    'arts-sciences': 'Department of Arts and Sciences. Faculty offices.',
    'teacher-ed': 'Department of Teacher Education and Languages. Faculty offices.',
    'records-room': 'Storage of official university records.',
    'main-gate': 'Main entrance to the building from the campus grounds.',
  };
  if (descs[room.id]) return descs[room.id];
  if (room.type === 'academic') return 'Classroom used for lectures and academic sessions. Check your schedule for current class assignments.';
  if (room.type === 'service') return 'Service area. Used by maintenance and operations staff.';
  if (room.type === 'support') return 'Support office for campus operations.';
  if (room.type === 'gate') return 'Building entrance or exit point.';
  return `${room.name}. Part of the CvSU Cavite City Main Building.`;
}

function getDirections(room) {
  const floor = FLOORS[CURRENT_FLOOR];
  let direction = '';
  if (CURRENT_FLOOR === 'second') {
    direction += 'Go up the stairs near the main lobby to the second floor. ';
  }
  if (room.x < 200) direction += 'The room is on the left wing of the building.';
  else if (room.x > 800) direction += 'The room is on the right wing of the building.';
  else direction += 'The room is in the central part of the building.';

  if (room.y < 250) direction += ' It is toward the back side, away from the main entrance.';
  else if (room.y > 400) direction += ' It is near the main entrance and front hallway.';
  else direction += ' It is along the main hallway.';
  return direction;
}

function focusRoom(id) {
  // Find which floor the room is on
  for (const fid of ['ground', 'second']) {
    if (FLOORS[fid].rooms.find(r => r.id === id)) {
      if (CURRENT_FLOOR !== fid) switchFloor(fid);
      setTimeout(() => selectRoom(id), 100);
      return;
    }
  }
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
