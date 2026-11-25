import { useState } from 'react';
import { Check, Copy, Globe, Trash2, X } from 'lucide-react';
import type { Site } from '@leo/shared';
import { api } from '../lib/api';

interface AddSiteModalProps {
  onClose: () => void;
  onCreated: (site: Site) => void;
}

export function AddSiteModal({ onClose, onCreated }: AddSiteModalProps) {
  const [domain, setDomain] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [createdSite, setCreatedSite] = useState<Site | null>(null);
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://analytics.yourdomain.com';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await api.createSite(domain, name || undefined);
      setCreatedSite(res.site);
      onCreated(res.site);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register website.');
    } finally {
      setSaving(false);
    }
  }

  const snippet = createdSite
    ? `<script defer data-domain="${createdSite.domain}" src="${origin}/js/script.js"></script>`
    : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-3xl text-zinc-950">
            {createdSite ? 'Install Tracking Script' : 'Add Website'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {createdSite ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-zinc-600">
              Paste this snippet inside the <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">&lt;head&gt;</code> tag of{' '}
              <strong className="text-zinc-900">{createdSite.domain}</strong>. No cookies, no consent banner required.
            </p>
            <div className="relative rounded-xl border border-zinc-200 bg-zinc-950 p-4 font-mono text-xs text-zinc-100 overflow-x-auto">
              <code>{snippet}</code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(snippet);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 font-sans text-xs font-medium text-white hover:bg-white/20 cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy snippet'}
              </button>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 cursor-pointer"
              >
                Open Dashboard
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Domain
              </label>
              <div className="relative mt-1.5">
                <Globe className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  required
                  placeholder="example.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 py-2 pl-9 pr-3 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Display Name <span className="text-zinc-400 normal-case">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="My Portfolio"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Adding...' : 'Add Website'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

interface SiteSnippetModalProps {
  site: Site;
  onClose: () => void;
  onDeleted: () => void;
}

export function SiteSnippetModal({ site, onClose, onDeleted }: SiteSnippetModalProps) {
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://analytics.yourdomain.com';
  const snippet = `<script defer data-domain="${site.domain}" src="${origin}/js/script.js"></script>`;

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.deleteSite(site.domain);
      onDeleted();
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-3xl text-zinc-950">{site.domain}</h2>
            <p className="text-xs text-zinc-500">Tracking snippet & site settings</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
            Embed Snippet
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-950 p-4 font-mono text-xs text-zinc-100 overflow-x-auto">
            <code>{snippet}</code>
            <div className="mt-3">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(snippet);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 font-sans text-xs font-medium text-white hover:bg-white/20 cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy snippet'}
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-100 pt-4 flex items-center justify-between">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete website & data
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-rose-600 font-medium">Permanently delete?</span>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="rounded-md bg-rose-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-700 cursor-pointer"
              >
                {deleting ? 'Deleting...' : 'Confirm'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-zinc-500 hover:text-zinc-800 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
