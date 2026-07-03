import { Employee } from '../models/Employee.js';
import { nextNumericId } from '../utils/seed.js';

export async function getAll(req, res) {
  try {
    const employees = await Employee.find({}, { _id: 0 }).sort({ id: 1 }).lean();
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function create(req, res) {
  try {
    const body = req.body;
    if (!body.name) return res.status(400).json({ error: 'name is required' });

    const id = await nextNumericId(Employee);
    const employee = await Employee.create({ id, ...body });
    const { _id, __v, ...plain } = employee.toObject();
    res.status(201).json(plain);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Duplicate id' });
    res.status(500).json({ error: err.message });
  }
}

export async function update(req, res) {
  try {
    const numId = Number(req.params.id);
    const updated = await Employee.findOneAndUpdate(
      { id: numId },
      { $set: req.body },
      { returnDocument: 'after', runValidators: true, projection: { _id: 0 } },
    ).lean();

    if (!updated) return res.status(404).json({ error: 'Employee not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function remove(req, res) {
  try {
    const numId = Number(req.params.id);
    const deleted = await Employee.findOneAndDelete({ id: numId });
    if (!deleted) return res.status(404).json({ error: 'Employee not found' });
    res.json({ ok: true, deleted: numId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
