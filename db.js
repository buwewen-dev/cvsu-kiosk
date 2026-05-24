/* Database abstraction. Uses SQLite locally and PostgreSQL on Render. */

const path = require('path');
const fs = require('fs');

const USE_PG = !!process.env.DATABASE_URL;
let db;
let pgPool;

if (USE_PG) {
  const { Pool } = require('pg');
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
} else {
  let Database;
  try {
    Database = require('better-sqlite3');
  } catch (e) {
    console.error('[db] No DATABASE_URL set and better-sqlite3 is not installed.');
    console.error('[db] For local dev: run "npm install better-sqlite3"');
    console.error('[db] For production: set DATABASE_URL to a PostgreSQL connection string.');
    throw e;
  }
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  db = new Database(path.join(dataDir, 'kiosk.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
}

function pgPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function query(sql, params = []) {
  if (USE_PG) {
    const result = await pgPool.query(pgPlaceholders(sql), params);
    return result.rows;
  } else {
    const stmt = db.prepare(sql);
    if (/^\s*select/i.test(sql) || /returning/i.test(sql)) return stmt.all(...params);
    return stmt.run(...params);
  }
}

async function get(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

async function run(sql, params = []) {
  if (USE_PG) {
    const result = await pgPool.query(pgPlaceholders(sql), params);
    return { rowCount: result.rowCount, rows: result.rows };
  } else {
    const stmt = db.prepare(sql);
    const info = stmt.run(...params);
    return { rowCount: info.changes, lastInsertRowid: info.lastInsertRowid };
  }
}

// ============ SCHEMA ============
const PK = USE_PG ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
const NOW = USE_PG ? 'CURRENT_TIMESTAMP' : "(datetime('now'))";

async function migrate() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id ${PK},
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      office_id TEXT,
      name TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT ${NOW}
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS offices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      description TEXT,
      color TEXT,
      building TEXT,
      room TEXT,
      icon_svg TEXT,
      active INTEGER DEFAULT 1
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      office_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      fee REAL NOT NULL,
      processing_days INTEGER NOT NULL,
      active INTEGER DEFAULT 1
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      course TEXT,
      year INTEGER,
      email TEXT
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS requests (
      id ${PK},
      ref_number TEXT UNIQUE NOT NULL,
      queue_number INTEGER NOT NULL,
      student_id TEXT,
      student_name TEXT NOT NULL,
      office_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      document_name TEXT NOT NULL,
      fee REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      payment_method TEXT,
      paid INTEGER DEFAULT 0,
      release_date TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT ${NOW},
      updated_at TIMESTAMP DEFAULT ${NOW}
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS announcements (
      id ${PK},
      type TEXT NOT NULL,
      featured INTEGER DEFAULT 0,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      date_text TEXT,
      author TEXT,
      office_id TEXT,
      active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT ${NOW}
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS faqs (
      id ${PK},
      category TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      office_id TEXT,
      sort_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS buildings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      description TEXT
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS building_offices (
      id ${PK},
      building_id TEXT NOT NULL,
      office_name TEXT NOT NULL,
      room TEXT
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS mission_vision (
      id ${PK},
      vision TEXT,
      mission TEXT,
      core_values TEXT
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS queue_state (
      office_id TEXT PRIMARY KEY,
      current_number INTEGER DEFAULT 0,
      last_issued INTEGER DEFAULT 0,
      updated_at TIMESTAMP DEFAULT ${NOW}
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT ${NOW}
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS request_items (
      id ${PK},
      request_id INTEGER NOT NULL,
      document_id TEXT NOT NULL,
      document_name TEXT NOT NULL,
      fee REAL NOT NULL
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS inquiries (
      id ${PK},
      question TEXT NOT NULL,
      student_email TEXT,
      student_name TEXT,
      student_id TEXT,
      office_id TEXT,
      status TEXT DEFAULT 'pending',
      reply TEXT,
      replied_at TIMESTAMP,
      replied_by TEXT,
      created_at TIMESTAMP DEFAULT ${NOW}
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS office_capacity (
      office_id TEXT PRIMARY KEY,
      per_hour INTEGER DEFAULT 20,
      hours_start TEXT DEFAULT '08:00',
      hours_end TEXT DEFAULT '17:00'
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS student_qrs (
      qr_code TEXT PRIMARY KEY,
      student_id TEXT,
      student_name TEXT,
      created_at TIMESTAMP DEFAULT ${NOW}
    )
  `);

  // Backfill new columns on requests if they don't exist yet
  await addColumnIfMissing('requests', 'scheduled_at', 'TEXT');
  await addColumnIfMissing('requests', 'total_fee', 'REAL');
  await addColumnIfMissing('requests', 'archived', 'INTEGER DEFAULT 0');
}

async function addColumnIfMissing(table, column, type) {
  try {
    if (USE_PG) {
      const r = await query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
        [table, column]
      );
      if (!r.length) {
        await pgPool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
      }
    } else {
      const info = db.prepare(`PRAGMA table_info(${table})`).all();
      if (!info.find(c => c.name === column)) {
        db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
      }
    }
  } catch (e) {
    console.warn(`[db] Could not add column ${table}.${column}:`, e.message);
  }
}

module.exports = { query, get, run, migrate, USE_PG };
