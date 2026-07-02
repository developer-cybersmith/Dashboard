/**
 * Seeds the employees, projects, and companies collections from initial-data.json
 * if those collections are empty. Safe to run on every startup.
 */

import { Employee } from '../models/Employee.js';
import { Project }  from '../models/Project.js';
import { Company }  from '../models/Company.js';
import { readSeed } from './jsonStore.js';

export async function seedIfEmpty() {
  const [empCount, projCount] = await Promise.all([
    Employee.countDocuments(),
    Project.countDocuments(),
  ]);

  if (empCount > 0 && projCount > 0) {
    console.log('[Seed] Collections already populated — skipping seed');
    return;
  }

  const { employees, projects } = readSeed();

  if (empCount === 0 && employees.length > 0) {
    await Employee.insertMany(employees, { ordered: false }).catch(() => {});
    console.log(`[Seed] Inserted ${employees.length} employees`);
  }

  if (projCount === 0 && projects.length > 0) {
    await Project.insertMany(projects, { ordered: false }).catch(() => {});
    console.log(`[Seed] Inserted ${projects.length} projects`);

    // Sync company names
    const names = [...new Set(projects.map((p) => p.company).filter(Boolean))];
    for (const name of names) {
      await Company.findOneAndUpdate({ name }, { name }, { upsert: true, new: true });
    }
    console.log(`[Seed] Synced ${names.length} companies`);
  }
}

/** Helper: get the next numeric id for a collection. */
export async function nextNumericId(Model) {
  const doc = await Model.findOne({}, { id: 1 }).sort({ id: -1 }).lean();
  return doc ? doc.id + 1 : 1;
}
