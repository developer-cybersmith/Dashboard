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

import express  from 'express';
import cors     from 'cors';
import path     from 'node:path';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';

import { connectDB, isMongoActive } from './config/db.js';
import { seedIfEmpty, runMigration } from './utils/seed.js';
import { readJson, writeJson, resetJson } from './utils/jsonStore.js';

import { Employee } from './models/Employee.js';
import { Project }  from './models/Project.js';
import { Company }  from './models/Company.js';
import { Activity } from './models/Activity.js';
import { convertCurrencyToINR, needsConversion } from './services/currencyService.js';

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

// ─── Currency rate lookup (frontend real-time preview) ───────────────────────
app.get('/api/currency/rate/:from', authMiddleware, async (req, res) => {
  try {
    const from = req.params.from.toUpperCase();
    if (from === 'INR') return res.json({ from: 'INR', to: 'INR', rate: 1 });
    const result = await convertCurrencyToINR(1, from);
    res.json({ from, to: 'INR', rate: result.exchangeRate, updatedAt: result.exchangeRateUpdatedAt });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ─── Activity log ────────────────────────────────────────────────────────────

app.get('/api/activity', authMiddleware, async (_req, res) => {
  try {
    if (!isMongoActive()) return res.json([]);
    const items = await Activity.find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/activity', authMiddleware, async (req, res) => {
  try {
    if (!isMongoActive()) return res.json({ ok: true });
    const { message, type = 'project', who = 'User', action = 'updated', entity = '', entityName = '', changes = [] } = req.body ?? {};
    if (!message) return res.status(400).json({ error: 'message required' });
    const doc = await Activity.create({ message, type, who, action, entity, entityName, changes });
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: manual migration trigger ─────────────────────────────────────────
// POST /api/admin/migrate  — call this once from Railway to pull data from the
// old "dashboard" collection into the new employees / projects / companies.

app.post('/api/admin/migrate', authMiddleware, async (_req, res) => {
  if (!isMongoActive()) {
    return res.status(503).json({ error: 'MongoDB not connected' });
  }
  try {
    const result = await runMigration();
    res.json(result);
  } catch (err) {
    console.error('[Admin/migrate]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/debug — shows first 3 raw docs from each collection
app.get('/api/admin/debug', authMiddleware, async (_req, res) => {
  if (!isMongoActive()) return res.status(503).json({ error: 'MongoDB not connected' });
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((c) => c.name);

    const sample = {};
    for (const name of collectionNames) {
      sample[name] = await db.collection(name).find({}).limit(3).toArray();
    }
    res.json({ database: db.databaseName, collections: collectionNames, sample });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/status — shows current collection counts
app.get('/api/admin/status', authMiddleware, async (_req, res) => {
  if (!isMongoActive()) {
    return res.status(503).json({ error: 'MongoDB not connected' });
  }
  try {
    const [employees, projects, companies] = await Promise.all([
      Employee.countDocuments(),
      Project.countDocuments(),
      Company.countDocuments(),
    ]);
    res.json({ employees, projects, companies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

/**
 * Fetch all docs from a Mongoose model, strip internal MongoDB fields,
 * and ensure every doc has a unique numeric `id`.
 */
async function fetchAndEnsureIds(Model) {
  const docs = await Model.find({}).lean();
  if (docs.length === 0) return [];

  const out = [];
  let nextId = Math.max(0, ...docs.map((d) => Number(d.id) || 0)) + 1;

  for (const doc of docs) {
    const { _id, __v, createdAt, updatedAt, key, ...rest } = doc;

    if (!rest.id || Number(rest.id) === 0) {
      rest.id = nextId++;
      await Model.findByIdAndUpdate(_id, { $set: { id: rest.id } });
    } else {
      rest.id = Number(rest.id);
    }

    out.push(rest);
  }

  return out.sort((a, b) => a.id - b.id);
}

app.get('/api/data', authMiddleware, async (_req, res) => {
  try {
    if (isMongoActive()) {
      const [employees, projects] = await Promise.all([
        fetchAndEnsureIds(Employee),
        fetchAndEnsureIds(Project),
      ]);
      console.log(`[GET /api/data] employees:${employees.length} projects:${projects.length}`);
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
          Employee.findOneAndUpdate({ id: e.id }, e, { upsert: true, returnDocument: 'after' }),
        ),
      );
      if (employees.length > 0) {
        const keepIds = employees.map((e) => e.id);
        await Employee.deleteMany({ id: { $nin: keepIds } });
      }

      // ── Currency conversion before saving projects ──────────────────────
      // Fetch existing projects once (to check if income/currency changed)
      const existingProjects = await Project.find(
        { id: { $in: projects.map((p) => p.id) } },
      ).lean();
      const existingMap = new Map(existingProjects.map((p) => [p.id, p]));

      const projectsToSave = await Promise.all(
        projects.map(async (p) => {
          const existing = existingMap.get(p.id);
          const currency = p.currency || 'INR';

          if (currency === 'INR') {
            // INR: amountINR always equals income; no API call needed
            return { ...p, currency, originalAmount: p.income, exchangeRate: 1, amountINR: p.income || 0 };
          }

          if (needsConversion(p, existing)) {
            try {
              const result = await convertCurrencyToINR(p.income, currency);
              return { ...p, currency, originalAmount: p.income, ...result };
            } catch (convErr) {
              console.error(`[Currency] Conversion failed for project ${p.id}:`, convErr.message);
              // Fall back: keep existing amountINR or use income
              return { ...p, currency, originalAmount: p.income,
                amountINR: existing?.amountINR ?? p.income,
                exchangeRate: existing?.exchangeRate ?? 1 };
            }
          }

          // No change in income/currency — reuse stored rate
          return { ...p, currency, originalAmount: p.income,
            amountINR:            existing?.amountINR            ?? p.income,
            exchangeRate:         existing?.exchangeRate         ?? 1,
            exchangeRateUpdatedAt: existing?.exchangeRateUpdatedAt };
        }),
      );
      // ────────────────────────────────────────────────────────────────────

      // Sync projects — upsert all, delete removed
      await Promise.all(
        projectsToSave.map((p) =>
          Project.findOneAndUpdate({ id: p.id }, p, { upsert: true, returnDocument: 'after' }),
        ),
      );
      if (projectsToSave.length > 0) {
        const keepIds = projectsToSave.map((p) => p.id);
        await Project.deleteMany({ id: { $nin: keepIds } });
      }

      // Keep companies in sync
      const names = [...new Set(projectsToSave.map((p) => p.company).filter(Boolean))];
      await Promise.all(
        names.map((name) =>
          Company.findOneAndUpdate({ name }, { name }, { upsert: true, returnDocument: 'after' }),
        ),
      );

      return res.json({ ok: true, saved: { employees: employees.length, projects: projectsToSave.length } });
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
