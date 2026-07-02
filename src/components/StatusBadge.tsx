import { normalizeStatus, getStatusColor } from '../utils/status';

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const category = normalizeStatus(status);
  const color = getStatusColor(category);

  return (
    <span
      className="status-badge"
      style={{ background: `${color}22`, color, borderColor: `${color}44` }}
    >
      {status.length > 40 ? `${status.slice(0, 40)}…` : status || category}
    </span>
  );
}
