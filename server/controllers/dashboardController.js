import { computeDashboard } from '../services/dashboardService.js';

export async function getDashboard(req, res) {
  try {
    const stats = await computeDashboard();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
