import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  IndianRupee,
  FolderKanban,
  Users,
  Wallet,
  TrendingUp,
  Percent,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { formatCurrency, formatDate, formatPercent } from '../utils/format';
import { getProjectProgressBreakdown } from '../utils/projectProgress';

export function DashboardPage() {
  const { data, metrics, activities } = useData();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  useEffect(() => {
    if (data.projects.length === 0) {
      setSelectedProjectId(null);
      return;
    }

    setSelectedProjectId((current) => {
      if (current && data.projects.some((project) => project.id === current)) {
        return current;
      }
      return data.projects[0].id;
    });
  }, [data.projects]);

  const selectedProject = useMemo(
    () => data.projects.find((project) => project.id === selectedProjectId) ?? null,
    [data.projects, selectedProjectId],
  );

  const projectProgressBreakdown = useMemo(
    () =>
      selectedProject
        ? getProjectProgressBreakdown(selectedProject.completedPercent)
        : [],
    [selectedProject],
  );

  const statCards = [
    {
      title: 'Total Revenue',
      value: formatCurrency(metrics.totalRevenue),
      change: 'From project income',
      icon: IndianRupee,
      color: '#3b82f6',
    },
    {
      title: 'Total Projects',
      value: String(metrics.totalProjects),
      change: 'Across all companies',
      icon: FolderKanban,
      color: '#a855f7',
    },
    {
      title: 'Total Employees',
      value: String(metrics.totalEmployees),
      change: 'Active payroll',
      icon: Users,
      color: '#22c55e',
    },
    {
      title: 'Total Salary Cost',
      value: formatCurrency(metrics.totalSalaryCost),
      change: 'Monthly payroll',
      icon: Wallet,
      color: '#f97316',
    },
    {
      title: 'Gross Profit',
      value: formatCurrency(metrics.grossProfit),
      change: metrics.grossProfit >= 0 ? 'Positive margin' : 'Deficit',
      icon: TrendingUp,
      color: '#14b8a6',
    },
    {
      title: 'Profit Margin',
      value: formatPercent(metrics.profitMargin),
      change: 'Revenue vs salary',
      icon: Percent,
      color: '#ec4899',
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-title-row">
        <div>
          <h2>Dashboard Overview</h2>
          <p>Real-time summary from employees and projects data</p>
        </div>
      </div>

      <div className="stat-grid">
        {statCards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      <div className="chart-grid-3">
        <div className="panel chart-panel wide-2">
          <div className="panel-header">
            <h3>Revenue vs Salary Cost</h3>
            <span className="panel-tag">This Year</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={metrics.monthlyTrend}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="salGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Legend />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" fill="url(#revGrad)" />
              <Area type="monotone" dataKey="salary" name="Salary Cost" stroke="#a855f7" fill="url(#salGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="panel chart-panel">
          <div className="panel-header">
            <h3>Project Status</h3>
            <select
              className="project-select"
              value={selectedProjectId ?? ''}
              onChange={(e) => setSelectedProjectId(Number(e.target.value))}
              disabled={data.projects.length === 0}
            >
              {data.projects.length === 0 ? (
                <option value="">No projects</option>
              ) : (
                data.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.company} — {project.projectName}
                  </option>
                ))
              )}
            </select>
          </div>
          {selectedProject ? (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={projectProgressBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {projectProgressBreakdown.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: 8,
                    }}
                    formatter={(value: number) => `${value}%`}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              <p className="panel-footer-text">
                {selectedProject.projectName}: {selectedProject.completedPercent}% completed ·{' '}
                {100 - selectedProject.completedPercent}% pending
              </p>
            </>
          ) : (
            <p className="panel-footer-text">Add a project to view completion status</p>
          )}
        </div>
      </div>

      <div className="chart-grid-3">
        <div className="panel chart-panel">
          <div className="panel-header">
            <h3>Company Performance</h3>
            <span className="panel-tag">By Revenue</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={metrics.companyPerformance} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis type="number" stroke="#64748b" fontSize={12} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="company" stroke="#64748b" fontSize={12} width={60} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel chart-panel">
          <div className="panel-header">
            <h3>Employee Salary Distribution</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={metrics.salaryDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={10} angle={-30} textAnchor="end" height={50} />
              <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Bar dataKey="salary" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel activity-panel">
          <div className="panel-header">
            <h3>Recent Activity</h3>
          </div>
          <ul className="activity-list">
            {activities.length === 0 ? (
              <li className="activity-item muted">
                Edit employees or projects to see live updates here
              </li>
            ) : (
              activities.map((a) => (
                <li key={a.id} className="activity-item">
                  <span className={`activity-dot ${a.type}`} />
                  <div>
                    <p>{a.message}</p>
                    <time>{a.time}</time>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="bottom-grid">
        <div className="panel table-panel wide-2">
          <div className="panel-header">
            <h3>Recent Projects</h3>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Company</th>
                  <th>Lead</th>
                  <th>Testers</th>
                  <th>Income</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Status</th>
                  <th>% Done</th>
                </tr>
              </thead>
              <tbody>
                {metrics.recentProjects.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.projectName}</strong></td>
                    <td>{p.company}</td>
                    <td>{p.projectLead || '—'}</td>
                    <td>{p.testers.length}</td>
                    <td>{formatCurrency(p.income)}</td>
                    <td>{formatDate(p.startDate)}</td>
                    <td>{formatDate(p.endDate)}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td>{p.completedPercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel side-stack">
          <div className="panel-header">
            <h3>Upcoming Deadlines</h3>
          </div>
          <ul className="deadline-list">
            {metrics.upcomingDeadlines.length === 0 ? (
              <li className="deadline-item muted">No upcoming deadlines</li>
            ) : (
              metrics.upcomingDeadlines.map((d) => (
                <li key={`${d.projectName}-${d.endDate}`} className="deadline-item">
                  <div>
                    <strong>{d.projectName}</strong>
                    <span>{d.company}</span>
                  </div>
                  <span className="deadline-badge">
                    {d.daysLeft === 0 ? 'Today' : `${d.daysLeft} days left`}
                  </span>
                </li>
              ))
            )}
          </ul>

          <div className="panel-header" style={{ marginTop: 16 }}>
            <h3>Financial Summary</h3>
          </div>
          <dl className="summary-list">
            <div><dt>Total Revenue</dt><dd>{formatCurrency(metrics.totalRevenue)}</dd></div>
            <div><dt>Salary Cost</dt><dd>{formatCurrency(metrics.totalSalaryCost)}</dd></div>
            <div><dt>Gross Profit</dt><dd className={metrics.grossProfit >= 0 ? 'positive' : 'negative'}>{formatCurrency(metrics.grossProfit)}</dd></div>
            <div><dt>Profit Margin</dt><dd>{formatPercent(metrics.profitMargin)}</dd></div>
          </dl>
        </div>
      </div>
    </div>
  );
}
