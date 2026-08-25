import type { AppData, DashboardMetrics, Project } from '../types';
import { daysUntil } from './format';
import { gstOf, tdsOf, netOfIncome } from './tax';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** FX rate used to convert project amounts into INR. */
function projectRate(p: Project): number {
  const currency = p.currency || 'INR';
  if (currency === 'INR') return 1;
  return p.exchangeRate && p.exchangeRate > 0 ? p.exchangeRate : 1;
}

/**
 * INR revenue for a project:
 * - INR:     Income + GST(18%) − TDS(10%)
 * - Non-INR: Income converted to INR (no GST/TDS)
 */
const inrValue = (p: Project) => {
  const currency = p.currency || 'INR';
  const base = netOfIncome(p.income, currency);
  const rate = projectRate(p);
  if (currency !== 'INR' && rate === 1 && p.amountINR != null && p.amountINR > 0) {
    return p.amountINR;
  }
  return parseFloat((base * rate).toFixed(2));
};

/** GST collected — INR projects only. */
const gstInr = (p: Project) => gstOf(p.income, p.currency || 'INR');

/** TDS deducted — INR projects only. */
const tdsInr = (p: Project) => tdsOf(p.income, p.currency || 'INR');

export function computeMetrics(data: AppData): DashboardMetrics {
  const { employees, projects } = data;

  const totalRevenue = projects.reduce((sum, p) => sum + inrValue(p), 0);
  const totalGst = projects.reduce((sum, p) => sum + gstInr(p), 0);
  const totalTds = projects.reduce((sum, p) => sum + tdsInr(p), 0);
  const totalSalaryCost = employees.reduce(
    (sum, e) => sum + (e.monthlyPay || 0),
    0,
  );
  const grossProfit = totalRevenue - totalSalaryCost;
  const profitMargin =
    totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const companyMap = new Map<string, number>();
  projects.forEach((p) => {
    const company = p.company || 'Others';
    companyMap.set(company, (companyMap.get(company) || 0) + inrValue(p));
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
    totalGst,
    totalTds,
    totalProjects: projects.length,
    totalEmployees: employees.length,
    totalSalaryCost,
    grossProfit,
    profitMargin,
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
    const rev = inrValue(p);
    if (!p.startDate || !rev) return;
    const month = new Date(p.startDate).getMonth();
    revenueByMonth.set(month, (revenueByMonth.get(month) || 0) + rev);
  });

  return MONTHS.map((month, i) => ({
    month,
    revenue: revenueByMonth.get(i) || 0,
    salary: salaryPerMonth,
  }));
}

export function projectTesterCost(project: Project): number {
  return (project.testers ?? []).reduce((sum, t) => sum + (t?.monthlyPay || 0), 0);
}
