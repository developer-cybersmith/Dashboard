import type { AppData, Employee, Project } from '../types';

export async function parseExcelFile(file: File): Promise<AppData> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  const employees = parseEmployees(
    XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets['Monthly Pay'] ?? workbook.Sheets[workbook.SheetNames[0]],
      { defval: null },
    ),
  );

  const projectSheet =
    workbook.Sheets['Project List'] ??
    workbook.Sheets[workbook.SheetNames[1]];

  const projects = parseProjects(
    XLSX.utils.sheet_to_json<Record<string, unknown>>(projectSheet, {
      defval: null,
    }),
  );

  return { employees, projects };
}

function parseEmployees(rows: Record<string, unknown>[]): Employee[] {
  return rows
    .filter((row) => row['Employee Name'])
    .map((row, i) => ({
      id: i + 1,
      name: String(row['Employee Name']).trim(),
      designation: row['Designation'] ? String(row['Designation']).trim() : '',
      monthlyPay: Number(row['Monthly Pay']) || 0,
    }));
}

function parseProjects(rows: Record<string, unknown>[]): Project[] {
  let company = '';
  let projectName = '';
  let category = '';
  const projects: Project[] = [];
  let current: Project | null = null;

  const flush = () => {
    if (current) {
      projects.push({ ...current, id: projects.length + 1 });
      current = null;
    }
  };

  for (const row of rows) {
    if (row['Company ']) company = String(row['Company ']).trim();
    if (row['Project Name']) projectName = String(row['Project Name']).trim();
    if (row['Unnamed: 2']) category = String(row['Unnamed: 2']).trim();

    const key = `${company}|${projectName}`;
    if (!current || `${current.company}|${current.projectName}` !== key) {
      flush();
      current = {
        id: 0,
        company,
        projectName,
        category,
        projectLead: row['Project Lead']
          ? String(row['Project Lead']).trim()
          : '',
        income: Number(row['Project Income']) || 0,
        startDate: formatExcelDate(row['Start Date']),
        endDate: formatExcelDate(row['End Date']),
        completedWork: '',
        pendingWork: '',
        completedPercent: 0,
        testers: [],
      };
    }

    if (row['Testers'] && current) {
      current.testers.push({
        name: String(row['Testers']).trim(),
        monthlyPay: Number(row['monthly pay of testers']) || 0,
      });
    }
  }

  flush();
  return projects;
}

function formatExcelDate(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const str = String(value);
  const d = new Date(str);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return '';
}
