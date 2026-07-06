import type { Project, ProjectTester } from '../types';

export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** Ensures every project has all required fields with safe defaults. */
export function normalizeProject(project: unknown): Project {
  const p = (project ?? {}) as Record<string, unknown>;
  return {
    id:               Number(p.id)              || 0,
    company:          String(p.company          ?? ''),
    projectName:      String(p.projectName      ?? ''),
    category:         String(p.category         ?? ''),
    projectLead:      String(p.projectLead      ?? ''),
    income:                 Number(p.income)                || 0,
    currency:               String(p.currency               ?? 'INR'),
    originalAmount:         Number(p.originalAmount)        || 0,
    exchangeRate:           Number(p.exchangeRate)          || 1,
    amountINR:              Number(p.amountINR)             || (Number(p.income) || 0),
    exchangeRateUpdatedAt:  p.exchangeRateUpdatedAt ? String(p.exchangeRateUpdatedAt) : undefined,
    startDate:              String(p.startDate        ?? ''),
    endDate:          String(p.endDate          ?? ''),
    completedWork:    String(p.completedWork    ?? ''),
    pendingWork:      String(p.pendingWork      ?? ''),
    completedPercent: clampPercent(Number(p.completedPercent) || 0),
    testers:          Array.isArray(p.testers)
                        ? (p.testers as ProjectTester[]).map((t) => ({
                            name:       String(t?.name       ?? ''),
                            monthlyPay: Number(t?.monthlyPay) || 0,
                          }))
                        : [],
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
