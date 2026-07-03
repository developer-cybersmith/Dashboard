/**
 * Computes which fields changed between two plain objects.
 * Returns one entry per changed field, with human-readable label,
 * old value and new value as strings — ready for the activity log.
 */

export interface FieldChange {
  field: string;   // human label, e.g. "Monthly Pay"
  from:  string;   // old value as string
  to:    string;   // new value as string
}

const FIELD_LABELS: Record<string, string> = {
  name:             'Name',
  designation:      'Designation',
  monthlyPay:       'Monthly Pay',
  company:          'Company',
  projectName:      'Project Name',
  category:         'Category',
  projectLead:      'Project Lead',
  income:           'Income',
  startDate:        'Start Date',
  endDate:          'End Date',
  completedWork:    'Completed Work',
  pendingWork:      'Pending Work',
  completedPercent: '% Done',
};

const CURRENCY_FIELDS = new Set(['income', 'monthlyPay']);
const PERCENT_FIELDS  = new Set(['completedPercent']);

const SKIP_FIELDS = new Set([
  'id', '_id', '__v', 'createdAt', 'updatedAt', 'testers',
]);

function fmt(key: string, raw: unknown): string {
  const v = raw ?? '';
  if (CURRENCY_FIELDS.has(key)) return `₹${Number(v).toLocaleString('en-IN')}`;
  if (PERCENT_FIELDS.has(key))  return `${v}%`;
  return String(v);
}

export function computeDiff(
  original: Record<string, unknown>,
  updated:  Record<string, unknown>,
): FieldChange[] {
  const changes: FieldChange[] = [];
  const keys = new Set([...Object.keys(original), ...Object.keys(updated)]);

  for (const key of keys) {
    if (SKIP_FIELDS.has(key)) continue;

    const from = String(original[key] ?? '');
    const to   = String(updated[key]  ?? '');
    if (from === to) continue;

    changes.push({
      field: FIELD_LABELS[key] ?? key,
      from:  fmt(key, original[key]),
      to:    fmt(key, updated[key]),
    });
  }

  return changes;
}
