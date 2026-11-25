import './lib/env.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { serve } from '@hono/node-server';
import { getConnInfo } from '@hono/node-server/conninfo';
import { serveStatic } from '@hono/node-server/serve-static';
import type { DatePreset, Filters, FilterKey } from '@leo/shared';
import { db } from './db/index.js';
import {
  AUTH_COOKIE_NAME,
  authenticateUser,
  createAuthSession,
  getAuthUserByToken,
  hasAnyAdmin,
  revokeAuthSession,
} from './lib/auth.js';
import { normalizeDomain } from './lib/enrich.js';
import { ingestPageview, type RawEventPayload } from './lib/ingest.js';
import { resolveDateRange } from './lib/dates.js';
import {
  getBreakdown,
  getKpis,
  getLiveVisitors,
  getSitesOverview,
  getTimeSeries,
  type BreakdownType,
} from './lib/queries.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const trackerPath = path.resolve(__dirname, '../../tracker/dist/script.js');
const webDistPath = path.resolve(__dirname, '../../web/dist');

const app = new Hono();

// 1. Public tracker script & event ingestion (open CORS, zero cookies)
app.use(
  '/api/event',
  cors({
    origin: '*',
    allowMethods: ['POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  })
);

app.get('/js/script.js', (c) => {
  if (!fs.existsSync(trackerPath)) {
    return c.text('// Tracker not built yet. Run pnpm --filter @leo/tracker build', 404);
  }
  const code = fs.readFileSync(trackerPath, 'utf8');
  c.header('Content-Type', 'application/javascript; charset=utf-8');
  c.header('Cache-Control', 'public, max-age=3600');
  c.header('Access-Control-Allow-Origin', '*');
  return c.body(code);
});

app.post('/api/event', async (c) => {
  let payload: RawEventPayload;
  try {
    const raw = await c.req.text();
    payload = JSON.parse(raw) as RawEventPayload;
  } catch {
    return c.body(null, 400);
  }

  const forwarded = c.req.header('x-forwarded-for');
  const remoteAddr = getConnInfo(c).remote.address || '';
  const ip =
    c.req.header('cf-connecting-ip') ||
    (forwarded ? forwarded.split(',')[0].trim() : '') ||
    c.req.header('x-real-ip') ||
    remoteAddr;

  const userAgent = c.req.header('user-agent') || '';
  const result = ingestPageview(payload, ip, userAgent, {
    get: (name) => c.req.header(name),
  });

  if (!result.accepted && result.reason === 'missing_fields') {
    return c.body(null, 400);
  }
  return c.body(null, 202);
});

// 2. Auth endpoints (dashboard only — never used on tracked websites)
app.get('/api/auth/status', (c) => {
  const token = getCookie(c, AUTH_COOKIE_NAME);
  const user = getAuthUserByToken(token);
  return c.json({
    hasAdmin: hasAnyAdmin(),
    authenticated: Boolean(user),
    user,
  });
});

app.post('/api/auth/login', async (c) => {
  if (!hasAnyAdmin()) {
    return c.json(
      { error: 'No admin user exists yet. Run `pnpm create-admin` on the server first.' },
      403
    );
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };

  if (!body.email || !body.password) {
    return c.json({ error: 'Email and password are required.' }, 400);
  }

  const user = authenticateUser(body.email, body.password);
  if (!user) {
    return c.json({ error: 'Invalid email or password.' }, 401);
  }

  const session = createAuthSession(user.id);
  setCookie(c, AUTH_COOKIE_NAME, session.token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(session.expiresAt),
  });

  return c.json({ user });
});

app.post('/api/auth/logout', (c) => {
  const token = getCookie(c, AUTH_COOKIE_NAME);
  revokeAuthSession(token);
  deleteCookie(c, AUTH_COOKIE_NAME, { path: '/' });
  return c.json({ ok: true });
});

// 3. Auth guard for all dashboard APIs
app.use('/api/sites/*', async (c, next) => {
  const user = getAuthUserByToken(getCookie(c, AUTH_COOKIE_NAME));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  await next();
});
app.use('/api/sites', async (c, next) => {
  const user = getAuthUserByToken(getCookie(c, AUTH_COOKIE_NAME));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  await next();
});
app.use('/api/stats/*', async (c, next) => {
  const user = getAuthUserByToken(getCookie(c, AUTH_COOKIE_NAME));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  await next();
});

// 4. Sites CRUD
app.get('/api/sites', (c) => {
  return c.json({ sites: getSitesOverview() });
});

app.post('/api/sites', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    domain?: string;
    name?: string;
    timezone?: string;
  };

  if (!body.domain) {
    return c.json({ error: 'Domain is required.' }, 400);
  }

  const domain = normalizeDomain(body.domain);
  if (!domain || !domain.includes('.')) {
    return c.json({ error: 'Please enter a valid domain (e.g. example.com).' }, 400);
  }

  const name = (body.name || domain).trim();
  const timezone = (body.timezone || 'UTC').trim();
  const now = Date.now();

  try {
    const res = db
      .prepare('INSERT INTO sites (domain, name, timezone, created_at) VALUES (?, ?, ?, ?)')
      .run(domain, name, timezone, now);

    return c.json(
      {
        site: {
          id: Number(res.lastInsertRowid),
          domain,
          name,
          timezone,
          createdAt: now,
        },
      },
      201
    );
  } catch {
    return c.json({ error: `Site "${domain}" is already registered.` }, 409);
  }
});

app.delete('/api/sites/:domain', (c) => {
  const domain = normalizeDomain(c.req.param('domain'));
  const res = db.prepare('DELETE FROM sites WHERE domain = ?').run(domain);
  if (res.changes === 0) {
    return c.json({ error: 'Site not found.' }, 404);
  }
  return c.json({ ok: true });
});

// 5. Analytics Stats API
const FILTER_KEYS: FilterKey[] = [
  'channel',
  'source',
  'utmSource',
  'utmMedium',
  'utmCampaign',
  'page',
  'entryPage',
  'exitPage',
  'country',
  'browser',
  'os',
  'device',
];

function extractFilters(c: { req: { query(k: string): string | undefined } }): Filters {
  const filters: Filters = {};
  for (const key of FILTER_KEYS) {
    const val = c.req.query(key);
    if (val) filters[key] = val;
  }
  return filters;
}

function getSiteOr404(domainParam: string) {
  const domain = normalizeDomain(domainParam);
  return db
    .prepare('SELECT id, domain, name, timezone, created_at AS createdAt FROM sites WHERE domain = ?')
    .get(domain) as
    | { id: number; domain: string; name: string; timezone: string; createdAt: number }
    | undefined;
}

app.get('/api/stats/:domain/summary', (c) => {
  const site = getSiteOr404(c.req.param('domain'));
  if (!site) return c.json({ error: 'Site not found' }, 404);

  const preset = (c.req.query('period') || '28d') as DatePreset;
  const range = resolveDateRange(preset, c.req.query('from'), c.req.query('to'));
  const filters = extractFilters(c);

  return c.json({
    site,
    liveVisitors: getLiveVisitors(site.id),
    range: {
      from: range.from,
      to: range.to,
      bucket: range.bucket,
    },
    kpis: getKpis(site.id, range, filters),
    series: getTimeSeries(site.id, range, filters),
  });
});

app.get('/api/stats/:domain/live', (c) => {
  const site = getSiteOr404(c.req.param('domain'));
  if (!site) return c.json({ error: 'Site not found' }, 404);
  return c.json({ liveVisitors: getLiveVisitors(site.id) });
});

const VALID_BREAKDOWNS = new Set<BreakdownType>([
  'channels',
  'sources',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'pages',
  'entry_pages',
  'exit_pages',
  'countries',
  'browsers',
  'os',
  'devices',
]);

app.get('/api/stats/:domain/breakdown/:type', (c) => {
  const site = getSiteOr404(c.req.param('domain'));
  if (!site) return c.json({ error: 'Site not found' }, 404);

  const type = c.req.param('type') as BreakdownType;
  if (!VALID_BREAKDOWNS.has(type)) {
    return c.json({ error: 'Invalid breakdown type' }, 400);
  }

  const preset = (c.req.query('period') || '28d') as DatePreset;
  const range = resolveDateRange(preset, c.req.query('from'), c.req.query('to'));
  const filters = extractFilters(c);
  const limit = Number(c.req.query('limit') || '9');
  const search = c.req.query('search') || '';

  return c.json(getBreakdown(site.id, type, range, filters, limit, search));
});

// 6. Serve built frontend in production
if (fs.existsSync(webDistPath)) {
  app.use('/*', serveStatic({ root: path.relative(process.cwd(), webDistPath) }));
  app.get('*', (c) => {
    const html = fs.readFileSync(path.join(webDistPath, 'index.html'), 'utf8');
    return c.html(html);
  });
}

const port = Number(process.env.PORT || 3001);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Leo Analytics server running at http://localhost:${info.port}`);
});
