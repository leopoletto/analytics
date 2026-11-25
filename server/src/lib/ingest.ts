import crypto from 'node:crypto';
import { db } from '../db/index.js';
import { computeVisitorHash } from './salt.js';
import {
  classifyAttribution,
  isBot,
  normalizeDomain,
  normalizePath,
  parseDeviceInfo,
  resolveCountry,
} from './enrich.js';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const findSiteByDomainStmt = db.prepare(
  'SELECT id, domain FROM sites WHERE domain = ?'
);

const findActiveSessionStmt = db.prepare(`
  SELECT id, started_at, pageviews
  FROM sessions
  WHERE site_id = ? AND visitor_hash = ? AND last_seen_at >= ?
  ORDER BY last_seen_at DESC
  LIMIT 1
`);

const insertSessionStmt = db.prepare(`
  INSERT INTO sessions (
    id, site_id, visitor_hash, started_at, last_seen_at, duration_sec,
    pageviews, is_bounce, entry_path, exit_path,
    channel, referrer_source, referrer_domain,
    utm_source, utm_medium, utm_campaign,
    country, browser, os, device
  ) VALUES (?, ?, ?, ?, ?, 0, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const updateSessionStmt = db.prepare(`
  UPDATE sessions
  SET last_seen_at = ?,
      duration_sec = ?,
      pageviews = pageviews + 1,
      is_bounce = 0,
      exit_path = ?
  WHERE id = ?
`);

const insertEventStmt = db.prepare(`
  INSERT INTO events (site_id, session_id, visitor_hash, created_at, path)
  VALUES (?, ?, ?, ?, ?)
`);

export interface RawEventPayload {
  d?: string; // domain
  u?: string; // full url
  r?: string | null; // referrer
  w?: number; // viewport width
}

export function ingestPageview(
  payload: RawEventPayload,
  ip: string,
  userAgent: string,
  headers: { get(name: string): string | undefined },
  nowMs = Date.now()
): { accepted: boolean; reason?: string } {
  if (isBot(userAgent)) {
    return { accepted: false, reason: 'bot' };
  }

  if (!payload.d || !payload.u) {
    return { accepted: false, reason: 'missing_fields' };
  }

  const domain = normalizeDomain(payload.d);
  const site = findSiteByDomainStmt.get(domain) as
    | { id: number; domain: string }
    | undefined;

  if (!site) {
    return { accepted: false, reason: 'unknown_site' };
  }

  let urlObj: URL;
  try {
    urlObj = new URL(payload.u);
  } catch {
    return { accepted: false, reason: 'invalid_url' };
  }

  const pagePath = normalizePath(urlObj.pathname);
  const visitorHash = computeVisitorHash(site.id, ip, userAgent, nowMs);

  const cutoff = nowMs - SESSION_TIMEOUT_MS;
  const activeSession = findActiveSessionStmt.get(
    site.id,
    visitorHash,
    cutoff
  ) as { id: string; started_at: number; pageviews: number } | undefined;

  let sessionId: string;

  if (activeSession) {
    sessionId = activeSession.id;
    const durationSec = Math.max(
      0,
      Math.round((nowMs - activeSession.started_at) / 1000)
    );
    updateSessionStmt.run(nowMs, durationSec, pagePath, sessionId);
  } else {
    sessionId = crypto.randomBytes(12).toString('base64url');
    const attribution = classifyAttribution(urlObj, payload.r, site.domain);
    const deviceInfo = parseDeviceInfo(userAgent, payload.w);
    const country = resolveCountry(ip, headers);

    insertSessionStmt.run(
      sessionId,
      site.id,
      visitorHash,
      nowMs,
      nowMs,
      pagePath,
      pagePath,
      attribution.channel,
      attribution.referrerSource,
      attribution.referrerDomain,
      attribution.utmSource,
      attribution.utmMedium,
      attribution.utmCampaign,
      country,
      deviceInfo.browser,
      deviceInfo.os,
      deviceInfo.device
    );
  }

  insertEventStmt.run(site.id, sessionId, visitorHash, nowMs, pagePath);
  return { accepted: true };
}
