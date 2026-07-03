import { Company } from '../models/Company.js';
import { Project } from '../models/Project.js';

export async function getAll(req, res) {
  try {
    const companies = await Company.find({}, { _id: 0 }).sort({ name: 1 }).lean();

    // Enrich with live stats from projects
    const enriched = await Promise.all(
      companies.map(async (c) => {
        const [totalRevenue, projectCount] = await Promise.all([
          Project.aggregate([
            { $match: { company: c.name } },
            { $group: { _id: null, total: { $sum: '$income' } } },
          ]).then((r) => r[0]?.total ?? 0),
          Project.countDocuments({ company: c.name }),
        ]);
        return { ...c, totalRevenue, projectCount };
      }),
    );

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function create(req, res) {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const company = await Company.findOneAndUpdate(
      { name },
      { name },
      { upsert: true, returnDocument: 'after', projection: { _id: 0 } },
    ).lean();

    res.status(201).json(company);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function update(req, res) {
  try {
    const oldName = decodeURIComponent(req.params.id);
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const updated = await Company.findOneAndUpdate(
      { name: oldName },
      { name },
      { returnDocument: 'after', projection: { _id: 0 } },
    ).lean();

    if (!updated) return res.status(404).json({ error: 'Company not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function remove(req, res) {
  try {
    const name = decodeURIComponent(req.params.id);
    const deleted = await Company.findOneAndDelete({ name });
    if (!deleted) return res.status(404).json({ error: 'Company not found' });
    res.json({ ok: true, deleted: name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
