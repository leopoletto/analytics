import { Globe, LogOut, Plus } from 'lucide-react';
import type { SiteOverview } from '@leo/shared';
import { formatCompact } from '../lib/format';

interface Props {
  sites: SiteOverview[];
  userEmail: string;
  onSelectSite: (domain: string) => void;
  onAddSite: () => void;
  onLogout: () => void;
}

function MiniSparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const w = 110;
  const h = 32;
  const points = data
    .map((v, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * w;
      const y = h - (v / max) * (h - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-28 overflow-visible">
      <polyline
        fill="none"
        stroke="#6366f1"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export function SitesList({
  sites,
  userEmail,
  onSelectSite,
  onAddSite,
  onLogout,
}: Props) {
  return (
    <div className="min-h-screen bg-[#fafaf8]">
      <header className="border-b border-zinc-200/70 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-display text-lg">
              L
            </div>
            <span className="font-display text-2xl text-zinc-950">Leo Analytics</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-zinc-500">{userEmail}</span>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl text-zinc-950">Your Websites</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Cookieless, fingerprint-free analytics across all your registered domains.
            </p>
          </div>
          <button
            type="button"
            onClick={onAddSite}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add Website
          </button>
        </div>

        {sites.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-zinc-300 bg-white p-14 text-center">
            <Globe className="mx-auto h-10 w-10 text-zinc-300" />
            <h2 className="mt-4 font-display text-2xl text-zinc-900">No websites yet</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Register your first domain to generate your lightweight tracking script.
            </p>
            <button
              type="button"
              onClick={onAddSite}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Add Website
            </button>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sites.map((site) => (
              <button
                key={site.id}
                type="button"
                onClick={() => onSelectSite(site.domain)}
                className="group flex flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white p-5 text-left shadow-xs transition-all hover:border-zinc-300 hover:shadow-md cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs font-semibold text-zinc-700 group-hover:bg-indigo-50 group-hover:text-indigo-700">
                        {site.domain.charAt(0).toUpperCase()}
                      </span>
                      <span className="truncate font-display text-2xl text-zinc-950">
                        {site.domain}
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-live-dot" />
                    {site.liveVisitors} live
                  </span>
                </div>

                <div className="mt-6 flex items-end justify-between gap-4">
                  <div>
                    <div className="font-display text-3xl leading-none text-zinc-950 tabular-nums">
                      {formatCompact(site.visitors24h)}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      visitors in last 24h · {formatCompact(site.pageviews24h)} views
                    </div>
                  </div>
                  <MiniSparkline data={site.sparkline} />
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
