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
  startDate: string;
  endDate: string;
  status: string;
  completedPercent: number;
  testers: ProjectTester[];
}

export interface AppData {
  employees: Employee[];
  projects: Project[];
}

export type ProjectStatusCategory =
  | 'Completed'
  | 'Ongoing'
  | 'Pending'
  | 'Revalidation';

export interface DashboardMetrics {
  totalRevenue: number;
  totalProjects: number;
  totalEmployees: number;
  totalSalaryCost: number;
  grossProfit: number;
  profitMargin: number;
  statusBreakdown: { name: ProjectStatusCategory; value: number; color: string }[];
  companyPerformance: { company: string; revenue: number }[];
  salaryDistribution: { name: string; salary: number }[];
  monthlyTrend: { month: string; revenue: number; salary: number }[];
  recentProjects: Project[];
  upcomingDeadlines: { projectName: string; company: string; endDate: string; daysLeft: number }[];
}

export interface ActivityItem {
  id: string;
  message: string;
  time: string;
  type: 'project' | 'employee' | 'salary';
}
