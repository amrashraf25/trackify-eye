/**
 * TRACKIFY — SQLite Schema
 * Replaces the flat JSON db with relational tables.
 * Run once on startup via db.js ensureSchema().
 */

const SCHEMA = `

-- ─── Core identity ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profiles (
  id          TEXT PRIMARY KEY REFERENCES users(id),
  email       TEXT,
  full_name   TEXT,
  role        TEXT DEFAULT 'student',
  avatar_url  TEXT,
  phone       TEXT,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_roles (
  id          TEXT PRIMARY KEY,
  user_id     TEXT REFERENCES users(id),
  role        TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS departments (
  id          TEXT PRIMARY KEY,
  name        TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- ─── Students ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
  id            TEXT PRIMARY KEY,
  student_code  TEXT UNIQUE,
  full_name     TEXT NOT NULL,
  email         TEXT,
  department_id TEXT,
  year_level    INTEGER DEFAULT 1,
  status        TEXT DEFAULT 'active',
  avatar_url    TEXT,
  face_embedding TEXT,          -- JSON array stored as text
  phone         TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- ─── Courses ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  code        TEXT,
  doctor_id   TEXT REFERENCES profiles(id),
  room_number TEXT,
  schedule    TEXT,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS enrollments (
  id          TEXT PRIMARY KEY,
  student_id  TEXT REFERENCES students(id),
  course_id   TEXT REFERENCES courses(id),
  enrolled_at TEXT DEFAULT (datetime('now')),
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now')),
  UNIQUE(student_id, course_id)
);

-- ─── Sessions (each camera-on period = one session) ───────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id                TEXT PRIMARY KEY,
  course_id         TEXT REFERENCES courses(id),
  doctor_id         TEXT REFERENCES profiles(id),
  room_number       TEXT,
  week_number       INTEGER DEFAULT 1,       -- 1-16
  session_type      TEXT DEFAULT 'lecture',  -- lecture | problem_solving | lab | tutorial
  schedule_id       TEXT,
  trigger           TEXT DEFAULT 'manual',   -- manual | auto | scheduled
  started_at        TEXT DEFAULT (datetime('now')),
  ended_at          TEXT,
  scheduled_end_at  TEXT,                    -- when the session should auto-close
  status            TEXT DEFAULT 'active',   -- active | ended
  total_present     INTEGER DEFAULT 0,
  total_enrolled    INTEGER DEFAULT 0,
  notes             TEXT
);

-- ─── Attendance ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance_records (
  id            TEXT PRIMARY KEY,
  session_id    TEXT REFERENCES sessions(id),
  student_id    TEXT REFERENCES students(id),
  course_id     TEXT REFERENCES courses(id),
  week_number   INTEGER DEFAULT 1,
  session_type  TEXT DEFAULT 'lecture',
  status        TEXT DEFAULT 'present',   -- present | late | absent
  is_late       INTEGER DEFAULT 0,
  confirmed_at  TEXT DEFAULT (datetime('now')),
  method        TEXT DEFAULT 'face_recognition',  -- face_recognition | manual | ai
  confidence    REAL DEFAULT 0.0,
  UNIQUE(session_id, student_id)         -- one record per student per session
);

-- ─── Behavior Logs ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS behavior_logs (
  id              TEXT PRIMARY KEY,
  session_id      TEXT REFERENCES sessions(id),
  student_id      TEXT REFERENCES students(id),
  course_id       TEXT REFERENCES courses(id),
  week_number     INTEGER DEFAULT 1,
  behavior_type   TEXT NOT NULL,        -- phone | sleeping | talking | fighting | cheating | drowsy
  severity        TEXT DEFAULT 'medium', -- low | medium | high | critical
  started_at      TEXT DEFAULT (datetime('now')),
  duration_sec    REAL DEFAULT 0,
  confidence      REAL DEFAULT 0,
  frame_count     INTEGER DEFAULT 1,
  notes           TEXT
);

-- ─── Behavior Scores (aggregate per student) ──────────────────────────
CREATE TABLE IF NOT EXISTS behavior_scores (
  id              TEXT PRIMARY KEY,
  student_id      TEXT UNIQUE REFERENCES students(id),
  score           INTEGER DEFAULT 100,   -- 0-100
  phone_count     INTEGER DEFAULT 0,
  sleeping_count  INTEGER DEFAULT 0,
  talking_count   INTEGER DEFAULT 0,
  fighting_count  INTEGER DEFAULT 0,
  cheating_count  INTEGER DEFAULT 0,
  drowsy_count    INTEGER DEFAULT 0,
  updated_at      TEXT DEFAULT (datetime('now'))
);

-- ─── Incidents (high-severity real-time alerts) ────────────────────────
CREATE TABLE IF NOT EXISTS incidents (
  id            TEXT PRIMARY KEY,
  session_id    TEXT,
  student_id    TEXT,
  student_name  TEXT,
  incident_type TEXT,
  description   TEXT,
  room_number   TEXT,
  severity      TEXT DEFAULT 'medium',
  status        TEXT DEFAULT 'active',
  detected_at   TEXT DEFAULT (datetime('now'))
);

-- ─── Assignments & Submissions ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assignments (
  id            TEXT PRIMARY KEY,
  course_id     TEXT REFERENCES courses(id),
  doctor_id     TEXT,
  title         TEXT,
  description   TEXT,
  due_date      TEXT,
  max_score     REAL DEFAULT 100,
  rubric        TEXT,
  content_type  TEXT DEFAULT 'assignment',
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS submissions (
  id              TEXT PRIMARY KEY,
  assignment_id   TEXT REFERENCES assignments(id),
  student_id      TEXT REFERENCES students(id),
  content         TEXT,
  file_url        TEXT,
  grade           REAL,
  ai_grade        REAL,
  ai_feedback     TEXT,
  plagiarism_score REAL,
  plagiarism_details TEXT,
  ai_detection_score REAL,
  ai_detection_label TEXT,
  ai_detection_details TEXT,
  behavior_note   TEXT,
  status          TEXT DEFAULT 'submitted',
  submitted_at    TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS course_materials (
  id          TEXT PRIMARY KEY,
  course_id   TEXT REFERENCES courses(id),
  doctor_id   TEXT,
  title       TEXT,
  description TEXT,
  file_url    TEXT,
  file_name   TEXT,
  file_size   INTEGER,
  file_type   TEXT,
  week_number INTEGER,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- ─── Notifications ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  student_id  TEXT,
  title       TEXT,
  message     TEXT,
  type        TEXT DEFAULT 'info',
  read        INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS doctor_notifications (
  id          TEXT PRIMARY KEY,
  doctor_id   TEXT,
  title       TEXT,
  message     TEXT,
  type        TEXT DEFAULT 'info',
  read        INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS grades (
  id          TEXT PRIMARY KEY,
  student_id  TEXT REFERENCES students(id),
  course_id   TEXT REFERENCES courses(id),
  grade       REAL,
  updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recognition_log (
  id          TEXT PRIMARY KEY,
  student_id  TEXT,
  session_id  TEXT,
  confidence  REAL,
  detected_at TEXT DEFAULT (datetime('now'))
);

-- ─── Doctor-level aggregates ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctor_attendance (
  id          TEXT PRIMARY KEY,
  doctor_id   TEXT,
  course_id   TEXT,
  date        TEXT,
  present     INTEGER DEFAULT 0,
  total       INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS doctor_behavior_records (
  id          TEXT PRIMARY KEY,
  doctor_id   TEXT,
  course_id   TEXT,
  student_id  TEXT,
  behavior    TEXT,
  severity    TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS doctor_behavior_scores (
  id          TEXT PRIMARY KEY,
  doctor_id   TEXT UNIQUE,
  score       INTEGER DEFAULT 100,
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- ─── Indexes for performance ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_attendance_session   ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student   ON attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_behavior_session     ON behavior_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_behavior_student     ON behavior_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_behavior_type        ON behavior_logs(behavior_type);
CREATE INDEX IF NOT EXISTS idx_sessions_course      ON sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course   ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student  ON enrollments(student_id);

-- ─── Course Schedules (dean-controlled) ───────────────────────────────
CREATE TABLE IF NOT EXISTS schedules (
  id            TEXT PRIMARY KEY,
  course_id     TEXT REFERENCES courses(id),
  doctor_id     TEXT REFERENCES profiles(id),
  day_of_week   TEXT NOT NULL,   -- 'Sunday'..'Saturday'
  start_time    TEXT NOT NULL,   -- 'HH:MM' 24-hour
  end_time      TEXT NOT NULL,   -- 'HH:MM' 24-hour
  room_number   TEXT DEFAULT '',
  session_type  TEXT DEFAULT 'lecture',   -- lecture|problem_solving|lab|tutorial
  week_number   INTEGER DEFAULT 1,        -- 1-16
  is_active     INTEGER DEFAULT 1,
  created_by    TEXT,            -- user id of dean who created it
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- ─── Session Summaries (generated when session ends) ──────────────────
CREATE TABLE IF NOT EXISTS session_summaries (
  id                TEXT PRIMARY KEY,
  session_id        TEXT UNIQUE REFERENCES sessions(id),
  course_id         TEXT,
  total_enrolled    INTEGER DEFAULT 0,
  total_present     INTEGER DEFAULT 0,
  total_absent      INTEGER DEFAULT 0,
  attendance_rate   REAL DEFAULT 0,
  behavior_events   INTEGER DEFAULT 0,
  top_behavior      TEXT,
  late_arrivals     INTEGER DEFAULT 0,
  generated_at      TEXT DEFAULT (datetime('now'))
);

-- ─── Indexes ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_schedules_course     ON schedules(course_id);
CREATE INDEX IF NOT EXISTS idx_schedules_day        ON schedules(day_of_week, start_time);
CREATE INDEX IF NOT EXISTS idx_summaries_session    ON session_summaries(session_id);

-- ─── Additional performance indexes ───────────────────────────────────
-- Sessions: status queried constantly by scheduler + ai-events
CREATE INDEX IF NOT EXISTS idx_sessions_status       ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_schedule     ON sessions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started      ON sessions(started_at);
-- Attendance: status used for present/absent counts
CREATE INDEX IF NOT EXISTS idx_attendance_status     ON attendance_records(status);
CREATE INDEX IF NOT EXISTS idx_attendance_course     ON attendance_records(course_id);
-- Behavior: cooldown query uses (session_id, student_id, behavior_type, started_at)
CREATE INDEX IF NOT EXISTS idx_behavior_cooldown     ON behavior_logs(session_id, student_id, behavior_type, started_at);
-- Notifications: per-recipient lookups
CREATE INDEX IF NOT EXISTS idx_notif_student         ON notifications(student_id, read, created_at);
CREATE INDEX IF NOT EXISTS idx_notif_doctor          ON doctor_notifications(doctor_id, read, created_at);
`;

module.exports = { SCHEMA };
