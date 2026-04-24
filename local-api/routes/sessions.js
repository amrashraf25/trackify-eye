/**
 * TRACKIFY — Session Routes
 * Frontend calls these to start/end monitoring sessions.
 */

const express = require('express');
const router  = express.Router();
const { startSession, endSession, getOrCreateActiveSession } = require('../services/session-service');
const { getSessionSummary } = require('../services/attendance-service');
const { all, get, run, uuidv4 } = require('../models/db');

// POST /api/session/start
router.post('/start', (req, res) => {
  try {
    const { course_id, doctor_id, room_number, week_number, session_type } = req.body || {};
    if (!course_id) return res.status(400).json({ error: 'course_id required' });
    const session = startSession({
      course_id, doctor_id, room_number,
      week_number: week_number || 1,
      session_type: session_type || 'lecture',
    });
    res.json({ success: true, session });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/session/end
router.post('/end', (req, res) => {
  try {
    const { session_id } = req.body || {};
    if (!session_id) return res.status(400).json({ error: 'session_id required' });
    const session  = endSession(session_id);
    const summary  = getSessionSummary(session_id);
    res.json({ success: true, session, summary });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/session/active
router.get('/active', (req, res) => {
  try {
    const { course_id } = req.query;
    const session = course_id
      ? get(`SELECT * FROM sessions WHERE course_id = ? AND status = 'active'
             ORDER BY started_at DESC LIMIT 1`, [course_id])
      : get(`SELECT * FROM sessions WHERE status = 'active'
             ORDER BY started_at DESC LIMIT 1`);
    res.json({ session: session || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/session/:id/summary
router.get('/:id/summary', (req, res) => {
  try {
    const summary = getSessionSummary(req.params.id);
    if (!summary) return res.status(404).json({ error: 'Session not found' });
    res.json(summary);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/session/history?course_id=...
router.get('/history', (req, res) => {
  try {
    const { course_id, limit = 20 } = req.query;
    const sessions = course_id
      ? all(`SELECT * FROM sessions WHERE course_id = ?
             ORDER BY started_at DESC LIMIT ?`, [course_id, Number(limit)])
      : all(`SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?`, [Number(limit)]);
    res.json(sessions);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────
// GET /api/session/list
// All sessions with course info. Supports ?course_id=, ?status=, ?student_id=
// ?student_id= returns sessions for courses the student is enrolled in,
//              with that student's attendance_record for each session.
// ─────────────────────────────────────────────────────────────────────
router.get('/list', (req, res) => {
  try {
    const { course_id, status, student_id, limit = 50 } = req.query;
    const conds = [], params = [];
    if (course_id)  { conds.push('s.course_id = ?'); params.push(course_id); }
    if (status)     { conds.push('s.status = ?');    params.push(status); }
    if (student_id) {
      conds.push(`s.course_id IN (
        SELECT course_id FROM enrollments WHERE student_id = ?
      )`);
      params.push(student_id);
    }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

    const sessions = all(
      `SELECT s.*,
              c.name  AS course_name,
              c.code  AS course_code,
              p.full_name AS doctor_name,
              sched.start_time AS sched_start,
              sched.end_time   AS sched_end
       FROM sessions s
       LEFT JOIN courses  c     ON c.id     = s.course_id
       LEFT JOIN profiles p     ON p.id     = s.doctor_id
       LEFT JOIN schedules sched ON sched.id = s.schedule_id
       ${where}
       ORDER BY s.started_at DESC
       LIMIT ?`,
      [...params, Number(limit)]
    );

    // If student_id provided, attach each student's attendance record
    if (student_id) {
      for (const sess of sessions) {
        const ar = get(
          `SELECT status, is_late, confirmed_at, method, confidence
           FROM attendance_records
           WHERE session_id = ? AND student_id = ?`,
          [sess.id, student_id]
        );
        sess.my_attendance = ar || null;
      }
    }

    res.json(sessions);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────
// GET /api/session/:id/attendance
// Full attendance list for a session (for doctor/admin live view)
// ─────────────────────────────────────────────────────────────────────
router.get('/:id/attendance', (req, res) => {
  try {
    const records = all(
      `SELECT ar.*,
              st.full_name, st.student_code, st.avatar_url, st.email
       FROM attendance_records ar
       JOIN students st ON st.id = ar.student_id
       WHERE ar.session_id = ?
       ORDER BY ar.status ASC, ar.confirmed_at ASC`,
      [req.params.id]
    );
    res.json(records);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────
// PATCH /api/session/:id/attendance/:student_id
// Manual attendance override by doctor/admin
// Body: { status: "present" | "absent" | "late" }
// ─────────────────────────────────────────────────────────────────────
router.patch('/:id/attendance/:student_id', (req, res) => {
  try {
    const { id: session_id, student_id } = req.params;
    const { status } = req.body || {};
    if (!['present', 'absent', 'late'].includes(status)) {
      return res.status(400).json({ error: 'status must be present | absent | late' });
    }

    const session = get('SELECT * FROM sessions WHERE id = ?', [session_id]);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const student = get('SELECT id, full_name FROM students WHERE id = ?', [student_id]);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const now = new Date().toISOString();
    const existing = get(
      'SELECT * FROM attendance_records WHERE session_id = ? AND student_id = ?',
      [session_id, student_id]
    );

    if (existing) {
      run(
        `UPDATE attendance_records
         SET status = ?, is_late = ?, confirmed_at = ?, method = 'manual'
         WHERE session_id = ? AND student_id = ?`,
        [status, status === 'late' ? 1 : 0, now, session_id, student_id]
      );
    } else {
      run(
        `INSERT INTO attendance_records
           (id, session_id, student_id, course_id, week_number, session_type,
            status, is_late, confirmed_at, method, confidence)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', 1.0)`,
        [uuidv4(), session_id, student_id, session.course_id,
         session.week_number || 1, session.session_type || 'lecture',
         status, status === 'late' ? 1 : 0, now]
      );
    }

    const record = get(
      'SELECT * FROM attendance_records WHERE session_id = ? AND student_id = ?',
      [session_id, student_id]
    );
    res.json({ success: true, record, student: student.full_name });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
