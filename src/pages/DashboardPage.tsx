import { useEffect, useMemo, useRef, useState } from 'react';
import {
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
  Search,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { StatCard } from '../components/StatCard';
import { formatCurrency, formatDate, formatPercent } from '../utils/format';
import { getProjectProgressBreakdown } from '../utils/projectProgress';
import { projectTesterCost } from '../utils/analytics';

export function DashboardPage() {
  const { data, metrics, activities } = useData();

  // ── project status selection ───────────────────────────────────────────────
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  useEffect(() => {
    if (data.projects.length === 0) { setSelectedProjectId(null); return; }
    setSelectedProjectId((cur) => {
      if (cur && data.projects.some((p) => p.id === cur)) return cur;
      return data.projects[0].id;
    });
  }, [data.projects]);

  const selectedProject = useMemo(
    () => data.projects.find((p) => p.id === selectedProjectId) ?? null,
    [data.projects, selectedProjectId],
  );

  const projectProgressBreakdown = useMemo(
    () => selectedProject ? getProjectProgressBreakdown(selectedProject.completedPercent) : [],
    [selectedProject],
  );

  // ── search ────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return data.projects.filter(
      (p) =>
        p.projectName.toLowerCase().includes(q) ||
        p.company.toLowerCase().includes(q) ||
        p.projectLead.toLowerCase().includes(q),
    ).slice(0, 8);
  }, [searchQuery, data.projects]);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function selectSuggestion(id: number) {
    setSelectedProjectId(id);
    const proj = data.projects.find((p) => p.id === id);
    if (proj) setSearchQuery(`${proj.company} — ${proj.projectName}`);
    setShowSuggestions(false);
  }

  // ── stat cards ────────────────────────────────────────────────────────────
  const statCards = [
    { title: 'Total Revenue',     value: formatCurrency(metrics.totalRevenue),   change: 'From project income',                                    icon: IndianRupee, color: '#3b82f6' },
    { title: 'Total Projects',    value: String(metrics.totalProjects),           change: 'Across all companies',                                   icon: FolderKanban,color: '#a855f7' },
    { title: 'Total Employees',   value: String(metrics.totalEmployees),          change: 'Active payroll',                                         icon: Users,       color: '#22c55e' },
    { title: 'Total Salary Cost', value: formatCurrency(metrics.totalSalaryCost), change: 'Monthly payroll',                                        icon: Wallet,      color: '#f97316' },
    { title: 'Gross Profit',      value: formatCurrency(metrics.grossProfit),     change: metrics.grossProfit >= 0 ? 'Positive margin' : 'Deficit', icon: TrendingUp,  color: '#14b8a6' },
    { title: 'Profit Margin',     value: formatPercent(metrics.profitMargin),     change: 'Revenue vs salary',                                      icon: Percent,     color: '#ec4899' },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-title-row">
        <div>
          <h2>Dashboard Overview</h2>
          <p>Real-time summary from employees and projects data</p>
        </div>

        {/* ── Global search ── */}
        <div className="dash-search-wrap" ref={searchRef}>
          <div className="dash-search-box">
            <Search size={16} className="dash-search-icon" />
            <input
              type="text"
              className="dash-search-input"
              placeholder="Search project or company…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
            />
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <ul className="dash-suggestions">
              {suggestions.map((p) => (
                <li
                  key={p.id}
                  className="dash-suggestion-item"
                  onMouseDown={() => selectSuggestion(p.id)}
                >
                  <span className="suggestion-company">{p.company}</span>
                  <span className="suggestion-name">{p.projectName}</span>
                  {p.projectLead && (
                    <span className="suggestion-lead">Lead: {p.projectLead}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="stat-grid">
        {statCards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      {/* ── Project Status (full-width) ── */}
      <div className="panel chart-panel project-status-panel">
        <div className="panel-header">
          <h3>Project Status</h3>
          <select
            className="project-select"
            value={selectedProjectId ?? ''}
            onChange={(e) => {
              setSelectedProjectId(Number(e.target.value));
              setSearchQuery('');
            }}
            disabled={data.projects.length === 0}
          >
            {data.projects.length === 0 ? (
              <option value="">No projects</option>
            ) : (
              data.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.company} — {p.projectName}
                </option>
              ))
            )}
          </select>
        </div>

        {selectedProject ? (
          <div className="project-status-body">
            {/* Left: wagon wheel + completed/pending text + project cost */}
            <div className="project-status-left">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={projectProgressBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={82}
                    paddingAngle={2}
                  >
                    {projectProgressBreakdown.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    formatter={(v: number) => `${v}%`}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>

              <div className="project-work-details">
                <div className="work-detail-row completed-detail">
                  <span className="work-detail-label">✓ Completed ({selectedProject.completedPercent}%)</span>
                  <p className="work-detail-text">{selectedProject.completedWork || 'No details entered'}</p>
                </div>
                <div className="work-detail-row pending-detail">
                  <span className="work-detail-label">⏳ Pending ({100 - selectedProject.completedPercent}%)</span>
                  <p className="work-detail-text">{selectedProject.pendingWork || 'No details entered'}</p>
                </div>
                <div className="work-detail-row cost-detail">
                  <span className="work-detail-label">₹ Project Income</span>
                  <p className="work-detail-text">
                    {selectedProject.income > 0
                      ? formatCurrency(selectedProject.income)
                      : 'Not specified'}
                  </p>
                </div>
              </div>
            </div>

            {/* Right: manpower list */}
            <div className="manpower-box">
              <div className="manpower-box-header">
                <Users size={15} />
                <span>Manpower — {selectedProject.projectName}</span>
              </div>

              {selectedProject.testers.length === 0 ? (
                <p className="manpower-empty">No testers assigned to this project.</p>
              ) : (
                <ul className="manpower-list">
                  {selectedProject.testers.map((t, i) => (
                    <li key={i} className="manpower-item">
                      <div className="manpower-avatar">
                        {t.name ? t.name[0].toUpperCase() : '?'}
                      </div>
                      <div className="manpower-info">
                        <strong>{t.name || 'Unnamed'}</strong>
                        <span>{formatCurrency(t.monthlyPay)}/mo</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="manpower-footer">
                <span>Total Tester Cost</span>
                <strong>{formatCurrency(projectTesterCost(selectedProject))}/mo</strong>
              </div>
            </div>
          </div>
        ) : (
          <p className="panel-footer-text">Add a project to view completion status</p>
        )}
      </div>

      {/* ── Charts row ── */}
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

      {/* ── Bottom grid ── */}
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
                  <th>Income</th>
                  <th>End</th>
                  <th>Completed Work</th>
                  <th>Pending Work</th>
                  <th>% Done</th>
                </tr>
              </thead>
              <tbody>
                {metrics.recentProjects.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.projectName}</strong></td>
                    <td>{p.company}</td>
                    <td>{p.projectLead || '—'}</td>
                    <td>{formatCurrency(p.income)}</td>
                    <td>{formatDate(p.endDate)}</td>
                    <td className="work-cell">{p.completedWork || '—'}</td>
                    <td className="work-cell">{p.pendingWork || '—'}</td>
                    <td>
                      <span className={`pct-badge ${p.completedPercent >= 100 ? 'pct-done' : p.completedPercent >= 50 ? 'pct-mid' : 'pct-low'}`}>
                        {p.completedPercent}%
                      </span>
                    </td>
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
