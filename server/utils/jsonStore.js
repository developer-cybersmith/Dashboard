/**
 * JSON file fallback store — used only when MONGO_URI is not set.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = path.join(__dirname, '..', '..', 'data');
const DB_PATH   = path.join(DATA_DIR, 'db.json');
const SEED_PATH = path.join(DATA_DIR, 'initial-data.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function readSeed() {
  return JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8'));
}

export function readJson() {
  ensureDir();
  if (!fs.existsSync(DB_PATH)) {
    const seed = readSeed();
    fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2), 'utf-8');
    return seed;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

export function writeJson(data) {
  ensureDir();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export function resetJson() {
  const seed = readSeed();
  writeJson(seed);
  return seed;
}
