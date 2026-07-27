/**
 * Generates data/sample-import-template.xlsx for the Import Excel feature.
 * Run: node scripts/generate-sample-excel.mjs
 */
import XLSX from 'xlsx';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, '..', 'data', 'sample-import-template.xlsx');

const employees = [
  { 'Employee Name': 'Rupali', Designation: 'Security Analyst', 'Monthly Pay': 30000 },
  { 'Employee Name': 'Parimal', Designation: 'Pentester', 'Monthly Pay': 30000 },
  { 'Employee Name': 'Biswajeet', Designation: 'Project Lead', 'Monthly Pay': 45000 },
];

const projects = [
  {
    Company: 'CSS',
    'Project Name': 'Encora',
    Category: 'Web / Cloud',
    Model: 'Monthly Recurring',
    'Project Lead': 'Rupali',
    'Project Income': 200000,
    'Start Date': new Date('2026-02-01'),
    'End Date': new Date('2026-06-12'),
    Testers: 'Rupali',
    'monthly pay of testers': 30000,
  },
  {
    Testers: 'Parimal',
    'monthly pay of testers': 30000,
  },
  {
    Testers: 'Dipansu',
    'monthly pay of testers': 15000,
  },
  {
    Company: 'Mitkat',
    'Project Name': 'RXIL',
    Category: 'Fintech',
    Model: 'One-Time Assessment',
    'Project Lead': 'Biswajeet',
    'Project Income': 150000,
    'Start Date': new Date('2026-01-15'),
    'End Date': new Date('2026-03-30'),
    Testers: 'Biswajeet',
    'monthly pay of testers': 45000,
  },
  {
    Company: 'CSS',
    'Project Name': 'Annadarpan Phase 2',
    Category: 'Compliance',
    Model: 'Quarterly Basis',
    'Project Lead': 'Sumit',
    'Project Income': 85000,
    'Start Date': new Date('2026-04-01'),
    'End Date': new Date('2026-12-31'),
    Testers: 'Sumit',
    'monthly pay of testers': 45000,
  },
];

const wb = XLSX.utils.book_new();

const empSheet = XLSX.utils.json_to_sheet(employees);
XLSX.utils.book_append_sheet(wb, empSheet, 'Monthly Pay');

const projSheet = XLSX.utils.json_to_sheet(projects);
XLSX.utils.book_append_sheet(wb, projSheet, 'Project List');

XLSX.writeFile(wb, outPath);
console.log('Created:', outPath);
