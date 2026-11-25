import { useEffect, useRef, useState } from 'react';
import { Calendar, Check, ChevronDown } from 'lucide-react';
import { DATE_PRESETS, type DatePreset } from '@leo/shared';

interface Props {
  value: DatePreset;
  customFrom: string;
  customTo: string;
  onChange: (preset: DatePreset, customFrom?: string, customTo?: string) => void;
}

export function DateRangePicker({ value, customFrom, customTo, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(value === 'custom');
  const [draftFrom, setDraftFrom] = useState(
    customFrom || new Date(Date.now() - 27 * 86400_000).toISOString().slice(0, 10)
  );
  const [draftTo, setDraftTo] = useState(
    customTo || new Date().toISOString().slice(0, 10)
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // Keyboard shortcuts when not focused in an input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }
      const key = e.key.toUpperCase();
      const matched = DATE_PRESETS.find((p) => p.shortcut === key);
      if (matched) {
        e.preventDefault();
        if (matched.id === 'custom') {
          setOpen(true);
          setShowCustom(true);
        } else {
          onChange(matched.id);
          setOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onChange]);

  const currentLabel =
    value === 'custom' && customFrom && customTo
      ? `${customFrom} – ${customTo}`
      : DATE_PRESETS.find((p) => p.id === value)?.label || 'Last 28 Days';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
          open
            ? 'border-indigo-500 bg-white text-zinc-900 ring-2 ring-indigo-500/15'
            : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:text-zinc-900'
        }`}
      >
        <Calendar className="h-4 w-4 text-zinc-500" />
        <span>{currentLabel}</span>
        <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-60 rounded-xl border border-zinc-200/90 bg-white py-1.5 shadow-lg shadow-zinc-900/5">
          {DATE_PRESETS.map((preset, idx) => {
            const prevGroup = idx > 0 ? DATE_PRESETS[idx - 1].group : preset.group;
            const showDivider = idx > 0 && preset.group !== prevGroup;
            const active = value === preset.id;

            return (
              <div key={preset.id}>
                {showDivider && <div className="my-1 border-t border-zinc-100" />}
                <button
                  type="button"
                  onClick={() => {
                    if (preset.id === 'custom') {
                      setShowCustom(true);
                    } else {
                      setShowCustom(false);
                      onChange(preset.id);
                      setOpen(false);
                    }
                  }}
                  className={`flex w-full items-center justify-between px-3.5 py-1.5 text-left text-sm transition-colors cursor-pointer ${
                    active
                      ? 'bg-zinc-100/90 font-medium text-zinc-950'
                      : 'text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950'
                  }`}
                >
                  <span>{preset.label}</span>
                  <span className="flex items-center gap-2">
                    {active && <Check className="h-3.5 w-3.5 text-indigo-600" />}
                    <kbd className="inline-flex h-5 w-5 items-center justify-center rounded border border-zinc-200 bg-zinc-50 text-[11px] font-medium text-zinc-500">
                      {preset.shortcut}
                    </kbd>
                  </span>
                </button>
              </div>
            );
          })}

          {showCustom && (
            <div className="mt-1.5 border-t border-zinc-100 px-3.5 pt-2.5 pb-2 space-y-2">
              <div className="grid grid-cols-1 gap-2">
                <label className="block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  From
                  <input
                    type="date"
                    value={draftFrom}
                    onChange={(e) => setDraftFrom(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-800"
                  />
                </label>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  To
                  <input
                    type="date"
                    value={draftTo}
                    onChange={(e) => setDraftTo(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-800"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => {
                  onChange('custom', draftFrom, draftTo);
                  setOpen(false);
                }}
                className="w-full rounded-lg bg-zinc-900 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 cursor-pointer"
              >
                Apply range
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
