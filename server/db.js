/**
 * Data persistence layer.
 *
 * When MONGO_URI is set → reads/writes from MongoDB Atlas.
 * Otherwise            → falls back to local data/db.json (local dev).
 */

import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = path.join(__dirname, '..', 'data');
const DB_PATH   = path.join(DATA_DIR, 'db.json');
const SEED_PATH = path.join(DATA_DIR, 'initial-data.json');

export const MONGO_ENABLED = Boolean(process.env.MONGO_URI);

// ── Mongoose model (only created when Mongo is used) ──────────────────────────

let DataModel = null;

if (MONGO_ENABLED) {
  const schema = new mongoose.Schema(
    {
      employees: { type: mongoose.Schema.Types.Mixed, default: [] },
      projects:  { type: mongoose.Schema.Types.Mixed, default: [] },
    },
    { collection: 'dashboarddata', strict: false },
  );

  DataModel = mongoose.models.DashboardData ||
              mongoose.model('DashboardData', schema);
}

// ── Connect to MongoDB and seed if the collection is empty ────────────────────

let mongoActive = false;

export function isMongoActive() {
  return mongoActive;
}

export async function connectMongo() {
  if (!MONGO_ENABLED) {
    ensureJsonDb();
    console.log('MONGO_URI not set — using local JSON storage (data/db.json)');
    return;
  }

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    mongoActive = true;
    console.log('MongoDB connected');

    const count = await DataModel.countDocuments();
    if (count === 0) {
      const seed = readSeed();
      await DataModel.create(seed);
      console.log('MongoDB seeded with initial data');
    }
  } catch (err) {
    mongoActive = false;
    console.error('MongoDB connection failed:', err.message);
    console.warn('Falling back to local JSON storage (data/db.json)');
    ensureJsonDb();
  }
}

// ── Read all data ─────────────────────────────────────────────────────────────

export async function readData() {
  if (mongoActive) {
    const doc = await DataModel.findOne({}).lean();
    if (!doc) return readSeed();
    return { employees: doc.employees ?? [], projects: doc.projects ?? [] };
  }

  ensureJsonDb();
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

// ── Write all data ────────────────────────────────────────────────────────────

export async function writeData(data) {
  if (mongoActive) {
    await DataModel.findOneAndUpdate(
      {},
      { $set: { employees: data.employees, projects: data.projects } },
      { upsert: true, new: true },
    );
    return;
  }

  ensureJsonDb();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// ── Reset to seed data ────────────────────────────────────────────────────────

export async function resetToSeed() {
  const seed = readSeed();
  await writeData(seed);
  return seed;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function readSeed() {
  return JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8'));
}

function ensureJsonDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, fs.readFileSync(SEED_PATH, 'utf-8'), 'utf-8');
  }
}
