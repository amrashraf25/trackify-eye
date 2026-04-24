/**
 * TRACKIFY — Analytics Service
 * Computes attendance rates, behavior scores, risk levels.
 */

const { all, get } = require('../models/db');

// Risk level thresholds
const RISK = {
  LOW:    { min: 80, label: 'low',    color: '#22c55e' },
  MEDIUM: { min: 60, label: 'medium', color: '#f59e0b' },
  HIGH:   { min: 0,  label: 'high',   color: '#ef4444' },
};

function getRiskLevel(score) {
  if (score >= 80) return RISK.LOW;
  if (score >= 60) return RISK.MEDIUM;
  return RISK.HIGH;
}

/**
 * Full analytics for a single student.
 */
function getStudentAnalytics(student_id) {
  const student = get('SELECT * FROM students WHERE id = ?', [student_id]);
  if (!student) return null;

  const behaviorScore = get(
    'SELECT * FROM behavior_scores WHERE student_id = ?', [student_id]
  ) || { score: 100, phone_count: 0, sleeping_count: 0, talking_count: 0,
         fighting_count: 0, cheating_count: 0, drowsy_count: 0 };

  // Attendance rate per course — only count 'present' or 'late', NOT 'absent'
  const attendancePerCourse = all(
    `SELECT
       c.id as course_id, c.name as course_name,
       COUNT(DISTINCT s.id)  as total_sessions,
       COUNT(DISTINCT ar.id) as attended_sessions,
       ROUND(COUNT(DISTINCT ar.id) * 100.0 / MAX(COUNT(DISTINCT s.id), 1)) as rate
     FROM courses c
     JOIN enrollments e  ON e.course_id = c.id AND e.student_id = ?
     LEFT JOIN sessions s  ON s.course_id = c.id AND s.status = 'ended'
     LEFT JOIN attendance_records ar
       ON ar.session_id = s.id AND ar.student_id = ? AND ar.status IN ('present','late')
     GROUP BY c.id`,
    [student_id, student_id]
  );

  const overallAttendanceRate = attendancePerCourse.length > 0
    ? Math.round(attendancePerCourse.reduce((a, c) => a + (c.rate || 0), 0) / attendancePerCourse.length)
    : 0;

  // Top behaviors
  const behaviorBreakdown = all(
    `SELECT behavior_type, COUNT(*) as count, SUM(duration_sec) as total_sec
     FROM behavior_logs WHERE student_id = ?
     GROUP BY behavior_type ORDER BY count DESC`,
    [student_id]
  );

  const riskLevel = getRiskLevel(behaviorScore.score);

  // Recent incidents
  const recentIncidents = all(
    `SELECT * FROM incidents WHERE student_id = ?
     ORDER BY detected_at DESC LIMIT 10`,
    [student_id]
  );

  return {
    student,
    behaviorScore,
    riskLevel,
    attendancePerCourse,
    overallAttendanceRate,
    behaviorBreakdown,
    recentIncidents,
  };
}

/**
 * Course-level analytics — for doctor dashboard.
 */
function getCourseAnalytics(course_id) {
  const course = get('SELECT * FROM courses WHERE id = ?', [course_id]);
  if (!course) return null;

  const totalSessions = get(
    `SELECT COUNT(*) as cnt FROM sessions WHERE course_id = ?`, [course_id]
  )?.cnt || 0;

  // Per-student attendance within this course
  const studentStats = all(
    `SELECT
       s.id, s.full_name, s.student_code, s.avatar_url,
       COALESCE(bs.score, 100) as behavior_score,
       COUNT(DISTINCT ar.id) as attended,
       ? as total_sessions,
       ROUND(COUNT(DISTINCT ar.id) * 100.0 / MAX(?, 1)) as attendance_rate
     FROM students s
     JOIN enrollments e ON e.student_id = s.id AND e.course_id = ?
     LEFT JOIN attendance_records ar
       ON ar.student_id = s.id AND ar.course_id = ? AND ar.status IN ('present','late')
     LEFT JOIN behavior_scores bs ON bs.student_id = s.id
     GROUP BY s.id
     ORDER BY attendance_rate DESC`,
    [totalSessions, totalSessions, course_id, course_id]
  );

  // Most frequent behaviors in this course
  const topBehaviors = all(
    `SELECT behavior_type, COUNT(*) as count, severity
     FROM behavior_logs WHERE course_id = ?
     GROUP BY behavior_type ORDER BY count DESC`,
    [course_id]
  );

  // At-risk students (score < 60 OR attendance < 70%)
  const atRisk = studentStats.filter(
    s => s.behavior_score < 60 || s.attendance_rate < 70
  );

  // Average attendance rate
  const avgAttendance = studentStats.length > 0
    ? Math.round(studentStats.reduce((a, s) => a + s.attendance_rate, 0) / studentStats.length)
    : 0;

  return {
    course,
    totalSessions,
    studentStats,
    topBehaviors,
    atRisk,
    avgAttendance,
    enrolledCount: studentStats.length,
  };
}

/**
 * Institution-wide dashboard analytics — for admin/dean.
 */
function getInstitutionAnalytics() {
  const totalStudents  = get('SELECT COUNT(*) as cnt FROM students WHERE status = ?', ['active'])?.cnt || 0;
  const totalCourses   = get('SELECT COUNT(*) as cnt FROM courses')?.cnt || 0;
  const totalSessions  = get('SELECT COUNT(*) as cnt FROM sessions')?.cnt || 0;
  const activeSessions = get(`SELECT COUNT(*) as cnt FROM sessions WHERE status = 'active'`)?.cnt || 0;

  const totalAttendance = get('SELECT COUNT(*) as cnt FROM attendance_records')?.cnt || 0;
  const totalIncidents  = get('SELECT COUNT(*) as cnt FROM incidents')?.cnt || 0;
  const criticalAlerts  = get(
    `SELECT COUNT(*) as cnt FROM incidents WHERE severity = 'critical' AND status = 'active'`
  )?.cnt || 0;

  // Behavior breakdown across institution
  const behaviorSummary = all(
    `SELECT behavior_type, COUNT(*) as count
     FROM behavior_logs GROUP BY behavior_type ORDER BY count DESC`
  );

  // Top at-risk students
  const atRiskStudents = all(
    `SELECT s.id, s.full_name, s.student_code, bs.score,
            bs.fighting_count, bs.cheating_count
     FROM behavior_scores bs
     JOIN students s ON s.id = bs.student_id
     WHERE bs.score < 60
     ORDER BY bs.score ASC LIMIT 10`
  );

  // Recent activity
  const recentAttendance = all(
    `SELECT ar.*, s.full_name, c.name as course_name
     FROM attendance_records ar
     JOIN students s  ON s.id  = ar.student_id
     LEFT JOIN courses c ON c.id = ar.course_id
     ORDER BY ar.confirmed_at DESC LIMIT 20`
  );

  return {
    summary: { totalStudents, totalCourses, totalSessions, activeSessions,
               totalAttendance, totalIncidents, criticalAlerts },
    behaviorSummary,
    atRiskStudents,
    recentAttendance,
  };
}

/**
 * Full per-session summary: attendance list + behavior breakdown.
 * Used by doctor live view and session history.
 */
function getSessionAnalytics(session_id) {
  const session = get(
    `SELECT s.*, c.name AS course_name, c.code AS course_code,
            p.full_name AS doctor_name
     FROM sessions s
     LEFT JOIN courses  c ON c.id = s.course_id
     LEFT JOIN profiles p ON p.id = s.doctor_id
     WHERE s.id = ?`,
    [session_id]
  );
  if (!session) return null;

  // Full attendance list (all enrolled students)
  const attendance = all(
    `SELECT ar.*,
            st.full_name, st.student_code, st.avatar_url,
            COALESCE(bs.score, 100) AS behavior_score
     FROM attendance_records ar
     JOIN students st ON st.id = ar.student_id
     LEFT JOIN behavior_scores bs ON bs.student_id = ar.student_id
     WHERE ar.session_id = ?
     ORDER BY ar.status ASC, ar.confirmed_at ASC`,
    [session_id]
  );

  const present = attendance.filter(r => r.status !== 'absent').length;
  const absent  = attendance.filter(r => r.status === 'absent').length;
  const late    = attendance.filter(r => r.is_late === 1).length;
  const rate    = attendance.length > 0
    ? Math.round(present * 100 / attendance.length) : 0;

  // Behavior breakdown for this session
  const behaviorBreakdown = all(
    `SELECT behavior_type, severity,
            COUNT(*)           AS occurrences,
            SUM(duration_sec)  AS total_sec,
            AVG(confidence)    AS avg_confidence,
            COUNT(DISTINCT student_id) AS unique_students
     FROM behavior_logs
     WHERE session_id = ?
     GROUP BY behavior_type
     ORDER BY occurrences DESC`,
    [session_id]
  );

  // Per-student behavior in this session
  const studentBehavior = all(
    `SELECT bl.student_id, st.full_name, st.student_code,
            bl.behavior_type, bl.severity,
            COUNT(*) AS count, SUM(bl.duration_sec) AS total_sec
     FROM behavior_logs bl
     JOIN students st ON st.id = bl.student_id
     WHERE bl.session_id = ?
     GROUP BY bl.student_id, bl.behavior_type
     ORDER BY bl.student_id, count DESC`,
    [session_id]
  );

  // Group per-student behavior into a map
  const studentBehaviorMap = {};
  for (const row of studentBehavior) {
    if (!studentBehaviorMap[row.student_id]) studentBehaviorMap[row.student_id] = [];
    studentBehaviorMap[row.student_id].push(row);
  }

  // Attach behavior summary + risk to each attendance record
  const attendanceWithBehavior = attendance.map(ar => {
    const behaviors = studentBehaviorMap[ar.student_id] || [];
    const totalEvents = behaviors.reduce((sum, b) => sum + b.count, 0);
    const hasCritical = behaviors.some(b => b.severity === 'critical');
    const hasHigh     = behaviors.some(b => b.severity === 'high');
    const riskLevel   = hasCritical ? 'critical' : hasHigh ? 'high'
      : ar.behavior_score < 60 ? 'high'
      : ar.behavior_score < 80 ? 'medium' : 'low';
    return { ...ar, behaviors, totalBehaviorEvents: totalEvents, riskLevel };
  });

  return {
    session,
    stats: { total: attendance.length, present, absent, late, rate },
    attendance: attendanceWithBehavior,
    behaviorBreakdown,
  };
}

/**
 * All sessions for a student's enrolled courses, with their attendance status per session.
 */
function getStudentSessions(student_id, { course_id, limit = 50 } = {}) {
  const params = [student_id];
  const courseFilter = course_id ? 'AND s.course_id = ?' : '';
  if (course_id) params.push(course_id);
  params.push(limit);

  const sessions = all(
    `SELECT s.*,
            c.name AS course_name, c.code AS course_code,
            ar.status  AS my_status,
            ar.is_late AS my_is_late,
            ar.method  AS my_method,
            ar.confirmed_at AS my_confirmed_at
     FROM sessions s
     JOIN enrollments e ON e.course_id = s.course_id AND e.student_id = ?
     LEFT JOIN attendance_records ar ON ar.session_id = s.id AND ar.student_id = e.student_id
     LEFT JOIN courses c ON c.id = s.course_id
     WHERE s.status = 'ended' ${courseFilter}
     ORDER BY s.started_at DESC
     LIMIT ?`,
    params
  );
  return sessions;
}

// ── Severity weights for dynamic risk ────────────────────────────────
const SEV_WEIGHT = { critical: 4, high: 3, medium: 2, low: 1 };

/**
 * Dynamic multi-factor risk score for a student in a session (or globally).
 * Combines: frequency × severity × recurrence-pattern bonus.
 */
function getDynamicRisk(student_id, session_id = null) {
  const params = session_id ? [student_id, session_id] : [student_id];
  const whereExtra = session_id ? 'AND session_id = ?' : "AND started_at >= datetime('now', '-30 days')";

  const logs = all(
    `SELECT behavior_type, severity, frame_count, duration_sec
     FROM behavior_logs WHERE student_id = ? ${whereExtra}`,
    params
  );

  let rawScore = 0;
  const counts = {};
  for (const log of logs) {
    const w = SEV_WEIGHT[log.severity] || 1;
    const density = 1 + Math.min((log.frame_count || 1) * 0.05, 2); // capped bonus
    rawScore += w * density;
    counts[log.behavior_type] = (counts[log.behavior_type] || 0) + 1;
  }

  // Pattern: same behavior in 3+ distinct sessions
  const patterns = all(
    `SELECT behavior_type, COUNT(DISTINCT session_id) as sess_count, COUNT(*) as total
     FROM behavior_logs WHERE student_id = ?
     GROUP BY behavior_type HAVING sess_count >= 3
     ORDER BY sess_count DESC`,
    [student_id]
  );
  if (patterns.length > 0) rawScore *= 1 + patterns.length * 0.25;

  const score = Math.round(rawScore);
  const level = score > 30 ? 'critical' : score > 15 ? 'high' : score > 6 ? 'medium' : 'low';
  return { score, level, counts, patterns };
}

/**
 * Weekly insights: attendance + behavior deltas vs previous week.
 */
function getWeeklyInsights(week_number) {
  const prev = week_number - 1;

  const thisAtt = get(
    `SELECT COUNT(*) as total,
            SUM(CASE WHEN status IN ('present','late') THEN 1 ELSE 0 END) as present
     FROM attendance_records WHERE week_number = ?`, [week_number]
  ) || { total: 0, present: 0 };

  const prevAtt = get(
    `SELECT COUNT(*) as total,
            SUM(CASE WHEN status IN ('present','late') THEN 1 ELSE 0 END) as present
     FROM attendance_records WHERE week_number = ?`, [prev]
  ) || { total: 0, present: 0 };

  const thisRate = thisAtt.total > 0 ? Math.round(thisAtt.present / thisAtt.total * 100) : 0;
  const prevRate = prevAtt.total > 0 ? Math.round(prevAtt.present / prevAtt.total * 100) : 0;

  const thisBeh = all(
    `SELECT behavior_type, severity, COUNT(*) as count FROM behavior_logs
     WHERE week_number = ? GROUP BY behavior_type`, [week_number]
  );
  const prevBeh = all(
    `SELECT behavior_type, COUNT(*) as count FROM behavior_logs
     WHERE week_number = ? GROUP BY behavior_type`, [prev]
  );

  const prevMap = {};
  for (const b of prevBeh) prevMap[b.behavior_type] = b.count;

  const behaviorDelta = thisBeh.map(b => {
    const p = prevMap[b.behavior_type] || 0;
    const pct = p > 0 ? Math.round((b.count - p) / p * 100) : (b.count > 0 ? 100 : 0);
    return { behavior_type: b.behavior_type, severity: b.severity, count: b.count, prev: p, change: b.count - p, pct };
  });

  const topIssues = [...thisBeh].sort((a, b) => b.count - a.count).slice(0, 3);

  // Students with absent this week
  const absentStudents = get(
    `SELECT COUNT(DISTINCT student_id) as cnt FROM attendance_records
     WHERE week_number = ? AND status = 'absent'`, [week_number]
  )?.cnt || 0;

  return {
    week_number,
    attendance: { thisRate, prevRate, change: thisRate - prevRate, thisPresent: thisAtt.present, thisTotal: thisAtt.total },
    behaviorDelta,
    topIssues,
    absentStudents,
  };
}

/**
 * Student ranking: most disciplined vs most violating.
 */
function getStudentRanking(limit = 10) {
  const disciplined = all(
    `SELECT s.id, s.full_name, s.student_code,
            COALESCE(bs.score, 100) as behavior_score,
            COUNT(DISTINCT CASE WHEN ar.status IN ('present','late') THEN ar.session_id END) as sessions_attended,
            COUNT(DISTINCT ar.session_id) as total_sessions
     FROM students s
     LEFT JOIN behavior_scores bs ON bs.student_id = s.id
     LEFT JOIN attendance_records ar ON ar.student_id = s.id
     WHERE s.status = 'active'
     GROUP BY s.id
     ORDER BY behavior_score DESC, sessions_attended DESC
     LIMIT ?`, [limit]
  );

  const violating = all(
    `SELECT s.id, s.full_name, s.student_code,
            COALESCE(bs.score, 100) as behavior_score,
            COUNT(bl.id) as total_violations,
            SUM(CASE WHEN bl.severity = 'critical' THEN 1 ELSE 0 END) as critical_count,
            SUM(CASE WHEN bl.severity = 'high' THEN 1 ELSE 0 END) as high_count
     FROM students s
     LEFT JOIN behavior_scores bs ON bs.student_id = s.id
     LEFT JOIN behavior_logs bl ON bl.student_id = s.id
     WHERE s.status = 'active'
     GROUP BY s.id
     HAVING total_violations > 0
     ORDER BY critical_count DESC, total_violations DESC
     LIMIT ?`, [limit]
  );

  return { disciplined, violating };
}

/**
 * Detect behavior patterns for a student across sessions.
 */
function getStudentPatterns(student_id) {
  const repeated = all(
    `SELECT behavior_type, severity,
            COUNT(DISTINCT session_id) as session_count,
            COUNT(*) as total_events,
            MAX(started_at) as last_seen
     FROM behavior_logs WHERE student_id = ?
     GROUP BY behavior_type
     HAVING session_count >= 2
     ORDER BY session_count DESC`, [student_id]
  );

  const recentTrend = all(
    `SELECT ar.status, s.started_at, c.name as course_name
     FROM attendance_records ar
     JOIN sessions s ON s.id = ar.session_id
     LEFT JOIN courses c ON c.id = ar.course_id
     WHERE ar.student_id = ?
     ORDER BY s.started_at DESC LIMIT 10`, [student_id]
  );

  // Consecutive absence streak
  let streak = 0;
  for (const r of recentTrend) {
    if (r.status === 'absent') streak++;
    else break;
  }

  return { repeatedBehaviors: repeated, recentTrend, absenceStreak: streak };
}

module.exports = {
  getStudentAnalytics, getCourseAnalytics, getInstitutionAnalytics,
  getSessionAnalytics, getStudentSessions,
  getRiskLevel, getDynamicRisk, getWeeklyInsights, getStudentRanking, getStudentPatterns,
};
