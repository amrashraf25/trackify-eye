/**
 * TRACKIFY — Camera / Room Dashboard Routes
 *
 * GET /api/camera/rooms
 *   Returns all known rooms (derived from schedules + sessions) with
 *   active-session status for each.
 *
 * GET /api/camera/room/:room_number
 *   Full live dashboard for one room:
 *     - activeSession  (course, doctor, type, week, times, enrolled, present)
 *     - attendance[]   (per-student status + behavior chips)
 *     - behaviorSummary[] (per-type totals)
 *     - nextSession    (next scheduled session in this room today)
 */

const express = require('express');
const router  = express.Router();
const { all, get } = require('../models/db');

// ── helpers ───────────────────────────────────────────────────────────

/** All unique room_numbers that appear in schedules or sessions. */
function getAllRooms() {
  const fromSchedules = all(
    `SELECT DISTINCT room_number FROM schedules
     WHERE room_number IS NOT NULL AND room_number != ''`
  );
  const fromSessions = all(
    `SELECT DISTINCT room_number FROM sessions
     WHERE room_number IS NOT NULL AND room_number != ''`
  );

  const seen = new Set();
  const rooms = [];
  for (const r of [...fromSchedules, ...fromSessions]) {
    if (r.room_number && !seen.has(r.room_number)) {
      seen.add(r.room_number);
      rooms.push(r.room_number);
    }
  }
  // Natural sort: "Room 101" < "Room 102" etc.
  rooms.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return rooms;
}

/** Active session for a room (if any). */
function getActiveSessionForRoom(room_number) {
  return get(
    `SELECT s.*,
            c.name         AS course_name,
            c.code         AS course_code,
            p.full_name    AS doctor_name,
            p.phone        AS doctor_phone,
            sched.start_time AS sched_start,
            sched.end_time   AS sched_end
     FROM sessions s
     LEFT JOIN courses  c     ON c.id     = s.course_id
     LEFT JOIN profiles p     ON p.id     = s.doctor_id
     LEFT JOIN schedules sched ON sched.id = s.schedule_id
     WHERE s.room_number = ? AND s.status = 'active'
     ORDER BY s.started_at DESC LIMIT 1`,
    [room_number]
  );
}

/** Next scheduled session in this room today (after now). */
function getNextSessionForRoom(room_number) {
  const now     = new Date();
  const day     = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][now.getDay()];
  const hhmm    = now.toTimeString().slice(0,5); // 'HH:MM'

  return get(
    `SELECT sched.*,
            c.name      AS course_name,
            c.code      AS course_code,
            p.full_name AS doctor_name
     FROM schedules sched
     LEFT JOIN courses  c ON c.id  = sched.course_id
     LEFT JOIN profiles p ON p.id  = sched.doctor_id
     WHERE sched.room_number = ?
       AND sched.day_of_week = ?
       AND sched.start_time  > ?
       AND sched.is_active   = 1
     ORDER BY sched.start_time ASC LIMIT 1`,
    [room_number, day, hhmm]
  );
}

/** Full attendance list with per-student behavior chips. */
function getSessionAttendanceWithBehavior(session_id) {
  const records = all(
    `SELECT ar.*,
            st.full_name, st.student_code, st.avatar_url,
            COALESCE(bs.score, 100) AS behavior_score
     FROM attendance_records ar
     JOIN students st ON st.id = ar.student_id
     LEFT JOIN behavior_scores bs ON bs.student_id = ar.student_id
     WHERE ar.session_id = ?
     ORDER BY ar.status ASC, st.full_name ASC`,
    [session_id]
  );

  // Per-student behavior from this session
  const behaviors = all(
    `SELECT bl.student_id, bl.behavior_type, bl.severity,
            COUNT(*) AS count
     FROM behavior_logs bl
     WHERE bl.session_id = ?
     GROUP BY bl.student_id, bl.behavior_type
     ORDER BY count DESC`,
    [session_id]
  );

  const bMap = {};
  for (const b of behaviors) {
    if (!bMap[b.student_id]) bMap[b.student_id] = [];
    bMap[b.student_id].push(b);
  }

  return records.map(r => ({
    ...r,
    behaviors: bMap[r.student_id] || [],
  }));
}

/** Aggregated behavior summary for a session. */
function getSessionBehaviorSummary(session_id) {
  return all(
    `SELECT behavior_type, severity,
            COUNT(*)               AS count,
            SUM(duration_sec)      AS total_sec,
            COUNT(DISTINCT student_id) AS unique_students
     FROM behavior_logs
     WHERE session_id = ?
     GROUP BY behavior_type
     ORDER BY count DESC`,
    [session_id]
  );
}

// ── GET /api/camera/rooms ─────────────────────────────────────────────

router.get('/rooms', (req, res) => {
  try {
    const rooms = getAllRooms();

    const enriched = rooms.map(rn => {
      const active = getActiveSessionForRoom(rn);
      const next   = !active ? getNextSessionForRoom(rn) : null;
      return {
        room_number: rn,
        has_active: !!active,
        active_course: active?.course_name || null,
        active_since:  active?.started_at  || null,
        next_course:   next?.course_name   || null,
        next_start:    next?.start_time    || null,
      };
    });

    res.json(enriched);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/camera/room/:room_number ─────────────────────────────────

router.get('/room/:room_number', (req, res) => {
  try {
    const { room_number } = req.params;
    const activeSession   = getActiveSessionForRoom(room_number);
    const nextSession     = getNextSessionForRoom(room_number);

    let attendance      = [];
    let behaviorSummary = [];
    let stats           = { total: 0, present: 0, absent: 0, late: 0, rate: 0 };

    if (activeSession) {
      attendance      = getSessionAttendanceWithBehavior(activeSession.id);
      behaviorSummary = getSessionBehaviorSummary(activeSession.id);

      const present = attendance.filter(r => r.status !== 'absent').length;
      const absent  = attendance.filter(r => r.status === 'absent').length;
      const late    = attendance.filter(r => r.is_late === 1).length;
      stats = {
        total:   attendance.length,
        present,
        absent,
        late,
        rate: attendance.length > 0 ? Math.round(present / attendance.length * 100) : 0,
      };
    }

    res.json({
      room_number,
      activeSession: activeSession ? {
        ...activeSession,
        stats,
      } : null,
      attendance,
      behaviorSummary,
      nextSession: nextSession ? {
        course_name:  nextSession.course_name,
        course_code:  nextSession.course_code,
        doctor_name:  nextSession.doctor_name,
        session_type: nextSession.session_type,
        week_number:  nextSession.week_number,
        start_time:   nextSession.start_time,
        end_time:     nextSession.end_time,
      } : null,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
