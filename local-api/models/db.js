/**
 * TRACKIFY — SQLite Database Layer
 * Replaces the flat JSON file with a real relational database.
 * Uses the built-in 'node:sqlite' module (Node.js 22.5+)
 * Falls back to 'better-sqlite3' if installed.
 */

const path = require('path');
const fs   = require('fs');
const EventEmitter = require('events');
const { SCHEMA } = require('./schema'); // SQL DDL string used to initialise tables on startup

// Database file lives one directory above this models/ folder, alongside server.js
const DB_PATH = path.join(__dirname, '..', 'trackify.db');
// EventEmitter used to broadcast row-level changes to the realtime (WebSocket/SSE) layer
const dbEvents = new EventEmitter();
dbEvents.setMaxListeners(200); // Raised limit to support many concurrent subscriber connections

let db; // Holds the active database connection (either node:sqlite or better-sqlite3 instance)

// ── Try native Node.js SQLite first, then better-sqlite3 ──────────────
// Opens the SQLite database file, enables WAL mode for better concurrency,
// and turns on foreign key enforcement (off by default in SQLite).
function openDatabase() {
  // Node 22.5+ has built-in sqlite
  try {
    const { DatabaseSync } = require('node:sqlite');
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL;');  // WAL mode allows concurrent reads during writes
    db.exec('PRAGMA foreign_keys = ON;');   // Enforce referential integrity
    console.log('✓ SQLite (node:sqlite built-in)');
    return 'builtin';
  } catch {}

  // Fallback: better-sqlite3
  try {
    const Database = require('better-sqlite3');
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    console.log('✓ SQLite (better-sqlite3)');
    return 'better-sqlite3';
  } catch {}

  throw new Error('No SQLite driver available. Run: npm install better-sqlite3');
}

// Splits the SCHEMA string on semicolons and executes each statement individually.
// Silently ignores "already exists" errors so the server can restart without failing.
function ensureSchema() {
  const statements = SCHEMA
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0); // Skip empty strings produced by trailing semicolons
  for (const stmt of statements) {
    try { db.exec(stmt + ';'); } catch (e) {
      if (!e.message.includes('already exists')) {
        // Only warn for unexpected errors; "already exists" is safe to ignore on restart
        console.warn('Schema warning:', e.message.slice(0, 80));
      }
    }
  }
  console.log('✓ Schema ready');
}

// ── Universal query helpers ───────────────────────────────────────────

// Executes a SELECT and returns ALL matching rows as an array (empty array on error).
function all(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  } catch (e) {
    console.error('[DB all]', e.message, '\nSQL:', sql.slice(0, 120));
    return [];
  }
}

// Executes a SELECT and returns the FIRST matching row, or null if none found.
function get(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    return stmt.get(...params);
  } catch (e) {
    console.error('[DB get]', e.message);
    return null;
  }
}

// Executes an INSERT / UPDATE / DELETE and returns a result object with a 'changes' count.
function run(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    return stmt.run(...params);
  } catch (e) {
    console.error('[DB run]', e.message, '\nSQL:', sql.slice(0, 120));
    return { changes: 0 }; // Return a safe no-op result so callers don't need to null-check
  }
}

// Executes a raw SQL string without parameters (used for DDL and PRAGMAs).
function exec(sql) {
  try { db.exec(sql); } catch (e) {
    console.error('[DB exec]', e.message);
  }
}

// ── Emit change for WebSocket realtime ───────────────────────────────
// Fires a 'change' event on dbEvents so the realtime layer can push live updates to clients.
// event is 'INSERT' | 'UPDATE' | 'DELETE'; newRow/oldRow mirror PostgreSQL NOTIFY payloads.
function emit(event, table, newRow, oldRow) {
  dbEvents.emit('change', { event, table, newRow: newRow || {}, oldRow: oldRow || {} });
}

// ── UUID helper ───────────────────────────────────────────────────────
// Returns a UUID v4. Uses the 'uuid' package if available, otherwise falls back to Node's built-in crypto.randomUUID().
let _uuid; // Lazily resolved on first call to avoid requiring unused packages at startup
function uuidv4() {
  if (!_uuid) {
    try { _uuid = require('uuid').v4; }
    catch { _uuid = () => require('crypto').randomUUID(); } // Node 14.17+ built-in
  }
  return _uuid();
}

// ── Initialize ────────────────────────────────────────────────────────
// Both calls run synchronously at module load time so the DB is ready before any route handlers fire.
openDatabase();
ensureSchema();

module.exports = { db, all, get, run, exec, emit, uuidv4, dbEvents, DB_PATH };
