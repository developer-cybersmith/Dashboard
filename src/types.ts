export interface Employee {
  id: number;
  name: string;
  designation: string;
  monthlyPay: number;
}

export interface ProjectTester {
  name: string;
  monthlyPay: number;
}

export interface Project {
  id: number;
  company: string;
  projectName: string;
  category: string;
  projectLead: string;
  income: number;
  // ── Multi-currency fields ──────────────────────────────────────────────
  currency?:              string;  // ISO 4217 code, e.g. 'USD'; defaults to 'INR'
  originalAmount?:        number;  // income in original currency
  exchangeRate?:          number;  // 1 USD = N INR
  amountINR?:             number;  // income converted to INR (used for all dashboard maths)
  exchangeRateUpdatedAt?: string;  // ISO timestamp of last rate fetch
  // ──────────────────────────────────────────────────────────────────────
  startDate: string;
  endDate: string;
  completedWork: string;
  pendingWork: string;
  completedPercent: number;
  testers: ProjectTester[];
}

export interface AppData {
  employees: Employee[];
  projects: Project[];
}

export interface DashboardMetrics {
  totalRevenue: number;
  totalProjects: number;
  totalEmployees: number;
  totalSalaryCost: number;
  grossProfit: number;
  profitMargin: number;
  companyPerformance: { company: string; revenue: number }[];
  salaryDistribution: { name: string; salary: number }[];
  monthlyTrend: { month: string; revenue: number; salary: number }[];
  recentProjects: Project[];
  upcomingDeadlines: { projectName: string; company: string; endDate: string; daysLeft: number }[];
}

export interface FieldChange {
  field: string;
  from:  string;
  to:    string;
}

export interface ActivityItem {
  id:      string;
  message: string;
  time:    string;
  type:    'project' | 'employee' | 'salary';
  who?:    string;
  changes?: FieldChange[];
}
