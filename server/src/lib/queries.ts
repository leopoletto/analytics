import type {
  BreakdownItem,
  BreakdownResponse,
  Filters,
  KpiSummary,
  KpiValue,
  SiteOverview,
  TimeSeriesPoint,
} from '@leo/shared';
import { db } from '../db/index.js';
import { buildBuckets, type ResolvedRange } from './dates.js';

interface WhereClause {
  sql: string;
  params: Array<string | number>;
}

/**
 * Builds a parameterized WHERE clause for the `sessions` table (aliased as `s`).
 * If filtering by `page`, uses an EXISTS subquery against `events`.
 */
function buildSessionWhere(
  siteId: number,
  from: number,
  to: number,
  filters: Filters
): WhereClause {
  const parts: string[] = ['s.site_id = ?', 's.started_at >= ?', 's.started_at <= ?'];
  const params: Array<string | number> = [siteId, from, to];

  if (filters.channel) {
    parts.push('s.channel = ?');
    params.push(filters.channel);
  }
  if (filters.source) {
    parts.push('s.referrer_source = ?');
    params.push(filters.source);
  }
  if (filters.utmSource) {
    parts.push('s.utm_source = ?');
    params.push(filters.utmSource);
  }
  if (filters.utmMedium) {
    parts.push('s.utm_medium = ?');
    params.push(filters.utmMedium);
  }
  if (filters.utmCampaign) {
    parts.push('s.utm_campaign = ?');
    params.push(filters.utmCampaign);
  }
  if (filters.entryPage) {
    parts.push('s.entry_path = ?');
    params.push(filters.entryPage);
  }
  if (filters.exitPage) {
    parts.push('s.exit_path = ?');
    params.push(filters.exitPage);
  }
  if (filters.country) {
    if (filters.country === '(not set)') {
      parts.push('s.country IS NULL');
    } else {
      parts.push('s.country = ?');
      params.push(filters.country);
    }
  }
  if (filters.browser) {
    parts.push('s.browser = ?');
    params.push(filters.browser);
  }
  if (filters.os) {
    parts.push('s.os = ?');
    params.push(filters.os);
  }
  if (filters.device) {
    parts.push('s.device = ?');
    params.push(filters.device);
  }
  if (filters.page) {
    parts.push(
      'EXISTS (SELECT 1 FROM events e WHERE e.session_id = s.id AND e.path = ?)'
    );
    params.push(filters.page);
  }

  return { sql: parts.join(' AND '), params };
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return Math.round(((current - previous) / previous) * 100);
}

interface RawKpiRow {
  visitors: number;
  visits: number;
  pageviews: number;
  bounces: number;
  totalDuration: number;
}

function queryRawKpis(
  siteId: number,
  from: number,
  to: number,
  filters: Filters
): RawKpiRow {
  const where = buildSessionWhere(siteId, from, to, filters);
  const row = db
    .prepare(`
      SELECT
        COUNT(DISTINCT s.visitor_hash) AS visitors,
        COUNT(*) AS visits,
        COALESCE(SUM(s.pageviews), 0) AS pageviews,
        COALESCE(SUM(s.is_bounce), 0) AS bounces,
        COALESCE(SUM(s.duration_sec), 0) AS totalDuration
      FROM sessions s
      WHERE ${where.sql}
    `)
    .get(...where.params) as RawKpiRow | undefined;

  return (
    row ?? {
      visitors: 0,
      visits: 0,
      pageviews: 0,
      bounces: 0,
      totalDuration: 0,
    }
  );
}

function deriveMetrics(r: RawKpiRow) {
  const viewsPerVisit = r.visits > 0 ? Number((r.pageviews / r.visits).toFixed(2)) : 0;
  const bounceRate = r.visits > 0 ? Math.round((r.bounces / r.visits) * 100) : 0;
  const visitDuration = r.visits > 0 ? Math.round(r.totalDuration / r.visits) : 0;
  return {
    visitors: r.visitors,
    visits: r.visits,
    pageviews: r.pageviews,
    viewsPerVisit,
    bounceRate,
    visitDuration,
  };
}

export function getLiveVisitors(siteId: number, nowMs = Date.now()): number {
  const cutoff = nowMs - 5 * 60 * 1000;
  const row = db
    .prepare(
      'SELECT COUNT(DISTINCT visitor_hash) AS count FROM sessions WHERE site_id = ? AND last_seen_at >= ?'
    )
    .get(siteId, cutoff) as { count: number } | undefined;
  return row?.count ?? 0;
}

export function getKpis(
  siteId: number,
  range: ResolvedRange,
  filters: Filters
): KpiSummary {
  const curr = deriveMetrics(queryRawKpis(siteId, range.from, range.to, filters));
  const prev = deriveMetrics(
    queryRawKpis(siteId, range.prevFrom, range.prevTo, filters)
  );

  const mk = (c: number, p: number): KpiValue => ({
    value: c,
    change: pctChange(c, p),
  });

  return {
    visitors: mk(curr.visitors, prev.visitors),
    visits: mk(curr.visits, prev.visits),
    pageviews: mk(curr.pageviews, prev.pageviews),
    viewsPerVisit: mk(curr.viewsPerVisit, prev.viewsPerVisit),
    bounceRate: mk(curr.bounceRate, prev.bounceRate),
    visitDuration: mk(curr.visitDuration, prev.visitDuration),
  };
}

export function getTimeSeries(
  siteId: number,
  range: ResolvedRange,
  filters: Filters
): TimeSeriesPoint[] {
  const where = buildSessionWhere(siteId, range.from, range.to, filters);

  const fmt =
    range.bucket === 'minute'
      ? '%Y-%m-%dT%H:%M'
      : range.bucket === 'hour'
      ? '%Y-%m-%dT%H'
      : range.bucket === 'day'
      ? '%Y-%m-%d'
      : '%Y-%m';

  const rows = db
    .prepare(`
      SELECT
        strftime('${fmt}', s.started_at / 1000, 'unixepoch') AS bucketKey,
        COUNT(DISTINCT s.visitor_hash) AS visitors,
        COUNT(*) AS visits,
        COALESCE(SUM(s.pageviews), 0) AS pageviews,
        COALESCE(SUM(s.is_bounce), 0) AS bounces,
        COALESCE(SUM(s.duration_sec), 0) AS totalDuration
      FROM sessions s
      WHERE ${where.sql}
      GROUP BY bucketKey
      ORDER BY bucketKey ASC
    `)
    .all(...where.params) as unknown as Array<RawKpiRow & { bucketKey: string }>;

  const map = new Map(rows.map((r) => [r.bucketKey, r]));
  const buckets = buildBuckets(range.from, range.to, range.bucket);

  return buckets.map((b) => {
    const row = map.get(b.key);
    const derived = row
      ? deriveMetrics(row)
      : {
          visitors: 0,
          visits: 0,
          pageviews: 0,
          viewsPerVisit: 0,
          bounceRate: 0,
          visitDuration: 0,
        };
    return {
      date: b.key,
      label: b.label,
      ...derived,
    };
  });
}

export type BreakdownType =
  | 'channels'
  | 'sources'
  | 'utm_source'
  | 'utm_medium'
  | 'utm_campaign'
  | 'pages'
  | 'entry_pages'
  | 'exit_pages'
  | 'countries'
  | 'browsers'
  | 'os'
  | 'devices';

const SESSION_COLUMN_MAP: Record<
  Exclude<BreakdownType, 'pages'>,
  { col: string; nonNullOnly?: boolean }
> = {
  channels: { col: 's.channel' },
  sources: { col: 's.referrer_source' },
  utm_source: { col: 's.utm_source', nonNullOnly: true },
  utm_medium: { col: 's.utm_medium', nonNullOnly: true },
  utm_campaign: { col: 's.utm_campaign', nonNullOnly: true },
  entry_pages: { col: 's.entry_path' },
  exit_pages: { col: 's.exit_path' },
  countries: { col: 's.country' },
  browsers: { col: 's.browser' },
  os: { col: 's.os' },
  devices: { col: 's.device' },
};

export function getBreakdown(
  siteId: number,
  type: BreakdownType,
  range: ResolvedRange,
  filters: Filters,
  limit = 9,
  search = ''
): BreakdownResponse {
  const where = buildSessionWhere(siteId, range.from, range.to, filters);
  const safeLimit = Math.min(Math.max(1, limit), 500);
  const searchTrim = search.trim();

  if (type === 'pages') {
    const searchSql = searchTrim ? 'AND e.path LIKE ?' : '';
    const extraParams = searchTrim ? [`%${searchTrim}%`] : [];

    const totalRow = db
      .prepare(`
        SELECT COUNT(DISTINCT s.visitor_hash) AS total
        FROM sessions s
        WHERE ${where.sql}
      `)
      .get(...where.params) as { total: number } | undefined;

    const total = totalRow?.total ?? 0;

    const rows = db
      .prepare(`
        SELECT
          e.path AS key,
          COUNT(DISTINCT e.visitor_hash) AS visitors,
          COUNT(*) AS pageviews
        FROM events e
        JOIN sessions s ON s.id = e.session_id
        WHERE ${where.sql} ${searchSql}
        GROUP BY e.path
        ORDER BY visitors DESC, pageviews DESC
        LIMIT ?
      `)
      .all(...where.params, ...extraParams, safeLimit) as Array<{
      key: string;
      visitors: number;
      pageviews: number;
    }>;

    const items: BreakdownItem[] = rows.map((r) => ({
      key: r.key,
      label: r.key,
      visitors: r.visitors,
      secondary: r.pageviews,
      percentage: total > 0 ? Math.round((r.visitors / total) * 100) : 0,
    }));

    return { items, total };
  }

  const spec = SESSION_COLUMN_MAP[type];
  const nullFilter = spec.nonNullOnly ? `AND ${spec.col} IS NOT NULL AND ${spec.col} != ''` : '';
  const searchSql = searchTrim ? `AND COALESCE(${spec.col}, '(not set)') LIKE ?` : '';
  const extraParams = searchTrim ? [`%${searchTrim}%`] : [];

  const totalRow = db
    .prepare(`
      SELECT COUNT(DISTINCT s.visitor_hash) AS total
      FROM sessions s
      WHERE ${where.sql} ${nullFilter}
    `)
    .get(...where.params) as { total: number } | undefined;

  const total = totalRow?.total ?? 0;

  const rows = db
    .prepare(`
      SELECT
        COALESCE(${spec.col}, '(not set)') AS key,
        COUNT(DISTINCT s.visitor_hash) AS visitors,
        COUNT(*) AS visits
      FROM sessions s
      WHERE ${where.sql} ${nullFilter} ${searchSql}
      GROUP BY key
      ORDER BY visitors DESC, visits DESC
      LIMIT ?
    `)
    .all(...where.params, ...extraParams, safeLimit) as Array<{
    key: string;
    visitors: number;
    visits: number;
  }>;

  const items: BreakdownItem[] = rows.map((r) => ({
    key: r.key,
    label: r.key,
    visitors: r.visitors,
    secondary: r.visits,
    percentage: total > 0 ? Math.round((r.visitors / total) * 100) : 0,
  }));

  return { items, total };
}

export function getSitesOverview(nowMs = Date.now()): SiteOverview[] {
  const sites = db
    .prepare('SELECT id, domain, name, timezone, created_at AS createdAt FROM sites ORDER BY created_at DESC')
    .all() as Array<{
    id: number;
    domain: string;
    name: string;
    timezone: string;
    createdAt: number;
  }>;

  const dayAgo = nowMs - 24 * 60 * 60 * 1000;
  const weekAgo = nowMs - 7 * 24 * 60 * 60 * 1000;
  const fiveMinAgo = nowMs - 5 * 60 * 1000;

  const liveStmt = db.prepare(
    'SELECT COUNT(DISTINCT visitor_hash) AS c FROM sessions WHERE site_id = ? AND last_seen_at >= ?'
  );
  const stats24hStmt = db.prepare(`
    SELECT COUNT(DISTINCT visitor_hash) AS visitors, COALESCE(SUM(pageviews), 0) AS pageviews
    FROM sessions
    WHERE site_id = ? AND started_at >= ?
  `);
  const sparkStmt = db.prepare(`
    SELECT strftime('%Y-%m-%d', started_at / 1000, 'unixepoch') AS d, COUNT(DISTINCT visitor_hash) AS v
    FROM sessions
    WHERE site_id = ? AND started_at >= ?
    GROUP BY d
    ORDER BY d ASC
  `);

  const last7Days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    last7Days.push(new Date(nowMs - i * 86400_000).toISOString().slice(0, 10));
  }

  return sites.map((site) => {
    const live = (liveStmt.get(site.id, fiveMinAgo) as { c: number } | undefined)?.c ?? 0;
    const s24 = (stats24hStmt.get(site.id, dayAgo) as
      | { visitors: number; pageviews: number }
      | undefined) ?? { visitors: 0, pageviews: 0 };
    const sparkRows = sparkStmt.all(site.id, weekAgo) as Array<{ d: string; v: number }>;
    const sparkMap = new Map(sparkRows.map((r) => [r.d, r.v]));

    return {
      ...site,
      liveVisitors: live,
      visitors24h: s24.visitors,
      pageviews24h: s24.pageviews,
      sparkline: last7Days.map((d) => sparkMap.get(d) ?? 0),
    };
  });
}
