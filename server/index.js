import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authenticate, authMiddleware, getSession, revokeToken } from './auth.js';
import { connectMongo, readData, writeData, resetToSeed, MONGO_ENABLED } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR  = path.join(__dirname, '..');
const SEED_PATH = path.join(ROOT_DIR, 'data', 'initial-data.json');
const DIST_PATH = path.join(ROOT_DIR, 'dist');

const PORT = process.env.PORT || 4000;
const IS_PRODUCTION =
  process.env.NODE_ENV === 'production' || fs.existsSync(DIST_PATH);

const app = express();

if (!IS_PRODUCTION) {
  app.use(cors());
}

app.use(express.json({ limit: '10mb' }));

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'cybersmithsecure-dashboard-api',
    storage: MONGO_ENABLED ? 'mongodb' : 'json-file',
    time: new Date().toISOString(),
  });
});

// ── Auth ──────────────────────────────────────────────────────────────────────

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
  const token  = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const user   = getSession(token);

  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  res.json({ user });
});

app.post('/api/auth/logout', (req, res) => {
  const header = req.headers.authorization;
  const token  = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) revokeToken(token);
  res.json({ ok: true });
});

// ── Data CRUD ─────────────────────────────────────────────────────────────────

app.get('/api/data', authMiddleware, async (_req, res) => {
  try {
    res.json(await readData());
  } catch (err) {
    console.error('GET /api/data error:', err);
    res.status(500).json({ error: String(err) });
  }
});

app.put('/api/data', authMiddleware, async (req, res) => {
  try {
    const body = req.body;
    if (!body || !Array.isArray(body.employees) || !Array.isArray(body.projects)) {
      return res.status(400).json({ error: 'Invalid payload: expected { employees[], projects[] }' });
    }
    await writeData(body);
    res.json({ ok: true, saved: { employees: body.employees.length, projects: body.projects.length } });
  } catch (err) {
    console.error('PUT /api/data error:', err);
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/reset', authMiddleware, async (_req, res) => {
  try {
    const seed = await resetToSeed();
    res.json(seed);
  } catch (err) {
    console.error('POST /api/reset error:', err);
    res.status(500).json({ error: String(err) });
  }
});

// ── Serve built frontend in production ────────────────────────────────────────

if (IS_PRODUCTION && fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(DIST_PATH, 'index.html'));
  });
}

// ── Start ─────────────────────────────────────────────────────────────────────

connectMongo()
  .then(() => {
    app.listen(PORT, () => {
      console.log(
        `CyberSmithSecure Dashboard ${IS_PRODUCTION ? 'production' : 'dev'} running on http://localhost:${PORT}`,
        `| storage: ${MONGO_ENABLED ? 'MongoDB' : 'JSON file'}`,
      );
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
