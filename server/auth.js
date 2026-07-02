import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALLOWED_USERS_PATH = path.join(__dirname, '..', 'data', 'allowed-users.json');
const AUTH_CONFIG_PATH = path.join(__dirname, '..', 'data', 'auth.config.json');

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const sessions = new Map();

export function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function loadAllowedUsers() {
  return JSON.parse(fs.readFileSync(ALLOWED_USERS_PATH, 'utf-8'));
}

function getDefaultPassword() {
  if (process.env.DEFAULT_PASSWORD) return process.env.DEFAULT_PASSWORD;
  try {
    const config = JSON.parse(fs.readFileSync(AUTH_CONFIG_PATH, 'utf-8'));
    return config.defaultPassword || 'Mitkat@2026';
  } catch {
    return 'Mitkat@2026';
  }
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function isEmailAllowed(email) {
  const normalized = normalizeEmail(email);
  return loadAllowedUsers().find((u) => normalizeEmail(u.email) === normalized) ?? null;
}

export function authenticate(email, password) {
  const allowed = isEmailAllowed(email);
  if (!allowed) return null;

  const expected = hashPassword(getDefaultPassword());
  if (hashPassword(password) !== expected) return null;

  return createSession(allowed);
}

export function createToken() {
  return crypto.randomBytes(32).toString('hex');
}

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
}

export function createSession(user) {
  cleanExpiredSessions();
  const token = createToken();
  const session = {
    email: normalizeEmail(user.email),
    name: user.name,
    role: user.role,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };
  sessions.set(token, session);
  return { token, user: session };
}

export function getSession(token) {
  if (!token) return null;
  cleanExpiredSessions();
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (session) sessions.delete(token);
    return null;
  }
  return {
    email: session.email,
    name: session.name,
    role: session.role,
  };
}

export function revokeToken(token) {
  sessions.delete(token);
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const session = getSession(token);

  if (!session) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  req.user = session;
  next();
}
