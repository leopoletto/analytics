export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'realtime'
  | '24h'
  | '7d'
  | '28d'
  | '91d'
  | 'mtd'
  | 'last_month'
  | 'ytd'
  | '12m'
  | 'all'
  | 'custom';

export type MetricKey =
  | 'visitors'
  | 'visits'
  | 'pageviews'
  | 'viewsPerVisit'
  | 'bounceRate'
  | 'visitDuration';

export type FilterKey =
  | 'channel'
  | 'source'
  | 'utmSource'
  | 'utmMedium'
  | 'utmCampaign'
  | 'page'
  | 'entryPage'
  | 'exitPage'
  | 'country'
  | 'browser'
  | 'os'
  | 'device';

export type Filters = Partial<Record<FilterKey, string>>;

export interface Site {
  id: number;
  domain: string;
  name: string;
  timezone: string;
  createdAt: number;
}

export interface SiteOverview extends Site {
  liveVisitors: number;
  visitors24h: number;
  pageviews24h: number;
  sparkline: number[];
}

export interface KpiValue {
  value: number;
  change: number | null; // percentage delta vs previous period
}

export interface KpiSummary {
  visitors: KpiValue;
  visits: KpiValue;
  pageviews: KpiValue;
  viewsPerVisit: KpiValue;
  bounceRate: KpiValue;
  visitDuration: KpiValue;
}

export interface TimeSeriesPoint {
  date: string; // ISO or formatted bucket label
  label: string; // Display label for X axis
  visitors: number;
  visits: number;
  pageviews: number;
  viewsPerVisit: number;
  bounceRate: number;
  visitDuration: number;
}

export interface BreakdownItem {
  key: string;
  label: string;
  visitors: number;
  percentage: number;
  secondary?: number; // e.g., pageviews or bounce rate
}

export interface BreakdownResponse {
  items: BreakdownItem[];
  total: number;
}

export interface DashboardSummaryResponse {
  site: Site;
  liveVisitors: number;
  range: {
    from: number;
    to: number;
    bucket: 'minute' | 'hour' | 'day' | 'month';
  };
  kpis: KpiSummary;
  series: TimeSeriesPoint[];
}

export interface AuthStatusResponse {
  hasAdmin: boolean;
  authenticated: boolean;
  user: { id: number; email: string } | null;
}

export const DATE_PRESETS: Array<{
  id: DatePreset;
  label: string;
  shortcut: string;
  group: number;
}> = [
  { id: 'today', label: 'Today', shortcut: 'D', group: 0 },
  { id: 'yesterday', label: 'Yesterday', shortcut: 'E', group: 0 },
  { id: 'realtime', label: 'Realtime', shortcut: 'R', group: 0 },
  { id: '24h', label: 'Last 24 Hours', shortcut: 'H', group: 1 },
  { id: '7d', label: 'Last 7 Days', shortcut: 'W', group: 1 },
  { id: '28d', label: 'Last 28 Days', shortcut: 'F', group: 1 },
  { id: '91d', label: 'Last 91 Days', shortcut: 'N', group: 1 },
  { id: 'mtd', label: 'Month to Date', shortcut: 'M', group: 2 },
  { id: 'last_month', label: 'Last Month', shortcut: 'P', group: 2 },
  { id: 'ytd', label: 'Year to Date', shortcut: 'Y', group: 3 },
  { id: '12m', label: 'Last 12 Months', shortcut: 'L', group: 3 },
  { id: 'all', label: 'All Time', shortcut: 'A', group: 4 },
  { id: 'custom', label: 'Custom Range', shortcut: 'C', group: 4 },
];
