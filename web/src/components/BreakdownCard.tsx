import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, Maximize2, Search, X } from 'lucide-react';
import type { BreakdownItem, DatePreset, Filters } from '@leo/shared';
import { api } from '../lib/api';
import { formatCompact } from '../lib/format';

export interface BreakdownTab {
  id: string;
  label: string;
  breakdownType?: string;
  columnLabel?: string;
  valueLabel?: string;
  subOptions?: Array<{ id: string; label: string; breakdownType: string }>;
}

interface Props {
  domain: string;
  period: DatePreset;
  customRange?: { from?: string; to?: string };
  filters: Filters;
  tabs: BreakdownTab[];
  activeTabId: string;
  onTabChange: (id: string) => void;
  barTone: 'indigo' | 'amber' | 'emerald';
  onRowClick?: (tabId: string, item: BreakdownItem) => void;
  renderLabel?: (tabId: string, item: BreakdownItem) => ReactNode;
  customContent?: ReactNode;
}

const TONE_CLASSES: Record<'indigo' | 'amber' | 'emerald', string> = {
  indigo: 'bg-indigo-50/90 group-hover:bg-indigo-100/80',
  amber: 'bg-amber-50/90 group-hover:bg-amber-100/75',
  emerald: 'bg-emerald-50/90 group-hover:bg-emerald-100/75',
};

export function BreakdownCard({
  domain,
  period,
  customRange,
  filters,
  tabs,
  activeTabId,
  onTabChange,
  barTone,
  onRowClick,
  renderLabel,
  customContent,
}: Props) {
  const [items, setItems] = useState<BreakdownItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [subMenuOpen, setSubMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [expandedItems, setExpandedItems] = useState<BreakdownItem[]>([]);
  const [search, setSearch] = useState('');

  // Resolve current tab (including sub-options like Campaigns -> utm_source/medium/campaign)
  let currentTab = tabs.find((t) => t.id === activeTabId);
  let activeSubOption: { id: string; label: string; breakdownType: string } | undefined;
  if (!currentTab) {
    for (const t of tabs) {
      const sub = t.subOptions?.find((s) => s.id === activeTabId);
      if (sub) {
        currentTab = t;
        activeSubOption = sub;
        break;
      }
    }
  }
  const breakdownType = activeSubOption?.breakdownType || currentTab?.breakdownType;

  useEffect(() => {
    if (!breakdownType || customContent) return;
    let cancelled = false;
    setLoading(true);
    api
      .breakdown(domain, breakdownType, period, filters, {
        limit: 9,
        ...(period === 'custom' ? customRange : {}),
      })
      .then((res) => {
        if (!cancelled) setItems(res.items);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [domain, breakdownType, period, JSON.stringify(filters), customRange?.from, customRange?.to, Boolean(customContent)]);

  useEffect(() => {
    if (!expanded || !breakdownType) return;
    let cancelled = false;
    api
      .breakdown(domain, breakdownType, period, filters, {
        limit: 100,
        search,
        ...(period === 'custom' ? customRange : {}),
      })
      .then((res) => {
        if (!cancelled) setExpandedItems(res.items);
      })
      .catch(() => {
        if (!cancelled) setExpandedItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, search, domain, breakdownType, period, JSON.stringify(filters), customRange?.from, customRange?.to]);

  const maxVal = items.length > 0 ? Math.max(...items.map((i) => i.visitors), 1) : 1;
  const maxExpanded =
    expandedItems.length > 0 ? Math.max(...expandedItems.map((i) => i.visitors), 1) : 1;

  return (
    <>
      <section className="flex flex-col rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs min-h-[410px]">
        {/* Card Tab Header */}
        <div className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-3">
          <div className="flex flex-wrap items-center gap-4">
            {tabs.map((tab) => {
              const isParentActive =
                tab.id === activeTabId ||
                Boolean(tab.subOptions?.some((s) => s.id === activeTabId));

              if (tab.subOptions) {
                const subLabel =
                  tab.subOptions.find((s) => s.id === activeTabId)?.label || tab.label;
                return (
                  <div key={tab.id} className="relative">
                    <button
                      type="button"
                      onClick={() => setSubMenuOpen((o) => !o)}
                      className={`relative inline-flex items-center gap-1 pb-3 -mb-[13px] text-xs font-semibold uppercase tracking-[0.06em] transition-colors cursor-pointer ${
                        isParentActive
                          ? 'text-zinc-950 border-b-2 border-zinc-900'
                          : 'text-zinc-500 hover:text-zinc-800'
                      }`}
                    >
                      <span>{subLabel}</span>
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    {subMenuOpen && (
                      <div className="absolute left-0 top-7 z-30 w-44 rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">
                        {tab.subOptions.map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => {
                              onTabChange(sub.id);
                              setSubMenuOpen(false);
                            }}
                            className={`block w-full px-3.5 py-1.5 text-left text-xs font-medium cursor-pointer ${
                              activeTabId === sub.id
                                ? 'bg-zinc-100 text-zinc-950'
                                : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950'
                            }`}
                          >
                            {sub.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={`pb-3 -mb-[13px] text-xs font-semibold uppercase tracking-[0.06em] transition-colors cursor-pointer ${
                    isParentActive
                      ? 'text-zinc-950 border-b-2 border-zinc-900'
                      : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {!customContent && (
            <button
              type="button"
              title="Expand details"
              onClick={() => {
                setSearch('');
                setExpanded(true);
              }}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors cursor-pointer"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Body */}
        {customContent ? (
          <div className="mt-3 flex-1">{customContent}</div>
        ) : (
          <div className="mt-3 flex-1 flex flex-col">
            <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400 pb-2 px-1">
              <span>{activeSubOption?.label || currentTab?.columnLabel || 'Item'}</span>
              <span>{currentTab?.valueLabel || 'Visitors'}</span>
            </div>

            {loading && items.length === 0 ? (
              <div className="space-y-2 py-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-8 rounded-lg bg-zinc-100/70 animate-pulse"
                    style={{ width: `${88 - i * 10}%` }}
                  />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">
                No data for this period
              </div>
            ) : (
              <div className="space-y-1.5">
                {items.map((item) => {
                  const widthPct = Math.max(4, Math.round((item.visitors / maxVal) * 100));
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => onRowClick?.(activeTabId, item)}
                      className="group relative flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors cursor-pointer"
                    >
                      <div
                        className={`absolute inset-y-0 left-0 rounded-lg transition-all ${TONE_CLASSES[barTone]}`}
                        style={{ width: `${widthPct}%` }}
                      />
                      <span className="relative z-10 flex items-center gap-2 truncate pr-4 font-medium text-zinc-800 group-hover:text-zinc-950">
                        {renderLabel ? renderLabel(activeTabId, item) : item.label}
                      </span>
                      <span className="relative z-10 shrink-0 font-medium text-zinc-900 tabular-nums">
                        {formatCompact(item.visitors)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Expand Modal */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4 backdrop-blur-[2px]"
          onClick={() => setExpanded(false)}
        >
          <div
            className="flex max-h-[82vh] w-full max-w-2xl flex-col rounded-2xl border border-zinc-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
              <h3 className="font-display text-2xl text-zinc-950">
                {activeSubOption?.label || currentTab?.label}
              </h3>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-zinc-100 px-6 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter results..."
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50/70 py-2 pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1.5">
              {expandedItems.map((item) => {
                const widthPct = Math.max(
                  3,
                  Math.round((item.visitors / maxExpanded) * 100)
                );
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      onRowClick?.(activeTabId, item);
                      setExpanded(false);
                    }}
                    className="group relative flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm cursor-pointer"
                  >
                    <div
                      className={`absolute inset-y-0 left-0 rounded-lg ${TONE_CLASSES[barTone]}`}
                      style={{ width: `${widthPct}%` }}
                    />
                    <span className="relative z-10 flex items-center gap-2 truncate pr-4 font-medium text-zinc-800">
                      {renderLabel ? renderLabel(activeTabId, item) : item.label}
                    </span>
                    <span className="relative z-10 shrink-0 font-medium text-zinc-900 tabular-nums">
                      {formatCompact(item.visitors)}
                      <span className="ml-2 text-xs text-zinc-400">
                        ({item.percentage}%)
                      </span>
                    </span>
                  </button>
                );
              })}
              {expandedItems.length === 0 && (
                <div className="py-12 text-center text-sm text-zinc-400">
                  No matching entries.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
