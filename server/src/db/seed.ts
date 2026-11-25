import crypto from 'node:crypto';
import { db } from './index.js';

function pickWeighted<T>(items: Array<[T, number]>): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [val, w] of items) {
    r -= w;
    if (r <= 0) return val;
  }
  return items[0][0];
}

const SITES = [
  { domain: 'leopoletto.dev', name: 'Leo Poletto' },
  { domain: 'studio-notes.io', name: 'Studio Notes' },
  { domain: 'craft-docs.app', name: 'Craft Docs' },
];

const SOURCES: Array<[{ channel: string; source: string; domain: string | null; utmS?: string; utmM?: string; utmC?: string }, number]> = [
  [{ channel: 'Direct', source: 'Direct / None', domain: null }, 44],
  [{ channel: 'Organic Search', source: 'Google', domain: 'google.com' }, 20],
  [{ channel: 'Referral', source: 'GitHub', domain: 'github.com' }, 8],
  [{ channel: 'AI Assistants', source: 'ChatGPT', domain: 'chatgpt.com' }, 6],
  [{ channel: 'Organic Social', source: 'X / Twitter', domain: 'x.com' }, 5],
  [{ channel: 'Organic Search', source: 'DuckDuckGo', domain: 'duckduckgo.com' }, 3.5],
  [{ channel: 'Organic Search', source: 'Bing', domain: 'bing.com' }, 2.5],
  [{ channel: 'AI Assistants', source: 'Perplexity', domain: 'perplexity.ai' }, 2.5],
  [{ channel: 'Organic Social', source: 'Hacker News', domain: 'news.ycombinator.com' }, 2.5],
  [{ channel: 'Email', source: 'Newsletter', domain: null, utmS: 'newsletter', utmM: 'email', utmC: 'nov-digest' }, 3],
  [{ channel: 'Paid Search', source: 'Google', domain: 'google.com', utmS: 'google', utmM: 'cpc', utmC: 'launch-q4' }, 2],
  [{ channel: 'Organic Video', source: 'YouTube', domain: 'youtube.com' }, 1],
];

const PAGES: Array<[string, number]> = [
  ['/', 32],
  ['/pricing', 16],
  ['/docs/getting-started', 14],
  ['/blog/cookieless-analytics', 11],
  ['/features', 9],
  ['/changelog', 6],
  ['/docs/tracker-script', 5],
  ['/about', 4],
  ['/login', 3],
];

const COUNTRIES: Array<[string, number]> = [
  ['US', 28],
  ['BR', 16],
  ['DE', 11],
  ['GB', 10],
  ['FR', 7],
  ['CA', 6],
  ['NL', 5],
  ['JP', 4],
  ['AU', 4],
  ['ES', 3],
  ['SE', 3],
  ['PT', 3],
];

const BROWSERS: Array<[string, number]> = [
  ['Chrome', 58],
  ['Safari', 22],
  ['Firefox', 9],
  ['Microsoft Edge', 6],
  ['Brave', 3],
  ['Opera', 2],
];

const OS_LIST: Array<[string, number]> = [
  ['Mac', 36],
  ['Windows', 30],
  ['iOS', 18],
  ['Android', 11],
  ['GNU/Linux', 5],
];

function seed() {
  const now = Date.now();
  const insertSite = db.prepare(
    'INSERT OR IGNORE INTO sites (domain, name, timezone, created_at) VALUES (?, ?, ?, ?)'
  );
  const getSite = db.prepare('SELECT id FROM sites WHERE domain = ?');
  const clearSessions = db.prepare('DELETE FROM sessions WHERE site_id = ?');
  const clearEvents = db.prepare('DELETE FROM events WHERE site_id = ?');

  const insertSession = db.prepare(`
    INSERT INTO sessions (
      id, site_id, visitor_hash, started_at, last_seen_at, duration_sec,
      pageviews, is_bounce, entry_path, exit_path,
      channel, referrer_source, referrer_domain,
      utm_source, utm_medium, utm_campaign,
      country, browser, os, device
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertEvent = db.prepare(`
    INSERT INTO events (site_id, session_id, visitor_hash, created_at, path)
    VALUES (?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN');
  try {
    for (let sIdx = 0; sIdx < SITES.length; sIdx++) {
      const s = SITES[sIdx];
      insertSite.run(s.domain, s.name, 'UTC', now - 40 * 86400_000);
      const { id: siteId } = getSite.get(s.domain) as { id: number };

      clearEvents.run(siteId);
      clearSessions.run(siteId);

      // Volume multiplier per site
      const basePerDay = sIdx === 0 ? 110 : sIdx === 1 ? 55 : 28;

      for (let dayOffset = 34; dayOffset >= 0; dayOffset--) {
        // Add a realistic traffic spike ~12 days ago
        const spike = dayOffset >= 10 && dayOffset <= 15 ? 2.1 - Math.abs(dayOffset - 12) * 0.25 : 1;
        const count = Math.round(basePerDay * spike * (0.75 + Math.random() * 0.5));
        const dayStart = now - dayOffset * 86400_000;

        // Pool of visitors for this day so some return for multiple sessions
        const visitorPool = Array.from({ length: Math.max(10, Math.round(count * 0.72)) }, () =>
          crypto.randomBytes(12).toString('hex')
        );

        for (let i = 0; i < count; i++) {
          const visitorHash = visitorPool[Math.floor(Math.random() * visitorPool.length)];
          const startedAt =
            dayOffset === 0
              ? now - Math.floor(Math.random() * 14 * 3600_000)
              : dayStart - Math.floor(Math.random() * 86400_000);

          const isBounce = Math.random() < 0.46 ? 1 : 0;
          const pvCount = isBounce ? 1 : 2 + Math.floor(Math.random() * 5);
          const durationSec = isBounce ? 0 : 25 + Math.floor(Math.random() * 480);
          const lastSeenAt = startedAt + durationSec * 1000;

          const src = pickWeighted(SOURCES);
          const country = pickWeighted(COUNTRIES);
          const browser = pickWeighted(BROWSERS);
          const os = pickWeighted(OS_LIST);
          const device =
            os === 'iOS' || os === 'Android'
              ? Math.random() < 0.08
                ? 'Tablet'
                : 'Mobile'
              : 'Desktop';

          const visitedPages: string[] = [];
          for (let p = 0; p < pvCount; p++) {
            visitedPages.push(pickWeighted(PAGES));
          }

          const sessionId = crypto.randomBytes(10).toString('base64url');
          insertSession.run(
            sessionId,
            siteId,
            visitorHash,
            startedAt,
            lastSeenAt,
            durationSec,
            pvCount,
            isBounce,
            visitedPages[0],
            visitedPages[visitedPages.length - 1],
            src.channel,
            src.source,
            src.domain,
            src.utmS ?? null,
            src.utmM ?? null,
            src.utmC ?? null,
            country,
            browser,
            os,
            device
          );

          const step = pvCount > 1 ? Math.floor((durationSec * 1000) / (pvCount - 1)) : 0;
          for (let p = 0; p < pvCount; p++) {
            insertEvent.run(siteId, sessionId, visitorHash, startedAt + p * step, visitedPages[p]);
          }
        }
      }

      // Add a handful of live visitors in the last 3 minutes
      const liveCount = sIdx === 0 ? 14 : sIdx === 1 ? 6 : 3;
      for (let i = 0; i < liveCount; i++) {
        const visitorHash = crypto.randomBytes(12).toString('hex');
        const startedAt = now - Math.floor(Math.random() * 180_000);
        const src = pickWeighted(SOURCES);
        const page = pickWeighted(PAGES);
        const sessionId = crypto.randomBytes(10).toString('base64url');
        insertSession.run(
          sessionId,
          siteId,
          visitorHash,
          startedAt,
          now - Math.floor(Math.random() * 30_000),
          45,
          2,
          0,
          page,
          '/pricing',
          src.channel,
          src.source,
          src.domain,
          src.utmS ?? null,
          src.utmM ?? null,
          src.utmC ?? null,
          pickWeighted(COUNTRIES),
          pickWeighted(BROWSERS),
          pickWeighted(OS_LIST),
          'Desktop'
        );
        insertEvent.run(siteId, sessionId, visitorHash, startedAt, page);
      }
    }
    db.exec('COMMIT');
    console.log(`Seeded ${SITES.length} websites with 35 days of analytics data.`);
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

seed();
