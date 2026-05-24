/* CvSU Multi-Service Kiosk - Express Server
   Serves the public kiosk UI, the admin UI, and the REST API.
*/

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const { query, get, run, migrate, USE_PG } = require('./db');
const { seed } = require('./seed');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// ============ STATIC ============
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// ============ SESSIONS (in-memory; fine for prototype) ============
const sessions = new Map();

function newSession(user) {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { user, createdAt: Date.now() });
  return token;
}

function getUserFromReq(req) {
  const token = req.cookies?.cvsu_admin;
  if (!token) return null;
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() - s.createdAt > 1000 * 60 * 60 * 8) {
    sessions.delete(token);
    return null;
  }
  return s.user;
}

function requireAdmin(req, res, next) {
  const u = getUserFromReq(req);
  if (!u) return res.status(401).json({ error: 'Unauthorized' });
  req.user = u;
  next();
}

function requireSystemAdmin(req, res, next) {
  const u = getUserFromReq(req);
  if (!u || u.role !== 'system_admin') return res.status(403).json({ error: 'Forbidden' });
  req.user = u;
  next();
}

// ============ AUTH ============
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
  const user = await get('SELECT * FROM users WHERE username = ?', [username]);
  if (!user) return res.status(401).json({ error: 'Invalid username or password' });
  if (!user.active) return res.status(403).json({ error: 'Account is deactivated' });
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid username or password' });
  const safeUser = { id: user.id, username: user.username, role: user.role, office_id: user.office_id, name: user.name };
  const token = newSession(safeUser);
  res.cookie('cvsu_admin', token, { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 });
  res.json({ user: safeUser });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies?.cvsu_admin;
  if (token) sessions.delete(token);
  res.clearCookie('cvsu_admin');
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const u = getUserFromReq(req);
  if (!u) return res.status(401).json({ error: 'Not signed in' });
  res.json({ user: u });
});

// ============ PUBLIC: kiosk data ============
app.get('/api/public/student/:id', async (req, res) => {
  const s = await get('SELECT * FROM students WHERE id = ?', [req.params.id]);
  if (!s) return res.status(404).json({ error: 'Student not found' });
  res.json({ student: s });
});

app.get('/api/public/offices', async (req, res) => {
  const offices = await query('SELECT * FROM offices WHERE active = 1');
  res.json({ offices });
});

app.get('/api/public/documents', async (req, res) => {
  const docs = await query('SELECT * FROM documents WHERE active = 1');
  res.json({ documents: docs });
});

app.get('/api/public/announcements', async (req, res) => {
  const rows = await query('SELECT * FROM announcements WHERE active = 1 ORDER BY featured DESC, id DESC');
  res.json({ announcements: rows });
});

app.get('/api/public/faqs', async (req, res) => {
  const rows = await query('SELECT * FROM faqs WHERE active = 1 ORDER BY category, sort_order, id');
  res.json({ faqs: rows });
});

app.get('/api/public/buildings', async (req, res) => {
  const buildings = await query('SELECT * FROM buildings');
  const offices = await query('SELECT * FROM building_offices ORDER BY id');
  const result = {};
  for (const b of buildings) {
    result[b.id] = {
      name: b.name,
      category: b.category,
      desc: b.description,
      offices: offices.filter(o => o.building_id === b.id).map(o => ({ name: o.office_name, room: o.room })),
    };
  }
  res.json({ buildings: result });
});

app.get('/api/public/mission', async (req, res) => {
  const m = await get('SELECT * FROM mission_vision ORDER BY id DESC LIMIT 1');
  res.json({ mission: m });
});

app.get('/api/public/queues', async (req, res) => {
  const offices = await query('SELECT id FROM offices WHERE active = 1');
  const state = await query('SELECT * FROM queue_state');
  const result = {};
  for (const o of offices) {
    const s = state.find(x => x.office_id === o.id) || { current_number: 0, last_issued: 0 };
    const waiting = await get('SELECT COUNT(*) AS c FROM requests WHERE office_id = ? AND status IN (?, ?, ?)', [o.id, 'pending', 'processing', 'ready']);
    const today = new Date().toISOString().slice(0, 10);
    const totalToday = await get(`SELECT COUNT(*) AS c FROM requests WHERE office_id = ? AND ${dateColumn('created_at')} = ?`, [o.id, today]);
    result[o.id] = {
      current: s.current_number || 0,
      waiting: parseInt(waiting.c),
      total_today: parseInt(totalToday.c),
      avg_min: 3,
    };
  }
  res.json({ queues: result });
});

function dateColumn(col) {
  return USE_PG ? `to_char(${col}, 'YYYY-MM-DD')` : `date(${col})`;
}

// ============ PUBLIC: submit request ============
app.post('/api/public/requests', async (req, res) => {
  const { student_id, student_name, office_id, document_id, payment_method } = req.body || {};
  if (!office_id || !document_id || !student_name || !payment_method) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const office = await get('SELECT * FROM offices WHERE id = ?', [office_id]);
  const doc = await get('SELECT * FROM documents WHERE id = ?', [document_id]);
  if (!office || !doc) return res.status(400).json({ error: 'Invalid office or document' });

  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  const officeCode = office_id.toUpperCase().substring(0, 3);
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  const refNumber = `${officeCode}-${datePart}-${seq}`;

  const qState = await get('SELECT * FROM queue_state WHERE office_id = ?', [office_id]);
  const nextQueue = (qState?.last_issued || 0) + 1;
  await run('UPDATE queue_state SET last_issued = ? WHERE office_id = ?', [nextQueue, office_id]);

  const releaseDate = addBusinessDays(now, doc.processing_days);
  const paid = payment_method === 'ewallet' ? 1 : 0;
  const status = paid ? 'processing' : 'pending';

  await run(
    `INSERT INTO requests (ref_number, queue_number, student_id, student_name, office_id, document_id, document_name, fee, status, payment_method, paid, release_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [refNumber, nextQueue, student_id || null, student_name, office_id, document_id, doc.name, doc.fee, status, payment_method, paid, releaseDate.toISOString().slice(0, 10)]
  );

  const created = await get('SELECT * FROM requests WHERE ref_number = ?', [refNumber]);
  res.json({ request: created });
});

app.post('/api/public/requests/:ref/pay', async (req, res) => {
  const r = await get('SELECT * FROM requests WHERE ref_number = ?', [req.params.ref]);
  if (!r) return res.status(404).json({ error: 'Request not found' });
  await run('UPDATE requests SET paid = 1, status = ?, payment_method = ? WHERE id = ?', ['processing', 'ewallet', r.id]);
  const updated = await get('SELECT * FROM requests WHERE id = ?', [r.id]);
  res.json({ request: updated });
});

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

// ============ ADMIN: requests ============
app.get('/api/admin/requests', requireAdmin, async (req, res) => {
  const { status, office_id } = req.query;
  let sql = 'SELECT * FROM requests WHERE 1=1';
  const params = [];
  if (req.user.role === 'office_admin') {
    sql += ' AND office_id = ?';
    params.push(req.user.office_id);
  } else if (office_id) {
    sql += ' AND office_id = ?';
    params.push(office_id);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC';
  const rows = await query(sql, params);
  res.json({ requests: rows });
});

app.patch('/api/admin/requests/:id', requireAdmin, async (req, res) => {
  const r = await get('SELECT * FROM requests WHERE id = ?', [req.params.id]);
  if (!r) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'office_admin' && r.office_id !== req.user.office_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { status, paid, notes } = req.body;
  const allowed = ['pending', 'processing', 'ready', 'released', 'cancelled'];
  if (status && !allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const updates = [];
  const params = [];
  if (status) { updates.push('status = ?'); params.push(status); }
  if (typeof paid !== 'undefined') { updates.push('paid = ?'); params.push(paid ? 1 : 0); }
  if (typeof notes !== 'undefined') { updates.push('notes = ?'); params.push(notes); }
  if (!updates.length) return res.json({ request: r });

  // Always update timestamp
  const nowSql = USE_PG ? 'CURRENT_TIMESTAMP' : "datetime('now')";
  updates.push(`updated_at = ${nowSql}`);
  params.push(r.id);
  await run(`UPDATE requests SET ${updates.join(', ')} WHERE id = ?`, params);

  // If marking as released, also advance queue_state.current_number
  if (status === 'released') {
    const q = await get('SELECT * FROM queue_state WHERE office_id = ?', [r.office_id]);
    if (q) await run('UPDATE queue_state SET current_number = ? WHERE office_id = ?', [r.queue_number, r.office_id]);
  }

  const updated = await get('SELECT * FROM requests WHERE id = ?', [r.id]);
  res.json({ request: updated });
});

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const baseWhere = req.user.role === 'office_admin' ? 'office_id = ?' : '1=1';
  const baseParams = req.user.role === 'office_admin' ? [req.user.office_id] : [];

  const countBy = async (extra, params) => {
    const r = await get(`SELECT COUNT(*) AS c FROM requests WHERE ${baseWhere} ${extra}`, [...baseParams, ...params]);
    return parseInt(r.c);
  };

  const pending = await countBy('AND status = ?', ['pending']);
  const processing = await countBy('AND status = ?', ['processing']);
  const ready = await countBy('AND status = ?', ['ready']);
  const released_today = await countBy(`AND status = ? AND ${dateColumn('updated_at')} = ?`, ['released', today]);
  const total_today = await countBy(`AND ${dateColumn('created_at')} = ?`, [today]);
  const revenue_today = await get(
    `SELECT COALESCE(SUM(fee), 0) AS s FROM requests WHERE ${baseWhere} AND paid = 1 AND ${dateColumn('created_at')} = ?`,
    [...baseParams, today]
  );

  res.json({
    stats: {
      pending, processing, ready,
      released_today,
      total_today,
      revenue_today: parseFloat(revenue_today.s) || 0,
    }
  });
});

// ============ ADMIN: users (system admin only) ============
app.get('/api/admin/users', requireSystemAdmin, async (req, res) => {
  const users = await query('SELECT id, username, role, office_id, name, active, created_at FROM users ORDER BY id');
  res.json({ users });
});

app.post('/api/admin/users', requireSystemAdmin, async (req, res) => {
  const { username, password, role, office_id, name } = req.body || {};
  if (!username || !password || !role || !name) return res.status(400).json({ error: 'Missing fields' });
  if (!['office_admin', 'system_admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (role === 'office_admin' && !office_id) return res.status(400).json({ error: 'office_id required for office_admin' });

  const existing = await get('SELECT id FROM users WHERE username = ?', [username]);
  if (existing) return res.status(409).json({ error: 'Username already taken' });

  const hash = bcrypt.hashSync(password, 10);
  await run('INSERT INTO users (username, password_hash, role, office_id, name, active) VALUES (?, ?, ?, ?, ?, 1)',
    [username, hash, role, role === 'office_admin' ? office_id : null, name]);
  const created = await get('SELECT id, username, role, office_id, name, active FROM users WHERE username = ?', [username]);
  res.json({ user: created });
});

app.patch('/api/admin/users/:id', requireSystemAdmin, async (req, res) => {
  const u = await get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!u) return res.status(404).json({ error: 'Not found' });
  const { active, password, name } = req.body;
  const updates = [];
  const params = [];
  if (typeof active !== 'undefined') { updates.push('active = ?'); params.push(active ? 1 : 0); }
  if (password) { updates.push('password_hash = ?'); params.push(bcrypt.hashSync(password, 10)); }
  if (name) { updates.push('name = ?'); params.push(name); }
  if (!updates.length) return res.json({ user: u });
  params.push(u.id);
  await run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
  const updated = await get('SELECT id, username, role, office_id, name, active FROM users WHERE id = ?', [u.id]);
  res.json({ user: updated });
});

// ============ ADMIN: announcements ============
app.get('/api/admin/announcements', requireAdmin, async (req, res) => {
  let sql = 'SELECT * FROM announcements';
  const params = [];
  if (req.user.role === 'office_admin') {
    sql += ' WHERE office_id = ? OR office_id IS NULL';
    params.push(req.user.office_id);
  }
  sql += ' ORDER BY featured DESC, id DESC';
  const rows = await query(sql, params);
  res.json({ announcements: rows });
});

app.post('/api/admin/announcements', requireAdmin, async (req, res) => {
  const { type, featured, title, body, date_text, author, office_id } = req.body || {};
  if (!type || !title || !body) return res.status(400).json({ error: 'Missing fields' });
  const finalOffice = req.user.role === 'office_admin' ? req.user.office_id : (office_id || null);
  await run('INSERT INTO announcements (type, featured, title, body, date_text, author, office_id, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
    [type, featured ? 1 : 0, title, body, date_text || null, author || req.user.name, finalOffice]);
  res.json({ ok: true });
});

app.patch('/api/admin/announcements/:id', requireAdmin, async (req, res) => {
  const a = await get('SELECT * FROM announcements WHERE id = ?', [req.params.id]);
  if (!a) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'office_admin' && a.office_id !== req.user.office_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { type, featured, title, body, date_text, author, active } = req.body || {};
  const updates = []; const params = [];
  if (type) { updates.push('type = ?'); params.push(type); }
  if (typeof featured !== 'undefined') { updates.push('featured = ?'); params.push(featured ? 1 : 0); }
  if (title) { updates.push('title = ?'); params.push(title); }
  if (body) { updates.push('body = ?'); params.push(body); }
  if (date_text) { updates.push('date_text = ?'); params.push(date_text); }
  if (author) { updates.push('author = ?'); params.push(author); }
  if (typeof active !== 'undefined') { updates.push('active = ?'); params.push(active ? 1 : 0); }
  if (!updates.length) return res.json({ announcement: a });
  params.push(a.id);
  await run(`UPDATE announcements SET ${updates.join(', ')} WHERE id = ?`, params);
  const updated = await get('SELECT * FROM announcements WHERE id = ?', [a.id]);
  res.json({ announcement: updated });
});

app.delete('/api/admin/announcements/:id', requireAdmin, async (req, res) => {
  const a = await get('SELECT * FROM announcements WHERE id = ?', [req.params.id]);
  if (!a) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'office_admin' && a.office_id !== req.user.office_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  await run('DELETE FROM announcements WHERE id = ?', [a.id]);
  res.json({ ok: true });
});

// ============ ADMIN: FAQs ============
app.get('/api/admin/faqs', requireAdmin, async (req, res) => {
  let sql = 'SELECT * FROM faqs';
  const params = [];
  if (req.user.role === 'office_admin') {
    sql += ' WHERE office_id = ? OR office_id IS NULL';
    params.push(req.user.office_id);
  }
  sql += ' ORDER BY category, sort_order, id';
  const rows = await query(sql, params);
  res.json({ faqs: rows });
});

app.post('/api/admin/faqs', requireAdmin, async (req, res) => {
  const { category, question, answer, office_id, sort_order } = req.body || {};
  if (!category || !question || !answer) return res.status(400).json({ error: 'Missing fields' });
  const finalOffice = req.user.role === 'office_admin' ? req.user.office_id : (office_id || null);
  await run('INSERT INTO faqs (category, question, answer, office_id, sort_order, active) VALUES (?, ?, ?, ?, ?, 1)',
    [category, question, answer, finalOffice, sort_order || 0]);
  res.json({ ok: true });
});

app.patch('/api/admin/faqs/:id', requireAdmin, async (req, res) => {
  const f = await get('SELECT * FROM faqs WHERE id = ?', [req.params.id]);
  if (!f) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'office_admin' && f.office_id !== req.user.office_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { category, question, answer, sort_order, active } = req.body || {};
  const updates = []; const params = [];
  if (category) { updates.push('category = ?'); params.push(category); }
  if (question) { updates.push('question = ?'); params.push(question); }
  if (answer) { updates.push('answer = ?'); params.push(answer); }
  if (typeof sort_order !== 'undefined') { updates.push('sort_order = ?'); params.push(sort_order); }
  if (typeof active !== 'undefined') { updates.push('active = ?'); params.push(active ? 1 : 0); }
  if (!updates.length) return res.json({ faq: f });
  params.push(f.id);
  await run(`UPDATE faqs SET ${updates.join(', ')} WHERE id = ?`, params);
  const updated = await get('SELECT * FROM faqs WHERE id = ?', [f.id]);
  res.json({ faq: updated });
});

app.delete('/api/admin/faqs/:id', requireAdmin, async (req, res) => {
  const f = await get('SELECT * FROM faqs WHERE id = ?', [req.params.id]);
  if (!f) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'office_admin' && f.office_id !== req.user.office_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  await run('DELETE FROM faqs WHERE id = ?', [f.id]);
  res.json({ ok: true });
});

// ============ FLOOR PLAN ============
app.get('/api/public/floor-plan', async (req, res) => {
  const row = await get('SELECT value FROM config WHERE key = ?', ['floor_plan']);
  if (!row) return res.json({ floors: null });
  try {
    res.json({ floors: JSON.parse(row.value) });
  } catch {
    res.json({ floors: null });
  }
});

app.put('/api/admin/floor-plan', requireSystemAdmin, async (req, res) => {
  const { floors } = req.body || {};
  if (!floors || typeof floors !== 'object' || !floors.ground || !floors.second) {
    return res.status(400).json({ error: 'Invalid floor plan. Must include "ground" and "second" floors.' });
  }
  const json = JSON.stringify(floors);
  const existing = await get('SELECT key FROM config WHERE key = ?', ['floor_plan']);
  const nowSql = USE_PG ? 'CURRENT_TIMESTAMP' : "datetime('now')";
  if (existing) {
    await run(`UPDATE config SET value = ?, updated_at = ${nowSql} WHERE key = ?`, [json, 'floor_plan']);
  } else {
    await run('INSERT INTO config (key, value) VALUES (?, ?)', ['floor_plan', json]);
  }
  res.json({ ok: true });
});

app.delete('/api/admin/floor-plan', requireSystemAdmin, async (req, res) => {
  await run('DELETE FROM config WHERE key = ?', ['floor_plan']);
  res.json({ ok: true });
});

// ============ ADMIN: mission (system admin) ============
app.patch('/api/admin/mission', requireSystemAdmin, async (req, res) => {
  const { vision, mission, core_values } = req.body || {};
  const existing = await get('SELECT * FROM mission_vision ORDER BY id DESC LIMIT 1');
  if (existing) {
    await run('UPDATE mission_vision SET vision = ?, mission = ?, core_values = ? WHERE id = ?',
      [vision || existing.vision, mission || existing.mission, core_values || existing.core_values, existing.id]);
  } else {
    await run('INSERT INTO mission_vision (vision, mission, core_values) VALUES (?, ?, ?)',
      [vision || '', mission || '', core_values || '']);
  }
  res.json({ ok: true });
});

// ============ ROUTES ============
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'login.html')));
app.get('/admin/office', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'office.html')));
app.get('/admin/system', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'system.html')));

// ============ START ============
(async function start() {
  try {
    await migrate();
    await seed();
    app.listen(PORT, () => {
      console.log(`[server] CvSU Kiosk running at http://localhost:${PORT}`);
      console.log(`[server] Admin login at http://localhost:${PORT}/admin`);
      console.log(`[server] Database: ${USE_PG ? 'PostgreSQL' : 'SQLite (data/kiosk.db)'}`);
    });
  } catch (err) {
    console.error('[server] Failed to start:', err);
    process.exit(1);
  }
})();
