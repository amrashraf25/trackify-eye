/**
 * TRACKIFY — Session Service (upgraded)
 *
 * A session = one continuous monitoring period for a course.
 * Sessions are created by:
 *   (a) Auto-scheduler when schedule.start_time matches current time
 *   (b) Dean/Doctor clicking "Start Session" manually
 *
 * When a session ends, a session_summary row is generated automatically.
 *
 * Late detection: student confirmed more than LATE_THRESHOLD_MIN after
 * session start → attendance_records.is_late = 1.
 */

const { all, get, run, uuidv4, emit } = require('../models/db');
const { notifySessionStart, notifySessionEnd } = require('./notification-service');

const LATE_THRESHOLD_MIN = 15; // minutes after start = "late"

// ── Schema patch: add columns if they don't exist ─────────────────────
function ensureSessionColumns() {
  const patches = [
    `ALTER TABLE sessions ADD COLUMN schedule_id TEXT`,
    `ALTER TABLE sessions ADD COLUMN trigger TEXT DEFAULT 'manual'`,
    `ALTER TABLE sessions ADD COLUMN week_number INTEGER DEFAULT 1`,
    `ALTER TABLE sessions ADD COLUMN session_type TEXT DEFAULT 'lecture'`,
    `ALTER TABLE sessions ADD COLUMN scheduled_end_at TEXT`,
    `ALTER TABLE attendance_records ADD COLUMN is_late INTEGER DEFAULT 0`,
    `ALTER TABLE attendance_records ADD COLUMN week_number INTEGER DEFAULT 1`,
    `ALTER TABLE attendance_records ADD COLUMN session_type TEXT DEFAULT 'lecture'`,
    `ALTER TABLE attendance_records ADD COLUMN status TEXT DEFAULT 'present'`,
    `ALTER TABLE behavior_logs ADD COLUMN week_number INTEGER DEFAULT 1`,
    `ALTER TABLE schedules ADD COLUMN session_type TEXT DEFAULT 'lecture'`,
    `ALTER TABLE schedules ADD COLUMN week_number INTEGER DEFAULT 1`,
    // Notifications: add session/course context fields
    `ALTER TABLE notifications ADD COLUMN session_id TEXT`,
    `ALTER TABLE notifications ADD COLUMN course_id TEXT`,
    `ALTER TABLE notifications ADD COLUMN ref_type TEXT`,
    `ALTER TABLE doctor_notifications ADD COLUMN session_id TEXT`,
    `ALTER TABLE doctor_notifications ADD COLUMN course_id TEXT`,
    `ALTER TABLE doctor_notifications ADD COLUMN ref_type TEXT`,
    // Students: add user_id for linking auth accounts to student records
    `ALTER TABLE students ADD COLUMN user_id TEXT`,
  ];
  for (const sql of patches) { try { run(sql); } catch {} }
}
ensureSessionColumns();

// ── Start ─────────────────────────────────────────────────────────────

/**
 * Start a new session for a course.
 * Ends any existing active session for the same course first.
 * Pre-populates absent attendance records for all enrolled students.
 */
function startSession({ course_id, doctor_id, room_number, schedule_id, trigger = 'manual', week_number = 1, session_type = 'lecture', scheduled_end_at = null }) {
  if (!course_id) throw new Error('course_id required');

  // Gracefully end any lingering active session for this course
  const lingering = all(
    `SELECT id FROM sessions WHERE course_id = ? AND status = 'active'`,
    [course_id]
  );
  for (const s of lingering) endSession(s.id, 'auto-replaced');

  const id  = uuidv4();
  const now = new Date().toISOString();

  // Count enrolled students at session start
  const enrolledStudents = all(
    `SELECT student_id FROM enrollments WHERE course_id = ?`,
    [course_id]
  );
  const enrolledCount = enrolledStudents.length;

  run(
    `INSERT INTO sessions
       (id, course_id, doctor_id, room_number, schedule_id, trigger,
        week_number, session_type, scheduled_end_at, started_at, status, total_enrolled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
    [id, course_id, doctor_id || null, room_number || '',
     schedule_id || null, trigger, week_number, session_type, scheduled_end_at, now, enrolledCount]
  );

  // Pre-populate absent records for all enrolled students
  // These will be updated to 'present'/'late' as AI detects them
  for (const { student_id } of enrolledStudents) {
    try {
      run(
        `INSERT OR IGNORE INTO attendance_records
           (id, session_id, student_id, course_id, week_number, session_type,
            status, is_late, confirmed_at, method, confidence)
         VALUES (?, ?, ?, ?, ?, ?, 'absent', 0, ?, 'ai', 0.0)`,
        [uuidv4(), id, student_id, course_id, week_number, session_type, now]
      );
    } catch {}
  }

  const session = get('SELECT * FROM sessions WHERE id = ?', [id]);
  emit('INSERT', 'sessions', session, {});
  console.log(`[Session] ▶ Started ${id} | course:${course_id} | week:${week_number} | type:${session_type} | enrolled:${enrolledCount}${scheduled_end_at ? ' | ends:' + scheduled_end_at.slice(11,16) + 'Z' : ''}`);
  // Notify enrolled students + doctor asynchronously (don't block session start)
  setImmediate(() => { try { notifySessionStart(session); } catch {} });
  return session;
}

// ── End ───────────────────────────────────────────────────────────────

/**
 * End an active session and generate its summary.
 */
function endSession(session_id, trigger = 'manual') {
  const now = new Date().toISOString();

  // Recalculate total_present from actual records before closing
  const presentCount = get(
    `SELECT COUNT(*) as cnt FROM attendance_records
     WHERE session_id = ? AND status IN ('present','late')`,
    [session_id]
  )?.cnt || 0;

  run(
    `UPDATE sessions
     SET status = 'ended', ended_at = ?, trigger = ?, total_present = ?
     WHERE id = ?`,
    [now, trigger, presentCount, session_id]
  );
  const session = get('SELECT * FROM sessions WHERE id = ?', [session_id]);
  emit('UPDATE', 'sessions', session, {});
  console.log(`[Session] ■ Ended ${session_id} | trigger:${trigger} | present:${presentCount}`);

  setImmediate(() => {
    try { generateSummary(session_id); } catch (e) {
      console.error('[Session] Summary generation failed:', e.message);
    }
    try { notifySessionEnd(session); } catch (e) {
      console.error('[Session] End notifications failed:', e.message);
    }
  });

  return session;
}

// ── Summary ───────────────────────────────────────────────────────────

/**
 * Generate a session_summaries row when a session ends.
 * Called automatically by endSession().
 */
function generateSummary(session_id) {
  const session = get('SELECT * FROM sessions WHERE id = ?', [session_id]);
  if (!session) return null;

  const totalPresent = get(
    `SELECT COUNT(*) as cnt FROM attendance_records WHERE session_id = ?`,
    [session_id]
  )?.cnt || 0;

  const enrolled = session.course_id ? get(
    `SELECT COUNT(*) as cnt FROM enrollments WHERE course_id = ?`,
    [session.course_id]
  )?.cnt || 0 : 0;

  const totalAbsent   = Math.max(0, enrolled - totalPresent);
  const attendanceRate = enrolled > 0 ? Math.round(totalPresent / enrolled * 100) : 0;

  const behaviorEvents = get(
    `SELECT COUNT(*) as cnt FROM behavior_logs WHERE session_id = ?`,
    [session_id]
  )?.cnt || 0;

  const topBehaviorRow = get(
    `SELECT behavior_type, COUNT(*) as cnt FROM behavior_logs
     WHERE session_id = ? GROUP BY behavior_type ORDER BY cnt DESC LIMIT 1`,
    [session_id]
  );

  const lateArrivals = get(
    `SELECT COUNT(*) as cnt FROM attendance_records WHERE session_id = ? AND is_late = 1`,
    [session_id]
  )?.cnt || 0;

  const id  = uuidv4();
  const now = new Date().toISOString();

  run(
    `INSERT OR REPLACE INTO session_summaries
       (id, session_id, course_id, total_enrolled, total_present, total_absent,
        attendance_rate, behavior_events, top_behavior, late_arrivals, generated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, session_id, session.course_id, enrolled, totalPresent, totalAbsent,
     attendanceRate, behaviorEvents, topBehaviorRow?.behavior_type || null,
     lateArrivals, now]
  );

  const summary = get('SELECT * FROM session_summaries WHERE session_id = ?', [session_id]);
  emit('INSERT', 'session_summaries', summary, {});
  console.log(`[Session] Summary: ${totalPresent}/${enrolled} present (${attendanceRate}%)`);
  return summary;
}

// ── Queries ───────────────────────────────────────────────────────────

function getLatestActiveSession() {
  return get(
    `SELECT * FROM sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1`
  );
}

function getActiveSessionForCourse(course_id) {
  return get(
    `SELECT * FROM sessions WHERE course_id = ? AND status = 'active'
     ORDER BY started_at DESC LIMIT 1`,
    [course_id]
  );
}

function getOrCreateActiveSession({ course_id, doctor_id, room_number }) {
  const active = getActiveSessionForCourse(course_id);
  if (active) return active;
  return startSession({ course_id, doctor_id, room_number, trigger: 'auto-created' });
}

function getSessionSummaryRecord(session_id) {
  return get('SELECT * FROM session_summaries WHERE session_id = ?', [session_id]);
}

/**
 * Check if a student's confirmed_at time is "late" relative to session start.
 * Returns true if difference > LATE_THRESHOLD_MIN minutes.
 */
function isLateArrival(session_id, confirmed_at_iso) {
  const session = get('SELECT started_at FROM sessions WHERE id = ?', [session_id]);
  if (!session) return false;
  const startMs   = new Date(session.started_at).getTime();
  const confirmMs = new Date(confirmed_at_iso).getTime();
  return (confirmMs - startMs) > LATE_THRESHOLD_MIN * 60 * 1000;
}

module.exports = {
  startSession, endSession, generateSummary,
  getLatestActiveSession, getActiveSessionForCourse,
  getOrCreateActiveSession, getSessionSummaryRecord,
  isLateArrival, LATE_THRESHOLD_MIN,
};
