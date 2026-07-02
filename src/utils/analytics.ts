import type {
  AppData,
  DashboardMetrics,
  Project,
  ProjectStatusCategory,
} from '../types';
import { normalizeStatus, getStatusColor } from './status';
import { daysUntil } from './format';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function computeMetrics(data: AppData): DashboardMetrics {
  const { employees, projects } = data;

  const totalRevenue = projects.reduce((sum, p) => sum + (p.income || 0), 0);
  const totalSalaryCost = employees.reduce(
    (sum, e) => sum + (e.monthlyPay || 0),
    0,
  );
  const grossProfit = totalRevenue - totalSalaryCost;
  const profitMargin =
    totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const statusCounts: Record<ProjectStatusCategory, number> = {
    Completed: 0,
    Ongoing: 0,
    Pending: 0,
    Revalidation: 0,
  };

  projects.forEach((p) => {
    const cat = normalizeStatus(p.status);
    statusCounts[cat]++;
  });

  const statusBreakdown = (
    Object.entries(statusCounts) as [ProjectStatusCategory, number][]
  )
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({
      name,
      value,
      color: getStatusColor(name),
    }));

  const companyMap = new Map<string, number>();
  projects.forEach((p) => {
    const company = p.company || 'Others';
    companyMap.set(company, (companyMap.get(company) || 0) + (p.income || 0));
  });

  const companyPerformance = Array.from(companyMap.entries())
    .map(([company, revenue]) => ({ company, revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  const salaryDistribution = [...employees]
    .sort((a, b) => b.monthlyPay - a.monthlyPay)
    .slice(0, 10)
    .map((e) => ({ name: e.name, salary: e.monthlyPay }));

  const monthlyTrend = buildMonthlyTrend(projects, employees);

  const recentProjects = [...projects]
    .sort((a, b) => {
      const da = a.startDate ? new Date(a.startDate).getTime() : 0;
      const db = b.startDate ? new Date(b.startDate).getTime() : 0;
      return db - da;
    })
    .slice(0, 8);

  const upcomingDeadlines = projects
    .filter((p) => p.endDate)
    .map((p) => ({
      projectName: p.projectName,
      company: p.company,
      endDate: p.endDate,
      daysLeft: daysUntil(p.endDate) ?? 999,
    }))
    .filter((d) => d.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 5);

  return {
    totalRevenue,
    totalProjects: projects.length,
    totalEmployees: employees.length,
    totalSalaryCost,
    grossProfit,
    profitMargin,
    statusBreakdown,
    companyPerformance,
    salaryDistribution,
    monthlyTrend,
    recentProjects,
    upcomingDeadlines,
  };
}

function buildMonthlyTrend(
  projects: Project[],
  employees: { monthlyPay: number }[],
) {
  const salaryPerMonth = employees.reduce(
    (sum, e) => sum + e.monthlyPay,
    0,
  );

  const revenueByMonth = new Map<number, number>();
  projects.forEach((p) => {
    if (!p.startDate || !p.income) return;
    const month = new Date(p.startDate).getMonth();
    revenueByMonth.set(month, (revenueByMonth.get(month) || 0) + p.income);
  });

  return MONTHS.map((month, i) => ({
    month,
    revenue: revenueByMonth.get(i) || 0,
    salary: salaryPerMonth,
  }));
}

export function projectTesterCost(project: Project): number {
  return project.testers.reduce((sum, t) => sum + (t.monthlyPay || 0), 0);
}
