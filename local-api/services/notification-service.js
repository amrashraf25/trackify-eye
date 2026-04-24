/**
 * TRACKIFY — Notification Service
 *
 * Writes targeted notifications to:
 *   • notifications        (student-facing)
 *   • doctor_notifications (doctor-facing)
 *
 * All writes emit a WebSocket change so the frontend updates instantly.
 */

const { all, get, run, uuidv4, emit } = require('../models/db');

// ── Notification deduplication ────────────────────────────────────────
// Prevents doctor from being flooded with repeated alerts for the same
// (session, student, behavior) within a cooldown window.
const _behaviorNotifTs = new Map(); // key → timestamp (ms)
const BEHAVIOR_NOTIF_COOLDOWN_MS = {
  critical: 0,              // always immediate
  high:     5 * 60 * 1000,  // 5 min
  medium:   15 * 60 * 1000, // 15 min (not used — medium not notified)
  low:      Infinity,        // never
};

// ── Internal helper ────────────────────────────────────────────────────

function _notifyStudent({ student_id, title, message, type = 'info', session_id = null, course_id = null, ref_type = null }) {
  if (!student_id) return;
  const id  = uuidv4();
  const now = new Date().toISOString();
  try {
    run(
      `INSERT INTO notifications (id, student_id, title, message, type, read, session_id, course_id, ref_type, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [id, student_id, title, message, type, session_id, course_id, ref_type, now]
    );
    const row = get('SELECT * FROM notifications WHERE id = ?', [id]);
    emit('INSERT', 'notifications', row, {});
  } catch (e) {
    // column may not exist on very old DBs — swallow silently
  }
}

function _notifyDoctor({ doctor_id, title, message, type = 'info', session_id = null, course_id = null, ref_type = null }) {
  if (!doctor_id) return;
  const id  = uuidv4();
  const now = new Date().toISOString();
  try {
    run(
      `INSERT INTO doctor_notifications (id, doctor_id, title, message, type, read, session_id, course_id, ref_type, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [id, doctor_id, title, message, type, session_id, course_id, ref_type, now]
    );
    const row = get('SELECT * FROM doctor_notifications WHERE id = ?', [id]);
    emit('INSERT', 'doctor_notifications', row, {});
  } catch (e) {}
}

// ── Public notification triggers ──────────────────────────────────────

/**
 * Called when a session starts.
 * Notifies all enrolled students that their session has begun.
 */
function notifySessionStart(session) {
  try {
    const TYPE_LABEL = {
      lecture: 'Lecture', problem_solving: 'Problem Solving', lab: 'Lab', tutorial: 'Tutorial',
    };
    const typeLabel = TYPE_LABEL[session.session_type] || session.session_type;
    const course    = get('SELECT name FROM courses WHERE id = ?', [session.course_id]);
    const courseName = course?.name || 'your course';

    const enrolled  = all('SELECT student_id FROM enrollments WHERE course_id = ?', [session.course_id]);
    for (const { student_id } of enrolled) {
      _notifyStudent({
        student_id,
        title:    `Session Started — ${courseName}`,
        message:  `Week ${session.week_number} ${typeLabel} has started. Attendance is being recorded.`,
        type:     'session_start',
        session_id: session.id,
        course_id:  session.course_id,
        ref_type:   'session',
      });
    }

    // Notify the doctor
    if (session.doctor_id) {
      _notifyDoctor({
        doctor_id: session.doctor_id,
        title:    `Session Started — ${courseName}`,
        message:  `Week ${session.week_number} ${typeLabel} is now active. AI monitoring is running.`,
        type:     'session_start',
        session_id: session.id,
        course_id:  session.course_id,
        ref_type:   'session',
      });
    }
  } catch (e) {
    console.error('[Notifications] notifySessionStart error:', e.message);
  }
}

/**
 * Called when a session ends.
 * Notifies enrolled students — tells each one if they were present or absent.
 */
function notifySessionEnd(session) {
  try {
    const course     = get('SELECT name FROM courses WHERE id = ?', [session.course_id]);
    const courseName = course?.name || 'your course';

    const records = all(
      'SELECT student_id, status FROM attendance_records WHERE session_id = ?',
      [session.id]
    );
    for (const rec of records) {
      if (rec.status === 'absent') {
        _notifyStudent({
          student_id: rec.student_id,
          title:    `Absent — ${courseName}`,
          message:  `You were marked absent for the Week ${session.week_number} session. Contact your doctor if this is incorrect.`,
          type:     'absent',
          session_id: session.id,
          course_id:  session.course_id,
          ref_type:   'attendance',
        });
      } else if (rec.status === 'late') {
        _notifyStudent({
          student_id: rec.student_id,
          title:    `Late Arrival — ${courseName}`,
          message:  `You were marked as late for the Week ${session.week_number} session.`,
          type:     'late',
          session_id: session.id,
          course_id:  session.course_id,
          ref_type:   'attendance',
        });
      }
    }
  } catch (e) {
    console.error('[Notifications] notifySessionEnd error:', e.message);
  }
}

/**
 * Called when a serious behavior is detected.
 * Deduplicates: critical = always immediate; high = once per 5 min per (session,student,behavior).
 */
function notifyBehaviorDetected({ session_id, student_id, behavior_type, severity, course_id }) {
  if (severity !== 'critical' && severity !== 'high') return;

  // Deduplication check
  const cooldown = BEHAVIOR_NOTIF_COOLDOWN_MS[severity] ?? Infinity;
  if (cooldown > 0) {
    const key  = `${session_id}:${student_id}:${behavior_type}`;
    const last = _behaviorNotifTs.get(key) || 0;
    if (Date.now() - last < cooldown) return; // within cooldown — skip
    _behaviorNotifTs.set(key, Date.now());
  }

  try {
    // Count how many times this behavior fired in this session
    const count = get(
      `SELECT COUNT(*) as cnt FROM behavior_logs
       WHERE session_id = ? AND student_id = ? AND behavior_type = ?`,
      [session_id, student_id, behavior_type]
    )?.cnt || 1;

    const student = get('SELECT full_name FROM students WHERE id = ?', [student_id]);
    const session = get('SELECT doctor_id FROM sessions WHERE id = ?', [session_id]);
    const course  = get('SELECT name FROM courses WHERE id = ?', [course_id]);
    if (!session?.doctor_id) return;

    const labels   = { critical: '🚨 CRITICAL', high: '⚠ HIGH' };
    const behLabel = behavior_type.charAt(0).toUpperCase() + behavior_type.slice(1);
    const countStr = count > 1 ? ` (×${count} this session)` : '';

    _notifyDoctor({
      doctor_id:  session.doctor_id,
      title:    `${labels[severity] || severity}: ${behLabel} Detected`,
      message:  `${student?.full_name || 'A student'} was flagged for ${behavior_type}${countStr} in ${course?.name || 'a session'}.`,
      type:     `behavior_${severity}`,
      session_id,
      course_id,
      ref_type: 'behavior',
    });
  } catch (e) {
    console.error('[Notifications] notifyBehaviorDetected error:', e.message);
  }
}

module.exports = { notifySessionStart, notifySessionEnd, notifyBehaviorDetected };
