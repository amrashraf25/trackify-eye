// ── Core dependencies ─────────────────────────────────────────────────────────
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');   // JWT signing / verification
const bcrypt = require('bcryptjs');    // Password hashing
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process'); // Used to launch the Python AI subprocess

// ── Python AI bridge ──────────────────────────────────────────────────────────
const AI_SCRIPT = path.join(__dirname, 'ai_analysis.py'); // Path to the Python AI analysis script

// Spawns the Python AI script, passes a JSON payload via stdin, and resolves with the parsed JSON result.
// Tries 'python' first then falls back to 'python3' for cross-platform compatibility.
function runPythonAI(payload) {
  return new Promise((resolve, reject) => {
    // Try 'python' first, fall back to 'python3'
    const tryPython = (cmd) => new Promise((res, rej) => {
      const proc = spawn(cmd, [AI_SCRIPT], { env: process.env });
      let out = '', err = '';
      proc.stdin.write(JSON.stringify(payload)); // Send the payload as JSON to the Python script's stdin
      proc.stdin.end();
      proc.stdout.on('data', d => out += d.toString()); // Accumulate stdout
      proc.stderr.on('data', d => err += d.toString()); // Accumulate stderr for error reporting
      proc.on('close', code => {
        if (out.trim()) {
          try { res(JSON.parse(out.trim())); } // Parse the JSON result from the script
          catch (e) { rej(new Error(`JSON parse error: ${out}`)); }
        } else {
          rej(new Error(err || `exit code ${code}`));
        }
      });
      proc.on('error', rej);
    });

    tryPython('python')
      .catch(() => tryPython('python3')) // Fallback for systems where 'python' is Python 2
      .then(resolve)
      .catch(reject);
  });
}

const multer = require('multer'); // Multipart form-data parser (used for file uploads)

// ── Database: try SQLite first, fall back to JSON ─────────────────────
// All CRUD operations are abstracted behind these shared variables so the
// rest of the server code works identically regardless of which DB is active.
let getData, save, uuidv4, emitChange, runQuery, runInsert, runUpdate, runDelete, runUpsert;
let _usingSQLite = false; // Flag used throughout the file to branch between SQLite and JSON paths
try {
  const sqliteDb  = require('./models/db');
  const sqliteQB  = require('./models/query-builder-sqlite');
  uuidv4    = sqliteDb.uuidv4;
  emitChange = sqliteDb.emit;
  getData    = () => ({});        // no-op shim for legacy code
  save       = () => {};          // no-op shim
  runQuery   = sqliteQB.runQuery;
  runInsert  = sqliteQB.runInsert;
  runUpdate  = sqliteQB.runUpdate;
  runDelete  = sqliteQB.runDelete;
  runUpsert  = sqliteQB.runUpsert;
  _usingSQLite = true;
  console.log('✓ Using SQLite database');
} catch (e) {
  // SQLite driver unavailable — fall back to the flat JSON file database
  console.warn('⚠ SQLite not available, falling back to JSON DB:', e.message);
  const jsonDb = require('./db');
  const jsonQB = require('./query-builder');
  getData    = jsonDb.getData;
  save       = jsonDb.save;
  uuidv4     = jsonDb.uuidv4;
  emitChange = jsonDb.emitChange;
  runQuery   = jsonQB.runQuery;
  runInsert  = jsonQB.runInsert;
  runUpdate  = jsonQB.runUpdate;
  runDelete  = jsonQB.runDelete;
  runUpsert  = jsonQB.runUpsert;
}

// ── New API routes (SQLite-backed) ────────────────────────────────────
// Feature-specific routers mounted under /api/*
const aiEventsRouter       = require('./routes/ai-events');
const sessionsRouter       = require('./routes/sessions');
const analyticsRouter      = require('./routes/analytics');
const schedulesRouter      = require('./routes/schedules');
const notificationsRouter  = require('./routes/notifications');
const reportsRouter        = require('./routes/reports');
const cameraRouter         = require('./routes/camera');

const { setupRealtime } = require('./realtime'); // WebSocket / SSE realtime layer

const app = express();
const PORT = 3001;
const JWT_SECRET = 'trackify-local-secret-key-2024'; // Shared secret for signing/verifying JWTs locally

// ─── Middleware ───
// Allow all origins so the React dev server (port 5173) can reach this API
app.use(cors({ origin: '*', methods: ['GET','POST','PATCH','PUT','DELETE','HEAD','OPTIONS'], allowedHeaders: '*', exposedHeaders: ['Content-Range', 'Range-Unit', 'X-Total-Count'] }));
// Custom body parser: use express.json for JSON, skip for multipart (multer handles it), raw otherwise
app.use((req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (ct.includes('application/json')) {
    express.json({ limit: '50mb' })(req, res, next);
  } else if (ct.includes('multipart/form-data')) {
    next(); // let multer handle it
  } else {
    express.raw({ type: '*/*', limit: '50mb' })(req, res, next);
  }
});

// ─── Static file serving for uploaded photos ───
const UPLOADS_DIR = path.join(__dirname, 'uploads'); // Root directory for all uploaded files
fs.mkdirSync(UPLOADS_DIR, { recursive: true }); // Create uploads dir on startup if it doesn't exist
// Serve uploaded files at the same public URL path that Supabase Storage would use
app.use('/storage/v1/object/public', express.static(UPLOADS_DIR));

// ─── Auth helpers ───

// Extracts and verifies the JWT from the Authorization header; returns null if missing or invalid.
// The literal string 'local-anon-key' is the unauthenticated Supabase placeholder — treated as no user.
function getUser(req) {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
  if (!token || token === 'local-anon-key') return null;
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

// Creates a Supabase-compatible access token (7d) and refresh token (30d) for a given user.
// The payload mirrors the Supabase JWT structure so the React client can decode it transparently.
function makeToken(user, profile) {
  const role = profile?.role || 'student';
  const payload = {
    sub: user.id, email: user.email,
    role: 'authenticated', user_role: role,
    iss: 'supabase-local', aud: 'authenticated',
  };
  const access_token  = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  const refresh_token = jwt.sign({ sub: user.id, type: 'refresh' }, JWT_SECRET, { expiresIn: '30d' });
  return { access_token, refresh_token, role };
}

// Shapes a user + profile into the Supabase Auth user object format expected by the frontend.
function buildAuthUser(user, profile) {
  return {
    id: user.id, email: user.email, role: 'authenticated',
    created_at: user.created_at, updated_at: user.updated_at,
    app_metadata: { provider: 'email' },
    user_metadata: { full_name: profile?.full_name, avatar_url: profile?.avatar_url },
  };
}

// ── Auth helpers: work with both SQLite and JSON db ──────────────────

// Looks up a user by email (default) or by UUID. Works for both SQLite and JSON backends.
function findUser(emailOrId, byId = false) {
  if (_usingSQLite) {
    const { get: dbGet } = require('./models/db');
    return byId
      ? dbGet('SELECT * FROM users WHERE id = ?', [emailOrId])
      : dbGet('SELECT * FROM users WHERE email = ?', [emailOrId]);
  }
  const d = getData();
  return byId ? d.users?.find(u => u.id === emailOrId) : d.users?.find(u => u.email === emailOrId);
}

// Retrieves the profile row for a given user ID (contains role, full_name, avatar_url).
function findProfile(userId) {
  if (_usingSQLite) {
    const { get: dbGet } = require('./models/db');
    return dbGet('SELECT * FROM profiles WHERE id = ?', [userId]);
  }
  return getData().profiles?.find(p => p.id === userId);
}

// Inserts a new user, their profile, and a default 'student' role in one atomic operation.
// New accounts always start with the 'student' role; role can be upgraded by an admin later.
function createUser(id, email, passwordHash, meta, now) {
  if (_usingSQLite) {
    const { run: dbRun } = require('./models/db');
    dbRun('INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [id, email, passwordHash, now, now]);
    dbRun('INSERT INTO profiles (id, email, full_name, role, avatar_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, email, meta?.full_name || '', 'student', null, now, now]);
    dbRun('INSERT INTO user_roles (id, user_id, role, created_at) VALUES (?, ?, ?, ?)',
      [uuidv4(), id, 'student', now]);
  } else {
    const data = getData();
    data.users.push({ id, email, password_hash: passwordHash, created_at: now, updated_at: now });
    data.profiles.push({ id, email, full_name: meta?.full_name || '', role: 'student', avatar_url: null, created_at: now, updated_at: now });
    data.user_roles.push({ id: uuidv4(), user_id: id, role: 'student', created_at: now });
    save();
  }
}

// ══════════════════════════════════════════════
// AUTH ROUTES  /auth/v1/*
// ══════════════════════════════════════════════

// Returns auth feature flags; disabling external providers and enabling auto-confirm for local dev.
app.get('/auth/v1/settings', (_req, res) => {
  res.json({ external: {}, disable_signup: false, mailer_autoconfirm: true });
});

// Handles both 'password' and 'refresh_token' grant types (Supabase OAuth2 token endpoint).
app.post('/auth/v1/token', (req, res) => {
  const grantType = req.query.grant_type;

  // ── Password grant: validate credentials and issue tokens ──
  if (grantType === 'password') {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const user = findUser(email);
    // bcrypt.compareSync checks the plaintext password against the stored hash
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid login credentials' });
    }
    const profile = findProfile(user.id);
    const { access_token, refresh_token } = makeToken(user, profile);
    return res.json({ access_token, token_type: 'bearer', expires_in: 604800, refresh_token, user: buildAuthUser(user, profile) });
  }

  // ── Refresh token grant: verify refresh token and issue a new token pair ──
  if (grantType === 'refresh_token') {
    const { refresh_token } = req.body || {};
    try {
      const decoded = jwt.verify(refresh_token, JWT_SECRET); // Throws if expired or tampered
      const user = findUser(decoded.sub, true);
      if (!user) return res.status(400).json({ error: 'invalid_grant' });
      const profile = findProfile(user.id);
      const tokens = makeToken(user, profile);
      return res.json({ access_token: tokens.access_token, token_type: 'bearer', expires_in: 604800, refresh_token: tokens.refresh_token, user: buildAuthUser(user, profile) });
    } catch { return res.status(400).json({ error: 'invalid_grant' }); }
  }

  res.status(400).json({ error: 'unsupported_grant_type' });
});

// Registers a new user, hashes their password with bcrypt (cost 10), and returns tokens immediately.
app.post('/auth/v1/signup', (req, res) => {
  const { email, password, data: meta } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  if (findUser(email)) return res.status(400).json({ error: 'User already registered' });

  const id = uuidv4(), now = new Date().toISOString();
  createUser(id, email, bcrypt.hashSync(password, 10), meta, now); // Hash before storing

  const user    = findUser(email);
  const profile = findProfile(id);
  const { access_token, refresh_token } = makeToken(user, profile);
  res.json({ access_token, token_type: 'bearer', expires_in: 604800, refresh_token, user: buildAuthUser(user, profile) });
});

// Returns the currently authenticated user's profile based on their JWT.
app.get('/auth/v1/user', (req, res) => {
  const authUser = getUser(req); // Decode JWT from Authorization header
  if (!authUser) return res.status(401).json({ message: 'Not authenticated' });
  const user = findUser(authUser.sub, true); // sub = user UUID
  if (!user) return res.status(404).json({ message: 'User not found' });
  const profile = findProfile(user.id);
  res.json(buildAuthUser(user, profile));
});

// Logout is stateless (JWT-based); just return an empty success response.
app.post('/auth/v1/logout', (_req, res) => res.json({}));

// ══════════════════════════════════════════════
// RPC  /rest/v1/rpc/*
// ══════════════════════════════════════════════

// Returns the role string (e.g. 'student', 'doctor', 'dean') for a given user ID.
// Checks user_roles first; falls back to profiles.role for users without an explicit role row.
app.post('/rest/v1/rpc/get_user_role', (req, res) => {
  const { _user_id } = req.body || {};
  if (_usingSQLite) {
    const { get: dbGet } = require('./models/db');
    const row = dbGet('SELECT role FROM user_roles WHERE user_id = ? LIMIT 1', [_user_id]);
    if (row) return res.json(row.role);
    // Fallback: read role directly from profiles if no user_roles entry exists
    const profile = dbGet('SELECT role FROM profiles WHERE id = ?', [_user_id]);
    return res.json(profile?.role || null);
  }
  const data = getData();
  const row = data.user_roles?.find(r => r.user_id === _user_id);
  if (row) return res.json(row.role);
  // Fallback: check profiles.role
  const profile = data.profiles.find(p => p.id === _user_id);
  res.json(profile?.role || null);
});

// ══════════════════════════════════════════════
// STORAGE  /storage/v1/*
// ══════════════════════════════════════════════

// Store uploaded files in memory before writing to disk (avoids temp-file cleanup complexity)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Writes an uploaded file to disk under uploads/<bucket>/<filePath>.
// Accepts both multipart uploads (via multer) and raw binary body streams.
function handleStorageUpload(req, res) {
  try {
    const bucket = req.params.bucket;
    const filePath = req.params[0] || req.params['0'] || `file_${Date.now()}`;
    const dir = path.join(UPLOADS_DIR, bucket, path.dirname(filePath));
    fs.mkdirSync(dir, { recursive: true }); // Ensure the nested bucket directory exists
    const fullPath = path.join(UPLOADS_DIR, bucket, filePath);
    // Use first multer file if available, otherwise fall back to raw body
    const data = (req.files && req.files.length > 0) ? req.files[0].buffer
      : Buffer.isBuffer(req.body) ? req.body
      : Buffer.from(req.body || '');
    fs.writeFileSync(fullPath, data);
    console.log(`[UPLOAD] saved ${bucket}/${filePath} (${data.length} bytes)`);
    // Return Supabase-compatible storage metadata
    res.json({ Key: `${bucket}/${filePath}`, path: filePath, id: filePath, fullPath: `${bucket}/${filePath}` });
  } catch (e) {
    console.error('[UPLOAD ERROR]', e.message);
    res.status(500).json({ error: e.message });
  }
}

// Both POST and PUT map to the same handler (Supabase clients use either verb for uploads)
app.post('/storage/v1/object/:bucket/*', upload.any(), handleStorageUpload);
app.put('/storage/v1/object/:bucket/*', upload.any(), handleStorageUpload);

// Returns minimal file metadata; the actual file is served by the static middleware above.
app.get('/storage/v1/object/info/public/:bucket/*', (req, res) => {
  res.json({ name: req.params[0], bucket_id: req.params.bucket });
});

// ══════════════════════════════════════════════
// EDGE FUNCTIONS  /functions/v1/*
// ══════════════════════════════════════════════

// Receives real-time events from the camera feed (phone detection, behavior alerts, incidents).
// Supported actions: 'report_incident', 'phone_detected', 'behavior_alert'.
// Unknown actions are acknowledged but ignored.
app.post('/functions/v1/camera-feed', (req, res) => {
  const { action, data: d } = req.body || {};
  if (!action) return res.json({ success: false });
  try {
    if (['report_incident', 'phone_detected', 'behavior_alert'].includes(action)) {
      const incident = {
        id: uuidv4(),
        // Normalize incident_type: phone actions use a fixed label; others use the behavior field
        incident_type: action === 'phone_detected' ? 'phone_detected' : (d?.behavior || d?.incident_type || action),
        description: d?.behavior || d?.incident_type || action,
        room_number: String(d?.room_number || ''),
        severity: d?.severity || 'medium',
        status: 'active',
        student_name: d?.student_name || null,
        detected_at: new Date().toISOString(),
      };
      getData().incidents.push(incident);
      save();
      emitChange('INSERT', 'incidents', incident, {}); // Push realtime update to connected clients
      return res.json({ success: true, incident });
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Creates a new student record and seeds their initial behavior_score row (starts at 100).
app.post('/functions/v1/create-student', (req, res) => {
  const body = req.body || {};
  try {
    const id = uuidv4(), now = new Date().toISOString();
    const student = {
      id, student_code: body.student_code || `STU${Date.now()}`,
      full_name: body.full_name || '', email: body.email || null,
      department_id: body.department_id || null, year_level: body.year_level || 1,
      status: body.status || 'active', avatar_url: body.avatar_url || null,
      phone: body.phone || null, created_at: now, updated_at: now,
    };
    const data = getData();
    data.students.push(student);
    data.behavior_scores.push({ id: uuidv4(), student_id: id, score: 100, updated_at: now }); // Default perfect score
    save();
    emitChange('INSERT', 'students', student, {});
    res.json({ success: true, student });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Creates a new doctor (instructor) user account with role 'doctor' and an initial behavior score.
app.post('/functions/v1/create-doctor', (req, res) => {
  const body = req.body || {};
  try {
    const id = uuidv4(), now = new Date().toISOString();
    const hash = bcrypt.hashSync(body.password || 'doctor123', 10); // Default password if none provided
    const data = getData();
    data.users.push({ id, email: body.email, password_hash: hash, created_at: now, updated_at: now });
    const profile = { id, email: body.email, full_name: body.full_name || '', role: 'doctor', avatar_url: body.avatar_url || null, created_at: now, updated_at: now };
    data.profiles.push(profile);
    data.user_roles.push({ id: uuidv4(), user_id: id, role: 'doctor', created_at: now });
    data.doctor_behavior_scores.push({ id: uuidv4(), doctor_id: id, score: 100, updated_at: now });
    save();
    emitChange('INSERT', 'profiles', profile, {});
    res.json({ success: true, user_id: id });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Patches a doctor's profile fields (full_name, email, avatar_url). Only updates provided fields.
app.post('/functions/v1/update-doctor-profile', (req, res) => {
  const body = req.body || {};
  try {
    const data = getData();
    const id = body.doctor_id || body.user_id; // Accept either field name for flexibility
    const idx = data.profiles.findIndex(p => p.id === id);
    if (idx >= 0) {
      if (body.full_name)  data.profiles[idx].full_name = body.full_name;
      if (body.email)      data.profiles[idx].email = body.email;
      if (body.avatar_url) data.profiles[idx].avatar_url = body.avatar_url;
      save();
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// RPC: ensure_assignment_files_bucket — no-op locally (storage handled by Python backend)
app.post('/rest/v1/rpc/ensure_assignment_files_bucket', (_req, res) => res.json(null));

// ── AI Edge Function Mocks ─────────────────────────────────────────────────

// ── Helper: load submission + assignment + peers ──────────────────────────────
// Fetches the target submission, its parent assignment (for rubric/due date), and the
// text content of all other submissions in the same assignment (used for plagiarism checks).
function loadSubmissionContext(submission_id) {
  if (_usingSQLite) {
    // SQLite path — query the database directly
    const rows = runQuery('submissions', { id: `eq.${submission_id}` }, true);
    const sub = Array.isArray(rows) ? rows[0] : rows;
    if (!sub) throw new Error('Submission not found');
    const aRows = runQuery('assignments', { id: `eq.${sub.assignment_id}` }, true);
    const assignment = (Array.isArray(aRows) ? aRows[0] : aRows) || {};
    const allSubs = runQuery('submissions', { assignment_id: `eq.${sub.assignment_id}` });
    const peerList = Array.isArray(allSubs) ? allSubs : [];
    // Collect peer submission text (non-empty, excluding the target submission)
    const peers = peerList
      .filter(s => s.id !== submission_id && (s.content || '').trim())
      .map(s => s.content);
    return { data: null, sub, assignment, peers };
  }
  // JSON fallback
  const data = getData();
  const sub  = data.submissions?.find(s => s.id === submission_id);
  if (!sub) throw new Error('Submission not found');
  const assignment = data.assignments?.find(a => a.id === sub.assignment_id) || {};
  const peers = (data.submissions || [])
    .filter(s => s.id !== submission_id && s.assignment_id === sub.assignment_id && (s.content || '').trim())
    .map(s => s.content);
  return { data, sub, assignment, peers };
}

// ── AI Grade ─────────────────────────────────────────────────────────────────
// Sends submission text + assignment rubric to the Python AI and stores the suggested grade and feedback.
app.post('/functions/v1/ai-grade', async (req, res) => {
  try {
    const { submission_id } = req.body || {};
    const { data, sub, assignment } = loadSubmissionContext(submission_id);
    const content = (sub.content || '').trim();
    if (!content) return res.json({ success: false, error: 'No text content to analyze' });

    // Pass rubric and max_score so the AI can grade relative to the assignment criteria
    const pyResult = await runPythonAI({
      action:      'grade',
      content,
      rubric:      assignment.rubric      || '',
      description: assignment.description || '',
      max_score:   assignment.max_score   || 100,
    });

    if (!pyResult.success) throw new Error(pyResult.error || 'Python error');
    const { suggested_grade, detailed_feedback } = pyResult.result;

    // Persist AI results back into the submission row
    if (_usingSQLite) {
      runUpdate('submissions', {
        ai_grade: suggested_grade,
        ai_feedback: detailed_feedback,
        ai_processed_at: new Date().toISOString(),
      }, { id: `eq.${submission_id}` });
    } else {
      const idx = data.submissions.findIndex(s => s.id === submission_id);
      if (idx >= 0) {
        data.submissions[idx].ai_grade       = suggested_grade;
        data.submissions[idx].ai_feedback    = detailed_feedback;
        data.submissions[idx].ai_processed_at = new Date().toISOString();
        save();
      }
    }
    res.json({ success: true, result: { suggested_grade, detailed_feedback } });
  } catch (e) {
    console.error('[ai-grade]', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Plagiarism ────────────────────────────────────────────────────────────────
// Compares this submission against all peer submissions for the same assignment and stores a similarity score.
app.post('/functions/v1/ai-plagiarism', async (req, res) => {
  try {
    const { submission_id } = req.body || {};
    const { data, sub, peers } = loadSubmissionContext(submission_id);
    const content = (sub.content || '').trim();
    if (!content) return res.json({ success: false, error: 'No text content to analyze' });

    const pyResult = await runPythonAI({ action: 'plagiarism', content, peers });
    if (!pyResult.success) throw new Error(pyResult.error || 'Python error');
    const { similarity_score, flags, note } = pyResult.result;

    if (_usingSQLite) {
      runUpdate('submissions', {
        plagiarism_score: similarity_score,
        plagiarism_details: JSON.stringify({ flags, note }),
      }, { id: `eq.${submission_id}` });
    } else {
      const idx = data.submissions.findIndex(s => s.id === submission_id);
      if (idx >= 0) {
        data.submissions[idx].plagiarism_score   = similarity_score;
        data.submissions[idx].plagiarism_details = { flags, note };
        save();
      }
    }
    res.json({ success: true, result: { similarity_score, flags, note } });
  } catch (e) {
    console.error('[ai-plagiarism]', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── AI Detection ──────────────────────────────────────────────────────────────
// Runs AI-generated-text detection on a submission, returning a probability score and classification label.
app.post('/functions/v1/ai-detection', async (req, res) => {
  try {
    const { submission_id } = req.body || {};
    const { data, sub } = loadSubmissionContext(submission_id);
    const content = (sub.content || '').trim();
    if (!content) return res.json({ success: false, error: 'No text content to analyze' });

    const pyResult = await runPythonAI({ action: 'detection', content });
    if (!pyResult.success) throw new Error(pyResult.error || 'Python error');
    const { ai_probability, classification, indicators, note } = pyResult.result;

    if (_usingSQLite) {
      runUpdate('submissions', {
        ai_detection_score: ai_probability,
        ai_detection_label: classification,
        ai_detection_details: JSON.stringify({ indicators, note }),
      }, { id: `eq.${submission_id}` });
    } else {
      const idx = data.submissions.findIndex(s => s.id === submission_id);
      if (idx >= 0) {
        data.submissions[idx].ai_detection_score   = ai_probability;
        data.submissions[idx].ai_detection_label   = classification;
        data.submissions[idx].ai_detection_details = { indicators, note };
        save();
      }
    }
    res.json({ success: true, result: { ai_probability, classification, indicators, note } });
  } catch (e) {
    console.error('[ai-detection]', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Behavior Note ─────────────────────────────────────────────────────────────
// Generates a behavior note based on submission timing relative to the assignment due date.
app.post('/functions/v1/ai-behavior-feedback', async (req, res) => {
  try {
    const { submission_id } = req.body || {};
    const { data, sub, assignment } = loadSubmissionContext(submission_id);

    // Passes submission and due-date timestamps so the AI can assess timeliness
    const pyResult = await runPythonAI({
      action:       'behavior',
      submitted_at: sub.submitted_at,
      due_date:     assignment.due_date || null,
    });
    if (!pyResult.success) throw new Error(pyResult.error || 'Python error');
    const { behavior_note } = pyResult.result;

    if (_usingSQLite) {
      runUpdate('submissions', { behavior_note }, { id: `eq.${submission_id}` });
    } else {
      const idx = data.submissions.findIndex(s => s.id === submission_id);
      if (idx >= 0) { data.submissions[idx].behavior_note = behavior_note; save(); }
    }
    res.json({ success: true, result: { behavior_note } });
  } catch (e) {
    console.error('[ai-behavior]', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════════════
// DATA ROUTES  /rest/v1/:table
// ══════════════════════════════════════════════

// Allowlist of tables exposed through the generic REST endpoint; prevents arbitrary table access.
const ALLOWED = new Set([
  'students','courses','enrollments','attendance_records','behavior_records',
  'behavior_scores','grades','incidents','notifications','doctor_notifications',
  'doctor_attendance','doctor_behavior_records','doctor_behavior_scores',
  'recognition_log','profiles','user_roles','departments',
  'assignments','submissions','course_materials',
  // Session-based tables
  'sessions','schedules','session_summaries','behavior_logs','behavior_scores',
]);

// Generic GET handler — mimics the PostgREST REST API that the React client was built against.
// HEAD + GET share the same handler — Express routes HEAD through GET
app.get('/rest/v1/:table', (req, res) => {
  const { table } = req.params;
  if (!ALLOWED.has(table)) return res.status(404).json({ message: 'Not found' });
  try {
    const prefer   = req.headers['prefer'] || '';
    const isHead   = req.method === 'HEAD';
    // 'pgrst.object' in Accept means the client wants a single object, not an array
    const isSingle = (req.headers['accept'] || '').includes('pgrst.object');
    // Run a COUNT query when: Prefer: count=exact header OR it's a HEAD request
    const needsCount = prefer.includes('count=exact') || isHead;

    const { count } = needsCount ? runQuery(table, req.query, false, true) : { count: null };

    if (needsCount && count !== null) {
      // PostgREST format: start-end/total  (or */0 when empty)
      const range = count === 0 ? `*/${count}` : `0-${count - 1}/${count}`;
      res.set('Content-Range', range);
      res.set('Range-Unit', 'items');
    }

    // HEAD requests only need headers — no body
    if (isHead) return res.status(200).end();

    const result = runQuery(table, req.query, isSingle, false);
    if (!needsCount) {
      res.set('Content-Range', Array.isArray(result) ? `0-${Math.max(0,result.length-1)}/*` : '*/*');
    }
    res.json(result);
  } catch (e) { console.error('GET', table, e.message); res.status(500).json({ message: e.message }); }
});

// Generic POST handler — supports plain insert and upsert (merge-duplicates) via the Prefer header.
app.post('/rest/v1/:table', (req, res) => {
  const { table } = req.params;
  if (!ALLOWED.has(table)) return res.status(404).json({ message: 'Not found' });
  try {
    const prefer   = req.headers['prefer'] || '';
    const isUpsert = prefer.includes('resolution=merge-duplicates'); // PostgREST upsert signal
    const returnRep= prefer.includes('return=representation');       // Return inserted rows if set
    const result   = isUpsert ? runUpsert(table, req.body) : runInsert(table, req.body);
    if (!returnRep) return res.status(201).end(); // No body needed if representation not requested
    res.status(201).json(Array.isArray(req.body) ? result : result[0]);
  } catch (e) { console.error('POST', table, e.message); res.status(500).json({ message: e.message }); }
});

// Generic PATCH handler — updates rows matching the query-string filter.
app.patch('/rest/v1/:table', (req, res) => {
  const { table } = req.params;
  if (!ALLOWED.has(table)) return res.status(404).json({ message: 'Not found' });
  try {
    const returnRep = (req.headers['prefer'] || '').includes('return=representation');
    const result = runUpdate(table, req.body, req.query);
    if (!returnRep) return res.status(204).end(); // 204 No Content when representation not requested
    res.json(result);
  } catch (e) { console.error('PATCH', table, e.message); res.status(500).json({ message: e.message }); }
});

// Generic DELETE handler — deletes rows matching the query-string filter.
app.delete('/rest/v1/:table', (req, res) => {
  const { table } = req.params;
  if (!ALLOWED.has(table)) return res.status(404).json({ message: 'Not found' });
  try { runDelete(table, req.query); res.status(204).end(); }
  catch (e) { console.error('DELETE', table, e.message); res.status(500).json({ message: e.message }); }
});

// ══════════════════════════════════════════════
// NEW API ROUTES  /api/*
// ══════════════════════════════════════════════
app.use('/api/ai',            aiEventsRouter);
app.use('/api/session',       sessionsRouter);
app.use('/api/analytics',     analyticsRouter);
app.use('/api/schedule',      schedulesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/reports',       reportsRouter);
app.use('/api/camera',        cameraRouter);

// ── GET /api/student/me?user_id=<auth_user_id> ──────────────────────
// Finds the student record that belongs to the logged-in user.
// Matches by user_id column first, falls back to email from profiles,
// and auto-patches user_id into the student row for future lookups.
app.get('/api/student/me', (req, res) => {
  try {
    const userId = req.query.user_id;
    if (!userId) return res.status(400).json({ error: 'user_id required' });

    if (_usingSQLite) {
      const { get: dbGet, run: dbRun } = require('./models/db');

      // 1. Try direct user_id column (works after first auto-link)
      let student = null;
      try { student = dbGet('SELECT * FROM students WHERE user_id = ?', [userId]); } catch {}

      if (!student) {
        // 2. Look up the profile to get the user's email, then match by email
        const profile = dbGet('SELECT email FROM profiles WHERE id = ?', [userId]);
        if (profile?.email) {
          student = dbGet('SELECT * FROM students WHERE LOWER(email) = LOWER(?)', [profile.email]);
        }
      }

      if (!student) {
        // 3. Try matching by full_name from profile (last resort)
        const profile = dbGet('SELECT full_name FROM profiles WHERE id = ?', [userId]);
        if (profile?.full_name) {
          student = dbGet('SELECT * FROM students WHERE LOWER(full_name) = LOWER(?)', [profile.full_name]);
        }
      }

      if (student) {
        // Auto-patch user_id so future queries by user_id work
        try {
          dbRun('UPDATE students SET user_id = ? WHERE id = ? AND (user_id IS NULL OR user_id = "")', [userId, student.id]);
        } catch {}
        return res.json(student);
      }
      return res.status(404).json({ error: 'No student record found for this user' });
    }

    // JSON fallback
    const data = getData();
    const profile = data.profiles?.find(p => p.id === userId);
    let student = data.students?.find(s => s.user_id === userId);
    if (!student && profile?.email) {
      student = data.students?.find(s => s.email?.toLowerCase() === profile.email?.toLowerCase());
    }
    if (!student && profile?.full_name) {
      student = data.students?.find(s => s.full_name?.toLowerCase() === profile.full_name?.toLowerCase());
    }
    if (student) {
      if (!student.user_id) { student.user_id = userId; save(); }
      return res.json(student);
    }
    return res.status(404).json({ error: 'No student record found for this user' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Health-check endpoint — confirms the server is running and reports which DB backend is active.
app.get('/health', (_req, res) => res.json({
  status: 'ok',
  mode: _usingSQLite ? 'sqlite' : 'local-json',
  db:   _usingSQLite ? 'SQLite' : 'JSON'
}));

// ─── Catch-all: log unknown routes and return JSON (not HTML) ───
// Ensures all unmatched routes return structured JSON instead of Express's default HTML error page.
app.use((req, res) => {
  console.log(`[404] ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Not found', path: req.path });
});
// Global error handler — catches any unhandled errors thrown inside route handlers.
app.use((err, req, res, _next) => {
  console.error(`[500] ${req.method} ${req.path}`, err.message);
  res.status(500).json({ error: err.message });
});

// ─── Start ───
// Wrap Express in a raw HTTP server so the realtime (WebSocket/SSE) layer can share the same port.
const server = http.createServer(app);
setupRealtime(server); // Attach WebSocket / SSE upgrade handlers to the HTTP server

server.listen(PORT, () => {
  console.log(`\n✓ Trackify Local API → http://localhost:${PORT}`);
  console.log('  admin@trackify.com / admin123');
  console.log('  dean@trackify.com  / dean123');
  console.log('  doctor@trackify.com / doctor123');
  console.log('  student@trackify.com / student123\n');

  // Start session auto-scheduler (checks schedules every 60 s)
  // Automatically opens/closes sessions based on the schedules table entries.
  try {
    const { startScheduler } = require('./services/schedule-service');
    startScheduler();
    console.log('  ✓ Session scheduler running (tick every 60 s)');
  } catch (e) {
    console.warn('  ⚠ Scheduler could not start:', e.message);
  }
});
