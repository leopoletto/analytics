import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDataDir = path.resolve(__dirname, '../../../data');
const dbPath = process.env.DATABASE_PATH || path.join(defaultDataDir, 'analytics.sqlite');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);

// Performance & durability pragmas for analytics workload
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
  PRAGMA cache_size = -64000;
  PRAGMA temp_store = MEMORY;
  PRAGMA busy_timeout = 5000;
`);

export function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_salts (
      date_key TEXT PRIMARY KEY,
      salt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      site_id INTEGER NOT NULL,
      visitor_hash TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      duration_sec INTEGER NOT NULL DEFAULT 0,
      pageviews INTEGER NOT NULL DEFAULT 1,
      is_bounce INTEGER NOT NULL DEFAULT 1,
      entry_path TEXT NOT NULL,
      exit_path TEXT NOT NULL,
      channel TEXT NOT NULL,
      referrer_source TEXT NOT NULL,
      referrer_domain TEXT,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      country TEXT,
      browser TEXT,
      os TEXT,
      device TEXT,
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL,
      session_id TEXT NOT NULL,
      visitor_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      path TEXT NOT NULL,
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_site_started
      ON sessions(site_id, started_at);

    CREATE INDEX IF NOT EXISTS idx_sessions_lookup
      ON sessions(site_id, visitor_hash, last_seen_at);

    CREATE INDEX IF NOT EXISTS idx_sessions_site_last_seen
      ON sessions(site_id, last_seen_at);

    CREATE INDEX IF NOT EXISTS idx_events_site_created
      ON events(site_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_events_site_path
      ON events(site_id, path, created_at);

    CREATE INDEX IF NOT EXISTS idx_events_session
      ON events(session_id);
  `);
}

initSchema();
