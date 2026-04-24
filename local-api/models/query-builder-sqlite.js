/**
 * TRACKIFY — SQLite Query Builder
 * Drop-in replacement for query-builder.js.
 * Translates PostgREST-style query params into SQLite statements.
 */

const { all, get, run, uuidv4, emit } = require('./db');

const ALLOWED_TABLES = new Set([
  'students','courses','enrollments','attendance_records','behavior_records',
  'behavior_logs','behavior_scores','grades','incidents','notifications',
  'doctor_notifications','doctor_attendance','doctor_behavior_records',
  'doctor_behavior_scores','recognition_log','profiles','user_roles',
  'departments','assignments','submissions','course_materials','sessions',
  'users',
]);

// ── FK map for embedded joins (same as JSON version) ─────────────────
const FK = {
  enrollments:             { students: 'student_id', courses: 'course_id' },
  attendance_records:      { students: 'student_id', courses: 'course_id' },
  behavior_logs:           { students: 'student_id', courses: 'course_id' },
  behavior_records:        { students: 'student_id', courses: 'course_id' },
  behavior_scores:         { students: 'student_id' },
  grades:                  { students: 'student_id', courses: 'course_id' },
  incidents:               { students: 'student_id' },
  doctor_attendance:       { courses: 'course_id', profiles: 'doctor_id' },
  doctor_behavior_records: { courses: 'course_id', profiles: 'doctor_id' },
  doctor_behavior_scores:  { profiles: 'doctor_id' },
  doctor_notifications:    { profiles: 'doctor_id' },
  notifications:           { students: 'student_id' },
  courses:                 { profiles: 'doctor_id' },
};

// ── Parse PostgREST filter value → SQL ───────────────────────────────
function parseFilter(col, val) {
  if (val === 'is.null')      return { sql: `"${col}" IS NULL`,     params: [] };
  if (val === 'not.is.null')  return { sql: `"${col}" IS NOT NULL`, params: [] };
  if (val.startsWith('eq.'))  return { sql: `"${col}" = ?`,         params: [val.slice(3)] };
  if (val.startsWith('neq.')) return { sql: `"${col}" != ?`,        params: [val.slice(4)] };
  if (val.startsWith('lt.'))  return { sql: `"${col}" < ?`,         params: [Number(val.slice(3))] };
  if (val.startsWith('lte.')) return { sql: `"${col}" <= ?`,        params: [Number(val.slice(4))] };
  if (val.startsWith('gt.'))  return { sql: `"${col}" > ?`,         params: [Number(val.slice(3))] };
  if (val.startsWith('gte.')) return { sql: `"${col}" >= ?`,        params: [Number(val.slice(4))] };
  if (val.startsWith('like.'))  return { sql: `"${col}" LIKE ?`,  params: [val.slice(5).replace(/%/g,'%')] };
  if (val.startsWith('ilike.')) return { sql: `LOWER("${col}") LIKE LOWER(?)`, params: [val.slice(6).replace(/%/g,'%')] };
  if (val.startsWith('in.(')) {
    const vals = val.slice(4, -1).split(',').map(v => v.trim());
    return { sql: `"${col}" IN (${vals.map(()=>'?').join(',')})`, params: vals };
  }
  // fallback: equality
  return { sql: `"${col}" = ?`, params: [val] };
}

// ── Build WHERE clause ────────────────────────────────────────────────
const SKIP_PARAMS = new Set(['select','order','limit','offset']);
function buildWhere(query) {
  const conditions = [], params = [];
  for (const [col, val] of Object.entries(query)) {
    if (SKIP_PARAMS.has(col)) continue;
    const f = parseFilter(col, String(val));
    conditions.push(f.sql);
    params.push(...f.params);
  }
  return {
    where:  conditions.length ? 'WHERE ' + conditions.join(' AND ') : '',
    params,
  };
}

// ── Parse select string ───────────────────────────────────────────────
function parseSelect(selectStr) {
  if (!selectStr || selectStr === '*') return { cols: null, joins: [] };
  const joins = [], cols = [];
  let depth = 0, current = '';
  for (const ch of selectStr + ',') {
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth--; current += ch; }
    else if (ch === ',' && depth === 0) {
      const part = current.trim(); current = '';
      if (!part) continue;
      const m = part.match(/^(\w+)\((.+)\)$/);
      if (m) joins.push({ table: m[1], cols: m[2].split(',').map(c => c.trim()) });
      else if (part !== '*') cols.push(part);
      current = '';
    } else current += ch;
  }
  return { cols: cols.length ? cols : null, joins };
}

// ── Project columns ───────────────────────────────────────────────────
function project(row, cols) {
  if (!cols) return row;
  const out = {};
  for (const c of cols) out[c] = row[c];
  return out;
}

// ── Resolve embedded joins ────────────────────────────────────────────
function resolveJoins(rows, table, joins) {
  if (!joins.length || !FK[table]) return rows;
  const fkMap = FK[table];
  return rows.map(row => {
    const r = { ...row };
    for (const join of joins) {
      const fkCol = fkMap[join.table];
      if (!fkCol) { r[join.table] = null; continue; }
      const fkVal = row[fkCol];
      if (!fkVal) { r[join.table] = null; continue; }
      const related = get(`SELECT * FROM "${join.table}" WHERE id = ?`, [fkVal]);
      r[join.table] = related ? project(related, join.cols[0] === '*' ? null : join.cols) : null;
    }
    return r;
  });
}

// ── runQuery ─────────────────────────────────────────────────────────
function runQuery(table, query, isSingle, isCount) {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`Table not allowed: ${table}`);

  const { where, params } = buildWhere(query);

  if (isCount) {
    const row = get(`SELECT COUNT(*) as cnt FROM "${table}" ${where}`, params);
    return { count: row?.cnt || 0 };
  }

  // ORDER
  let orderSql = '';
  if (query.order) {
    const parts = query.order.split(',').map(p => {
      const segs = p.trim().split('.');
      const col  = segs[0];
      const dir  = segs[1] === 'desc' ? 'DESC' : 'ASC';
      return `"${col}" ${dir}`;
    });
    orderSql = 'ORDER BY ' + parts.join(', ');
  }

  // LIMIT / OFFSET
  const limit  = query.limit  ? `LIMIT  ${Number(query.limit)}`  : '';
  const offset = query.offset ? `OFFSET ${Number(query.offset)}` : '';

  const sql  = `SELECT * FROM "${table}" ${where} ${orderSql} ${limit} ${offset}`.trim();
  let rows   = all(sql, params);

  // Select projection + joins
  const { cols, joins } = parseSelect(query.select);
  rows = rows.map(r => project(r, cols));
  rows = resolveJoins(rows, table, joins);

  return isSingle ? (rows[0] || null) : rows;
}

// ── runInsert ────────────────────────────────────────────────────────
function runInsert(table, body) {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`Table not allowed: ${table}`);
  const rows = Array.isArray(body) ? body : [body];
  const inserted = [];
  const now = new Date().toISOString();
  for (const row of rows) {
    const record = { created_at: now, updated_at: now, ...row, id: row.id || uuidv4() };
    const cols   = Object.keys(record);
    const vals   = Object.values(record);
    const sql = `INSERT OR IGNORE INTO "${table}"
      (${cols.map(c=>`"${c}"`).join(',')})
      VALUES (${cols.map(()=>'?').join(',')})`;
    run(sql, vals);
    const saved = get(`SELECT * FROM "${table}" WHERE id = ?`, [record.id]) || record;
    inserted.push(saved);
    emit('INSERT', table, saved, {});
  }
  return inserted;
}

// ── runUpdate ────────────────────────────────────────────────────────
function runUpdate(table, body, query) {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`Table not allowed: ${table}`);
  const now  = new Date().toISOString();
  const data = { ...body, updated_at: now };
  const sets = Object.keys(data).map(c => `"${c}" = ?`).join(', ');
  const { where, params: wp } = buildWhere(query);
  const vals = [...Object.values(data), ...wp];
  run(`UPDATE "${table}" SET ${sets} ${where}`, vals);
  const updated = all(`SELECT * FROM "${table}" ${where}`, wp);
  for (const row of updated) emit('UPDATE', table, row, {});
  return updated;
}

// ── runDelete ────────────────────────────────────────────────────────
function runDelete(table, query) {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`Table not allowed: ${table}`);
  const { where, params } = buildWhere(query);
  const toDelete = all(`SELECT * FROM "${table}" ${where}`, params);
  run(`DELETE FROM "${table}" ${where}`, params);
  for (const row of toDelete) emit('DELETE', table, {}, row);
  return toDelete;
}

// ── runUpsert ────────────────────────────────────────────────────────
function runUpsert(table, body) {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`Table not allowed: ${table}`);
  const rows = Array.isArray(body) ? body : [body];
  const upserted = [];
  const now = new Date().toISOString();
  for (const row of rows) {
    const record = { created_at: now, updated_at: now, ...row, id: row.id || uuidv4() };
    const cols   = Object.keys(record);
    const vals   = Object.values(record);
    const sql = `INSERT INTO "${table}"
      (${cols.map(c=>`"${c}"`).join(',')})
      VALUES (${cols.map(()=>'?').join(',')})
      ON CONFLICT(id) DO UPDATE SET
      ${cols.filter(c=>c!=='id').map(c=>`"${c}"=excluded."${c}"`).join(',')}`;
    run(sql, vals);
    const saved = get(`SELECT * FROM "${table}" WHERE id = ?`, [record.id]) || record;
    upserted.push(saved);
    emit('INSERT', table, saved, {});
  }
  return upserted;
}

module.exports = { runQuery, runInsert, runUpdate, runDelete, runUpsert };
