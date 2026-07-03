/**
 * One-time migration script.
 *
 * Reads the old single-document structure from the `dashboard` (or `dashboarddata`)
 * collection and migrates every employee and project into their own collections.
 *
 * Run once on Railway (or locally with MONGO_URI set):
 *   node server/migrate.js
 *
 * The old collection is NOT deleted so you can verify first.
 */

import mongoose from 'mongoose';
import { Employee } from './models/Employee.js';
import { Project }  from './models/Project.js';
import { Company }  from './models/Company.js';

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('MONGO_URI environment variable is not set.');
  process.exit(1);
}

async function migrate() {
  console.log('Connecting to MongoDB…');
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  console.log('Connected to:', mongoose.connection.db.databaseName);

  const db = mongoose.connection.db;

  // Try both possible collection names used by older code
  let sourceDoc = null;
  for (const colName of ['dashboard', 'dashboarddata']) {
    try {
      const col = db.collection(colName);
      sourceDoc = await col.findOne({});
      if (sourceDoc) {
        console.log(`Found source data in collection: "${colName}"`);
        break;
      }
    } catch { /* ignore */ }
  }

  if (!sourceDoc) {
    console.log('No source document found in "dashboard" or "dashboarddata". Nothing to migrate.');
    await mongoose.disconnect();
    return;
  }

  const employees = sourceDoc.employees ?? [];
  const projects  = sourceDoc.projects  ?? [];
  console.log(`Source: ${employees.length} employees, ${projects.length} projects`);

  // ── Migrate employees ────────────────────────────────────────────────────────
  let empInserted = 0;
  let empSkipped  = 0;

  for (const emp of employees) {
    const existing = await Employee.findOne({ id: emp.id });
    if (existing) { empSkipped++; continue; }

    const { _id, __v, ...data } = emp;
    await Employee.create({ ...data, id: emp.id ?? empInserted + 1 });
    empInserted++;
  }

  console.log(`Employees — inserted: ${empInserted}, skipped (duplicates): ${empSkipped}`);

  // ── Migrate projects ─────────────────────────────────────────────────────────
  let projInserted = 0;
  let projSkipped  = 0;

  const companyNames = new Set();

  for (const proj of projects) {
    const existing = await Project.findOne({ id: proj.id });
    if (existing) { projSkipped++; continue; }

    const { _id, __v, status, ...data } = proj;

    // Map old status string → completedWork if completedWork not already present
    const completedWork   = data.completedWork   ?? (status ? String(status) : '');
    const pendingWork     = data.pendingWork     ?? '';
    const completedPercent = data.completedPercent ?? 0;

    await Project.create({ ...data, completedWork, pendingWork, completedPercent });
    if (proj.company) companyNames.add(proj.company);
    projInserted++;
  }

  console.log(`Projects — inserted: ${projInserted}, skipped (duplicates): ${projSkipped}`);

  // ── Sync companies ────────────────────────────────────────────────────────────
  // Also pick up any companies already in the migrated projects
  const allProjects = await Project.find({}, { company: 1 }).lean();
  allProjects.forEach((p) => { if (p.company) companyNames.add(p.company); });

  let compSynced = 0;
  for (const name of companyNames) {
    await Company.findOneAndUpdate({ name }, { name }, { upsert: true, returnDocument: 'after' });
    compSynced++;
  }
  console.log(`Companies synced: ${compSynced}`);

  console.log('\n✅ Migration complete.');
  console.log('The old collection has NOT been deleted. Verify the data, then drop it manually if needed.');

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
