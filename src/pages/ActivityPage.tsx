import { useEffect, useState } from 'react';
import { Activity, RefreshCw, User } from 'lucide-react';
import { fetchActivities } from '../utils/api';
import { useData } from '../context/DataContext';
import type { FieldChange } from '../types';

interface ActivityRecord {
  _id?:       string;
  who:        string;
  action:     string;
  entity:     string;
  entityName: string;
  message:    string;
  type:       string;
  changes:    FieldChange[];
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
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function ChangeList({ changes }: { changes: FieldChange[] }) {
  if (!changes || changes.length === 0) return null;
  return (
    <ul className="activity-changes">
      {changes.map((c, i) => (
        <li key={i}>
          <span className="change-field">{c.field}</span>
          <span className="change-from">{c.from || '—'}</span>
          <span className="change-arrow">→</span>
          <span className="change-to">{c.to || '—'}</span>
        </li>
      ))}
    </ul>
  );
}

function ActivityCard({ item }: { item: ActivityRecord; local?: boolean }) {
  return (
    <li className="activity-log-item">
      <span className="activity-log-dot" style={{ background: TYPE_COLOR[item.type] ?? '#64748b' }} />
      <div className="activity-log-body">
        <p className="activity-msg">{item.message}</p>
        <ChangeList changes={item.changes ?? []} />
        <div className="activity-log-meta">
          <span className="activity-log-who">
            <User size={11} /> {item.who || 'User'}
          </span>
          {item.createdAt && (
            <time title={fmtDate(item.createdAt)}>{timeAgo(item.createdAt)}</time>
          )}
        </div>
      </div>
    </li>
  );
}

export function ActivityPage() {
  const { activities: local } = useData();
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
          <p>Every change — who made it, which fields, old value → new value.</p>
        </div>
        <button type="button" className="btn btn-outline" onClick={handleRefresh}>
          <RefreshCw size={15} className={refreshed ? 'spin-once' : ''} />
          {refreshed ? 'Refreshed' : 'Refresh'}
        </button>
      </div>

      {/* Live session */}
      {local.length > 0 && (
        <div className="panel activity-log-panel">
          <div className="panel-header">
            <h3>This Session</h3>
            <span className="panel-tag">{local.length} events</span>
          </div>
          <ul className="activity-log-list">
            {local.map((a) => (
              <li key={a.id} className="activity-log-item">
                <span className="activity-log-dot" style={{ background: TYPE_COLOR[a.type] ?? '#64748b' }} />
                <div className="activity-log-body">
                  <p className="activity-msg">{a.message}</p>
                  <ChangeList changes={a.changes ?? []} />
                  <div className="activity-log-meta">
                    {a.who && <span className="activity-log-who"><User size={11} /> {a.who}</span>}
                    <time>{a.time}</time>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Persistent records from MongoDB */}
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
              <ActivityCard key={a._id ?? i} item={a} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
