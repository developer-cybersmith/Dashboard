/**
 * On startup:
 *  1. Check if employees / projects collections already have data → skip.
 *  2. Otherwise look for the OLD single-document collections
 *     (`dashboard` or `dashboarddata`) and auto-migrate from there.
 *  3. If no old data found either, fall back to seeding from initial-data.json.
 */

import mongoose from 'mongoose';
import { Employee } from '../models/Employee.js';
import { Project }  from '../models/Project.js';
import { Company }  from '../models/Company.js';
import { readSeed } from './jsonStore.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function cleanEmp(e) {
  const { _id, __v, ...rest } = e;
  return {
    id:          Number(rest.id)          || 0,
    name:        String(rest.name         ?? ''),
    designation: String(rest.designation  ?? ''),
    monthlyPay:  Number(rest.monthlyPay)  || 0,
  };
}

function cleanProj(p) {
  const { _id, __v, status, ...rest } = p;
  return {
    id:               Number(rest.id)               || 0,
    company:          String(rest.company            ?? ''),
    projectName:      String(rest.projectName        ?? ''),
    category:         String(rest.category           ?? ''),
    projectLead:      String(rest.projectLead        ?? ''),
    income:           Number(rest.income)            || 0,
    startDate:        String(rest.startDate          ?? ''),
    endDate:          String(rest.endDate            ?? ''),
    completedWork:    String(rest.completedWork      ?? (status ? String(status) : '')),
    pendingWork:      String(rest.pendingWork        ?? ''),
    completedPercent: Math.min(100, Math.max(0, Number(rest.completedPercent) || 0)),
    testers:          Array.isArray(rest.testers)
                        ? rest.testers.map((t) => ({
                            name:       String(t?.name       ?? ''),
                            monthlyPay: Number(t?.monthlyPay) || 0,
                          }))
                        : [],
  };
}

async function syncCompanies(projects) {
  const names = [...new Set(projects.map((p) => p.company).filter(Boolean))];
  for (const name of names) {
    await Company.findOneAndUpdate({ name }, { name }, { upsert: true, new: true });
  }
  return names.length;
}

// ── auto-migrate from old dashboard collection ────────────────────────────────

async function migrateFromOldCollection() {
  const db = mongoose.connection.db;

  for (const colName of ['dashboard', 'dashboarddata']) {
    let doc = null;
    try {
      doc = await db.collection(colName).findOne({});
    } catch { continue; }

    if (!doc) continue;

    const rawEmps  = doc.employees ?? [];
    const rawProjs = doc.projects  ?? [];

    if (rawEmps.length === 0 && rawProjs.length === 0) continue;

    console.log(`[Migrate] Found ${rawEmps.length} employees + ${rawProjs.length} projects in "${colName}" — migrating…`);

    if (rawEmps.length > 0) {
      const docs = rawEmps.map(cleanEmp).filter((e) => e.id > 0);
      await Employee.insertMany(docs, { ordered: false }).catch((e) => {
        console.warn('[Migrate] Employee insert warnings:', e.message);
      });
      console.log(`[Migrate] Employees inserted: ${docs.length}`);
    }

    if (rawProjs.length > 0) {
      const docs = rawProjs.map(cleanProj).filter((p) => p.id > 0 && p.projectName);
      await Project.insertMany(docs, { ordered: false }).catch((e) => {
        console.warn('[Migrate] Project insert warnings:', e.message);
      });
      const compCount = await syncCompanies(docs);
      console.log(`[Migrate] Projects inserted: ${docs.length}, companies synced: ${compCount}`);
    }

    console.log(`[Migrate] Done. Old "${colName}" collection kept intact for safety.`);
    return true; // migrated
  }

  return false; // nothing found
}

// ── public API ────────────────────────────────────────────────────────────────

export async function seedIfEmpty() {
  const [empCount, projCount] = await Promise.all([
    Employee.countDocuments(),
    Project.countDocuments(),
  ]);

  if (empCount > 0 || projCount > 0) {
    console.log(`[Seed] Collections have data (emp:${empCount} proj:${projCount}) — skipping`);
    return;
  }

  console.log('[Seed] Collections are empty — checking for old dashboard data…');

  // Try auto-migration first
  const migrated = await migrateFromOldCollection();
  if (migrated) return;

  // Fall back to initial-data.json
  console.log('[Seed] No old data found — seeding from initial-data.json');
  let seed;
  try {
    seed = readSeed();
  } catch (err) {
    console.error('[Seed] Could not read initial-data.json:', err.message);
    return;
  }

  const { employees = [], projects = [] } = seed;

  if (employees.length > 0) {
    await Employee.insertMany(employees, { ordered: false }).catch(() => {});
    console.log(`[Seed] Inserted ${employees.length} employees from seed`);
  }

  if (projects.length > 0) {
    await Project.insertMany(projects, { ordered: false }).catch(() => {});
    const compCount = await syncCompanies(projects);
    console.log(`[Seed] Inserted ${projects.length} projects from seed, ${compCount} companies synced`);
  }
}

/** Helper: get the next numeric id for a collection. */
export async function nextNumericId(Model) {
  const doc = await Model.findOne({}, { id: 1 }).sort({ id: -1 }).lean();
  return doc ? doc.id + 1 : 1;
}
