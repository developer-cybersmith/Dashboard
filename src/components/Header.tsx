import { Bell, RefreshCw, Wifi, WifiOff, LogOut, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

interface HeaderProps {
  onMenuToggle: () => void;
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { connection, refresh } = useData();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="top-header">
      <button
        type="button"
        className="icon-btn mobile-menu-btn"
        aria-label="Toggle menu"
        onClick={onMenuToggle}
      >
        <Menu size={20} />
      </button>

      <div className="header-title">
        <span>CyberSmithSecure Dashboard</span>
      </div>

      <div className="header-actions">
        <div className={`conn-pill conn-${connection}`}>
          {connection === 'online' ? (
            <Wifi size={14} />
          ) : (
            <WifiOff size={14} />
          )}
          <span>
            {connection === 'online'
              ? 'Live'
              : connection === 'connecting'
                ? 'Syncing'
                : 'Offline'}
          </span>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label="Refresh"
          onClick={refresh}
        >
          <RefreshCw size={18} />
        </button>
        <button type="button" className="icon-btn" aria-label="Notifications">
          <Bell size={18} />
          <span className="badge-dot" />
        </button>
        <div className="user-profile">
          <div className="avatar">{user ? initials(user.name) : 'MA'}</div>
          <div className="user-info">
            <strong>{user?.name ?? 'CSS Admin'}</strong>
            <span>{user?.role ?? 'Administrator'}</span>
          </div>
        </div>
        <button
          type="button"
          className="icon-btn logout-btn"
          aria-label="Logout"
          title="Logout"
          onClick={handleLogout}
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
