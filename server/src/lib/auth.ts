import crypto from 'node:crypto';
import { db } from '../db/index.js';

export const AUTH_COOKIE_NAME = 'leo_analytics_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function hasAnyAdmin(): boolean {
  const row = db.prepare('SELECT COUNT(*) as count FROM users').get() as {
    count: number;
  };
  return row.count > 0;
}

export function createAdminUser(email: string, password: string): { id: number; email: string } {
  const cleanEmail = email.trim().toLowerCase();
  const passwordHash = hashPassword(password);
  const now = Date.now();

  const existing = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(cleanEmail) as { id: number } | undefined;

  if (existing) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
      passwordHash,
      existing.id
    );
    return { id: existing.id, email: cleanEmail };
  }

  const res = db
    .prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)')
    .run(cleanEmail, passwordHash, now);

  return { id: Number(res.lastInsertRowid), email: cleanEmail };
}

export function authenticateUser(
  email: string,
  password: string
): { id: number; email: string } | null {
  const cleanEmail = email.trim().toLowerCase();
  const user = db
    .prepare('SELECT id, email, password_hash FROM users WHERE email = ?')
    .get(cleanEmail) as
    | { id: number; email: string; password_hash: string }
    | undefined;

  if (!user) return null;
  if (!verifyPassword(password, user.password_hash)) return null;
  return { id: user.id, email: user.email };
}

export function createAuthSession(userId: number): { token: string; expiresAt: number } {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;

  db.prepare(
    'INSERT INTO auth_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'
  ).run(tokenHash, userId, expiresAt, now);

  // Clean up expired sessions opportunistically
  db.prepare('DELETE FROM auth_sessions WHERE expires_at < ?').run(now);

  return { token, expiresAt };
}

export function getAuthUserByToken(
  token: string | undefined
): { id: number; email: string } | null {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const now = Date.now();

  const row = db
    .prepare(`
      SELECT u.id, u.email
      FROM auth_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?
    `)
    .get(tokenHash, now) as { id: number; email: string } | undefined;

  return row ?? null;
}

export function revokeAuthSession(token: string | undefined): void {
  if (!token) return;
  db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(hashToken(token));
}
