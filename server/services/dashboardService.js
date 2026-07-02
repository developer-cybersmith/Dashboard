import { Employee } from '../models/Employee.js';
import { Project }  from '../models/Project.js';

export async function computeDashboard() {
  const [
    totalEmployees,
    totalProjects,
    revenueAgg,
    salaryAgg,
    completedProjects,
    runningProjects,
    pendingProjects,
    topCompaniesAgg,
    topEmployees,
    recentProjects,
    upcomingDeadlines,
  ] = await Promise.all([
    Employee.countDocuments(),
    Project.countDocuments(),

    Project.aggregate([
      { $group: { _id: null, total: { $sum: '$income' } } },
    ]),

    Employee.aggregate([
      { $group: { _id: null, total: { $sum: '$monthlyPay' } } },
    ]),

    Project.countDocuments({ completedPercent: 100 }),
    Project.countDocuments({ completedPercent: { $gt: 0, $lt: 100 } }),
    Project.countDocuments({ completedPercent: 0 }),

    Project.aggregate([
      { $group: { _id: '$company', revenue: { $sum: '$income' }, projects: { $sum: 1 } } },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, company: '$_id', revenue: 1, projects: 1 } },
    ]),

    Employee.find({}, { _id: 0, id: 1, name: 1, designation: 1, monthlyPay: 1 })
      .sort({ monthlyPay: -1 })
      .limit(5)
      .lean(),

    Project.find({}, { _id: 0 })
      .sort({ startDate: -1 })
      .limit(8)
      .lean(),

    Project.aggregate([
      { $match: { endDate: { $gt: new Date().toISOString().slice(0, 10) } } },
      {
        $addFields: {
          daysLeft: {
            $ceil: {
              $divide: [
                { $subtract: [{ $dateFromString: { dateString: '$endDate' } }, new Date()] },
                1000 * 60 * 60 * 24,
              ],
            },
          },
        },
      },
      { $sort: { daysLeft: 1 } },
      { $limit: 5 },
      { $project: { _id: 0, projectName: 1, company: 1, endDate: 1, daysLeft: 1 } },
    ]),
  ]);

  const totalRevenue    = revenueAgg[0]?.total ?? 0;
  const totalSalaryCost = salaryAgg[0]?.total  ?? 0;
  const grossProfit     = totalRevenue - totalSalaryCost;
  const profitMargin    = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  return {
    totalEmployees,
    totalProjects,
    totalRevenue,
    totalSalaryCost,
    grossProfit,
    profitMargin: Math.round(profitMargin * 100) / 100,
    completedProjects,
    runningProjects,
    pendingProjects,
    topCompanies:      topCompaniesAgg,
    topEmployees,
    recentProjects,
    upcomingDeadlines,
  };
}
