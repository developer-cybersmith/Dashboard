import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  icon: LucideIcon;
  color: string;
}

export function StatCard({ title, value, change, icon: Icon, color }: StatCardProps) {
  return (
    <div className="stat-card" style={{ '--accent': color } as CSSProperties}>
      <div className="stat-card-top">
        <div className="stat-icon" style={{ background: `${color}22`, color }}>
          <Icon size={20} />
        </div>
        {change && <span className="stat-change positive">{change}</span>}
      </div>
      <p className="stat-title">{title}</p>
      <p className="stat-value">{value}</p>
      <div className="stat-sparkline">
        <svg viewBox="0 0 80 24" preserveAspectRatio="none">
          <polyline
            points="0,20 10,16 20,18 30,12 40,14 50,8 60,10 70,4 80,6"
            fill="none"
            stroke={color}
            strokeWidth="2"
          />
        </svg>
      </div>
    </div>
  );
}
