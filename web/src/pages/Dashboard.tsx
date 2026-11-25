import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Code2,
  Filter,
  Globe,
  Laptop,
  LayoutGrid,
  Link2,
  LogOut,
  Plus,
  Smartphone,
  Tablet,
  X,
} from 'lucide-react';
import type {
  BreakdownItem,
  DashboardSummaryResponse,
  DatePreset,
  FilterKey,
  Filters,
  MetricKey,
  SiteOverview,
} from '@leo/shared';
import { api } from '../lib/api';
import { countryFlag, countryName } from '../lib/format';
import { DateRangePicker } from '../components/DateRangePicker';
import { MetricChartCard } from '../components/MetricChartCard';
import { BreakdownCard, type BreakdownTab } from '../components/BreakdownCard';
import { WorldMap } from '../components/WorldMap';
import { SiteSnippetModal } from '../components/SiteModal';

interface Props {
  domain: string;
  sites: SiteOverview[];
  onSelectSite: (domain: string) => void;
  onGoToSites: () => void;
  onAddSite: () => void;
  onSiteDeleted: () => void;
  onLogout: () => void;
}

const SOURCE_TABS: BreakdownTab[] = [
  { id: 'channels', label: 'Channels', breakdownType: 'channels', columnLabel: 'Channel', valueLabel: 'Visitors' },
  { id: 'sources', label: 'Sources', breakdownType: 'sources', columnLabel: 'Source', valueLabel: 'Visitors' },
  {
    id: 'campaigns',
    label: 'Campaigns',
    subOptions: [
      { id: 'utm_campaign', label: 'UTM Campaign', breakdownType: 'utm_campaign' },
      { id: 'utm_source', label: 'UTM Source', breakdownType: 'utm_source' },
      { id: 'utm_medium', label: 'UTM Medium', breakdownType: 'utm_medium' },
    ],
  },
];

const PAGE_TABS: BreakdownTab[] = [
  { id: 'pages', label: 'Top Pages', breakdownType: 'pages', columnLabel: 'Page', valueLabel: 'Visitors' },
  { id: 'entry_pages', label: 'Entry Pages', breakdownType: 'entry_pages', columnLabel: 'Entry page', valueLabel: 'Unique entrances' },
  { id: 'exit_pages', label: 'Exit Pages', breakdownType: 'exit_pages', columnLabel: 'Exit page', valueLabel: 'Unique exits' },
];

const LOCATION_TABS: BreakdownTab[] = [
  { id: 'map', label: 'Map' },
  { id: 'countries', label: 'Countries', breakdownType: 'countries', columnLabel: 'Country', valueLabel: 'Visitors' },
];

const TECH_TABS: BreakdownTab[] = [
  { id: 'browsers', label: 'Browsers', breakdownType: 'browsers', columnLabel: 'Browser', valueLabel: 'Visitors' },
  { id: 'os', label: 'Operating Systems', breakdownType: 'os', columnLabel: 'Operating system', valueLabel: 'Visitors' },
  { id: 'devices', label: 'Devices', breakdownType: 'devices', columnLabel: 'Device', valueLabel: 'Visitors' },
];

const FILTER_LABELS: Record<FilterKey, string> = {
  channel: 'Channel',
  source: 'Source',
  utmSource: 'UTM Source',
  utmMedium: 'UTM Medium',
  utmCampaign: 'UTM Campaign',
  page: 'Page',
  entryPage: 'Entry Page',
  exitPage: 'Exit Page',
  country: 'Country',
  browser: 'Browser',
  os: 'OS',
  device: 'Device',
};

export function Dashboard({
  domain,
  sites,
  onSelectSite,
  onGoToSites,
  onAddSite,
  onSiteDeleted,
  onLogout,
}: Props) {
  const [period, setPeriod] = useState<DatePreset>('28d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [filters, setFilters] = useState<Filters>({});
  const [activeMetric, setActiveMetric] = useState<MetricKey>('visitors');

  const [sourceTab, setSourceTab] = useState('sources');
  const [pageTab, setPageTab] = useState('pages');
  const [locationTab, setLocationTab] = useState('map');
  const [techTab, setTechTab] = useState('browsers');

  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [liveVisitors, setLiveVisitors] = useState<number>(0);
  const [mapCountries, setMapCountries] = useState<BreakdownItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [siteMenuOpen, setSiteMenuOpen] = useState(false);
  const [showSnippet, setShowSnippet] = useState(false);
  const siteMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (siteMenuRef.current && !siteMenuRef.current.contains(e.target as Node)) {
        setSiteMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // Reset filters when switching domain
  useEffect(() => {
    setFilters({});
  }, [domain]);

  const customRange = period === 'custom' ? { from: customFrom, to: customTo } : undefined;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.summary(domain, period, filters, customRange),
      api.breakdown(domain, 'countries', period, filters, {
        limit: 200,
        ...(customRange || {}),
      }),
    ])
      .then(([sumRes, countryRes]) => {
        if (cancelled) return;
        setSummary(sumRes);
        setLiveVisitors(sumRes.liveVisitors);
        setMapCountries(countryRes.items);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [domain, period, customFrom, customTo, JSON.stringify(filters)]);

  // Poll live visitors every 15s
  useEffect(() => {
    const timer = setInterval(() => {
      api
        .live(domain)
        .then((res) => setLiveVisitors(res.liveVisitors))
        .catch(() => {});
    }, 15_000);
    return () => clearInterval(timer);
  }, [domain]);

  const handleDateChange = useCallback(
    (next: DatePreset, from?: string, to?: string) => {
      setPeriod(next);
      if (from) setCustomFrom(from);
      if (to) setCustomTo(to);
    },
    []
  );

  const toggleFilter = (key: FilterKey, value: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (next[key] === value) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  };

  const activeFilterEntries = Object.entries(filters) as Array<[FilterKey, string]>;

  return (
    <div className="min-h-screen bg-[#fafaf8] pb-16">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-zinc-200/70 bg-[#fafaf8]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5">
          {/* Left: Site Switcher + Live Visitors */}
          <div className="flex items-center gap-4">
            <div ref={siteMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setSiteMenuOpen((o) => !o)}
                className="inline-flex items-center gap-2.5 rounded-xl px-2 py-1 hover:bg-zinc-200/50 transition-colors cursor-pointer"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-display text-base">
                  L
                </span>
                <span className="font-display text-2xl leading-none text-zinc-950">
                  {domain}
                </span>
                <ChevronDown className="h-4 w-4 text-zinc-400" />
              </button>

              {siteMenuOpen && (
                <div className="absolute left-0 z-40 mt-2 w-64 rounded-xl border border-zinc-200 bg-white py-1.5 shadow-xl">
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    Leo Analytics · Websites
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {sites.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          onSelectSite(s.domain);
                          setSiteMenuOpen(false);
                        }}
                        className={`flex w-full items-center justify-between px-3.5 py-2 text-left text-sm cursor-pointer ${
                          s.domain === domain
                            ? 'bg-zinc-100 font-medium text-zinc-950'
                            : 'text-zinc-700 hover:bg-zinc-50'
                        }`}
                      >
                        <span className="truncate">{s.domain}</span>
                        {s.liveVisitors > 0 && (
                          <span className="ml-2 text-xs text-emerald-600 tabular-nums">
                            {s.liveVisitors} live
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="my-1 border-t border-zinc-100" />
                  <button
                    type="button"
                    onClick={() => {
                      setSiteMenuOpen(false);
                      onAddSite();
                    }}
                    className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm font-medium text-indigo-600 hover:bg-indigo-50/60 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    Add Website
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSiteMenuOpen(false);
                      onGoToSites();
                    }}
                    className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                  >
                    <LayoutGrid className="h-4 w-4" />
                    All Websites
                  </button>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setPeriod('realtime')}
              className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
              title="Switch to Realtime view"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-live-dot" />
              <span className="tabular-nums">
                {liveVisitors} current {liveVisitors === 1 ? 'visitor' : 'visitors'}
              </span>
            </button>
          </div>

          {/* Right: Filter hint, Date Range Picker, Snippet */}
          <div className="flex items-center gap-2">
            {activeFilterEntries.length > 0 && (
              <button
                type="button"
                onClick={() => setFilters({})}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 cursor-pointer"
              >
                <Filter className="h-3.5 w-3.5" />
                Clear {activeFilterEntries.length}
              </button>
            )}

            <DateRangePicker
              value={period}
              customFrom={customFrom}
              customTo={customTo}
              onChange={handleDateChange}
            />

            <button
              type="button"
              onClick={() => setShowSnippet(true)}
              title="Tracking snippet & site settings"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 cursor-pointer"
            >
              <Code2 className="h-4 w-4" />
              <span className="hidden md:inline text-xs font-medium">Snippet</span>
            </button>
          </div>
        </div>

        {/* Active Filter Chips */}
        {activeFilterEntries.length > 0 && (
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 sm:px-6 pb-3">
            {activeFilterEntries.map(([key, value]) => (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-700 shadow-2xs"
              >
                <span className="text-zinc-400">{FILTER_LABELS[key]}:</span>
                <span className="font-medium text-zinc-950">
                  {key === 'country' ? `${countryFlag(value)} ${countryName(value)}` : value}
                </span>
                <button
                  type="button"
                  onClick={() => toggleFilter(key, value)}
                  className="ml-0.5 rounded-full p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-6 space-y-6">
        {/* Hero KPIs + Time Series Chart */}
        {summary ? (
          <MetricChartCard
            kpis={summary.kpis}
            series={summary.series}
            activeMetric={activeMetric}
            onSelectMetric={setActiveMetric}
            loading={loading}
          />
        ) : (
          <div className="h-[420px] rounded-2xl border border-zinc-200/80 bg-white animate-pulse" />
        )}

        {/* 2x2 Breakdown Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* 1. Traffic Sources */}
          <BreakdownCard
            domain={domain}
            period={period}
            customRange={customRange}
            filters={filters}
            tabs={SOURCE_TABS}
            activeTabId={sourceTab}
            onTabChange={setSourceTab}
            barTone="indigo"
            onRowClick={(tabId, item) => {
              if (tabId === 'channels') toggleFilter('channel', item.key);
              else if (tabId === 'sources') toggleFilter('source', item.key);
              else if (tabId === 'utm_source') toggleFilter('utmSource', item.key);
              else if (tabId === 'utm_medium') toggleFilter('utmMedium', item.key);
              else if (tabId === 'utm_campaign') toggleFilter('utmCampaign', item.key);
            }}
            renderLabel={(tabId, item) => (
              <>
                {tabId === 'sources' && (
                  <Link2 className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                )}
                <span className="truncate">{item.label}</span>
              </>
            )}
          />

          {/* 2. Top / Entry / Exit Pages */}
          <BreakdownCard
            domain={domain}
            period={period}
            customRange={customRange}
            filters={filters}
            tabs={PAGE_TABS}
            activeTabId={pageTab}
            onTabChange={setPageTab}
            barTone="amber"
            onRowClick={(tabId, item) => {
              if (tabId === 'pages') toggleFilter('page', item.key);
              else if (tabId === 'entry_pages') toggleFilter('entryPage', item.key);
              else if (tabId === 'exit_pages') toggleFilter('exitPage', item.key);
            }}
          />

          {/* 3. Locations (Map + Countries) */}
          <BreakdownCard
            domain={domain}
            period={period}
            customRange={customRange}
            filters={filters}
            tabs={LOCATION_TABS}
            activeTabId={locationTab}
            onTabChange={setLocationTab}
            barTone="amber"
            customContent={
              locationTab === 'map' ? (
                <WorldMap
                  countries={mapCountries}
                  onSelectCountry={(code) => toggleFilter('country', code)}
                />
              ) : undefined
            }
            onRowClick={(_tabId, item) => toggleFilter('country', item.key)}
            renderLabel={(_tabId, item) => (
              <>
                <span className="text-base leading-none">{countryFlag(item.key)}</span>
                <span className="truncate">{countryName(item.key)}</span>
              </>
            )}
          />

          {/* 4. Technology (Browsers, OS, Devices) */}
          <BreakdownCard
            domain={domain}
            period={period}
            customRange={customRange}
            filters={filters}
            tabs={TECH_TABS}
            activeTabId={techTab}
            onTabChange={setTechTab}
            barTone="emerald"
            onRowClick={(tabId, item) => {
              if (tabId === 'browsers') toggleFilter('browser', item.key);
              else if (tabId === 'os') toggleFilter('os', item.key);
              else if (tabId === 'devices') toggleFilter('device', item.key);
            }}
            renderLabel={(tabId, item) => (
              <>
                {tabId === 'devices' ? (
                  item.key === 'Mobile' ? (
                    <Smartphone className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                  ) : item.key === 'Tablet' ? (
                    <Tablet className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                  ) : (
                    <Laptop className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                  )
                ) : (
                  <Globe className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                )}
                <span className="truncate">{item.label}</span>
              </>
            )}
          />
        </div>
      </main>

      {showSnippet && summary && (
        <SiteSnippetModal
          site={summary.site}
          onClose={() => setShowSnippet(false)}
          onDeleted={onSiteDeleted}
        />
      )}
    </div>
  );
}
