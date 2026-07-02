/**
 * seedIfEmpty()  — called on every server startup.
 *   - Only fills collections that are currently EMPTY.
 *   - For empty collections: tries old "dashboard" / "dashboarddata" collection first.
 *   - Falls back to initial-data.json if no old collection exists.
 *
 * runMigration() — can also be called manually via POST /api/admin/migrate
 *   - Always reads the old collection and upserts into new collections.
 *   - Safe to run multiple times (upsert, not insert).
 */

import mongoose from 'mongoose';
import { Employee } from '../models/Employee.js';
import { Project }  from '../models/Project.js';
import { Company }  from '../models/Company.js';
import { readSeed } from './jsonStore.js';

// ── field normalisers ─────────────────────────────────────────────────────────

export function cleanEmp(e) {
  const raw = e ?? {};
  return {
    id:          Number(raw.id)          || 0,
    name:        String(raw.name         ?? ''),
    designation: String(raw.designation  ?? ''),
    monthlyPay:  Number(raw.monthlyPay)  || 0,
  };
}

export function cleanProj(p) {
  const { _id, __v, status, ...raw } = p ?? {};
  return {
    id:               Number(raw.id)               || 0,
    company:          String(raw.company            ?? ''),
    projectName:      String(raw.projectName        ?? ''),
    category:         String(raw.category           ?? ''),
    projectLead:      String(raw.projectLead        ?? ''),
    income:           Number(raw.income)            || 0,
    startDate:        String(raw.startDate          ?? ''),
    endDate:          String(raw.endDate            ?? ''),
    completedWork:    String(raw.completedWork      ?? (status ? String(status) : '')),
    pendingWork:      String(raw.pendingWork        ?? ''),
    completedPercent: Math.min(100, Math.max(0, Number(raw.completedPercent) || 0)),
    testers: Array.isArray(raw.testers)
      ? raw.testers.map((t) => ({
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

// ── read old dashboard collection ────────────────────────────────────────────

async function readOldDashboard() {
  const db = mongoose.connection.db;
  for (const colName of ['dashboard', 'dashboarddata']) {
    try {
      const doc = await db.collection(colName).findOne({});
      if (doc && (doc.employees?.length || doc.projects?.length)) {
        console.log(`[Migrate] Found legacy data in "${colName}"`);
        return { colName, employees: doc.employees ?? [], projects: doc.projects ?? [] };
      }
    } catch { /* collection may not exist */ }
  }
  return null;
}

// ── public: full upsert migration (safe to run repeatedly) ───────────────────

export async function runMigration() {
  const old = await readOldDashboard();
  if (!old) {
    return { ok: false, message: 'No legacy dashboard/dashboarddata collection found.' };
  }

  const { colName, employees: rawEmps, projects: rawProjs } = old;
  const log = [];

  // Employees
  let empOk = 0, empSkip = 0;
  for (const e of rawEmps) {
    const doc = cleanEmp(e);
    if (!doc.id || !doc.name) { empSkip++; continue; }
    await Employee.findOneAndUpdate({ id: doc.id }, doc, { upsert: true, new: true });
    empOk++;
  }
  log.push(`Employees: ${empOk} upserted, ${empSkip} skipped`);

  // Projects
  let projOk = 0, projSkip = 0;
  for (const p of rawProjs) {
    const doc = cleanProj(p);
    if (!doc.id || !doc.projectName) { projSkip++; continue; }
    await Project.findOneAndUpdate({ id: doc.id }, doc, { upsert: true, new: true });
    projOk++;
  }
  log.push(`Projects: ${projOk} upserted, ${projSkip} skipped`);

  const compCount = await syncCompanies(rawProjs.map(cleanProj));
  log.push(`Companies synced: ${compCount}`);

  log.push(`Source: "${colName}" collection (untouched)`);
  log.forEach((l) => console.log(`[Migrate] ${l}`));

  return { ok: true, source: colName, log };
}

// ── startup seed (only fills empty collections) ───────────────────────────────

export async function seedIfEmpty() {
  const [empCount, projCount] = await Promise.all([
    Employee.countDocuments(),
    Project.countDocuments(),
  ]);

  console.log(`[Seed] employees: ${empCount}, projects: ${projCount}`);

  if (empCount > 0 && projCount > 0) {
    console.log('[Seed] Both collections populated — nothing to do');
    return;
  }

  // ── at least one collection is empty ────────────────────────────────────────
  const old = await readOldDashboard();

  if (old) {
    // Migrate only the empty collections
    if (projCount === 0 && old.projects.length > 0) {
      let ok = 0;
      for (const p of old.projects) {
        const doc = cleanProj(p);
        if (!doc.id || !doc.projectName) continue;
        await Project.findOneAndUpdate({ id: doc.id }, doc, { upsert: true, new: true });
        ok++;
      }
      await syncCompanies(old.projects.map(cleanProj));
      console.log(`[Seed] Migrated ${ok} projects from "${old.colName}"`);
    }

    if (empCount === 0 && old.employees.length > 0) {
      let ok = 0;
      for (const e of old.employees) {
        const doc = cleanEmp(e);
        if (!doc.id || !doc.name) continue;
        await Employee.findOneAndUpdate({ id: doc.id }, doc, { upsert: true, new: true });
        ok++;
      }
      console.log(`[Seed] Migrated ${ok} employees from "${old.colName}"`);
    }

    return;
  }

  // ── no old collection — use initial-data.json ────────────────────────────────
  console.log('[Seed] No legacy collection found — seeding from initial-data.json');
  let seed;
  try { seed = readSeed(); } catch (err) {
    console.error('[Seed] Cannot read initial-data.json:', err.message);
    return;
  }

  const { employees = [], projects = [] } = seed;

  if (empCount === 0 && employees.length > 0) {
    await Employee.insertMany(employees, { ordered: false }).catch(() => {});
    console.log(`[Seed] Inserted ${employees.length} employees from seed`);
  }

  if (projCount === 0 && projects.length > 0) {
    await Project.insertMany(projects, { ordered: false }).catch(() => {});
    await syncCompanies(projects);
    console.log(`[Seed] Inserted ${projects.length} projects from seed`);
  }
}

/** Helper: get the next numeric id for a collection. */
export async function nextNumericId(Model) {
  const doc = await Model.findOne({}, { id: 1 }).sort({ id: -1 }).lean();
  return doc ? doc.id + 1 : 1;
}
