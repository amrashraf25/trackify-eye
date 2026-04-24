/**
 * TRACKIFY — AI Events Router
 * Receives POST events from the Python AI pipeline.
 * All routes under /api/ai/
 *
 * Python calls these endpoints; the frontend never calls them directly.
 */

const express = require('express');
const router  = express.Router();

const { markPresent }             = require('../services/attendance-service');
const { logBehavior, logBehaviorBatch } = require('../services/behavior-service');
const { getLatestActiveSession }  = require('../services/session-service');
const { get }                     = require('../models/db');

// ── Shared helper: resolve session_id ────────────────────────────────
function resolveSession(session_id) {
  if (session_id) {
    const s = get('SELECT * FROM sessions WHERE id = ?', [session_id]);
    if (s) return s;
  }
  return getLatestActiveSession();
}

/**
 * Returns an error string if the session's time window is violated,
 * or null if the event should be accepted.
 *
 * Rules:
 *  - Session must be active (status = 'active')
 *  - If session has scheduled_end_at and current time > scheduled_end_at → reject
 *    (catches events that arrive before the scheduler has auto-ended the session)
 */
function validateSessionWindow(session) {
  if (!session) return 'No active session';

  // Active session — also check scheduled_end_at hasn't passed
  if (session.status === 'active') {
    if (session.scheduled_end_at) {
      const now = new Date().toISOString();
      if (now > session.scheduled_end_at) {
        return `Session time window has ended (was scheduled to end at ${session.scheduled_end_at.slice(11, 16)} UTC)`;
      }
    }
    return null;
  }

  // Recently-ended session — allow attendance within a 5-minute grace window
  // so face-recognition POSTs that arrive just after session end are not lost.
  if (session.status === 'ended' && session.ended_at) {
    const endedMs = new Date(session.ended_at).getTime();
    const nowMs   = Date.now();
    const GRACE_MS = 5 * 60 * 1000; // 5 minutes
    if (nowMs - endedMs <= GRACE_MS) return null;
  }

  return 'No active session';
}

// ─────────────────────────────────────────────────────────────────────
// POST /api/ai/attendance
// Called by Python when AttendanceBuffer confirms a student present.
//
// Body:
// {
//   student_id:  "uuid",
//   session_id:  "uuid" | null,   (resolved to latest active if null)
//   confidence:  0.87,
//   timestamp:   "ISO string"
// }
// ─────────────────────────────────────────────────────────────────────
router.post('/attendance', (req, res) => {
  try {
    const { student_id, session_id, confidence, timestamp } = req.body || {};
    if (!student_id) return res.status(400).json({ error: 'student_id required' });

    // Verify student exists
    const student = get('SELECT id, full_name FROM students WHERE id = ?', [student_id]);
    if (!student) {
      return res.status(404).json({ error: `Student not found: ${student_id}` });
    }

    const session = resolveSession(session_id);
    const windowErr = validateSessionWindow(session);
    if (windowErr) {
      return res.status(409).json({ error: windowErr });
    }

    const result = markPresent({
      session_id:  session.id,
      student_id,
      course_id:   session.course_id,
      confidence:  confidence || 0,
    });

    res.json({
      success:  true,
      created:  result.created,
      student:  student.full_name,
      session:  session.id,
      record:   result.record,
    });
  } catch (e) {
    console.error('[ai/attendance]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────
// POST /api/ai/behavior
// Called by Python when a behavior is detected.
//
// Body:
// {
//   student_id:    "uuid",
//   session_id:    "uuid" | null,
//   behavior_type: "phone | sleeping | talking | fighting | cheating | drowsy",
//   confidence:    0.91,
//   duration_sec:  2.4,
//   timestamp:     "ISO string"
// }
// ─────────────────────────────────────────────────────────────────────
router.post('/behavior', (req, res) => {
  try {
    const { student_id, session_id, behavior_type, confidence, duration_sec } = req.body || {};
    if (!student_id || !behavior_type) {
      return res.status(400).json({ error: 'student_id and behavior_type required' });
    }

    const student = get('SELECT id, full_name FROM students WHERE id = ?', [student_id]);
    if (!student) {
      return res.status(404).json({ error: `Student not found: ${student_id}` });
    }

    const session = resolveSession(session_id);
    // Behavior events outside the session window are silently ignored
    // (not an error — just don't record them)
    if (validateSessionWindow(session)) {
      return res.json({ success: true, merged: false, log: null, ignored: true });
    }

    const result = logBehavior({
      session_id:    session?.id || null,
      student_id,
      course_id:     session?.course_id || null,
      behavior_type,
      confidence:    confidence || 0,
      duration_sec:  duration_sec || 0,
    });

    res.json({
      success:  true,
      merged:   result.merged,
      student:  student.full_name,
      behavior: behavior_type,
      log:      result.log,
    });
  } catch (e) {
    console.error('[ai/behavior]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────
// POST /api/ai/batch
// Python batches up to 30 events and sends them together.
// Reduces network overhead vs one call per frame.
//
// Body:
// {
//   events: [
//     { type: "attendance", student_id, session_id, confidence },
//     { type: "behavior",   student_id, session_id, behavior_type, confidence, duration_sec },
//     ...
//   ]
// }
// ─────────────────────────────────────────────────────────────────────
router.post('/batch', (req, res) => {
  try {
    const events = req.body?.events;
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'events array required' });
    }

    const session = getLatestActiveSession();
    // Reject entire batch if the session window has expired
    if (validateSessionWindow(session)) {
      return res.json({ success: true, processed: 0, results: { attendance: 0, behavior: 0, errors: 0 }, reason: 'no_active_session' });
    }
    const results = { attendance: 0, behavior: 0, errors: 0 };

    for (const ev of events) {
      try {
        const student = get('SELECT id FROM students WHERE id = ?', [ev.student_id]);
        if (!student) { results.errors++; continue; }

        const sid         = session?.id          || ev.session_id || null;
        const cid         = session?.course_id   || null;
        const week_number = session?.week_number || ev.week_number || 1;

        if (ev.type === 'attendance') {
          markPresent({ session_id: sid, student_id: ev.student_id, course_id: cid, confidence: ev.confidence });
          results.attendance++;
        } else if (ev.type === 'behavior') {
          logBehavior({ session_id: sid, student_id: ev.student_id, course_id: cid,
                        behavior_type: ev.behavior_type, confidence: ev.confidence,
                        duration_sec: ev.duration_sec || 0, week_number });
          results.behavior++;
        }
      } catch { results.errors++; }
    }

    res.json({ success: true, processed: events.length, results });
  } catch (e) {
    console.error('[ai/batch]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────
// GET /api/ai/status
// Python polls this to get active session info.
// ─────────────────────────────────────────────────────────────────────
router.get('/status', (req, res) => {
  const session = getLatestActiveSession();
  res.json({
    active_session: session || null,
    has_session:    !!session,
  });
});

module.exports = router;
