import { useEffect, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { fetchActivities } from '../utils/api';
import { useData } from '../context/DataContext';

interface ActivityRecord {
  _id?: string;
  who: string;
  action: string;
  entity: string;
  entityName: string;
  message: string;
  type: string;
  createdAt?: string;
}

const TYPE_COLOR: Record<string, string> = {
  project:  '#a855f7',
  employee: '#22c55e',
  salary:   '#f97316',
};

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function ActivityPage() {
  const { activities: localActivities } = useData();
  const [remote,    setRemote]    = useState<ActivityRecord[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshed, setRefreshed] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = (await fetchActivities()) as ActivityRecord[];
    setRemote(data);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const handleRefresh = async () => {
    await load();
    setRefreshed(true);
    setTimeout(() => setRefreshed(false), 1500);
  };

  return (
    <div className="data-page">
      <div className="page-title-row">
        <div>
          <h2>Activity Log</h2>
          <p>All changes made to employees and projects, stored in MongoDB.</p>
        </div>
        <button type="button" className="btn btn-outline" onClick={handleRefresh}>
          <RefreshCw size={15} className={refreshed ? 'spin-once' : ''} />
          {refreshed ? 'Refreshed' : 'Refresh'}
        </button>
      </div>

      {/* Live in-session activities */}
      {localActivities.length > 0 && (
        <div className="panel activity-log-panel">
          <div className="panel-header">
            <h3>This Session</h3>
            <span className="panel-tag">{localActivities.length} events</span>
          </div>
          <ul className="activity-log-list">
            {localActivities.map((a) => (
              <li key={a.id} className="activity-log-item">
                <span className="activity-log-dot" style={{ background: TYPE_COLOR[a.type] ?? '#64748b' }} />
                <div className="activity-log-body">
                  <p>{a.message}</p>
                  <time>{a.time}</time>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Persistent activities from MongoDB */}
      <div className="panel activity-log-panel">
        <div className="panel-header">
          <h3>All Time (from database)</h3>
          <span className="panel-tag">{remote.length} records</span>
        </div>

        {loading ? (
          <div className="loading-screen" style={{ minHeight: 120 }}>
            <div className="loader-ring" />
            <p>Loading…</p>
          </div>
        ) : remote.length === 0 ? (
          <div className="activity-log-empty">
            <Activity size={32} />
            <p>No activity recorded yet.<br />Start editing employees or projects.</p>
          </div>
        ) : (
          <ul className="activity-log-list">
            {remote.map((a, i) => (
              <li key={a._id ?? i} className="activity-log-item">
                <span
                  className="activity-log-dot"
                  style={{ background: TYPE_COLOR[a.type] ?? '#64748b' }}
                />
                <div className="activity-log-body">
                  <p>{a.message}</p>
                  <div className="activity-log-meta">
                    <span className="activity-log-who">{a.who}</span>
                    <time>{timeAgo(a.createdAt)}</time>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
