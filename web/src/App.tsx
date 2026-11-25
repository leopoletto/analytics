import { useCallback, useEffect, useState } from 'react';
import type { AuthStatusResponse, SiteOverview } from '@leo/shared';
import { api } from './lib/api';
import { AuthGate } from './pages/AuthGate';
import { SitesList } from './pages/SitesList';
import { Dashboard } from './pages/Dashboard';
import { AddSiteModal } from './components/SiteModal';

export function App() {
  const [auth, setAuth] = useState<AuthStatusResponse | null>(null);
  const [sites, setSites] = useState<SiteOverview[]>([]);
  const [activeDomain, setActiveDomain] = useState<string | null>(() => {
    const seg = decodeURIComponent(window.location.pathname.replace(/^\/+|\/+$/g, ''));
    return seg && seg !== 'sites' ? seg : null;
  });
  const [showAddModal, setShowAddModal] = useState(false);

  const loadAuth = useCallback(async () => {
    const status = await api.authStatus();
    setAuth(status);
    return status;
  }, []);

  const loadSites = useCallback(async () => {
    const res = await api.listSites();
    setSites(res.sites);
    return res.sites;
  }, []);

  useEffect(() => {
    loadAuth().then((status) => {
      if (status.authenticated) {
        loadSites();
      }
    });
  }, [loadAuth, loadSites]);

  useEffect(() => {
    const onPop = () => {
      const seg = decodeURIComponent(window.location.pathname.replace(/^\/+|\/+$/g, ''));
      setActiveDomain(seg && seg !== 'sites' ? seg : null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigateTo = (domain: string | null) => {
    setActiveDomain(domain);
    const url = domain ? `/${encodeURIComponent(domain)}` : '/sites';
    window.history.pushState({}, '', url);
  };

  if (!auth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafaf8] text-sm text-zinc-400">
        Loading Leo Analytics...
      </div>
    );
  }

  if (!auth.authenticated) {
    return (
      <AuthGate
        hasAdmin={auth.hasAdmin}
        onAuthenticated={async () => {
          await loadAuth();
          await loadSites();
        }}
      />
    );
  }

  const handleLogout = async () => {
    await api.logout();
    setSites([]);
    setActiveDomain(null);
    await loadAuth();
  };

  return (
    <>
      {activeDomain ? (
        <Dashboard
          domain={activeDomain}
          sites={sites}
          onSelectSite={(d) => navigateTo(d)}
          onGoToSites={() => {
            loadSites();
            navigateTo(null);
          }}
          onAddSite={() => setShowAddModal(true)}
          onSiteDeleted={async () => {
            await loadSites();
            navigateTo(null);
          }}
          onLogout={handleLogout}
        />
      ) : (
        <SitesList
          sites={sites}
          userEmail={auth.user?.email || ''}
          onSelectSite={(d) => navigateTo(d)}
          onAddSite={() => setShowAddModal(true)}
          onLogout={handleLogout}
        />
      )}

      {showAddModal && (
        <AddSiteModal
          onClose={() => setShowAddModal(false)}
          onCreated={async (site) => {
            await loadSites();
            navigateTo(site.domain);
          }}
        />
      )}
    </>
  );
}
