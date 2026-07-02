import { Project }  from '../models/Project.js';
import { Company }  from '../models/Company.js';
import { nextNumericId } from '../utils/seed.js';

async function syncCompany(companyName) {
  if (companyName) {
    await Company.findOneAndUpdate(
      { name: companyName },
      { name: companyName },
      { upsert: true, new: true },
    );
  }
}

export async function getAll(req, res) {
  try {
    const projects = await Project.find({}, { _id: 0 }).sort({ id: 1 }).lean();
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function create(req, res) {
  try {
    const body = req.body;
    if (!body.projectName) return res.status(400).json({ error: 'projectName is required' });

    const id = await nextNumericId(Project);
    const project = await Project.create({ id, ...body });
    await syncCompany(body.company);

    const { _id, __v, ...plain } = project.toObject();
    res.status(201).json(plain);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Duplicate id' });
    res.status(500).json({ error: err.message });
  }
}

export async function update(req, res) {
  try {
    const numId = Number(req.params.id);
    const updated = await Project.findOneAndUpdate(
      { id: numId },
      { $set: req.body },
      { new: true, runValidators: true, projection: { _id: 0 } },
    ).lean();

    if (!updated) return res.status(404).json({ error: 'Project not found' });
    await syncCompany(req.body.company);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function remove(req, res) {
  try {
    const numId = Number(req.params.id);
    const deleted = await Project.findOneAndDelete({ id: numId });
    if (!deleted) return res.status(404).json({ error: 'Project not found' });
    res.json({ ok: true, deleted: numId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
