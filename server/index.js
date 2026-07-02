import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authenticate, authMiddleware, getSession, revokeToken } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const SEED_PATH = path.join(DATA_DIR, 'initial-data.json');
const DIST_PATH = path.join(ROOT_DIR, 'dist');

const PORT = process.env.PORT || 4000;
const IS_PRODUCTION =
  process.env.NODE_ENV === 'production' || fs.existsSync(DIST_PATH);

const app = express();

if (!IS_PRODUCTION) {
  app.use(cors());
}

app.use(express.json({ limit: '10mb' }));

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    const seed = fs.readFileSync(SEED_PATH, 'utf-8');
    fs.writeFileSync(DB_PATH, seed, 'utf-8');
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function writeDb(data) {
  ensureDb();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'mitkat-dashboard-api', time: new Date().toISOString() });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const result = authenticate(email, password);
  if (!result) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  res.json(result);
});

app.get('/api/auth/me', (req, res) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const user = getSession(token);

  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  res.json({ user });
});

app.post('/api/auth/logout', (req, res) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) revokeToken(token);
  res.json({ ok: true });
});

app.get('/api/data', authMiddleware, (_req, res) => {
  try {
    res.json(readDb());
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.put('/api/data', authMiddleware, (req, res) => {
  try {
    const body = req.body;
    if (!body || !Array.isArray(body.employees) || !Array.isArray(body.projects)) {
      return res.status(400).json({ error: 'Invalid payload: expected { employees[], projects[] }' });
    }
    writeDb(body);
    res.json({ ok: true, saved: { employees: body.employees.length, projects: body.projects.length } });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/reset', authMiddleware, (_req, res) => {
  try {
    const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8'));
    writeDb(seed);
    res.json(seed);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

if (IS_PRODUCTION && fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(DIST_PATH, 'index.html'));
  });
}

app.listen(PORT, () => {
  ensureDb();
  console.log(
    `Mitkat Dashboard ${IS_PRODUCTION ? 'production' : 'API'} running on http://localhost:${PORT}`,
  );
});
