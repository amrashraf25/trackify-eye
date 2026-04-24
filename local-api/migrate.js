/**
 * One-time migration: Supabase cloud → local JSON database
 * Run with: node migrate.js
 */

const { getData, save } = require('./db');
const https = require('https');

// Use the ORIGINAL Supabase credentials for migration
const SUPABASE_URL = 'https://itrtpjtzvujuovysvvre.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0cnRwanR6dnVqdW92eXN2dnJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3ODkxODAsImV4cCI6MjA4MTM2NTE4MH0.g0lFMYEnOFla0S9cQmBBh11-hwUG0srC_N6CFpr29Y0';

const ADMIN_EMAIL = 'admin@trackify.com';
const ADMIN_PASS  = 'admin123';

const TABLES = [
  'departments', 'students', 'courses', 'enrollments',
  'attendance_records', 'behavior_records', 'behavior_scores',
  'grades', 'incidents', 'notifications',
  'doctor_notifications', 'doctor_attendance',
  'doctor_behavior_records', 'doctor_behavior_scores',
];

function fetchJson(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const reqOpts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };
    const req = https.request(reqOpts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data: {} }); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function login() {
  console.log('Logging in to Supabase as admin...');
  const res = await fetchJson(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
  });
  if (!res.data.access_token) {
    console.log('Auth failed:', JSON.stringify(res.data));
    return null;
  }
  console.log('✓ Authenticated\n');
  return res.data.access_token;
}

async function fetchTable(table, token) {
  const res = await fetchJson(
    `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1000`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${token}` } }
  );
  if (res.status !== 200 || !Array.isArray(res.data)) return [];
  return res.data;
}

async function run() {
  console.log('=== Trackify: Supabase → Local Migration ===\n');

  const token = await login();
  if (!token) { console.log('Migration aborted.'); return; }

  const localData = getData();
  let total = 0;

  for (const table of TABLES) {
    process.stdout.write(`  ${table}... `);
    const rows = await fetchTable(table, token);
    if (!rows.length) { console.log('0 rows (empty or blocked by RLS)'); continue; }

    // Merge: add rows that don't exist yet (by id)
    if (!localData[table]) localData[table] = [];
    const existingIds = new Set(localData[table].map(r => r.id));
    let added = 0;
    for (const row of rows) {
      if (!existingIds.has(row.id)) {
        // Normalize booleans
        for (const [k, v] of Object.entries(row)) {
          if (v === true) row[k] = true;
          if (v === false) row[k] = false;
        }
        localData[table].push(row);
        added++;
      }
    }
    console.log(`${added} new rows (${rows.length} total in Supabase)`);
    total += added;
  }

  save();
  console.log(`\n✓ Migration complete! ${total} new rows added to local database.`);
  console.log('  File: local-api/db.json\n');
}

run().catch(console.error);
