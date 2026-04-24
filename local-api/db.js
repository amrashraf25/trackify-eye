const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

const DB_FILE = path.join(__dirname, 'db.json');

// ─── Event emitter for real-time broadcasts ───
const dbEvents = new EventEmitter();
dbEvents.setMaxListeners(100);

// ─── Table definitions ───
const EMPTY_DB = {
  users: [], profiles: [], user_roles: [], departments: [],
  students: [], courses: [], enrollments: [],
  attendance_records: [], behavior_records: [], behavior_scores: [],
  grades: [], incidents: [], notifications: [], doctor_notifications: [],
  doctor_attendance: [], doctor_behavior_records: [], doctor_behavior_scores: [],
  recognition_log: [],
};

// ─── Load / Save ───
let _data = null;

function load() {
  if (_data) return _data;
  try {
    _data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    // Add any missing tables
    for (const [k, v] of Object.entries(EMPTY_DB)) {
      if (!_data[k]) _data[k] = v;
    }
  } catch {
    _data = JSON.parse(JSON.stringify(EMPTY_DB));
  }
  return _data;
}

function save() {
  fs.writeFileSync(DB_FILE, JSON.stringify(_data, null, 2));
}

function getData() { return load(); }

// ─── Seed demo accounts ───
function seedIfEmpty() {
  const data = load();
  if (data.users.length > 0) return;

  console.log('Seeding demo accounts...');
  const accounts = [
    { email: 'admin@trackify.com',    password: 'admin123',   role: 'admin',   name: 'Admin User' },
    { email: 'dean@trackify.com',     password: 'dean123',    role: 'dean',    name: 'Dean User' },
    { email: 'doctor@trackify.com',   password: 'doctor123',  role: 'doctor',  name: 'Dr. Smith' },
    { email: 'student@trackify.com',  password: 'student123', role: 'student', name: 'Student User' },
  ];

  for (const acc of accounts) {
    const id = uuidv4();
    const now = new Date().toISOString();
    data.users.push({ id, email: acc.email, password_hash: bcrypt.hashSync(acc.password, 10), created_at: now, updated_at: now });
    data.profiles.push({ id, email: acc.email, full_name: acc.name, role: acc.role, avatar_url: null, phone: null, created_at: now, updated_at: now });
    data.user_roles.push({ id: uuidv4(), user_id: id, role: acc.role, created_at: now });
  }
  save();
  console.log('✓ Demo accounts seeded');
}

function emitChange(event, table, newRow, oldRow) {
  dbEvents.emit('change', { event, table, newRow: newRow || {}, oldRow: oldRow || {} });
}

seedIfEmpty();

module.exports = { getData, save, dbEvents, emitChange, uuidv4 };
