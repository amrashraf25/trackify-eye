/**
 * TRACKIFY — Analytics Routes
 */

const express = require('express');
const router  = express.Router();
const {
  getStudentAnalytics, getCourseAnalytics, getInstitutionAnalytics,
  getSessionAnalytics, getStudentSessions,
  getDynamicRisk, getWeeklyInsights, getStudentRanking, getStudentPatterns,
} = require('../services/analytics-service');
const { getStudentBehaviorProfile, getStudentSessionBehavior } = require('../services/behavior-service');
const { getStudentAttendanceRate } = require('../services/attendance-service');

// GET /api/analytics/institution
router.get('/institution', (_req, res) => {
  try { res.json(getInstitutionAnalytics()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/analytics/course/:id
router.get('/course/:id', (req, res) => {
  try {
    const data = getCourseAnalytics(req.params.id);
    if (!data) return res.status(404).json({ error: 'Course not found' });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/analytics/student/:id
router.get('/student/:id', (req, res) => {
  try {
    const data = getStudentAnalytics(req.params.id);
    if (!data) return res.status(404).json({ error: 'Student not found' });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/analytics/student/:id/behavior
router.get('/student/:id/behavior', (req, res) => {
  try { res.json(getStudentBehaviorProfile(req.params.id)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/analytics/student/:id/attendance?course_id=...
router.get('/student/:id/attendance', (req, res) => {
  try {
    const { course_id } = req.query;
    if (!course_id) return res.status(400).json({ error: 'course_id required' });
    res.json(getStudentAttendanceRate(req.params.id, course_id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/analytics/session/:id/behavior?student_id=...
router.get('/session/:id/behavior', (req, res) => {
  try {
    const { student_id } = req.query;
    if (!student_id) return res.status(400).json({ error: 'student_id required' });
    res.json(getStudentSessionBehavior(student_id, req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/analytics/session/:id
// Full session summary: attendance list, behavior breakdown, per-student risk
router.get('/session/:id', (req, res) => {
  try {
    const data = getSessionAnalytics(req.params.id);
    if (!data) return res.status(404).json({ error: 'Session not found' });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/analytics/student/:id/sessions?course_id=&limit=
// All ended sessions for a student with their attendance status
router.get('/student/:id/sessions', (req, res) => {
  try {
    const { course_id, limit } = req.query;
    res.json(getStudentSessions(req.params.id, { course_id, limit: Number(limit) || 50 }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/analytics/insights?week_number=3
router.get('/insights', (req, res) => {
  try {
    const week = Number(req.query.week_number) || 1;
    res.json(getWeeklyInsights(week));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/analytics/ranking?limit=10
router.get('/ranking', (req, res) => {
  try {
    res.json(getStudentRanking(Number(req.query.limit) || 10));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/analytics/student/:id/risk?session_id=
router.get('/student/:id/risk', (req, res) => {
  try {
    const { session_id } = req.query;
    res.json(getDynamicRisk(req.params.id, session_id || null));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/analytics/student/:id/patterns
router.get('/student/:id/patterns', (req, res) => {
  try {
    res.json(getStudentPatterns(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
