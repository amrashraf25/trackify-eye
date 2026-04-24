const { getData, save, emitChange, uuidv4 } = require('./db');

// ─── FK map for embedded joins ───
const FK = {
  enrollments:             { students: 'student_id', courses: 'course_id' },
  attendance_records:      { students: 'student_id', courses: 'course_id' },
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

// ─── Parse select string (handles embedded resources) ───
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

// ─── Apply PostgREST filters to a record ───
function matchesFilters(record, query) {
  const skip = new Set(['select', 'order', 'limit', 'offset']);
  for (const [col, val] of Object.entries(query)) {
    if (skip.has(col)) continue;
    const rv = record[col];
    if (val === 'is.null')     { if (rv !== null && rv !== undefined) return false; }
    else if (val === 'not.is.null') { if (rv === null || rv === undefined) return false; }
    else if (val.startsWith('eq.'))   { if (String(rv) !== val.slice(3)) return false; }
    else if (val.startsWith('neq.'))  { if (String(rv) === val.slice(4)) return false; }
    else if (val.startsWith('lt.'))   { if (!(Number(rv) < Number(val.slice(3)))) return false; }
    else if (val.startsWith('lte.'))  { if (!(Number(rv) <= Number(val.slice(4)))) return false; }
    else if (val.startsWith('gt.'))   { if (!(Number(rv) > Number(val.slice(3)))) return false; }
    else if (val.startsWith('gte.'))  { if (!(Number(rv) >= Number(val.slice(4)))) return false; }
    else if (val.startsWith('like.')) { if (!String(rv).toLowerCase().includes(val.slice(5).replace(/%/g,'').toLowerCase())) return false; }
    else if (val.startsWith('ilike.')){ if (!String(rv).toLowerCase().includes(val.slice(6).replace(/%/g,'').toLowerCase())) return false; }
    else if (val.startsWith('in.(')) {
      const vals = val.slice(4, -1).split(',').map(v => v.trim());
      if (!vals.includes(String(rv))) return false;
    }
  }
  return true;
}

// ─── Apply order ───
function applyOrder(rows, orderStr) {
  if (!orderStr) return rows;
  const parts = orderStr.split(',');
  return [...rows].sort((a, b) => {
    for (const part of parts) {
      const segs = part.trim().split('.');
      const col = segs[0], dir = segs[1] === 'desc' ? -1 : 1;
      const av = a[col], bv = b[col];
      if (av === bv) continue;
      if (av === null || av === undefined) return dir;
      if (bv === null || bv === undefined) return -dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
    }
    return 0;
  });
}

// ─── Project columns ───
function projectCols(record, cols) {
  if (!cols) return record;
  const out = {};
  for (const c of cols) out[c] = record[c];
  return out;
}

// ─── Main query runner ───
function runQuery(table, query, isSingle, isCount) {
  const data = getData();
  const rows = data[table] || [];

  const filtered = rows.filter(r => matchesFilters(r, query));

  if (isCount) return { count: filtered.length };

  const ordered = applyOrder(filtered, query.order);
  const limited = query.limit ? ordered.slice(Number(query.offset || 0), Number(query.offset || 0) + Number(query.limit)) : ordered;

  const { cols, joins } = parseSelect(query.select);
  const projected = limited.map(r => projectCols(r, cols));

  // Resolve embedded joins
  if (joins.length && FK[table]) {
    const fkMap = FK[table];
    for (const row of projected) {
      for (const join of joins) {
        const fkCol = fkMap[join.table];
        if (!fkCol) { row[join.table] = null; continue; }
        const fkVal = row[fkCol] || (limited.find(r => projectCols(r, cols) === row) || {})[fkCol];
        if (!fkVal) { row[join.table] = null; continue; }
        const related = (data[join.table] || []).find(r => r.id === fkVal);
        row[join.table] = related ? projectCols(related, join.cols[0] === '*' ? null : join.cols) : null;
      }
    }
  }

  if (isSingle) return projected[0] || null;
  return projected;
}

// ─── Insert ───
function runInsert(table, body) {
  const data = getData();
  if (!data[table]) data[table] = [];
  const rows = Array.isArray(body) ? body : [body];
  const inserted = [];
  const now = new Date().toISOString();
  for (const row of rows) {
    const record = { created_at: now, updated_at: now, ...row, id: row.id || uuidv4() };
    data[table].push(record);
    inserted.push(record);
    emitChange('INSERT', table, record, {});
  }
  save();
  return inserted;
}

// ─── Update ───
function runUpdate(table, body, query) {
  const data = getData();
  if (!data[table]) return [];
  const now = new Date().toISOString();
  const updated = [];
  data[table] = data[table].map(row => {
    if (!matchesFilters(row, query)) return row;
    const newRow = { ...row, ...body, updated_at: now };
    updated.push(newRow);
    emitChange('UPDATE', table, newRow, row);
    return newRow;
  });
  save();
  return updated;
}

// ─── Delete ───
function runDelete(table, query) {
  const data = getData();
  if (!data[table]) return;
  const toDelete = data[table].filter(r => matchesFilters(r, query));
  data[table] = data[table].filter(r => !matchesFilters(r, query));
  for (const row of toDelete) emitChange('DELETE', table, {}, row);
  save();
  return toDelete;
}

// ─── Upsert ───
function runUpsert(table, body) {
  const data = getData();
  if (!data[table]) data[table] = [];
  const rows = Array.isArray(body) ? body : [body];
  const upserted = [];
  const now = new Date().toISOString();
  for (const row of rows) {
    const id = row.id || uuidv4();
    const idx = data[table].findIndex(r => r.id === id);
    const record = { created_at: now, ...row, id, updated_at: now };
    if (idx >= 0) { data[table][idx] = { ...data[table][idx], ...record }; }
    else { data[table].push(record); }
    upserted.push(record);
    emitChange('INSERT', table, record, {});
  }
  save();
  return upserted;
}

module.exports = { runQuery, runInsert, runUpdate, runDelete, runUpsert };
