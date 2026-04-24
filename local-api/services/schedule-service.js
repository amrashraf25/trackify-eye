/**
 * TRACKIFY — Schedule Service
 *
 * Two responsibilities:
 *   1. CRUD for dean-managed course schedules
 *   2. Auto-scheduler: checks every minute whether a session should
 *      start or stop based on the schedule table, then calls
 *      session-service accordingly.
 *
 * Schedule check logic (runs every 60 s):
 *   • Find schedules whose day_of_week == today AND start_time == now
 *     → call startSession() for each (if no session already active)
 *   • Find active sessions whose scheduled end_time == now
 *     → call endSession() for each
 *
 * Dean can also start/end sessions manually via routes/sessions.js.
 */

const { all, get, run, uuidv4, emit } = require('../models/db');
const { startSession, endSession }    = require('./session-service');

// ── Day name helpers ──────────────────────────────────────────────────
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function todayName()  { return DAY_NAMES[new Date().getDay()]; }
function nowHHMM()    {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// ── CRUD ──────────────────────────────────────────────────────────────

function createSchedule({ course_id, doctor_id, day_of_week, start_time, end_time, room_number, session_type = 'lecture', week_number = 1, created_by }) {
  if (!course_id || !day_of_week || !start_time || !end_time) {
    throw new Error('course_id, day_of_week, start_time, end_time are required');
  }
  // Validate day
  if (!DAY_NAMES.includes(day_of_week)) {
    throw new Error(`day_of_week must be one of: ${DAY_NAMES.join(', ')}`);
  }
  // Validate time format HH:MM
  if (!/^\d{2}:\d{2}$/.test(start_time) || !/^\d{2}:\d{2}$/.test(end_time)) {
    throw new Error('start_time and end_time must be in HH:MM format');
  }
  if (start_time >= end_time) {
    throw new Error('start_time must be before end_time');
  }

  const id  = uuidv4();
  const now = new Date().toISOString();
  run(
    `INSERT INTO schedules
       (id, course_id, doctor_id, day_of_week, start_time, end_time, room_number,
        session_type, week_number, is_active, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    [id, course_id, doctor_id || null, day_of_week, start_time, end_time, room_number || '',
     session_type, week_number, created_by || null, now, now]
  );
  const schedule = get('SELECT * FROM schedules WHERE id = ?', [id]);
  emit('INSERT', 'schedules', schedule, {});
  console.log(`[Schedule] Created: ${day_of_week} ${start_time}-${end_time} | ${session_type} | week ${week_number} | course ${course_id}`);
  return schedule;
}

function updateSchedule(id, updates) {
  const allowed = ['day_of_week','start_time','end_time','room_number','is_active','doctor_id','session_type','week_number'];
  const fields  = Object.keys(updates).filter(k => allowed.includes(k));
  if (!fields.length) throw new Error('No valid fields to update');

  if (updates.day_of_week && !DAY_NAMES.includes(updates.day_of_week)) {
    throw new Error(`day_of_week must be one of: ${DAY_NAMES.join(', ')}`);
  }

  const now = new Date().toISOString();
  const sets = [...fields.map(f => `"${f}" = ?`), 'updated_at = ?'].join(', ');
  const vals = [...fields.map(f => updates[f]), now, id];
  run(`UPDATE schedules SET ${sets} WHERE id = ?`, vals);

  const schedule = get('SELECT * FROM schedules WHERE id = ?', [id]);
  emit('UPDATE', 'schedules', schedule, {});
  return schedule;
}

function deleteSchedule(id) {
  const schedule = get('SELECT * FROM schedules WHERE id = ?', [id]);
  if (!schedule) throw new Error('Schedule not found');
  run('UPDATE schedules SET is_active = 0, updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);
  return { deleted: true };
}

function getSchedules({ course_id, doctor_id, day_of_week, active_only = false } = {}) {
  const conditions = [], params = [];
  if (course_id)   { conditions.push('s.course_id = ?');   params.push(course_id); }
  if (doctor_id)   { conditions.push('s.doctor_id = ?');   params.push(doctor_id); }
  if (day_of_week) { conditions.push('s.day_of_week = ?'); params.push(day_of_week); }
  if (active_only) { conditions.push('s.is_active = 1'); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  return all(
    `SELECT s.*, c.name as course_name, c.code as course_code,
            p.full_name as doctor_name
     FROM schedules s
     LEFT JOIN courses c ON c.id = s.course_id
     LEFT JOIN profiles p ON p.id = s.doctor_id
     ${where}
     ORDER BY s.day_of_week, s.start_time`,
    params
  );
}

function getScheduleById(id) {
  return get(
    `SELECT s.*, c.name as course_name, p.full_name as doctor_name
     FROM schedules s
     LEFT JOIN courses c ON c.id = s.course_id
     LEFT JOIN profiles p ON p.id = s.doctor_id
     WHERE s.id = ?`,
    [id]
  );
}

// ── Auto-Scheduler ────────────────────────────────────────────────────

let _schedulerInterval = null;

/**
 * Convert today's HH:MM wall-clock time to a full ISO timestamp.
 */
function todayAtHHMM(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

/**
 * Checks every minute:
 *
 * START logic (window-based — tolerates missed ticks):
 *   Find schedules where today's day matches AND we are within the
 *   [start_time, end_time) window AND no session has been started for
 *   this schedule_id today. This means if the server restarts mid-session
 *   it will pick up the session that should be running.
 *
 * END logic (two paths):
 *   1. Sessions with scheduled_end_at <= now  (fast path)
 *   2. Active sessions linked to a schedule whose end_time <= now
 *      (catches manually-started sessions without scheduled_end_at)
 */
function tick() {
  const day       = todayName();
  const time      = nowHHMM();
  const nowISO    = new Date().toISOString();
  // Start of today (local midnight expressed as ISO string)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartISO = todayStart.toISOString();

  // ── 1. Auto-start sessions ──────────────────────────────────────────
  // Find schedules whose window contains the current time today,
  // but that don't already have a session started today.
  const toStart = all(
    `SELECT s.*, c.room_number AS c_room
     FROM schedules s
     LEFT JOIN courses c ON c.id = s.course_id
     WHERE s.day_of_week = ?
       AND s.start_time  <= ?
       AND s.end_time    >  ?
       AND s.is_active   = 1
       AND NOT EXISTS (
         SELECT 1 FROM sessions sess
         WHERE sess.schedule_id = s.id
           AND sess.started_at >= ?
       )`,
    [day, time, time, todayStartISO]
  );

  for (const sched of toStart) {
    try {
      const scheduledEndAt = todayAtHHMM(sched.end_time);
      const session = startSession({
        course_id:       sched.course_id,
        doctor_id:       sched.doctor_id,
        room_number:     sched.room_number || sched.c_room || '',
        schedule_id:     sched.id,
        trigger:         'auto',
        session_type:    sched.session_type || 'lecture',
        week_number:     sched.week_number  || 1,
        scheduled_end_at: scheduledEndAt,
      });
      console.log(`[Scheduler] ▶ Auto-started session ${session.id} | course:${sched.course_id} | ${sched.start_time}-${sched.end_time}`);
    } catch (e) {
      console.error(`[Scheduler] Failed to start session for schedule ${sched.id}:`, e.message);
    }
  }

  // ── 2. Auto-end sessions (path A: scheduled_end_at) ────────────────
  const toEndByTime = all(
    `SELECT * FROM sessions
     WHERE status = 'active'
       AND scheduled_end_at IS NOT NULL
       AND scheduled_end_at <= ?`,
    [nowISO]
  );
  for (const sess of toEndByTime) {
    try {
      endSession(sess.id, 'auto-scheduled');
      console.log(`[Scheduler] ■ Auto-ended session ${sess.id} at ${time} (scheduled_end_at)`);
    } catch (e) {
      console.error(`[Scheduler] Failed to end session ${sess.id}:`, e.message);
    }
  }

  // ── 3. Auto-end sessions (path B: schedule end_time via schedule_id) ─
  // Catches sessions that don't have scheduled_end_at set (e.g., manual starts)
  const toEndBySchedule = all(
    `SELECT sess.*
     FROM sessions sess
     JOIN schedules sched ON sched.id = sess.schedule_id
     WHERE sess.status        = 'active'
       AND (sess.scheduled_end_at IS NULL OR sess.scheduled_end_at = '')
       AND sched.day_of_week  = ?
       AND sched.end_time    <= ?
       AND sched.is_active    = 1`,
    [day, time]
  );
  for (const sess of toEndBySchedule) {
    try {
      endSession(sess.id, 'auto-schedule');
      console.log(`[Scheduler] ■ Auto-ended session ${sess.id} at ${time} (schedule end_time)`);
    } catch (e) {
      console.error(`[Scheduler] Failed to end session ${sess.id}:`, e.message);
    }
  }
}

function startScheduler() {
  if (_schedulerInterval) return;
  console.log('[Scheduler] Started — checking every 5s');
  tick(); // immediate check on startup
  _schedulerInterval = setInterval(tick, 5_000);
}

function stopScheduler() {
  if (_schedulerInterval) {
    clearInterval(_schedulerInterval);
    _schedulerInterval = null;
  }
}

// ── Today's schedule helper (for frontend display) ────────────────────
function getTodaySchedule() {
  const day = todayName();
  return all(
    `SELECT s.*, c.name as course_name, c.code as course_code,
            p.full_name as doctor_name,
            sess.id as active_session_id, sess.status as session_status
     FROM schedules s
     LEFT JOIN courses c   ON c.id   = s.course_id
     LEFT JOIN profiles p  ON p.id   = s.doctor_id
     LEFT JOIN sessions sess
       ON sess.course_id = s.course_id AND sess.status = 'active'
     WHERE s.day_of_week = ? AND s.is_active = 1
     ORDER BY s.start_time`,
    [day]
  );
}

// ── Next upcoming schedule ─────────────────────────────────────────────
function getUpcomingSchedules(limit = 5) {
  const day  = todayName();
  const time = nowHHMM();
  const todayIdx = DAY_NAMES.indexOf(day);

  // Today's remaining + rest of week
  return all(
    `SELECT s.*, c.name as course_name, c.code as course_code,
            p.full_name as doctor_name
     FROM schedules s
     LEFT JOIN courses c  ON c.id  = s.course_id
     LEFT JOIN profiles p ON p.id  = s.doctor_id
     WHERE s.is_active = 1
     ORDER BY
       CASE s.day_of_week
         WHEN 'Sunday'    THEN 0 WHEN 'Monday' THEN 1 WHEN 'Tuesday'   THEN 2
         WHEN 'Wednesday' THEN 3 WHEN 'Thursday' THEN 4 WHEN 'Friday'  THEN 5
         WHEN 'Saturday'  THEN 6
       END,
       s.start_time
     LIMIT ?`,
    [limit]
  );
}

module.exports = {
  createSchedule, updateSchedule, deleteSchedule,
  getSchedules, getScheduleById,
  getTodaySchedule, getUpcomingSchedules,
  startScheduler, stopScheduler, tick,
};
