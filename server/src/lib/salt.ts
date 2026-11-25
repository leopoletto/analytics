import crypto from 'node:crypto';
import { db } from '../db/index.js';

const getSaltStmt = db.prepare('SELECT salt FROM daily_salts WHERE date_key = ?');
const insertSaltStmt = db.prepare(
  'INSERT OR IGNORE INTO daily_salts (date_key, salt) VALUES (?, ?)'
);
const pruneSaltStmt = db.prepare('DELETE FROM daily_salts WHERE date_key < ?');

let cachedDateKey = '';
let cachedSalt = '';

function utcDateKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export function getDailySalt(nowMs = Date.now()): string {
  const key = utcDateKey(nowMs);
  if (cachedDateKey === key && cachedSalt) {
    return cachedSalt;
  }

  const row = getSaltStmt.get(key) as { salt: string } | undefined;
  if (row?.salt) {
    cachedDateKey = key;
    cachedSalt = row.salt;
    return cachedSalt;
  }

  const fresh = crypto.randomBytes(32).toString('hex');
  insertSaltStmt.run(key, fresh);

  // Purge salts older than 2 days so hashes can never be reconstructed later
  const cutoff = utcDateKey(nowMs - 2 * 24 * 60 * 60 * 1000);
  pruneSaltStmt.run(cutoff);

  const persisted = getSaltStmt.get(key) as { salt: string };
  cachedDateKey = key;
  cachedSalt = persisted.salt;
  return cachedSalt;
}

/**
 * Cookieless, fingerprint-free daily visitor hash.
 * The raw IP address is never persisted anywhere.
 */
export function computeVisitorHash(
  siteId: number,
  ip: string,
  userAgent: string,
  nowMs = Date.now()
): string {
  const salt = getDailySalt(nowMs);
  return crypto
    .createHash('sha256')
    .update(`${salt}|${siteId}|${ip}|${userAgent}`)
    .digest('hex')
    .slice(0, 32);
}
