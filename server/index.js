/**
 * CyberSmithSecure Dashboard — Express API Server (MVC Refactor)
 *
 * Endpoints:
 *   Auth          POST /api/auth/login   GET /api/auth/me   POST /api/auth/logout
 *   Health        GET  /api/health
 *   Data compat   GET  /api/data         PUT /api/data       POST /api/reset
 *   Employees     /api/employees  (CRUD)
 *   Projects      /api/projects   (CRUD)
 *   Companies     /api/companies  (CRUD)
 *   Dashboard     GET /api/dashboard  (aggregate stats)
 */

import express from 'express';
import cors    from 'cors';
import path    from 'node:path';
import { fileURLToPath } from 'node:url';

import { connectDB, isMongoActive } from './config/db.js';
import { seedIfEmpty }              from './utils/seed.js';
import { readJson, writeJson, resetJson } from './utils/jsonStore.js';

import { Employee } from './models/Employee.js';
import { Project }  from './models/Project.js';
import { Company }  from './models/Company.js';

import employeeRoutes  from './routes/employees.js';
import projectRoutes   from './routes/projects.js';
import companyRoutes   from './routes/companies.js';
import dashboardRoutes from './routes/dashboard.js';

import {
  authenticate,
  getSession,
  revokeToken,
  authMiddleware,
} from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─── Auth ────────────────────────────────────────────────────────────────────

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  const result = authenticate(email, password);
  if (!result) return res.status(401).json({ error: 'Invalid credentials' });
  res.json(result);
});

app.get('/api/auth/me', (req, res) => {
  const header  = req.headers.authorization;
  const token   = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const session = getSession(token);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ user: session });
});

app.post('/api/auth/logout', (req, res) => {
  const header = req.headers.authorization;
  const token  = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) revokeToken(token);
  res.json({ ok: true });
});

// ─── Health ──────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    service:        'cybersmithsecure-dashboard-api',
    status:         'ok',
    storage:        isMongoActive() ? 'mongodb' : 'json-file',
    mongoConfigured: Boolean(process.env.MONGO_URI),
    uptime:         process.uptime(),
    timestamp:      new Date().toISOString(),
  });
});

// ─── MVC Routes (Employees, Projects, Companies, Dashboard) ──────────────────

function mongoOnly(req, res, next) {
  if (!isMongoActive()) {
    return res.status(503).json({
      error: 'MongoDB not connected. These endpoints require a live MongoDB connection.',
    });
  }
  next();
}

app.use('/api/employees', mongoOnly, employeeRoutes);
app.use('/api/projects',  mongoOnly, projectRoutes);
app.use('/api/companies', mongoOnly, companyRoutes);
app.use('/api/dashboard', mongoOnly, dashboardRoutes);

// ─── Legacy /api/data  (frontend compatibility) ───────────────────────────────
// The existing React frontend reads/writes everything via these two endpoints.
// We keep them intact, routing through MongoDB when active.

const EXCLUDE = { _id: 0, __v: 0, createdAt: 0, updatedAt: 0 };

app.get('/api/data', authMiddleware, async (_req, res) => {
  try {
    if (isMongoActive()) {
      const [employees, projects] = await Promise.all([
        Employee.find({}, EXCLUDE).sort({ id: 1 }).lean(),
        Project.find({},  EXCLUDE).sort({ id: 1 }).lean(),
      ]);
      return res.json({ employees, projects });
    }
    res.json(readJson());
  } catch (err) {
    console.error('[GET /api/data]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/data', authMiddleware, async (req, res) => {
  try {
    const { employees = [], projects = [] } = req.body;

    if (isMongoActive()) {
      // Sync employees — upsert all, delete removed
      await Promise.all(
        employees.map((e) =>
          Employee.findOneAndUpdate({ id: e.id }, e, { upsert: true, new: true }),
        ),
      );
      if (employees.length > 0) {
        const keepIds = employees.map((e) => e.id);
        await Employee.deleteMany({ id: { $nin: keepIds } });
      }

      // Sync projects — upsert all, delete removed
      await Promise.all(
        projects.map((p) =>
          Project.findOneAndUpdate({ id: p.id }, p, { upsert: true, new: true }),
        ),
      );
      if (projects.length > 0) {
        const keepIds = projects.map((p) => p.id);
        await Project.deleteMany({ id: { $nin: keepIds } });
      }

      // Keep companies in sync
      const names = [...new Set(projects.map((p) => p.company).filter(Boolean))];
      await Promise.all(
        names.map((name) =>
          Company.findOneAndUpdate({ name }, { name }, { upsert: true, new: true }),
        ),
      );

      return res.json({ ok: true, saved: { employees: employees.length, projects: projects.length } });
    }

    writeJson({ employees, projects });
    res.json({ ok: true, saved: { employees: employees.length, projects: projects.length } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reset', authMiddleware, async (_req, res) => {
  try {
    if (isMongoActive()) {
      await Promise.all([Employee.deleteMany({}), Project.deleteMany({}), Company.deleteMany({})]);
      await seedIfEmpty();

      const [employees, projects] = await Promise.all([
        Employee.find({}, EXCLUDE).sort({ id: 1 }).lean(),
        Project.find({},  EXCLUDE).sort({ id: 1 }).lean(),
      ]);
      return res.json({ employees, projects });
    }

    const data = resetJson();
    res.json(data);
  } catch (err) {
    console.error('[POST /api/reset]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Static files (production build) ─────────────────────────────────────────

const DIST = path.join(__dirname, '..', 'dist');
app.use(express.static(DIST));
app.get('*', (_req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

// ─── Bootstrap ───────────────────────────────────────────────────────────────

async function start() {
  await connectDB();

  if (isMongoActive()) {
    try {
      await seedIfEmpty();
    } catch (err) {
      console.error('[Server] Seed failed (non-fatal):', err.message);
    }
  }

  app.listen(PORT, () => {
    const storage = isMongoActive() ? 'MongoDB' : 'JSON file';
    console.log(
      `[Server] CyberSmithSecure Dashboard running on port ${PORT} | storage: ${storage}`,
    );
  });
}

start().catch((err) => {
  console.error('[Server] Fatal startup error:', err.message);
  process.exit(1);
});
