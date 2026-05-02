const bcrypt = require('bcryptjs');
const { get, run, uuidv4 } = require('./models/db');

function seedSQLite() {
  const countRow = get('SELECT COUNT(*) as count FROM users');
  if (countRow && countRow.count > 0) {
    console.log('SQLite DB already seeded.');
    return;
  }

  console.log('Seeding demo accounts into SQLite DB...');
  const accounts = [
    { email: 'admin@trackify.com',    password: 'admin123',   role: 'admin',   name: 'Admin User' },
    { email: 'dean@trackify.com',     password: 'dean123',    role: 'dean',    name: 'Dean User' },
    { email: 'doctor@trackify.com',   password: 'doctor123',  role: 'doctor',  name: 'Dr. Smith' },
    { email: 'student@trackify.com',  password: 'student123', role: 'student', name: 'Student User' },
  ];

  for (const acc of accounts) {
    const id = uuidv4();
    const now = new Date().toISOString();
    const hash = bcrypt.hashSync(acc.password, 10);
    run('INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [id, acc.email, hash, now, now]);
    run('INSERT INTO profiles (id, email, full_name, role, avatar_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, acc.email, acc.name, acc.role, null, now, now]);
    run('INSERT INTO user_roles (id, user_id, role, created_at) VALUES (?, ?, ?, ?)', [uuidv4(), id, acc.role, now]);
  }
  console.log('✓ Demo accounts seeded into SQLite');
}

seedSQLite();
