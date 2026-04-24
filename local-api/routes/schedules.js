/**
 * TRACKIFY — Schedule Routes
 * All routes under /api/schedule/
 *
 * Who can call what:
 *   Dean  → full CRUD on schedules
 *   Doctor → read own schedules, manual start/end
 *   Admin  → everything
 */

const express = require('express');
const router  = express.Router();

const {
  createSchedule, updateSchedule, deleteSchedule,
  getSchedules, getScheduleById,
  getTodaySchedule, getUpcomingSchedules,
  tick,
} = require('../services/schedule-service');

const { startSession, endSession }   = require('../services/session-service');
const { getSessionSummary }          = require('../services/attendance-service');

// ── GET /api/schedule ─────────────────────────────────────────────────
// List schedules. Supports ?course_id=, ?doctor_id=, ?day=, ?active_only=1
router.get('/', (req, res) => {
  try {
    const { course_id, doctor_id, day_of_week, active_only } = req.query;
    const schedules = getSchedules({
      course_id, doctor_id, day_of_week,
      active_only: active_only === '1' || active_only === 'true',
    });
    res.json(schedules);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/schedule/today ───────────────────────────────────────────
// Today's schedule with active session info (for dashboard widget)
router.get('/today', (_req, res) => {
  try { res.json(getTodaySchedule()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/schedule/upcoming ────────────────────────────────────────
router.get('/upcoming', (req, res) => {
  try {
    const limit = Number(req.query.limit) || 5;
    res.json(getUpcomingSchedules(limit));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/schedule/:id ─────────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const sched = getScheduleById(req.params.id);
    if (!sched) return res.status(404).json({ error: 'Schedule not found' });
    res.json(sched);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/schedule ────────────────────────────────────────────────
// Create a new schedule (dean/admin only)
// Body: { course_id, doctor_id, day_of_week, start_time, end_time, room_number }
router.post('/', (req, res) => {
  try {
    const schedule = createSchedule(req.body);
    // Immediately check if this new schedule should start a session right now
    setImmediate(tick);
    res.status(201).json({ success: true, schedule });
  } catch (e) {
    const status = e.message.includes('required') || e.message.includes('must be') ? 400 : 500;
    res.status(status).json({ error: e.message });
  }
});

// ── PATCH /api/schedule/:id ───────────────────────────────────────────
// Update a schedule (dean/admin only)
router.patch('/:id', (req, res) => {
  try {
    const schedule = updateSchedule(req.params.id, req.body);
    // Re-check scheduler in case time/day was changed to match now
    setImmediate(tick);
    res.json({ success: true, schedule });
  } catch (e) {
    const status = e.message.includes('must be') ? 400 : 500;
    res.status(status).json({ error: e.message });
  }
});

// ── DELETE /api/schedule/:id ──────────────────────────────────────────
// Soft-delete (sets is_active = 0)
router.delete('/:id', (req, res) => {
  try {
    res.json(deleteSchedule(req.params.id));
  } catch (e) {
    const status = e.message === 'Schedule not found' ? 404 : 500;
    res.status(status).json({ error: e.message });
  }
});

// ── POST /api/schedule/:id/start ──────────────────────────────────────
// Manual early-start a session for this schedule (dean or doctor)
router.post('/:id/start', (req, res) => {
  try {
    const sched = getScheduleById(req.params.id);
    if (!sched) return res.status(404).json({ error: 'Schedule not found' });

    const session = startSession({
      course_id:   sched.course_id,
      doctor_id:   sched.doctor_id,
      room_number: sched.room_number || '',
      schedule_id: sched.id,
      trigger:     'manual',
    });
    res.json({ success: true, session });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/schedule/:id/end ────────────────────────────────────────
// Manual early-end the active session for this schedule
router.post('/:id/end', (req, res) => {
  try {
    const sched = getScheduleById(req.params.id);
    if (!sched) return res.status(404).json({ error: 'Schedule not found' });

    const { get } = require('../models/db');
    const session = get(
      `SELECT * FROM sessions WHERE course_id = ? AND status = 'active'
       ORDER BY started_at DESC LIMIT 1`,
      [sched.course_id]
    );
    if (!session) return res.status(404).json({ error: 'No active session for this schedule' });

    const ended   = endSession(session.id, 'manual');
    const summary = getSessionSummary(session.id);
    res.json({ success: true, session: ended, summary });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
