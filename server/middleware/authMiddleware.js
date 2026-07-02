import { getSession } from '../auth.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const token  = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const session = getSession(token);

  if (!session) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  req.user = session;
  next();
}
