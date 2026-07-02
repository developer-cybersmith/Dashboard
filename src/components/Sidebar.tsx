import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Plus,
  Upload,
  Zap,
  X,
} from 'lucide-react';
import { useData } from '../context/DataContext';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/employees', label: 'Employees', icon: Users },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
];

const STATUS_TEXT: Record<string, string> = {
  online: 'Backend online · data synced',
  offline: 'Offline · using local cache',
  connecting: 'Connecting to backend…',
};

export function Sidebar({ open, onClose }: SidebarProps) {
  const { addEmployee, addProject, connection } = useData();

  return (
    <aside className={`sidebar${open ? ' sidebar-open' : ''}`}>
      <div className="sidebar-brand">
        <div className="brand-icon">CSS</div>
        <div>
          <h1>CyberSmith</h1>
          <p>Secure · Analyze · Grow</p>
        </div>
        <button
          type="button"
          className="icon-btn sidebar-close-btn"
          aria-label="Close menu"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>

      <nav className="sidebar-nav">
        <p className="sidebar-section-title">Menu</p>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `nav-link${isActive ? ' active' : ''}`
            }
            onClick={onClose}
          >
            <span className="nav-link-icon">
              <Icon size={18} />
            </span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-actions">
        <p className="sidebar-section-title">
          <Zap size={12} /> Quick Actions
        </p>
        <button
          type="button"
          className="btn btn-blue"
          onClick={() => {
            addEmployee({ name: 'New Employee', designation: '', monthlyPay: 0 });
            onClose();
          }}
        >
          <Plus size={16} />
          Add Employee
        </button>
        <button
          type="button"
          className="btn btn-purple"
          onClick={() => {
            addProject({
              company: 'CSS',
              projectName: 'New Project',
              category: '',
              projectLead: '',
              income: 0,
              startDate: '',
              endDate: '',
              completedWork: '',
              pendingWork: '',
              completedPercent: 0,
              testers: [],
            });
            onClose();
          }}
        >
          <Plus size={16} />
          Add Project
        </button>
        <label className="btn btn-green-outline import-btn">
          <Upload size={16} />
          Import Excel
          <input
            type="file"
            accept=".xlsx,.xls"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                window.dispatchEvent(
                  new CustomEvent('import-excel', { detail: file }),
                );
              }
              e.target.value = '';
              onClose();
            }}
          />
        </label>
      </div>

      <div className={`sidebar-status status-${connection}`}>
        <span className="status-orb" />
        <span>{STATUS_TEXT[connection]}</span>
      </div>
    </aside>
  );
}
