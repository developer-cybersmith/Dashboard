/**
 * seed.js — startup data initialisation.
 *
 * Handles three source formats automatically:
 *   A) Collections already have individual documents  → skip / nothing to do
 *   B) Collection has ONE document with an embedded array
 *      e.g. projects collection: { projects:[...], __v:0 }
 *      → explode into individual documents
 *   C) Old "dashboard" / "dashboarddata" collection with embedded arrays → migrate
 *   D) No data anywhere → seed from initial-data.json
 */

import mongoose from 'mongoose';
import { Employee } from '../models/Employee.js';
import { Project }  from '../models/Project.js';
import { Company }  from '../models/Company.js';
import { readSeed } from './jsonStore.js';

// ── field normalisers ─────────────────────────────────────────────────────────

export function cleanEmp(raw) {
  const e = raw ?? {};
  return {
    id:          Number(e.id)          || 0,
    name:        String(e.name         ?? ''),
    designation: String(e.designation  ?? ''),
    monthlyPay:  Number(e.monthlyPay)  || 0,
  };
}

export function cleanProj(raw) {
  const { _id, __v, status, key, ...p } = raw ?? {};
  return {
    id:               Number(p.id)               || 0,
    company:          String(p.company            ?? ''),
    projectName:      String(p.projectName        ?? ''),
    category:         String(p.category           ?? ''),
    projectLead:      String(p.projectLead        ?? ''),
    income:           Number(p.income)            || 0,
    startDate:        String(p.startDate          ?? ''),
    endDate:          String(p.endDate            ?? ''),
    completedWork:    String(p.completedWork      ?? (status ? String(status) : '')),
    pendingWork:      String(p.pendingWork        ?? ''),
    completedPercent: Math.min(100, Math.max(0, Number(p.completedPercent) || 0)),
    testers: Array.isArray(p.testers)
      ? p.testers.map((t) => ({
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

// ── detect & explode single-document format ───────────────────────────────────
// Handles: projects collection has { projects:[...] }
//          employees collection has { employees:[...] }

async function explodeSingleDocIfNeeded(Model, embeddedField, cleanFn, label) {
  const collName = Model.collection.name;
  const db = mongoose.connection.db;

  // Look for a document that has the embedded array field
  const wrapper = await db.collection(collName).findOne({
    [embeddedField]: { $exists: true, $type: 'array' },
  });

  if (!wrapper) return 0; // Normal individual-document format

  const items = wrapper[embeddedField] ?? [];
  console.log(`[Fix] "${collName}" has single-document format with ${items.length} ${label} — converting…`);

  // Delete the wrapper document
  await db.collection(collName).deleteOne({ _id: wrapper._id });

  // Insert each item as its own document
  let ok = 0;
  for (const item of items) {
    const doc = cleanFn(item);
    if (label === 'projects' && (!doc.id || !doc.projectName)) continue;
    if (label === 'employees' && (!doc.id || !doc.name)) continue;
    await Model.findOneAndUpdate({ id: doc.id }, doc, { upsert: true, new: true });
    ok++;
  }

  console.log(`[Fix] Converted ${ok} individual ${label} documents in "${collName}"`);
  return ok;
}

// ── migrate from old dashboard / dashboarddata collection ─────────────────────

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

// ── public: force migration (safe to run repeatedly via /api/admin/migrate) ───

export async function runMigration() {
  const log = [];

  // Step 1: check own collections for single-document format first
  const projFixed = await explodeSingleDocIfNeeded(Project, 'projects', cleanProj, 'projects');
  const empFixed  = await explodeSingleDocIfNeeded(Employee, 'employees', cleanEmp, 'employees');
  if (projFixed) log.push(`Exploded ${projFixed} projects from single-doc format`);
  if (empFixed)  log.push(`Exploded ${empFixed} employees from single-doc format`);

  // Step 2: check old dashboard collection
  const old = await readOldDashboard();
  if (old) {
    const { colName, employees: rawEmps, projects: rawProjs } = old;

    let empOk = 0;
    for (const e of rawEmps) {
      const doc = cleanEmp(e);
      if (!doc.id || !doc.name) continue;
      await Employee.findOneAndUpdate({ id: doc.id }, doc, { upsert: true, new: true });
      empOk++;
    }
    if (empOk) log.push(`Employees upserted from "${colName}": ${empOk}`);

    let projOk = 0;
    for (const p of rawProjs) {
      const doc = cleanProj(p);
      if (!doc.id || !doc.projectName) continue;
      await Project.findOneAndUpdate({ id: doc.id }, doc, { upsert: true, new: true });
      projOk++;
    }
    if (projOk) {
      await syncCompanies(rawProjs.map(cleanProj));
      log.push(`Projects upserted from "${colName}": ${projOk}`);
    }

    log.push(`Source "${colName}" collection kept intact.`);
  }

  if (log.length === 0) {
    log.push('No legacy data found to migrate.');
  }

  const [empCount, projCount, compCount] = await Promise.all([
    Employee.countDocuments(),
    Project.countDocuments(),
    Company.countDocuments(),
  ]);
  log.push(`Final counts — employees: ${empCount}, projects: ${projCount}, companies: ${compCount}`);
  log.forEach((l) => console.log(`[Migrate] ${l}`));

  // Sync companies from current project set
  const allProjects = await Project.find({}, { company: 1 }).lean();
  await syncCompanies(allProjects);

  return { ok: true, log };
}

// ── startup seed ──────────────────────────────────────────────────────────────

export async function seedIfEmpty() {
  // First: fix single-document format if present (handles user's current setup)
  await explodeSingleDocIfNeeded(Project,  'projects',  cleanProj, 'projects').catch((e) =>
    console.error('[Seed] explode projects error:', e.message),
  );
  await explodeSingleDocIfNeeded(Employee, 'employees', cleanEmp,  'employees').catch((e) =>
    console.error('[Seed] explode employees error:', e.message),
  );

  const [empCount, projCount] = await Promise.all([
    Employee.countDocuments(),
    Project.countDocuments(),
  ]);

  console.log(`[Seed] After fix — employees: ${empCount}, projects: ${projCount}`);

  if (empCount > 0 && projCount > 0) {
    console.log('[Seed] Both collections populated — done');
    await syncCompanies(
      await Project.find({}, { company: 1 }).lean(),
    );
    return;
  }

  // Try old dashboard collection
  const old = await readOldDashboard();
  if (old) {
    const { colName, employees: rawEmps, projects: rawProjs } = old;

    if (projCount === 0 && rawProjs.length > 0) {
      let ok = 0;
      for (const p of rawProjs) {
        const doc = cleanProj(p);
        if (!doc.id || !doc.projectName) continue;
        await Project.findOneAndUpdate({ id: doc.id }, doc, { upsert: true, new: true });
        ok++;
      }
      await syncCompanies(rawProjs.map(cleanProj));
      console.log(`[Seed] Migrated ${ok} projects from "${colName}"`);
    }

    if (empCount === 0 && rawEmps.length > 0) {
      let ok = 0;
      for (const e of rawEmps) {
        const doc = cleanEmp(e);
        if (!doc.id || !doc.name) continue;
        await Employee.findOneAndUpdate({ id: doc.id }, doc, { upsert: true, new: true });
        ok++;
      }
      console.log(`[Seed] Migrated ${ok} employees from "${colName}"`);
    }
    return;
  }

  // Fall back to initial-data.json
  console.log('[Seed] No legacy data — seeding from initial-data.json');
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
