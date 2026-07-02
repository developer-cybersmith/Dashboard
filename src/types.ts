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

export interface ActivityItem {
  id: string;
  message: string;
  time: string;
  type: 'project' | 'employee' | 'salary';
}
