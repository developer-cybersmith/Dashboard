import type { Project } from '../types';

export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function normalizeProject(project: Project): Project {
  return {
    ...project,
    completedWork: project.completedWork ?? '',
    pendingWork: project.pendingWork ?? '',
    completedPercent: clampPercent(Number(project.completedPercent) || 0),
  };
}

export function getProjectProgressBreakdown(completedPercent: number) {
  const completed = clampPercent(completedPercent);
  const pending = 100 - completed;

  return [
    { name: 'Completed', value: completed, color: '#22c55e' },
    { name: 'Pending', value: pending, color: '#f97316' },
  ].filter((item) => item.value > 0);
}
