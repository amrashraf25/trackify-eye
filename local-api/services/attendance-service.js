/**
 * TRACKIFY — Attendance Service
 * Handles all attendance business logic.
 * Called by routes/ai-events.js when Python confirms a student present.
 */

const { all, get, run, uuidv4, emit } = require('../models/db');
const { isLateArrival }               = require('./session-service');

/**
 * Mark a student as present in a session.
 * Safe to call multiple times — UNIQUE(session_id, student_id) prevents duplicates.
 *
 * @param {object} opts
 * @param {string} opts.session_id
 * @param {string} opts.student_id
 * @param {string} [opts.course_id]
 * @param {number} [opts.confidence]
 * @returns {{ created: boolean, record: object }}
 */
function markPresent({ session_id, student_id, course_id, confidence = 0 }) {
  // Resolve full session context
  const sess = get('SELECT * FROM sessions WHERE id = ?', [session_id]);
  if (!course_id) course_id = sess?.course_id || null;
  const week_number  = sess?.week_number  || 1;
  const session_type = sess?.session_type || 'lecture';

  const existing = get(
    'SELECT * FROM attendance_records WHERE session_id = ? AND student_id = ?',
    [session_id, student_id]
  );

  const now    = new Date().toISOString();
  const late   = isLateArrival(session_id, now) ? 1 : 0;
  const status = late ? 'late' : 'present';

  if (existing) {
    // Already confirmed present/late — no change
    if (existing.status === 'present' || existing.status === 'late') {
      return { created: false, record: existing };
    }
    // Was pre-populated as 'absent' — upgrade to present/late
    run(
      `UPDATE attendance_records
       SET status = ?, is_late = ?, confirmed_at = ?, method = 'face_recognition', confidence = ?
       WHERE session_id = ? AND student_id = ?`,
      [status, late, now, confidence, session_id, student_id]
    );
    const updated = get(
      'SELECT * FROM attendance_records WHERE session_id = ? AND student_id = ?',
      [session_id, student_id]
    );
    run(
      `UPDATE sessions SET total_present = (
         SELECT COUNT(*) FROM attendance_records
         WHERE session_id = ? AND status IN ('present','late')
       ) WHERE id = ?`,
      [session_id, session_id]
    );
    emit('UPDATE', 'attendance_records', updated, existing);
    _notifyStudent(student_id, session_id, course_id, now);
    console.log(`[Attendance] ✓ ${student_id} → ${status} (was absent) | week:${week_number}`);
    return { created: true, record: updated };
  }

  // No pre-populated record — insert fresh present record
  const id = uuidv4();
  run(
    `INSERT OR IGNORE INTO attendance_records
       (id, session_id, student_id, course_id, week_number, session_type,
        status, is_late, confirmed_at, method, confidence)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'face_recognition', ?)`,
    [id, session_id, student_id, course_id, week_number, session_type,
     status, late, now, confidence]
  );
  const record = get('SELECT * FROM attendance_records WHERE id = ?', [id]);
  run(
    `UPDATE sessions SET total_present = (
       SELECT COUNT(*) FROM attendance_records
       WHERE session_id = ? AND status IN ('present','late')
     ) WHERE id = ?`,
    [session_id, session_id]
  );
  emit('INSERT', 'attendance_records', record, {});
  _notifyStudent(student_id, session_id, course_id, now);
  console.log(`[Attendance] ✓ ${student_id} → ${status} | week:${week_number} | type:${session_type}`);
  return { created: true, record };
}

/**
 * Get full attendance summary for a session.
 */
function getSessionSummary(session_id) {
  const session = get('SELECT * FROM sessions WHERE id = ?', [session_id]);
  if (!session) return null;

  const present = all(
    `SELECT ar.*, s.full_name, s.student_code, s.avatar_url
     FROM attendance_records ar
     JOIN students s ON s.id = ar.student_id
     WHERE ar.session_id = ?
     ORDER BY ar.confirmed_at`,
    [session_id]
  );

  // All enrolled students for this course
  const enrolled = session.course_id ? all(
    `SELECT s.* FROM students s
     JOIN enrollments e ON e.student_id = s.id
     WHERE e.course_id = ?`,
    [session.course_id]
  ) : [];

  const presentIds = new Set(present.map(r => r.student_id));
  const absent = enrolled.filter(s => !presentIds.has(s.id));

  return {
    session,
    present,
    absent,
    total_present:  present.length,
    total_enrolled: enrolled.length,
    attendance_rate: enrolled.length > 0
      ? Math.round((present.length / enrolled.length) * 100)
      : 0,
  };
}

/**
 * Attendance percentage for a student across all sessions in a course.
 */
function getStudentAttendanceRate(student_id, course_id) {
  const total = get(
    'SELECT COUNT(*) as cnt FROM sessions WHERE course_id = ? AND status = ?',
    [course_id, 'ended']
  )?.cnt || 0;

  const attended = get(
    `SELECT COUNT(*) as cnt FROM attendance_records
     WHERE student_id = ? AND course_id = ?`,
    [student_id, course_id]
  )?.cnt || 0;

  return { total_sessions: total, attended, rate: total > 0 ? Math.round((attended / total) * 100) : 0 };
}

// ── Internal helpers ──────────────────────────────────────────────────

function _notifyStudent(student_id, session_id, course_id, timestamp) {
  try {
    const course = course_id ? get('SELECT name FROM courses WHERE id = ?', [course_id]) : null;
    const id  = uuidv4();
    const msg = course ? `Your attendance for ${course.name} has been recorded.` : 'Your attendance has been recorded.';
    run(
      `INSERT INTO notifications (id, student_id, title, message, type, created_at)
       VALUES (?, ?, 'Attendance Recorded', ?, 'attendance', ?)`,
      [id, student_id, msg, timestamp]
    );
    emit('INSERT', 'notifications', { id, student_id, title: 'Attendance Recorded', message: msg }, {});
  } catch {}
}

module.exports = { markPresent, getSessionSummary, getStudentAttendanceRate };
