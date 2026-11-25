import { useState } from 'react';
import { Lock, Terminal } from 'lucide-react';
import { api } from '../lib/api';

interface Props {
  hasAdmin: boolean;
  onAuthenticated: () => void;
}

export function AuthGate({ hasAdmin, onAuthenticated }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.login(email, password);
      onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#fafaf8] px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200/90 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white font-display text-xl">
            L
          </div>
          <span className="font-display text-3xl text-zinc-950">Leo Analytics</span>
        </div>

        {!hasAdmin ? (
          <div className="mt-6 space-y-4">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 border border-amber-200/70">
              <Lock className="h-3.5 w-3.5" />
              Dashboard locked — setup required
            </div>
            <p className="text-sm leading-relaxed text-zinc-600">
              No administrator account has been created yet. To unlock your dashboard locally or on your server over SSH, run:
            </p>
            <div className="flex items-center gap-2.5 rounded-xl bg-zinc-950 px-4 py-3 font-mono text-xs text-zinc-100">
              <Terminal className="h-4 w-4 shrink-0 text-indigo-400" />
              <code>pnpm create-admin</code>
            </div>
            <p className="text-xs text-zinc-400">
              Once created, refresh this page to sign in.
            </p>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <p className="text-sm text-zinc-500">
              Sign in to access your cookieless analytics dashboard.
            </p>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Email
              </label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                className="mt-1.5 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1.5 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-zinc-950 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
