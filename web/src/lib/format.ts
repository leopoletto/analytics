export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}k`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export function formatMetricValue(
  key: 'visitors' | 'visits' | 'pageviews' | 'viewsPerVisit' | 'bounceRate' | 'visitDuration',
  value: number
): string {
  switch (key) {
    case 'viewsPerVisit':
      return value.toFixed(2);
    case 'bounceRate':
      return `${Math.round(value)}%`;
    case 'visitDuration':
      return formatDuration(value);
    default:
      return formatCompact(value);
  }
}

const regionDisplay =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null;

export function countryName(code: string): string {
  if (!code || code === '(not set)' || code.length !== 2) return code || '(not set)';
  try {
    return regionDisplay?.of(code.toUpperCase()) || code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

export function countryFlag(code: string): string {
  if (!code || code.length !== 2 || code === '(not set)') return '🌐';
  const upper = code.toUpperCase();
  return String.fromCodePoint(
    0x1f1e6 + upper.charCodeAt(0) - 65,
    0x1f1e6 + upper.charCodeAt(1) - 65
  );
}
