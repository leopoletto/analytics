import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { KpiSummary, MetricKey, TimeSeriesPoint } from '@leo/shared';
import { formatCompact, formatDuration, formatMetricValue } from '../lib/format';

interface Props {
  kpis: KpiSummary;
  series: TimeSeriesPoint[];
  activeMetric: MetricKey;
  onSelectMetric: (m: MetricKey) => void;
  loading?: boolean;
}

const KPI_DEFS: Array<{
  key: MetricKey;
  label: string;
  invertDelta?: boolean;
}> = [
  { key: 'visitors', label: 'Unique Visitors' },
  { key: 'visits', label: 'Total Visits' },
  { key: 'pageviews', label: 'Total Pageviews' },
  { key: 'viewsPerVisit', label: 'Views per Visit' },
  { key: 'bounceRate', label: 'Bounce Rate', invertDelta: true },
  { key: 'visitDuration', label: 'Visit Duration' },
];

export function MetricChartCard({
  kpis,
  series,
  activeMetric,
  onSelectMetric,
  loading,
}: Props) {
  const formatYAxis = (v: number) => {
    if (activeMetric === 'visitDuration') return formatDuration(v);
    if (activeMetric === 'bounceRate') return `${v}%`;
    if (activeMetric === 'viewsPerVisit') return v.toFixed(1);
    return formatCompact(v);
  };

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white shadow-xs overflow-hidden">
      {/* 6 KPI Metric Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border-b border-zinc-100 p-2 gap-1">
        {KPI_DEFS.map((def, idx) => {
          const item = kpis[def.key];
          const isActive = activeMetric === def.key;
          const change = item.change;
          const isPositive =
            change !== null && (def.invertDelta ? change <= 0 : change >= 0);

          return (
            <button
              key={def.key}
              type="button"
              onClick={() => onSelectMetric(def.key)}
              className={`group relative rounded-xl px-4 py-3 text-left transition-all cursor-pointer ${
                isActive
                  ? 'bg-zinc-100/85 ring-1 ring-zinc-200/80'
                  : 'hover:bg-zinc-50'
              }`}
            >
              {idx > 0 && !isActive && (
                <span className="hidden lg:block absolute left-0 top-3 bottom-3 w-px bg-zinc-100" />
              )}
              <div
                className={`text-[11px] font-semibold uppercase tracking-[0.06em] ${
                  isActive ? 'text-zinc-900' : 'text-zinc-500 group-hover:text-zinc-700'
                }`}
              >
                {def.label}
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="font-display text-[30px] leading-none text-zinc-950 tabular-nums">
                  {formatMetricValue(def.key, item.value)}
                </span>
                {change !== null && (
                  <span
                    className={`inline-flex items-center gap-0.5 text-xs font-medium tabular-nums ${
                      isPositive ? 'text-emerald-600' : 'text-rose-500'
                    }`}
                  >
                    {change >= 0 ? (
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowDownRight className="h-3.5 w-3.5" />
                    )}
                    {Math.abs(change)}%
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Time-Series Area Chart */}
      <div className={`px-4 pt-6 pb-4 transition-opacity ${loading ? 'opacity-50' : 'opacity-100'}`}>
        <div className="h-[310px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="leoChartFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#f4f4f5" strokeDasharray="0" />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#71717a', fontSize: 12 }}
                minTickGap={36}
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#71717a', fontSize: 12 }}
                tickFormatter={formatYAxis}
                width={52}
              />
              <Tooltip
                cursor={{ stroke: '#d4d4d8', strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const point = payload[0].payload as TimeSeriesPoint;
                  const activeDef = KPI_DEFS.find((d) => d.key === activeMetric)!;
                  return (
                    <div className="rounded-xl border border-zinc-200 bg-zinc-950 px-3.5 py-2.5 text-white shadow-xl">
                      <div className="text-[11px] font-medium text-zinc-400">
                        {point.label}
                      </div>
                      <div className="mt-1 flex items-baseline justify-between gap-5">
                        <span className="text-xs text-zinc-300">{activeDef.label}</span>
                        <span className="font-display text-xl leading-none tabular-nums">
                          {formatMetricValue(activeMetric, point[activeMetric])}
                        </span>
                      </div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey={activeMetric}
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#leoChartFill)"
                activeDot={{ r: 4.5, fill: '#4f46e5', stroke: '#ffffff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
