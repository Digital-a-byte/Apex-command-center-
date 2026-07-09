// APEX server — Express + built-in Node SQLite + JWT auth.
// Serves the frontend and a small JSON API for accounts + per-user data storage.

const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn('\n⚠️  WARNING: JWT_SECRET is not set. Using a temporary secret for this run only.');
  console.warn('   Every restart will invalidate existing logins. Set JWT_SECRET in your host\'s');
  console.warn('   environment variables before sharing this with real users.\n');
}
const SECRET = JWT_SECRET || require('crypto').randomBytes(32).toString('hex');

// ---------- Database ----------
const fs = require('fs');
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'apex.db');
const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS user_data (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

// ---------- App ----------
const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function signToken(user) {
  return jwt.sign({ uid: user.id, email: user.email }, SECRET, { expiresIn: '90d' });
}
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not signed in.' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}
function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

// ---------- Auth routes ----------
app.post('/api/auth/register', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  const normEmail = String(email).trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normEmail);
  if (existing) return res.status(409).json({ error: 'An account with that email already exists. Try signing in instead.' });

  const hash = bcrypt.hashSync(password, 10);
  const now = new Date().toISOString();
  const info = db.prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)').run(normEmail, hash, now);
  const user = { id: info.lastInsertRowid, email: normEmail };
  db.prepare('INSERT INTO user_data (user_id, data, updated_at) VALUES (?, ?, ?)').run(user.id, JSON.stringify(null), now);
  res.json({ token: signToken(user), email: user.email });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Enter your email and password.' });
  const normEmail = String(email).trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normEmail);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  res.json({ token: signToken(user), email: user.email });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ email: req.user.email });
});

// ---------- State (study data) routes ----------
app.get('/api/state', authMiddleware, (req, res) => {
  const row = db.prepare('SELECT data FROM user_data WHERE user_id = ?').get(req.user.uid);
  res.json({ data: row ? row.data : null });
});

app.put('/api/state', authMiddleware, (req, res) => {
  const payload = req.body && typeof req.body.data === 'string' ? req.body.data : null;
  if (payload === null) return res.status(400).json({ error: 'Missing data payload.' });
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO user_data (user_id, data, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
  `).run(req.user.uid, payload, now);
  res.json({ ok: true, updated_at: now });
});

// SPA fallback — anything not /api/* serves the app shell
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`APEX server running → http://localhost:${PORT}`);
});
