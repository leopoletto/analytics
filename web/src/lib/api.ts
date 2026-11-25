import type {
  AuthStatusResponse,
  BreakdownResponse,
  DashboardSummaryResponse,
  DatePreset,
  Filters,
  Site,
  SiteOverview,
} from '@leo/shared';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Request failed (${res.status})`);
  }

  return res.json() as Promise<T>;
}

function buildQuery(
  period: DatePreset,
  filters: Filters,
  extra?: Record<string, string | number | undefined>
): string {
  const params = new URLSearchParams();
  params.set('period', period);
  for (const [k, v] of Object.entries(filters)) {
    if (v) params.set(k, v);
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined && v !== '') params.set(k, String(v));
    }
  }
  return params.toString();
}

export const api = {
  authStatus: () => request<AuthStatusResponse>('/api/auth/status'),
  login: (email: string, password: string) =>
    request<{ user: { id: number; email: string } }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  listSites: () => request<{ sites: SiteOverview[] }>('/api/sites'),
  createSite: (domain: string, name?: string) =>
    request<{ site: Site }>('/api/sites', {
      method: 'POST',
      body: JSON.stringify({ domain, name }),
    }),
  deleteSite: (domain: string) =>
    request<{ ok: boolean }>(`/api/sites/${encodeURIComponent(domain)}`, {
      method: 'DELETE',
    }),

  summary: (
    domain: string,
    period: DatePreset,
    filters: Filters,
    customRange?: { from?: string; to?: string }
  ) =>
    request<DashboardSummaryResponse>(
      `/api/stats/${encodeURIComponent(domain)}/summary?${buildQuery(
        period,
        filters,
        customRange
      )}`
    ),

  live: (domain: string) =>
    request<{ liveVisitors: number }>(
      `/api/stats/${encodeURIComponent(domain)}/live`
    ),

  breakdown: (
    domain: string,
    type: string,
    period: DatePreset,
    filters: Filters,
    options?: { limit?: number; search?: string; from?: string; to?: string }
  ) =>
    request<BreakdownResponse>(
      `/api/stats/${encodeURIComponent(domain)}/breakdown/${type}?${buildQuery(
        period,
        filters,
        options
      )}`
    ),
};
