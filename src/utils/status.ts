import type { ProjectStatusCategory } from '../types';

const STATUS_COLORS: Record<ProjectStatusCategory, string> = {
  Completed: '#22c55e',
  Ongoing: '#3b82f6',
  Pending: '#f97316',
  Revalidation: '#a855f7',
};

export function normalizeStatus(status: string): ProjectStatusCategory {
  const s = status.toLowerCase();
  if (s.includes('completed') && !s.includes('pending')) return 'Completed';
  if (s.includes('revalid')) return 'Revalidation';
  if (
    s.includes('pending') ||
    s.includes('hold') ||
    s.includes('paused') ||
    s.includes('waiting')
  )
    return 'Pending';
  if (
    s.includes('ongoing') ||
    s.includes('progress') ||
    s.includes('testing') ||
    s.includes('blackbox') ||
    s.includes('policy') ||
    s.includes('contract') ||
    s.includes('renewal')
  )
    return 'Ongoing';
  return 'Pending';
}

export function getStatusColor(category: ProjectStatusCategory): string {
  return STATUS_COLORS[category];
}

export const STATUS_OPTIONS: ProjectStatusCategory[] = [
  'Completed',
  'Ongoing',
  'Pending',
  'Revalidation',
];
