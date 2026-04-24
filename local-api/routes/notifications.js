/**
 * TRACKIFY — Notifications Routes
 * Exposes student and doctor notifications from SQLite.
 */

const express = require('express');
const router  = express.Router();
const { all, get, run } = require('../models/db');

// GET /api/notifications?student_id=&limit=&unread_only=
router.get('/', (req, res) => {
  try {
    const { student_id, limit = 20, unread_only } = req.query;
    if (!student_id) return res.status(400).json({ error: 'student_id required' });

    const conds  = ['student_id = ?'];
    const params = [student_id];
    if (unread_only === 'true') { conds.push('read = 0'); }

    const rows = all(
      `SELECT * FROM notifications WHERE ${conds.join(' AND ')}
       ORDER BY created_at DESC LIMIT ?`,
      [...params, Number(limit)]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/notifications/:id/read  — mark one as read
router.patch('/:id/read', (req, res) => {
  try {
    run('UPDATE notifications SET read = 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/notifications/read-all?student_id=  — mark all as read
router.patch('/read-all', (req, res) => {
  try {
    const { student_id } = req.query;
    if (!student_id) return res.status(400).json({ error: 'student_id required' });
    run('UPDATE notifications SET read = 1 WHERE student_id = ?', [student_id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Doctor notifications ─────────────────────────────────────────────

// GET /api/notifications/doctor?doctor_id=&limit=&unread_only=
router.get('/doctor', (req, res) => {
  try {
    const { doctor_id, limit = 30, unread_only } = req.query;
    if (!doctor_id) return res.status(400).json({ error: 'doctor_id required' });

    const conds  = ['doctor_id = ?'];
    const params = [doctor_id];
    if (unread_only === 'true') { conds.push('read = 0'); }

    const rows = all(
      `SELECT * FROM doctor_notifications WHERE ${conds.join(' AND ')}
       ORDER BY created_at DESC LIMIT ?`,
      [...params, Number(limit)]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/notifications/doctor/:id/read
router.patch('/doctor/:id/read', (req, res) => {
  try {
    run('UPDATE doctor_notifications SET read = 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/notifications/doctor/read-all?doctor_id=
router.patch('/doctor/read-all', (req, res) => {
  try {
    const { doctor_id } = req.query;
    if (!doctor_id) return res.status(400).json({ error: 'doctor_id required' });
    run('UPDATE doctor_notifications SET read = 1 WHERE doctor_id = ?', [doctor_id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
