import type { DatePreset } from '@leo/shared';

export interface ResolvedRange {
  from: number;
  to: number;
  prevFrom: number;
  prevTo: number;
  bucket: 'minute' | 'hour' | 'day' | 'month';
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function startOfUtcDay(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function resolveDateRange(
  preset: DatePreset,
  customFrom?: string,
  customTo?: string,
  nowMs = Date.now()
): ResolvedRange {
  const todayStart = startOfUtcDay(nowMs);
  let from: number;
  let to: number = nowMs;
  let bucket: 'minute' | 'hour' | 'day' | 'month' = 'day';

  switch (preset) {
    case 'realtime':
      from = nowMs - 30 * MINUTE;
      to = nowMs;
      bucket = 'minute';
      break;
    case 'today':
      from = todayStart;
      to = nowMs;
      bucket = 'hour';
      break;
    case 'yesterday':
      from = todayStart - DAY;
      to = todayStart - 1;
      bucket = 'hour';
      break;
    case '24h':
      from = nowMs - 24 * HOUR;
      to = nowMs;
      bucket = 'hour';
      break;
    case '7d':
      from = todayStart - 6 * DAY;
      to = nowMs;
      bucket = 'day';
      break;
    case '28d':
      from = todayStart - 27 * DAY;
      to = nowMs;
      bucket = 'day';
      break;
    case '91d':
      from = todayStart - 90 * DAY;
      to = nowMs;
      bucket = 'day';
      break;
    case 'mtd': {
      const d = new Date(nowMs);
      from = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
      to = nowMs;
      bucket = 'day';
      break;
    }
    case 'last_month': {
      const d = new Date(nowMs);
      from = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1);
      to = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - 1;
      bucket = 'day';
      break;
    }
    case 'ytd': {
      const d = new Date(nowMs);
      from = Date.UTC(d.getUTCFullYear(), 0, 1);
      to = nowMs;
      bucket = nowMs - from > 95 * DAY ? 'month' : 'day';
      break;
    }
    case '12m': {
      const d = new Date(nowMs);
      from = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 11, 1);
      to = nowMs;
      bucket = 'month';
      break;
    }
    case 'all': {
      const d = new Date(nowMs);
      from = Date.UTC(d.getUTCFullYear() - 3, 0, 1);
      to = nowMs;
      bucket = 'month';
      break;
    }
    case 'custom': {
      const parsedFrom = customFrom ? Date.parse(customFrom) : NaN;
      const parsedTo = customTo ? Date.parse(customTo) : NaN;
      from = Number.isFinite(parsedFrom) ? parsedFrom : todayStart - 27 * DAY;
      to = Number.isFinite(parsedTo) ? parsedTo + DAY - 1 : nowMs;
      const span = to - from;
      if (span <= 2 * DAY) bucket = 'hour';
      else if (span > 120 * DAY) bucket = 'month';
      else bucket = 'day';
      break;
    }
    default:
      from = todayStart - 27 * DAY;
      to = nowMs;
      bucket = 'day';
  }

  const span = Math.max(HOUR, to - from);
  const prevTo = from - 1;
  const prevFrom = prevTo - span;

  return { from, to, prevFrom, prevTo, bucket };
}

export function buildBuckets(
  from: number,
  to: number,
  bucket: 'minute' | 'hour' | 'day' | 'month'
): Array<{ key: string; label: string }> {
  const result: Array<{ key: string; label: string }> = [];
  const d = new Date(from);

  if (bucket === 'minute') {
    let cursor = Math.floor(from / MINUTE) * MINUTE;
    while (cursor <= to) {
      const cur = new Date(cursor);
      const key = cur.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
      const label = cur.toISOString().slice(11, 16);
      result.push({ key, label });
      cursor += MINUTE;
    }
  } else if (bucket === 'hour') {
    let cursor = Math.floor(from / HOUR) * HOUR;
    while (cursor <= to) {
      const cur = new Date(cursor);
      const key = cur.toISOString().slice(0, 13); // YYYY-MM-DDTHH
      const label = `${cur.getUTCHours().toString().padStart(2, '0')}:00`;
      result.push({ key, label });
      cursor += HOUR;
    }
  } else if (bucket === 'day') {
    let cursor = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    while (cursor <= to) {
      const cur = new Date(cursor);
      const key = cur.toISOString().slice(0, 10); // YYYY-MM-DD
      const label = `${cur.getUTCDate()} ${months[cur.getUTCMonth()]}`;
      result.push({ key, label });
      cursor += DAY;
    }
  } else {
    let year = d.getUTCFullYear();
    let month = d.getUTCMonth();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    while (Date.UTC(year, month, 1) <= to) {
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      const label = `${months[month]} ${year}`;
      result.push({ key, label });
      month += 1;
      if (month === 12) {
        month = 0;
        year += 1;
      }
    }
  }

  return result;
}
