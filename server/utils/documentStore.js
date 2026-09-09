/**
 * JSON-file fallback for project document (invoice/PO PDF) metadata.
 * Actual PDF binaries are stored under data/uploads/.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DOCS_PATH = path.join(DATA_DIR, 'project-documents.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function getUploadsRoot() {
  ensureDir(UPLOADS_DIR);
  return UPLOADS_DIR;
}

export function getProjectUploadDir(kind, projectId) {
  const dir = path.join(UPLOADS_DIR, kind === 'po' ? 'pos' : 'invoices', String(projectId));
  ensureDir(dir);
  return dir;
}

export function readDocuments() {
  ensureDir(DATA_DIR);
  if (!fs.existsSync(DOCS_PATH)) {
    fs.writeFileSync(DOCS_PATH, '[]', 'utf-8');
    return [];
  }
  try {
    const raw = JSON.parse(fs.readFileSync(DOCS_PATH, 'utf-8'));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function writeDocuments(docs) {
  ensureDir(DATA_DIR);
  fs.writeFileSync(DOCS_PATH, JSON.stringify(docs, null, 2), 'utf-8');
}

export function nextDocumentId(docs) {
  if (!docs.length) return 1;
  return Math.max(...docs.map((d) => Number(d.id) || 0)) + 1;
}
