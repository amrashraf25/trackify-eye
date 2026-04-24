/**
 * TRACKIFY — Behavior Service
 * Logs behavior events from the AI pipeline, deduplicates, scores students.
 *
 * Deduplication strategy:
 *   - Each behavior event has a "cooldown" per (student, behavior, session).
 *   - If the same behavior fires within the cooldown window it is merged
 *     into the existing log (incrementing frame_count + duration) instead
 *     of creating a new row.
 */

const { all, get, run, uuidv4, emit } = require('../models/db');
const { notifyBehaviorDetected } = require('./notification-service');

// Minimum gap (seconds) before a new separate log entry is created
const COOLDOWN = {
  phone:    30,
  sleeping: 60,
  talking:  20,
  fighting:  5,   // fighting is always new — short cooldown
  cheating: 45,
  drowsy:   30,
};

// Score deductions per behavior occurrence
const SCORE_DEDUCTION = {
  phone:    5,
  sleeping: 8,
  talking:  3,
  fighting: 20,
  cheating: 15,
  drowsy:   4,
};

// Severity mapping
const SEVERITY = {
  phone:    'high',
  sleeping: 'medium',
  talking:  'low',
  fighting: 'critical',
  cheating: 'high',
  drowsy:   'low',
};

/**
 * Log a behavior event.
 * @param {object} opts
 * @param {string} opts.session_id
 * @param {string} opts.student_id
 * @param {string} [opts.course_id]
 * @param {string} opts.behavior_type   phone|sleeping|talking|fighting|cheating|drowsy
 * @param {number} [opts.confidence]
 * @param {number} [opts.duration_sec]
 * @returns {{ merged: boolean, log: object }}
 */
function logBehavior({ session_id, student_id, course_id, behavior_type, confidence = 0, duration_sec = 0, week_number = 1 }) {
  if (!student_id || !behavior_type) return { merged: false, log: null };

  const now       = new Date().toISOString();
  const cooldown  = COOLDOWN[behavior_type] ?? 30;
  const cutoff    = new Date(Date.now() - cooldown * 1000).toISOString();
  const severity  = SEVERITY[behavior_type] ?? 'medium';

  // Resolve course_id and week_number from session
  if (!course_id || week_number === 1) {
    const sess = get('SELECT course_id, week_number FROM sessions WHERE id = ?', [session_id]);
    if (!course_id) course_id = sess?.course_id || null;
    if (sess?.week_number) week_number = sess.week_number;
  }

  // Check for recent duplicate
  const recent = get(
    `SELECT * FROM behavior_logs
     WHERE session_id = ? AND student_id = ? AND behavior_type = ?
       AND started_at >= ?
     ORDER BY started_at DESC LIMIT 1`,
    [session_id, student_id, behavior_type, cutoff]
  );

  if (recent) {
    // Merge: update duration + frame count
    run(
      `UPDATE behavior_logs
       SET duration_sec = duration_sec + ?,
           frame_count  = frame_count + 1,
           confidence   = MAX(confidence, ?)
       WHERE id = ?`,
      [duration_sec, confidence, recent.id]
    );
    const updated = get('SELECT * FROM behavior_logs WHERE id = ?', [recent.id]);
    emit('UPDATE', 'behavior_logs', updated, recent);
    return { merged: true, log: updated };
  }

  // New log entry
  const id = uuidv4();
  run(
    `INSERT INTO behavior_logs
       (id, session_id, student_id, course_id, week_number, behavior_type, severity,
        started_at, duration_sec, confidence, frame_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [id, session_id, student_id, course_id, week_number, behavior_type, severity, now, duration_sec, confidence]
  );
  const log = get('SELECT * FROM behavior_logs WHERE id = ?', [id]);

  // Update behavior score (subtract points)
  _updateScore(student_id, behavior_type);

  // Broadcast
  emit('INSERT', 'behavior_logs', log, {});

  // Create incident + notify doctor for critical/high severity
  if (severity === 'critical' || severity === 'high') {
    _createIncident({ session_id, student_id, behavior_type, severity, now });
    setImmediate(() => {
      try { notifyBehaviorDetected({ session_id, student_id, behavior_type, severity, course_id }); } catch {}
    });
  }

  return { merged: false, log };
}

/**
 * Batch-log multiple events (from Python batch flush).
 */
function logBehaviorBatch(events) {
  const results = [];
  for (const ev of events) {
    try { results.push(logBehavior(ev)); } catch (e) {
      console.error('[behavior-service] batch error:', e.message);
    }
  }
  return results;
}

/**
 * Get behavior summary for a student in a session.
 */
function getStudentSessionBehavior(student_id, session_id) {
  return all(
    `SELECT behavior_type, severity, COUNT(*) as occurrences,
            SUM(duration_sec) as total_duration, AVG(confidence) as avg_confidence,
            MIN(started_at) as first_seen, MAX(started_at) as last_seen
     FROM behavior_logs
     WHERE student_id = ? AND session_id = ?
     GROUP BY behavior_type`,
    [student_id, session_id]
  );
}

/**
 * Get aggregated behavior counts for a student across all time.
 */
function getStudentBehaviorProfile(student_id) {
  const score = get(
    'SELECT * FROM behavior_scores WHERE student_id = ?',
    [student_id]
  );
  const history = all(
    `SELECT behavior_type, COUNT(*) as total, AVG(confidence) as avg_confidence,
            SUM(duration_sec) as total_duration
     FROM behavior_logs WHERE student_id = ?
     GROUP BY behavior_type ORDER BY total DESC`,
    [student_id]
  );
  const recent = all(
    `SELECT bl.*, s.full_name as course_name
     FROM behavior_logs bl
     LEFT JOIN sessions ss ON ss.id = bl.session_id
     LEFT JOIN courses s ON s.id = ss.course_id
     WHERE bl.student_id = ?
     ORDER BY bl.started_at DESC LIMIT 20`,
    [student_id]
  );
  return { score, history, recent };
}

// ── Internal helpers ──────────────────────────────────────────────────

function _updateScore(student_id, behavior_type) {
  const deduction = SCORE_DEDUCTION[behavior_type] ?? 5;
  const col       = `${behavior_type}_count`;
  const now       = new Date().toISOString();

  // Ensure row exists
  run(
    `INSERT OR IGNORE INTO behavior_scores (id, student_id, score, updated_at)
     VALUES (?, ?, 100, ?)`,
    [uuidv4(), student_id, now]
  );

  // Update score + counter
  const validCols = ['phone_count','sleeping_count','talking_count','fighting_count','cheating_count','drowsy_count'];
  if (validCols.includes(col)) {
    run(
      `UPDATE behavior_scores
       SET score      = MAX(0, score - ?),
           ${col}     = ${col} + 1,
           updated_at = ?
       WHERE student_id = ?`,
      [deduction, now, student_id]
    );
  } else {
    run(
      `UPDATE behavior_scores SET score = MAX(0, score - ?), updated_at = ?
       WHERE student_id = ?`,
      [deduction, now, student_id]
    );
  }

  const updated = get('SELECT * FROM behavior_scores WHERE student_id = ?', [student_id]);
  emit('UPDATE', 'behavior_scores', updated, {});
}

function _createIncident({ session_id, student_id, behavior_type, severity, now }) {
  try {
    const student = get('SELECT full_name FROM students WHERE id = ?', [student_id]);
    const session = get('SELECT room_number FROM sessions WHERE id = ?', [session_id]);
    const id = uuidv4();
    run(
      `INSERT INTO incidents
         (id, session_id, student_id, student_name, incident_type, description,
          room_number, severity, status, detected_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [
        id, session_id, student_id,
        student?.full_name || 'Unknown',
        behavior_type,
        `${behavior_type} detected`,
        session?.room_number || '',
        severity, now
      ]
    );
    const incident = get('SELECT * FROM incidents WHERE id = ?', [id]);
    emit('INSERT', 'incidents', incident, {});
  } catch {}
}

module.exports = { logBehavior, logBehaviorBatch, getStudentSessionBehavior, getStudentBehaviorProfile };
