/**
 * TRACKIFY — Reports & Export Routes
 * Exports attendance and behavior data as CSV.
 */

const express = require('express');
const router  = express.Router();
const { all, get } = require('../models/db');

// ── CSV helper ────────────────────────────────────────────────────────

function toCSV(rows, columns) {
  if (!rows.length) return columns.join(',') + '\n';
  const header = columns.join(',');
  const lines  = rows.map(row =>
    columns.map(col => {
      const v = row[col] ?? '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')
  );
  return [header, ...lines].join('\n');
}

// ── GET /api/reports/attendance?course_id=&session_id=&week_number= ───
// Returns CSV: student, course, week, session_type, status, is_late, confirmed_at
router.get('/attendance', (req, res) => {
  try {
    const { course_id, session_id, week_number } = req.query;
    const conds = [], params = [];

    if (session_id)  { conds.push('ar.session_id = ?');   params.push(session_id);  }
    if (course_id)   { conds.push('ar.course_id = ?');    params.push(course_id);   }
    if (week_number) { conds.push('ar.week_number = ?');  params.push(Number(week_number)); }

    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

    const rows = all(
      `SELECT
         st.student_code,
         st.full_name     AS student_name,
         c.name           AS course_name,
         c.code           AS course_code,
         ar.week_number,
         ar.session_type,
         ar.status,
         ar.is_late,
         ar.confirmed_at,
         ar.method,
         ROUND(ar.confidence * 100) AS confidence_pct
       FROM attendance_records ar
       JOIN students st  ON st.id  = ar.student_id
       LEFT JOIN courses c ON c.id = ar.course_id
       ${where}
       ORDER BY ar.week_number, c.name, st.full_name`,
      params
    );

    const csv = toCSV(rows, [
      'student_code','student_name','course_name','course_code',
      'week_number','session_type','status','is_late',
      'confirmed_at','method','confidence_pct',
    ]);

    const filename = `attendance_${course_id || 'all'}_w${week_number || 'all'}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/reports/behavior?course_id=&session_id=&week_number= ─────
// Returns CSV: student, behavior_type, severity, occurrences, total_duration
router.get('/behavior', (req, res) => {
  try {
    const { course_id, session_id, week_number } = req.query;
    const conds = [], params = [];

    if (session_id)  { conds.push('bl.session_id = ?');   params.push(session_id);  }
    if (course_id)   { conds.push('bl.course_id = ?');    params.push(course_id);   }
    if (week_number) { conds.push('bl.week_number = ?');  params.push(Number(week_number)); }

    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

    const rows = all(
      `SELECT
         st.student_code,
         st.full_name     AS student_name,
         c.name           AS course_name,
         bl.week_number,
         bl.behavior_type,
         bl.severity,
         COUNT(*)         AS occurrences,
         SUM(bl.duration_sec) AS total_duration_sec,
         ROUND(AVG(bl.confidence) * 100) AS avg_confidence_pct,
         MIN(bl.started_at)   AS first_seen,
         MAX(bl.started_at)   AS last_seen
       FROM behavior_logs bl
       JOIN students st ON st.id  = bl.student_id
       LEFT JOIN courses c ON c.id = bl.course_id
       ${where}
       GROUP BY bl.student_id, bl.behavior_type
       ORDER BY occurrences DESC, st.full_name`,
      params
    );

    const csv = toCSV(rows, [
      'student_code','student_name','course_name','week_number',
      'behavior_type','severity','occurrences','total_duration_sec',
      'avg_confidence_pct','first_seen','last_seen',
    ]);

    const filename = `behavior_${course_id || 'all'}_w${week_number || 'all'}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/reports/session/:id ─────────────────────────────────────
// Full session report: course info + attendance + behavior summary
router.get('/session/:id', (req, res) => {
  try {
    const session = get(
      `SELECT s.*, c.name AS course_name, c.code AS course_code
       FROM sessions s LEFT JOIN courses c ON c.id = s.course_id
       WHERE s.id = ?`, [req.params.id]
    );
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const attendance = all(
      `SELECT st.student_code, st.full_name AS student_name,
              ar.status, ar.is_late, ar.confirmed_at, ar.method,
              ROUND(ar.confidence * 100) AS confidence_pct
       FROM attendance_records ar
       JOIN students st ON st.id = ar.student_id
       WHERE ar.session_id = ?
       ORDER BY ar.status ASC, st.full_name`, [req.params.id]
    );

    const behavior = all(
      `SELECT st.student_code, st.full_name AS student_name,
              bl.behavior_type, bl.severity, COUNT(*) AS occurrences
       FROM behavior_logs bl
       JOIN students st ON st.id = bl.student_id
       WHERE bl.session_id = ?
       GROUP BY bl.student_id, bl.behavior_type
       ORDER BY occurrences DESC`, [req.params.id]
    );

    // Combine into one CSV with a separator
    const attCSV = toCSV(attendance, ['student_code','student_name','status','is_late','confirmed_at','method','confidence_pct']);
    const behCSV = toCSV(behavior,   ['student_code','student_name','behavior_type','severity','occurrences']);

    const header = [
      `# Trackify Session Report`,
      `# Course: ${session.course_name || session.course_id} (${session.course_code || ''})`,
      `# Week: ${session.week_number} | Type: ${session.session_type}`,
      `# Date: ${new Date(session.started_at).toLocaleDateString()}`,
      `# Present: ${session.total_present} / ${session.total_enrolled}`,
      ``,
      `## ATTENDANCE`,
    ].join('\n');

    const csv = `${header}\n${attCSV}\n\n## BEHAVIOR\n${behCSV}`;
    const filename = `session_${req.params.id.slice(0,8)}_report.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
